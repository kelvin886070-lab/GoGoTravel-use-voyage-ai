// src/services/routing.ts
// 🛣️ Phase C：接路估算（純函式、零 API、零延遲）。
// 用途：拖曳/插入當下即時給「≈N 分 + 運具」；放手後（步驟 6）才用 Directions API 換精算。
// 原則：便宜估算做互動與運算，只在最後對確定的邊打貴 API。

export interface Coord { lat: number; lng: number; }
export type TravelMode = 'walk' | 'transit' | 'taxi' | 'intercity';

export interface LegEstimate {
    mode: TravelMode;
    minutes: number;   // 估計分鐘（含繞路係數與 overhead）
    km: number;        // 直線距離（公里，四捨五入兩位）
    estimated: true;   // 標記為估算值（非 API 精算）
}

// haversine 直線距離（公里）
export const havKm = (a: Coord, b: Coord): number => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

// 直線距離會低估真實路程 → 乘繞路係數。
const DETOUR = 1.3;

interface ModeSpec { mode: TravelMode; kmh: number; overheadMin: number; }

// 距離門檻挑運具（承筆記：<800m 走／市內大眾／更遠計程／跨城城際），各給有效速度與固定 overhead。
function pickMode(km: number): ModeSpec {
    if (km <= 0.8) return { mode: 'walk', kmh: 4.5, overheadMin: 0 };      // 走路
    if (km <= 12) return { mode: 'transit', kmh: 20, overheadMin: 8 };     // 市內大眾/地鐵（含等車）
    if (km <= 120) return { mode: 'taxi', kmh: 45, overheadMin: 5 };       // 計程/開車
    return { mode: 'intercity', kmh: 120, overheadMin: 40 };              // 高鐵/城際（含站到站）
}

/** 兩座標之間的接路估算（純函式、零 API）。 */
export function estimateLeg(from: Coord, to: Coord): LegEstimate {
    const km = havKm(from, to);
    const spec = pickMode(km);
    const roadKm = km * DETOUR;
    const minutes = Math.max(1, Math.round(spec.overheadMin + (roadKm / spec.kmh) * 60));
    return { mode: spec.mode, minutes, km: Math.round(km * 100) / 100, estimated: true };
}

// 對映到 transportDetail.mode 的字串（與連接卡圖示/顯示相容）
export const legModeLabel: Record<TravelMode, string> = {
    walk: 'walk',
    transit: 'subway',
    taxi: 'taxi',
    intercity: 'train',
};

// 顯示用時長字串（連接卡 A 的 mono 文字；用 "min" 讓舊 parseDurationString 也能解析為 fallback）
export const legDurationStr = (min: number): string => `${min} min`;
