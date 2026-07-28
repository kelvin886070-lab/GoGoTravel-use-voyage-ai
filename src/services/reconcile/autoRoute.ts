// src/services/reconcile/autoRoute.ts
// 🛣️ Phase C：自動連接卡的辨識 / strip / 冪等重生。
// 「編輯即自動接路」的核心：任何結構改動後 strip 掉舊的自動連接卡、依相鄰真站重生，
//   再交給 reconcile 跑時間骨牌。連接卡＝衍生的邊，不是使用者心血。
import type { Activity, TripDay, TransportMode } from '../../types';
import { activitySource } from '../../types';
import { estimateLeg, legModeLabel, legDurationStr, type Coord } from '../routing';

// 自動連接卡的簽名（與 timeline.ts ensureGapConnectors 產出一致，供相容舊資料辨識）
export const AUTO_CONNECTOR_TITLE = '移動 (預估)';
export const AUTO_CONNECTOR_INSTRUCTION = '前往下個地點';

/**
 * 是否為「系統自動連接卡」。
 * 判定：type transport 且（新版標 source:'generated' ／ 或舊版的自動簽名）。
 * ⚠️ 使用者手加的交通（title「移動」、instruction「搭乘交通工具」）、航班/城際 → 不算，永不被 strip。
 */
export function isAutoConnector(a: Activity): boolean {
    if ((a.type || '').toLowerCase() !== 'transport') return false;
    if (activitySource(a) === 'generated') return true;
    // 相容尚未標 source 的舊自動連接卡
    return a.title === AUTO_CONNECTOR_TITLE || a.transportDetail?.instruction === AUTO_CONNECTOR_INSTRUCTION;
}

// 定點活動（會佔時間、之間需要移動）——與 timeline.isStayActivity 一致，避免非地理化行程失去連接卡
const STAY_TYPES = new Set(['sightseeing', 'food', 'cafe', 'shopping', 'relax', 'bar', 'culture', 'activity', 'hotel', 'other']);
const isStay = (a: Activity): boolean => STAY_TYPES.has((a.type || '').toLowerCase());
const hasCoord = (a: Activity): boolean => typeof a.lat === 'number' && typeof a.lng === 'number';

/** 移除所有自動連接卡（保留使用者交通、航班、真站）。 */
export function stripAutoConnectors(activities: Activity[]): Activity[] {
    return activities.filter(a => !isAutoConnector(a));
}

let autoSeq = 0;
const makeAutoId = () => `auto-conn-${Date.now().toString(36)}-${(autoSeq++).toString(36)}`;

/**
 * 冪等重生：strip 舊自動連接卡 → 在「相鄰兩張『有座標的真站』」之間插入新的自動連接卡（用 estimateLeg 估）。
 * - 相鄰若不都是有座標的真站（例如中間本來就有使用者交通/航班、或缺座標）→ 不插，維持原樣。
 * - 冪等：連跑兩次結果一致（因為每次都先 strip 再依當前真站重生）。
 * 純函式：回傳新陣列，不改動輸入。
 */
export function rebuildConnectorsInList(activities: Activity[]): Activity[] {
    const base = stripAutoConnectors(activities);
    const out: Activity[] = [];
    for (let i = 0; i < base.length; i++) {
        const cur = base[i];
        out.push(cur);
        const next = base[i + 1];
        if (!next) break;
        // 相鄰兩張都是「定點」才需要一段移動（與舊 ensureGapConnectors 一致）
        if (isStay(cur) && isStay(next)) {
            let mode: TransportMode = 'walk';
            let durMin = 15;   // 缺座標的預設（沿用舊行為，不讓非地理化行程失去連接卡）
            if (hasCoord(cur) && hasCoord(next)) {
                const leg = estimateLeg(cur as Coord, next as Coord);
                mode = legModeLabel[leg.mode] as TransportMode;   // 連接卡顯示用標籤（沿用既有 UI 行為）
                durMin = leg.minutes;
            }
            out.push({
                id: makeAutoId(),
                time: cur.time,                 // 暫時；交給 recalculate/reconcile 排
                title: AUTO_CONNECTOR_TITLE,
                description: '系統自動填補，點擊可修改',
                type: 'transport',
                source: 'generated',
                location: '',
                cost: 0,
                durationMin: durMin,            // 讓 recalculate/reconcile 用此時長跑骨牌
                movable: 'floating',
                transportDetail: {
                    mode,
                    duration: legDurationStr(durMin),
                    instruction: AUTO_CONNECTOR_INSTRUCTION,
                },
            });
        }
    }
    return out;
}

/** 對一天重生自動連接卡（純函式）。 */
export function rebuildConnectors(day: TripDay): TripDay {
    return { ...day, activities: rebuildConnectorsInList(day.activities ?? []) };
}
