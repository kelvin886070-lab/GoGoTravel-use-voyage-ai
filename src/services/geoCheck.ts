// src/services/geoCheck.ts
// 🧭 空間類·第二刀（比例判斷版）：地點把關（純幾何、無網路）。
//   - far-from-all：離所有目的地都太遠（絕對門檻）→ 大概排錯地方。
//   - wrong-city（比例判斷）：某活動「明顯更靠近別城」而非它被排的那天城市 → 排錯城。
//       用比例（離最近城 < 一半的離被排城）而非固定公里，才對尺度免疫：
//       台南/高雄近但不同城 → 抓；LA 遠但同城 → 不抓；剛好在兩城中間 → 不誤報。
//   - 每天「實際城市」優先用 day.city，否則從當天活動最近城的「多數決」推（不完全依賴生成標籤）。
//   - 附順路建議：把排錯的點，指向「哪一天是它該在的城」。
import type { TripDay, Activity } from '../types';

export interface LatLng { lat: number; lng: number; }

export type LocationWarnKind = 'far-from-all' | 'wrong-city';
export interface LocationWarning {
  kind: LocationWarnKind;
  activityId?: string;
  title: string;
  dayNumber: number;
  km: number;                 // far-from-all：離最近城；wrong-city：離被排城市
  nearestCity?: string;
  dayCity?: string;           // wrong-city：這天實際的城市
  suggestDayNumber?: number;  // 順路建議：該點該在的那城是哪一天
  message: string;            // 繁中、冷靜、不喊口號
}

const SYSTEM_TYPES = new Set(['transport', 'flight', 'note', 'process']);
const isSystem = (a: Activity) => SYSTEM_TYPES.has((a.type || '').toLowerCase());
const hasCoord = (a: Activity): a is Activity & { lat: number; lng: number } => a.lat != null && a.lng != null;

export function havKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export interface LocationCheckOptions {
  farKm?: number;   // 離最近目的地超過此 → 「排錯地方」。預設 80。
  ratio?: number;   // 「明顯更靠近別城」的比例門檻：離最近城 < ratio×離被排城 → 抓。預設 0.5。
}

export function locationWarnings(
  days: TripDay[],
  cityCentroids: Record<string, LatLng>,
  opts: LocationCheckOptions = {},
): LocationWarning[] {
  const farKm = opts.farKm ?? 80;
  const ratio = opts.ratio ?? 0.5;
  const cities = Object.entries(cityCentroids).filter(([, c]) => c && isFinite(c.lat) && isFinite(c.lng));
  if (cities.length === 0) return [];

  const nearestCity = (p: LatLng): { city: string; km: number } => {
    let city = cities[0][0], km = havKm(p, cities[0][1]);
    for (const [c, ctr] of cities) { const d = havKm(p, ctr); if (d < km) { km = d; city = c; } }
    return { city, km };
  };

  // 每天「實際城市」：優先 day.city（若是有效目的地城市）；否則用當天活動最近城的多數決（平手→null，避免亂判）。
  const intendedCityOf = (d: TripDay): string | null => {
    if (d.city && cityCentroids[d.city]) return d.city;
    const counts: Record<string, number> = {};
    for (const a of d.activities ?? []) {
      if (isSystem(a) || !hasCoord(a)) continue;
      const n = nearestCity({ lat: a.lat, lng: a.lng });
      counts[n.city] = (counts[n.city] || 0) + 1;
    }
    let top: string | null = null, topN = 0, tie = false;
    for (const [c, n] of Object.entries(counts)) {
      if (n > topN) { top = c; topN = n; tie = false; }
      else if (n === topN) tie = true;
    }
    return tie ? null : top;
  };
  const dayIntended = new Map<number, string | null>();
  for (const d of days ?? []) dayIntended.set(d.day, intendedCityOf(d));

  const out: LocationWarning[] = [];
  for (const d of days ?? []) {
    const intended = dayIntended.get(d.day) ?? null;
    for (const a of d.activities ?? []) {
      if (isSystem(a) || !hasCoord(a)) continue;
      const p: LatLng = { lat: a.lat, lng: a.lng };
      const n = nearestCity(p);

      if (n.km > farKm) {
        out.push({
          kind: 'far-from-all', activityId: a.id, title: a.title, dayNumber: d.day, km: n.km, nearestCity: n.city,
          message: `「${a.title}」看起來離你的目的地都有點遠（最近的 ${n.city} 約 ${Math.round(n.km)} 公里），確認一下是不是排錯地方了？`,
        });
        continue;
      }

      if (!intended || n.city === intended) continue;   // 這天說不清是哪城、或本來就對 → 跳過
      const kmToIntended = cityCentroids[intended] ? havKm(p, cityCentroids[intended]) : Infinity;
      if (n.km >= ratio * kmToIntended) continue;        // 不夠「明顯更靠近別城」（邊界點）→ 不誤報

      // 明顯排錯城 → 找「該點該在的城」是哪一天，給順路建議
      let suggest: number | undefined;
      for (const dd of days) { if (dd.day !== d.day && dayIntended.get(dd.day) === n.city) { suggest = dd.day; break; } }

      out.push({
        kind: 'wrong-city', activityId: a.id, title: a.title, dayNumber: d.day, km: kmToIntended,
        nearestCity: n.city, dayCity: intended, suggestDayNumber: suggest,
        message: suggest
          ? `「${a.title}」看起來在 ${n.city}，卻排在 Day ${d.day}（${intended}）。Day ${suggest} 是 ${n.city} 的行程，要不要移過去？`
          : `「${a.title}」看起來在 ${n.city}，卻排在 Day ${d.day}（${intended}），要不要調整一下？`,
      });
    }
  }
  return out;
}
