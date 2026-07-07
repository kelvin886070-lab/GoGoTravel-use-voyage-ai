// src/services/scheduler.ts
// 🧭 Phase C1-3：一鍵順路排入（純座標演算法，非 LLM）。
//   就近分群到各天 → 天內最近鄰排序 → 依類別停留 + 餐點錨定 + 希望時段給時間。
//   只插入新點、不動既有行程；排不下的（每天皆達容量上限）列為溢出。
import type { Trip, WishItem } from '../types';
import { categoryKeyOf } from '../utils/wishCategory';

type Pace = NonNullable<Trip['pace']>;

// 每日目標總數（含既有）
const CAP: Record<Pace, number> = { relaxed: 8, standard: 10, packed: 12, deep: 8 };
// 各類別預設停留（分鐘）
const DWELL: Record<string, number> = { cafe: 60, food: 90, sight: 120, shop: 75, bar: 90, other: 75 };
// pace 停留倍率
const FACTOR: Record<Pace, number> = { relaxed: 1.2, standard: 1.0, packed: 0.65, deep: 1.6 };
const BUFFER = 15;          // 點與點之間的緩衝（分）
const DAY_START = 10 * 60;  // 空天預設從 10:00 開始
const LUNCH = 12 * 60, DINNER = 18 * 60 + 30;
const SLOT_START: Record<string, number> = { morning: 9 * 60, afternoon: 13 * 60, evening: 18 * 60 };

const paceOf = (t: Trip): Pace => t.pace || 'standard';

const catOf = categoryKeyOf;
const dwellOf = (w: WishItem, pace: Pace) => Math.round((DWELL[catOf(w)] * FACTOR[pace]) / 5) * 5;

// 系統卡（交通/航班/備註/程序）不算「景點容量」
const SYSTEM_TYPES = new Set(['transport', 'flight', 'note', 'process']);
const isRealStop = (a: { type?: string }) => !SYSTEM_TYPES.has((a.type || '').toLowerCase());

// 依心願分類 → 建立活動時要用的類型 id（讓標籤正確，不再一律「景點」）
export const activityTypeOf = (w: WishItem): string => {
    if (w.type === 'item') return 'shopping';
    const c = catOf(w);
    if (c === 'cafe') return 'snacks';
    if (c === 'shop') return 'shopping';
    if (c === 'food') return 'food';
    if (c === 'bar') return 'bar';
    return 'sightseeing';
};

const toMin = (t?: string): number | null => {
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};
const toHHMM = (min: number) => {
    const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const hav = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};
const hasCoord = (o: { lat?: number; lng?: number }): o is { lat: number; lng: number } => o.lat != null && o.lng != null;
const centroid = (pts: { lat: number; lng: number }[]) =>
    pts.length ? { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length } : null;

export interface PlannedItem { wish: WishItem; time: string; }
export interface PlanDay { dayIndex: number; region?: string; items: PlannedItem[]; }
export interface ArrangePlan { byDay: PlanDay[]; overflow: WishItem[]; totalPlaced: number; }

// 多數決取區域標籤（城市 / 分區）
const regionLabel = (wishes: WishItem[]): string | undefined => {
    const counts: Record<string, number> = {};
    wishes.forEach(w => { const k = w.area || w.city; if (k) counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top?.[0];
};

export function planArrangement(trip: Trip, wishes: WishItem[]): ArrangePlan {
    const pace = paceOf(trip);
    const cap = CAP[pace];

    const days = trip.days.map((d, i) => {
        const coords = d.activities.filter(hasCoord).map(a => ({ lat: a.lat as number, lng: a.lng as number }));
        return { i, anchor: centroid(coords), existing: d.activities.filter(isRealStop).length };
    });

    // ---- 分配到天 ----
    const assigned: Record<number, WishItem[]> = {};
    const overflow: WishItem[] = [];
    const load = (i: number) => days[i].existing + (assigned[i]?.length || 0);

    for (const w of wishes) {
        const avail = days.filter(d => load(d.i) < cap);
        if (avail.length === 0) { overflow.push(w); continue; }
        let target = null as (typeof days)[number] | null;
        if (hasCoord(w)) {
            const anchored = avail.filter(d => d.anchor);
            if (anchored.length) {
                target = anchored.reduce((best, d) =>
                    hav(w, d.anchor!) < hav(w, best.anchor!) ? d : best);
            }
        }
        if (!target) target = avail.reduce((best, d) => (load(d.i) < load(best.i) ? d : best));
        (assigned[target.i] = assigned[target.i] || []).push(w);
    }

    // ---- 天內順路排序 + 給時間 ----
    const byDay: PlanDay[] = [];
    for (const d of days) {
        const list = assigned[d.i];
        if (!list || list.length === 0) continue;

        // 最近鄰排序（起點：當天最後一個既有座標，否則錨點，否則第一個點）
        const dayActs = trip.days[d.i].activities;
        const lastCoord = [...dayActs].reverse().find(hasCoord);
        let start = lastCoord ? { lat: lastCoord.lat as number, lng: lastCoord.lng as number } : d.anchor;
        const remaining = [...list];
        const ordered: WishItem[] = [];
        while (remaining.length) {
            let idx = 0;
            if (start) {
                let bestD = Infinity;
                remaining.forEach((w, k) => { if (hasCoord(w)) { const dd = hav(w, start!); if (dd < bestD) { bestD = dd; idx = k; } } });
            }
            const [picked] = remaining.splice(idx, 1);
            ordered.push(picked);
            if (hasCoord(picked)) start = { lat: picked.lat as number, lng: picked.lng as number };
        }

        // 給時間
        const existMins = dayActs.map(a => toMin(a.time)).filter((m): m is number => m != null);
        let cursor = existMins.length ? Math.max(...existMins) + 90 : DAY_START;
        let lunchUsed = existMins.some(m => m >= 11 * 60 && m <= 14 * 60);
        let dinnerUsed = existMins.some(m => m >= 17 * 60 + 30 && m <= 20 * 60 + 30);

        const items: PlannedItem[] = ordered.map(w => {
            const dwell = dwellOf(w, pace);
            const cat = catOf(w);
            let t = cursor;
            if (w.preferredSlot && SLOT_START[w.preferredSlot] != null) {
                t = Math.max(cursor, SLOT_START[w.preferredSlot]);
            } else if (cat === 'food') {
                if (!lunchUsed && cursor <= 14 * 60) { t = Math.max(cursor, LUNCH); lunchUsed = true; }
                else if (!dinnerUsed && cursor <= 20 * 60 + 30) { t = Math.max(cursor, DINNER); dinnerUsed = true; }
            }
            cursor = t + dwell + BUFFER;
            return { wish: w, time: toHHMM(t) };
        });

        byDay.push({ dayIndex: d.i, region: regionLabel(list), items });
    }

    byDay.sort((a, b) => a.dayIndex - b.dayIndex);
    const totalPlaced = byDay.reduce((s, d) => s + d.items.length, 0);
    return { byDay, overflow, totalPlaced };
}
