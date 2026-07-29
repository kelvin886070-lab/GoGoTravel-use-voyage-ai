// src/services/tripPhase.ts
// 🕰️ 行程生命週期的時間判定（純函式層，單一真相）。
//   從 StageSpine 抽出，讓 services（readiness 等）能共用同一套階段門檻，
//   而不必反向依賴 view 元件。StageSpine 仍 re-export 這些，既有 import 不受影響。
//   階段：回來後(4)｜旅途中(3)｜前夕≤3天(2)｜準備≤21天(1)｜規劃(>21天,0)。

type TripDates = { startDate?: string; endDate?: string };

// 當地 00:00 timestamp（避免 UTC 位移）。無效日期回 null。
const localMidnight = (s?: string): number | null => {
    const [y, m, d] = (s || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
};

const todayMidnight = (): number => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
};

/**
 * 距出發還有幾天（今天=0、已過=負）。無 startDate 回 null。
 * 天數以「當地整日」計，和 computeStage 一致。
 */
export const daysUntilStart = (trip: TripDates): number | null => {
    const s = localMidnight(trip.startDate);
    if (s == null) return null;
    return Math.ceil((s - todayMidnight()) / 86400000);
};

/**
 * 時間驅動的生命週期階段。
 * 回傳：回來後(4)｜旅途中(3)｜前夕≤3天(2)｜準備≤21天(1)｜規劃(>21天,0)。
 * 注意：階段分界(21天) 與「脊椎啟動/變暗」門檻(ACTIVATE_DAYS=30) 是兩件事。
 */
export const computeStage = (trip: TripDates): number => {
    const s = localMidnight(trip.startDate);
    const e = localMidnight(trip.endDate);
    if (s == null) return 0;
    const now = todayMidnight();
    if (e != null && now > e) return 4;
    if (now >= s && (e == null || now <= e)) return 3;
    const days = Math.ceil((s - now) / 86400000);
    if (days <= 3) return 2;
    if (days <= 21) return 1;
    return 0;
};

// 脊椎「啟動」門檻：出發前 30 天內（或已在旅途/回憶）才點亮「現在」；更早整條變暗、只開放不施壓。
export const ACTIVATE_DAYS = 30;

// 只有前夕(2)/旅途(3)/回憶(4)是「非到不可」的時間閘門；規劃/準備隨時可進。
export const LOCKABLE_FROM = 2;
