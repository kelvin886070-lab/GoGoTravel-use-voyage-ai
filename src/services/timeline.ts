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
 * 檢查並修復入境流程 (Arrival Process Injection)
 * 如果第一項是航班，且第二項不是 Process，則自動插入入境審查卡片
 */
const ensureArrivalProcess = (activities: Activity[]): Activity[] => {
    if (activities.length === 0) return activities;

    const firstAct = activities[0];
    // 判斷是否為抵達航班 (通常是第一項且是 flight)
    if (firstAct.type === 'flight') {
        const nextAct = activities[1];
        // 如果下一項還不是 process，就插入
        if (!nextAct || nextAct.type !== 'process') {
            const processCard: Activity = {
                time: firstAct.time, // 暫時用一樣的時間，recalculateTimeline 會修復它
                title: '入境審查 & 領取行李',
                description: '請預留時間辦理入境手續與提領行李。',
                type: 'process',
                location: '機場',
                cost: 0,
                transportDetail: {
                    mode: 'walk',
                    duration: '60 min', // 預設 60 分鐘
                    instruction: '入境流程'
                }
            };
            // 插入在航班之後 (index 1)
            const newActivities = [...activities];
            newActivities.splice(1, 0, processCard);
            return newActivities;
        }
    }
    return activities;
};

/**
 * 核心函式：重新計算當天的所有活動時間
 * 確保時間軸連續，並自動加入出關/交通緩衝
 */
export const recalculateTimeline = (day: TripDay): TripDay => {
    let activities = JSON.parse(JSON.stringify(day.activities)) as Activity[];
    
    if (activities.length === 0) return day;

    // 1. 自動檢查並插入「入境審查」卡片 (僅針對第一天或抵達日)
    // 這裡我們假設如果第一筆是 flight，就需要 process
    activities = ensureArrivalProcess(activities);

    // 2. 設定起始時間錨點 (Anchor)
    let currentClock = timeToMinutes(activities[0].time);

    for (let i = 0; i < activities.length; i++) {
        const act = activities[i];

        // 除了第一個活動保持原樣外，後續都由上一項推算
        if (i > 0) {
            act.time = minutesToTime(currentClock);
        } else {
            currentClock = timeToMinutes(act.time); 
        }

        // 3. 計算此活動的持續時間 (Duration)
        let duration = 60; // 預設

        if (act.type === 'note' || act.type === 'expense') {
            duration = 0; // 不佔用時間
        } else if (act.type === 'flight') {
            // 航班本身不佔用時間軸 (因為它標示的是抵達時間)
            // 真正的耗時會由下一張 'process' 卡片來承擔
            duration = 0; 
        } else if (act.type === 'process') {
            // 入境審查 / 手續
            duration = parseDurationString(act.transportDetail?.duration || '60 min');
        } else if (act.type === 'transport' && act.transportDetail) {
            duration = parseDurationString(act.transportDetail.duration);
            if (duration === 0) duration = 30;
        } else {
            // 一般活動預設時間
            switch (act.type) {
                case 'food': duration = 60; break;
                case 'cafe': duration = 45; break;
                case 'sightseeing': duration = 90; break;
                case 'shopping': duration = 120; break;
                case 'relax': duration = 60; break;
                case 'hotel': duration = 30; break; // 辦理入住
                default: duration = 60;
            }
        }

        // 4. 將時間往後推
        currentClock += duration;
    }

    return {
        ...day,
        activities
    };
};