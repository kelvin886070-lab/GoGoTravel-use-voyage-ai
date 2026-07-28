// src/services/timeline.ts
import type { TripDay, Activity } from '../types';
import { newActivityId } from '../utils/activityId';
import { rebuildConnectorsInList } from './reconcile/autoRoute';

/**
 * 將 "HH:MM" 字串轉換為分鐘數 (從 00:00 開始計算)
 */
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

/**
 * 將分鐘數轉換回 "HH:MM" 格式
 */
const minutesToTime = (totalMinutes: number): string => {
    // 🧱 F4：跨午夜不再 wrap 成 00:50——保留 >=24h（如 24:50、25:30），與 reconcile 分鐘制一致。
    //   顯示層（ActivityItem）負責 wrap 成隔日 HH:MM ＋ 掛小月亮。這樣月亮偵測（>=24:00）才觸發得到。
    const mins = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * 解析自然語言的時間長度，例如 "1 h 30 min", "45 min"
 */
const parseDurationString = (durationStr?: string): number => {
    if (!durationStr) return 0;
    let total = 0;
    
    const hMatch = durationStr.match(/(\d+)\s*(h|hr|hour)/i);
    const mMatch = durationStr.match(/(\d+)\s*(m|min|minute)/i);

    if (hMatch) total += parseInt(hMatch[1], 10) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);

    if (!hMatch && !mMatch && /^\d+$/.test(durationStr.trim())) {
        total += parseInt(durationStr, 10);
    }

    return total;
};

/**
 * 判斷是否為「定點活動」 (Stay Activity)
 * 這些活動之間如果沒有交通，就需要插入移動卡片
 */
const isStayActivity = (type: string): boolean => {
    const stayTypes = ['sightseeing', 'food', 'cafe', 'shopping', 'relax', 'bar', 'culture', 'activity', 'hotel', 'other'];
    return stayTypes.includes(type);
};

/**
 * 檢查並填補缺失的移動卡片 (Gap Filling)
 * 如果 Act A 和 Act B 都是定點活動，中間自動插入 "移動 (預估 15 min)"
 */
const ensureGapConnectors = (activities: Activity[]): Activity[] => {
    if (activities.length < 2) return activities;
    
    const result: Activity[] = [];
    
    for (let i = 0; i < activities.length; i++) {
        const current = activities[i];
        result.push(current);

        // 如果還有下一個活動
        if (i < activities.length - 1) {
            const next = activities[i + 1];
            
            // 邏輯：當前是定點 && 下一個也是定點 -> 插入移動
            if (isStayActivity(current.type) && isStayActivity(next.type)) {
                result.push({
                    time: current.time, // 暫時時間，稍後會被重算
                    title: '移動 (預估)',
                    description: '系統自動填補，點擊可修改',
                    type: 'transport',
                    source: 'generated',  // 🛣️ C1：標記為系統自動連接卡（可被 stripAutoConnectors 冪等清除）
                    location: '',
                    cost: 0,
                    transportDetail: {
                        mode: 'walk',
                        duration: '15 min',
                        instruction: '前往下個地點'
                    }
                });
            }
        }
    }
    return result;
};

// 🧱 F3：已退休 `ensureArrivalProcess`（自動插「入境審查」）。
//   它每次 recalc 都在首張 flight 後硬插一張入境卡，與真訂位的抵達錨打架（購物排在入境前、重複抵達序列）。
//   抵達＝單一真相，只由訂位錨（或生成的抵達卡）承擔；不再自動插入境 preamble。

/**
 * 核心函式：重新計算當天的所有活動時間
 */
export const recalculateTimeline = (day: TripDay): TripDay => {
    let activities = JSON.parse(JSON.stringify(day.activities)) as Activity[];
    
    if (activities.length === 0) return day;

    // 🧱 F3：入境自動插入已退休（見上）。
    // 🛣️ C4：改用 rebuildConnectorsInList——冪等 strip 舊自動連接卡＋依相鄰定點重生（有座標則路由估算、否則沿用 15 分預設）。
    //   這讓「編輯即自動接路」全站生效（所有編輯都經 recalculateTimeline）；連接卡不殘留、不重複。
    activities = rebuildConnectorsInList(activities);

    // 3. 設定起始時間錨點
    let currentClock = timeToMinutes(activities[0].time);

    for (let i = 0; i < activities.length; i++) {
        const act = activities[i];

        // 🧱 F1：確保每張卡（含自動插入的入境/移動卡）都有穩定 id
        if (!act.id) act.id = newActivityId();

        // 🧱 F2：改為「尊重明確時間」語義（與 reconcile 一致）——
        //   首張錨定；後續若自身時間不早於目前時鐘就保留（使用者手動編的時間會存活），
        //   只有會往前重疊時才推到時鐘。連接卡（時間＝前一張，必早於時鐘）自然往後流動。
        if (i === 0) {
            currentClock = timeToMinutes(act.time);
        } else {
            const explicit = timeToMinutes(act.time);
            const t = explicit >= currentClock ? explicit : currentClock;
            act.time = minutesToTime(t);
            currentClock = t;
        }

        // 4. 計算此活動的持續時間
        let duration = 60; // 預設

        if (act.type === 'note' || act.type === 'expense') {
            duration = 0;
        } else if (act.type === 'flight') {
            duration = 0; // 航班本身不佔用時間軸，耗時由 process 承擔
        } else if (act.type === 'process') {
            duration = parseDurationString(act.transportDetail?.duration || '60 min');
        } else if (act.type === 'transport') {
            // 🛣️ C4：優先用 durationMin（接路估算/精算的來源）；退回解析字串；再退回預設 15
            duration = act.durationMin ?? parseDurationString(act.transportDetail?.duration);
            if (!duration || duration <= 0) duration = 15;
        } else {
            switch (act.type) {
                case 'food': duration = 60; break;
                case 'cafe': duration = 45; break;
                case 'sightseeing': duration = 90; break;
                case 'shopping': duration = 120; break;
                case 'relax': duration = 60; break;
                case 'hotel': duration = 30; break;
                default: duration = 60;
            }
        }

        currentClock += duration;
    }

    return {
        ...day,
        activities
    };
};