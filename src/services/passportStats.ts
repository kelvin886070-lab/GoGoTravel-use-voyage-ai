// src/services/passportStats.ts
// 🛂 護照個資頁的統計與人格欄位（純函式層，批③）。
//   鐵律（與 Kelvin 定案）：
//   - 護照只記「已完成」旅程（endDate < 今天、未刪除）——蓋過章的才算，未來的住首頁。
//   - 任何欄位在任何狀態不得輸出 undefined/破值：空值都有設計過的退位（首趟後揭曉／養成中 N/3）。
//   - 旅風門檻 3 趟、旅伴與最常去門檻 1 趟；最常去平手（全部 ×1）→ 顯示最近去的城市、不帶次數。
import type { Trip } from '../types';

const dayTs = (s?: string): number => {
    const [y, m, d] = (s || '').split('-').map(Number);
    if (!y || !m || !d) return 0;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
};

/** 已完成旅程：endDate < 今天（今天還在玩的不算）、未刪除。 */
export function completedTrips(trips: Trip[]): Trip[] {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const now = t.getTime();
    return trips.filter(tr => !tr.isDeleted && !!tr.endDate && dayTs(tr.endDate) < now);
}

export interface PassportStats {
    trips: number;    // 趟旅程
    cities: number;   // 座城市（day.city 去重）
    days: number;     // 總旅遊天數（各趟天數加總）
}

export function passportStats(trips: Trip[]): PassportStats {
    const done = completedTrips(trips);
    const citySet = new Set<string>();
    let days = 0;
    for (const tr of done) {
        days += (tr.days || []).length;
        for (const d of tr.days || []) {
            const c = (d.city || '').trim();
            if (c) citySet.add(c);
        }
    }
    return { trips: done.length, cities: citySet.size, days };
}

// ── 旅風 / STYLE ───────────────────────────────────────────────
// v1 規則引擎：已完成旅程的非交通活動分佈 → 主導類別。<3 趟＝養成中（帶進度）。
// v2（記錄於 docs）：心願盒 tags＋實際 vs 計畫差異餵 LLM，並回饋生成 prompt。
export type TravelStyle =
    | { ready: false; progress: number; threshold: 3 }
    | { ready: true; label: string; sharePct: number };

const STYLE_BUCKETS: Array<{ label: string; types: string[] }> = [
    { label: '美食旅人', types: ['food', 'cafe'] },
    { label: '人文旅人', types: ['culture', 'sightseeing'] },
    { label: '藏貨旅人', types: ['shopping'] },
    { label: '慢遊旅人', types: ['relax', 'bar'] },
];

export function travelStyle(trips: Trip[]): TravelStyle {
    const done = completedTrips(trips);
    if (done.length < 3) return { ready: false, progress: done.length, threshold: 3 };
    const counts = new Map<string, number>();
    let total = 0;
    for (const tr of done) for (const d of tr.days || []) for (const a of d.activities || []) {
        const ty = (a.type || '').toLowerCase();
        if (ty === 'transport' || ty === 'flight') continue;
        total += 1;
        for (const b of STYLE_BUCKETS) if (b.types.includes(ty)) counts.set(b.label, (counts.get(b.label) || 0) + 1);
    }
    if (total === 0) return { ready: false, progress: done.length >= 3 ? 2 : done.length, threshold: 3 };
    // 依 bucket 宣告順序穩定決勝（平手時前者優先），不受 Map 迭代影響
    let best = STYLE_BUCKETS[0].label, bestN = -1;
    for (const b of STYLE_BUCKETS) {
        const n = counts.get(b.label) || 0;
        if (n > bestN) { best = b.label; bestN = n; }
    }
    return { ready: true, label: best, sharePct: Math.round((bestN / total) * 100) };
}

// ── 旅伴 / COMPANION ───────────────────────────────────────────
// 已完成旅程的同行人數眾數（members 空＝1 人）。平手取最近一趟。門檻 1 趟。
export function companionType(trips: Trip[]): string | null {
    const done = completedTrips(trips).sort((a, b) => dayTs(a.startDate) - dayTs(b.startDate));
    if (done.length === 0) return null;
    const label = (n: number) => (n <= 1 ? '獨行旅人' : n === 2 ? '雙人同行' : '團體旅人');
    const freq = new Map<string, number>();
    let recent = '獨行旅人';
    for (const tr of done) {
        const l = label(Math.max(tr.members?.length || 0, 1));
        freq.set(l, (freq.get(l) || 0) + 1);
        recent = l;   // 迴圈依日期升冪，最後一次＝最近
    }
    let best: string | null = null, bestN = -1;
    for (const [l, n] of freq) {
        if (n > bestN || (n === bestN && l === recent)) { best = l; bestN = n; }
    }
    return best;
}

// ── 最常去 / MOST VISITED ─────────────────────────────────────
// 以「趟」為單位計城市（一趟去京都算 1 次，不論待幾天）。
// 最高 ≥2 →「京都 ×2」；全部 ×1 → 最近一趟的第一個城市（不帶次數）；無城市資料 → null。
export function mostVisited(trips: Trip[]): string | null {
    const done = completedTrips(trips).sort((a, b) => dayTs(a.startDate) - dayTs(b.startDate));
    const freq = new Map<string, number>();
    let recentCity: string | null = null;
    for (const tr of done) {
        const tripCities = new Set<string>();
        for (const d of tr.days || []) {
            const c = (d.city || '').trim();
            if (c) tripCities.add(c);
        }
        const first = [...tripCities][0];
        if (first) recentCity = first;
        for (const c of tripCities) freq.set(c, (freq.get(c) || 0) + 1);
    }
    let best: string | null = null, bestN = 0;
    for (const [c, n] of freq) if (n > bestN) { best = c; bestN = n; }
    if (best && bestN >= 2) return `${best} ×${bestN}`;
    return recentCity;
}

// ── 會員碼 / NO ────────────────────────────────────────────────
// v1：由 user id（UUID）前 8 hex 導出——天生穩定、對每位使用者唯一；自訂碼＝未來社交批（profiles 表 UNIQUE）。
export function friendCodeOf(userId: string): string {
    const hex = (userId || '').replace(/-/g, '').slice(0, 8).toUpperCase() || 'TRAVELER';
    return `KT-${hex}`;
}

// ── MRZ 機讀碼（兩行，各 44 字元＝真護照 TD3 規格，'<' 補滿）──────────────────
// 彩蛋層：姓名（非 ASCII 以 TRAVELER 退位）、會員碼、統計、EST 加入年。敏感值（email/完整 uuid）永不進入。
export function mrzLines(name: string, code: string, stats: PassportStats, estYear: string): [string, string] {
    const pad = (s: string) => (s.length >= 44 ? s.slice(0, 44) : s + '<'.repeat(44 - s.length));
    const ascii = (name || '').replace(/[^A-Za-z]/g, '').toUpperCase() || 'TRAVELER';
    const l1 = pad(`P<KELVINTRIP<<${ascii}`);
    const l2 = pad(`${code.replace('-', '')}<<${stats.trips}TRIPS<${stats.cities}CITIES<${stats.days}DAYS<<EST${estYear}`);
    return [l1, l2];
}
