// src/services/booking/nights.ts
// 🛏️「行程需幾晚」一等公民 + 住宿覆蓋計算（A2/A1 的地基）。
//   夜以「入住日」為 key：'2027-01-09' 代表 01/09→01/10 那一晚。
//   行程需要的夜 = startDate .. endDate-1（4天3夜＝3 晚）。
//   一筆訂房覆蓋的夜 = checkIn .. checkOut-1。多筆取聯集。
import type { HotelBooking } from '../../types/booking';

const parseDate = (s?: string): Date | null => {
    const [y, m, d] = (s || '').slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt;
};
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const rangeDates = (start: Date, count: number): string[] =>
    Array.from({ length: Math.max(0, count) }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return fmt(d); });

interface TripLike { startDate?: string; endDate?: string; days?: unknown[] }

// 行程需要的夜（日期陣列）。無日期時回空陣列，覆蓋改用計數 fallback。
export function tripNights(trip: TripLike): string[] {
    const s = parseDate(trip.startDate), e = parseDate(trip.endDate);
    if (s && e) return rangeDates(s, daysBetween(s, e));
    return [];
}

// 一筆訂房覆蓋的夜（checkIn..checkOut-1）。
export function hotelNights(h: { checkInLocal?: string; checkOutLocal?: string }): string[] {
    const ci = parseDate(h.checkInLocal), co = parseDate(h.checkOutLocal);
    if (!ci || !co) return [];
    return rangeDates(ci, daysBetween(ci, co));
}

export interface NightsCoverage {
    needed: string[];      // 需要的夜（日期）
    covered: string[];     // 已被訂房覆蓋的夜
    missing: string[];     // 缺的夜
    neededCount: number;   // 需幾晚（無日期時 fallback＝天數-1）
    coveredCount: number;
}

export function nightsCoverage(trip: TripLike, hotels: HotelBooking[]): NightsCoverage {
    const needed = tripNights(trip);
    const coveredSet = new Set<string>();
    for (const h of hotels) for (const nt of hotelNights(h)) coveredSet.add(nt);
    const covered = needed.filter(n => coveredSet.has(n));
    const missing = needed.filter(n => !coveredSet.has(n));
    const neededCount = needed.length || Math.max(0, (trip.days?.length ?? 1) - 1);
    // 無行程日期但有訂房時，用訂房覆蓋數當已訂數（盡量給資訊）
    const coveredCount = needed.length ? covered.length : coveredSet.size;
    return { needed, covered, missing, neededCount, coveredCount };
}

// 顯示用：把缺的夜壓成「01/11」這類短標（連續夜可再壓區間，先逐一）。
export function shortNight(dateStr: string): string {
    const d = parseDate(dateStr);
    return d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : dateStr;
}

// 🔎 A1 日期交叉檢查（決定性、安全）：住宿日期是否超出行程範圍。地點檢查另用 geo。
export interface CrossWarn { title: string; body: string }
export function hotelDateWarnings(
    trip: TripLike,
    hotels: { checkInLocal?: string; checkOutLocal?: string }[],
): CrossWarn[] {
    const s = parseDate(trip.startDate), e = parseDate(trip.endDate);
    if (!s || !e) return [];
    const tripYear = s.getFullYear();
    const out: CrossWarn[] = [];
    for (const h of hotels) {
        const ci = parseDate(h.checkInLocal), co = parseDate(h.checkOutLocal);
        // 年份不同時，先報清楚的「年份對不上」（否則會誤成含糊的「比出發還早」）
        if (ci && ci.getFullYear() !== tripYear) {
            out.push({ title: '年份對不上', body: `住宿在 ${ci.getFullYear()} 年，這趟卻是 ${tripYear} 年，check 一下喔！` });
            continue;
        }
        if (co && co.getTime() > e.getTime())
            out.push({ title: '住宿日期超出行程', body: `住宿排到 ${shortNight(h.checkOutLocal!)}，比回程（${shortNight(trip.endDate!)}）還晚，check 一下喔！` });
        if (ci && ci.getTime() < s.getTime())
            out.push({ title: '住宿比出發還早', body: `住宿 ${shortNight(h.checkInLocal!)} 就入住，比出發（${shortNight(trip.startDate!)}）還早，確認一下喔！` });
    }
    // 去重（多筆同款訂位不重複刷同一句）
    const seen = new Set<string>();
    return out.filter(w => { const k = w.title + '|' + w.body; if (seen.has(k)) return false; seen.add(k); return true; });
}
