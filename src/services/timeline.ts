// src/services/timeline.ts
import type { TripDay, Activity } from '../types';

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
    // 處理跨日 (超過 24 小時)
    let mins = totalMinutes % (24 * 60);
    if (mins < 0) mins += 24 * 60;
    
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
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

/**
 * 檢查並修復入境流程 (Arrival Process Injection)
 * 如果第一項是航班，且第二項不是 Process，則自動插入入境審查卡片
 */
const ensureArrivalProcess = (activities: Activity[]): Activity[] => {
    if (activities.length === 0) return activities;

    const firstAct = activities[0];
    if (firstAct.type === 'flight') {
        const nextAct = activities[1];
        if (!nextAct || nextAct.type !== 'process') {
            const processCard: Activity = {
                time: firstAct.time,
                title: '入境審查 & 領取行李',
                description: '請預留時間辦理入境手續與提領行李。',
                type: 'process',
                location: '機場',
                cost: 0,
                transportDetail: {
                    mode: 'walk',
                    duration: '60 min',
                    instruction: '入境流程'
                }
            };
            const newActivities = [...activities];
            newActivities.splice(1, 0, processCard);
            return newActivities;
        }
    }
    return activities;
};

/**
 * 核心函式：重新計算當天的所有活動時間
 */
export const recalculateTimeline = (day: TripDay): TripDay => {
    let activities = JSON.parse(JSON.stringify(day.activities)) as Activity[];
    
    if (activities.length === 0) return day;

    // 1. 自動檢查並插入「入境審查」
    activities = ensureArrivalProcess(activities);

    // 2. 自動填補缺失的「移動卡片」 (新增邏輯)
    activities = ensureGapConnectors(activities);

    // 3. 設定起始時間錨點
    let currentClock = timeToMinutes(activities[0].time);

    for (let i = 0; i < activities.length; i++) {
        const act = activities[i];

        // 除了第一個活動保持原樣外，後續都由上一項推算
        if (i > 0) {
            act.time = minutesToTime(currentClock);
        } else {
            currentClock = timeToMinutes(act.time); 
        }

        // 4. 計算此活動的持續時間
        let duration = 60; // 預設

        if (act.type === 'note' || act.type === 'expense') {
            duration = 0;
        } else if (act.type === 'flight') {
            duration = 0; // 航班本身不佔用時間軸，耗時由 process 承擔
        } else if (act.type === 'process') {
            duration = parseDurationString(act.transportDetail?.duration || '60 min');
        } else if (act.type === 'transport' && act.transportDetail) {
            duration = parseDurationString(act.transportDetail.duration);
            if (duration === 0) duration = 15; // 預設移動至少 15 分鐘
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