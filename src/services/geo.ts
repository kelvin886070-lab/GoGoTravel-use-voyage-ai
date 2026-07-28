// src/services/geo.ts
// 🗺️ Phase D：地點名稱 → 座標（透過 ai-proxy 的 geocode，走全域快取 + 每日限額）
import { supabase } from './supabase';
import type { Trip, Activity } from '../types';
import { parseMapsUrl, isShortMapsUrl, looksLikeMapsUrl, extractPlaceNameFromMapsUrl, type LatLng } from '../utils/mapsUrl';

export interface GeoResult { lat: number; lng: number; placeId?: string; }

// 🧭 T1：Places API (New) 找點結果（含信心旗標）
export interface PlaceHit {
    lat: number; lng: number; placeId?: string;
    name?: string; formattedAddress?: string;
    lowConfidence: boolean; candidates: number; cached?: boolean;
}

// 批次找點（走 ai-proxy 的 findplace，伺服器金鑰 + 全域快取 + 每日限額）
export async function findPlaces(
    items: { location: string; context?: string }[],
): Promise<Record<string, PlaceHit | null>> {
    if (items.length === 0) return {};
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'findplace', payload: { items } },
    });
    if (error) throw new Error(error.message || 'findplace 失敗');
    if (data?.error) throw new Error(data.error);
    return (data?.results || {}) as Record<string, PlaceHit | null>;
}

// 🔎 D2：地點搜尋清單（typeahead）——走 ai-proxy place-search（伺服器金鑰＋城市偏置＋快取＋限額）
export interface PlaceSearchResult { placeId?: string; name: string; address: string; lat: number; lng: number; }
export interface PlaceSearchResponse { results: PlaceSearchResult[]; nextPageToken?: string; }
export async function searchPlaces(query: string, bias?: { lat: number; lng: number }, pageToken?: string): Promise<PlaceSearchResponse> {
    const q = query.trim();
    if (q.length < 2) return { results: [] };
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'place-search', payload: { query: q, bias, pageToken } },
    });
    if (error) throw new Error(error.message || 'place-search 失敗');
    if (data?.error) throw new Error(data.error);
    return { results: (data?.results || []) as PlaceSearchResult[], nextPageToken: data?.nextPageToken };
}

// 🔗 D2①：貼上 Google Maps 連結 → 解析成一個地點（名稱＋座標）。
//   完整網址：純前端抽座標＋名稱（免費）；短網址：後端 resolve-maps-url 還原拿 coords＋finalUrl 再抽名。
//   無 placeId（不額外打 Details，控成本）；抽不到名稱時回一個中性名稱。
export interface MapsLinkPlace { name: string; address?: string; lat: number; lng: number; placeId?: string; }
export async function resolveMapsLink(url: string): Promise<MapsLinkPlace | null> {
    const u = (url || '').trim();
    if (!looksLikeMapsUrl(u)) return null;
    const localName = extractPlaceNameFromMapsUrl(u);
    // 1) 完整網址：前端直接抽座標（免費、最高信心）
    const local = parseMapsUrl(u);
    if (local) return { name: localName || '地圖位置', lat: local.lat, lng: local.lng };
    // 2) 短網址：後端還原（回 coords + finalUrl）
    if (isShortMapsUrl(u)) {
        try {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: { action: 'resolve-maps-url', payload: { url: u } },
            });
            if (error || data?.error) return null;
            const coords = data?.coords as LatLng | null;
            if (!coords) return null;
            const name = extractPlaceNameFromMapsUrl(String(data?.finalUrl || '')) || localName || '地圖位置';
            return { name, lat: coords.lat, lng: coords.lng };
        } catch {
            return null;
        }
    }
    return null;
}

// 🌟 D2②：Place Details（評分，方案A）。只在存進心願盒/開細節時查一次；後端快取(30天)＋每日限額。
export interface PlaceDetails { placeId: string; rating?: number; ratingCount?: number; name?: string; }
// 前端 session 記憶體快取：同一次使用中再開同地點＝零往返、瞬間顯示（重整後清空，仍走後端快取不花錢）。
//   value 為 PlaceDetails（含無評分的情況）；網路失敗不寫入 → 可重試。
const _detailsCache = new Map<string, PlaceDetails | null>();
// 同步讀快取：undefined＝還沒查過（要 loading）；null/物件＝查過了（可立即顯示、不閃 loading）。
export function getCachedPlaceDetails(placeId: string): PlaceDetails | null | undefined {
    return _detailsCache.get((placeId || '').trim());
}
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const id = (placeId || '').trim();
    if (!id) return null;
    if (_detailsCache.has(id)) return _detailsCache.get(id) ?? null;
    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { action: 'place-details', payload: { placeId: id } },
        });
        if (error || data?.error) return null;   // 失敗不快取 → 可重試
        const d = (data?.details as PlaceDetails) ?? null;
        _detailsCache.set(id, d);
        return d;
    } catch {
        return null;
    }
}

// 🌟 D2②-A：用名稱＋座標偏置一次拿回 placeId＋評分（補「有座標沒 placeId」的匯入地點）。
export interface PlaceLookupHit { placeId: string; name?: string; rating?: number; ratingCount?: number; lat?: number; lng?: number; }
export async function lookupPlaceByText(query: string, bias?: { lat: number; lng: number }): Promise<PlaceLookupHit | null> {
    const q = (query || '').trim();
    if (q.length < 2) return null;
    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { action: 'place-lookup', payload: { query: q, bias } },
        });
        if (error || data?.error) return null;
        return (data?.match as PlaceLookupHit) ?? null;
    } catch {
        return null;
    }
}

// 🧭 T1 正式 cascade：Geocoding 主 → 弱信心升級 Places。回傳含 needsConfirm（低信心→前端標「位置待確認」）。
export interface ResolveResult {
    lat: number; lng: number; placeId?: string;
    source: 'geocode' | 'places'; needsConfirm: boolean;
}
export async function resolvePlaces(
    items: { location: string; context?: string; bias?: { lat: number; lng: number } }[],
): Promise<Record<string, ResolveResult | null>> {
    if (items.length === 0) return {};
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'resolve-place', payload: { items } },
    });
    if (error) throw new Error(error.message || 'resolve-place 失敗');
    if (data?.error) throw new Error(data.error);
    return (data?.results || {}) as Record<string, ResolveResult | null>;
}
export async function resolvePlace(query: string, context?: string): Promise<ResolveResult | null> {
    const q = query.trim();
    if (!q) return null;
    try {
        const results = await resolvePlaces([{ location: q, context }]);
        return results[q] ?? null;
    } catch {
        return null;
    }
}

// 🧭 T0：Google Maps 連結 → 座標（完整網址純前端解析；短網址走後端還原）。最高信心、免費。
export async function coordsFromMapsUrl(url: string): Promise<LatLng | null> {
    const local = parseMapsUrl(url);
    if (local) return local;
    if (isShortMapsUrl(url)) {
        try {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: { action: 'resolve-maps-url', payload: { url } },
            });
            if (error || data?.error) return null;
            return (data?.coords as LatLng) ?? null;
        } catch {
            return null;
        }
    }
    return null;
}

// 🔬 對抗式稽核：同批查詢並排比較 Geocoding vs Places（不寫快取）
export interface GeoAuditHit {
    lat: number; lng: number; placeId?: string;
    locationType?: string; partialMatch?: boolean; formattedAddress?: string;
}
export async function geoBenchmark(
    items: { key: string; location: string; context?: string }[],
): Promise<Record<string, { geocoding: GeoAuditHit | null; places: PlaceHit | null }>> {
    if (items.length === 0) return {};
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'geo-benchmark', payload: { items } },
    });
    if (error) throw new Error(error.message || 'geo-benchmark 失敗');
    if (data?.error) throw new Error(data.error);
    return data?.results || {};
}

// 單點找點（存檔時用；失敗回 null 不擋存檔）
export async function findPlace(query: string, context?: string): Promise<PlaceHit | null> {
    const q = query.trim();
    if (!q) return null;
    try {
        const results = await findPlaces([{ location: q, context }]);
        return results[q] ?? null;
    } catch {
        return null;
    }
}

// 哪些活動適合放上地圖：有地點文字、且非抽象/交通類
const SKIP_TYPES = new Set(['note', 'process', 'transport']);
export const isMappable = (a: Activity): boolean =>
    !!(a.location && a.location.trim()) && !SKIP_TYPES.has((a.type || '').toLowerCase());

export async function geocodeItems(
    items: { location: string; context?: string }[],
): Promise<Record<string, GeoResult | null>> {
    if (items.length === 0) return {};
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'geocode', payload: { items } },
    });
    if (error) throw new Error(error.message || 'geocode 失敗');
    if (data?.error) throw new Error(data.error);
    return (data?.results || {}) as Record<string, GeoResult | null>;
}

// 🧱 Phase C0：單一心願地點 → 座標（重用 geocode 全域快取 + 每日限額）
export async function geocodeWish(query: string, context?: string): Promise<GeoResult | null> {
    const q = query.trim();
    if (!q) return null;
    try {
        const results = await geocodeItems([{ location: q, context }]);
        return results[q] ?? null;
    } catch {
        return null; // geocode 失敗不擋存檔，之後可重試
    }
}

// 🛣️ 取「沿道路」的路線（回傳 Google 編碼折線字串；失敗回 null → 前端退回直線）
export async function getRoutePolyline(coords: { lat: number; lng: number }[]): Promise<string | null> {
    if (coords.length < 2) return null;
    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { action: 'directions', payload: { coords } },
        });
        if (error) return null;
        return (data?.polyline as string) ?? null;
    } catch {
        return null;
    }
}

// 補齊行程中「可上地圖但還沒座標」的活動（含 days 與待安排托盤 parked）；回傳更新後的 trip 與是否有變動
export async function ensureTripGeocoded(trip: Trip): Promise<{ trip: Trip; changed: boolean }> {
    const needsGeo = (a: Activity) => isMappable(a) && (a.lat === undefined || a.lng === undefined);
    const need: { location: string; context?: string }[] = [];
    const collect = (a: Activity) => { if (needsGeo(a)) need.push({ location: a.location as string, context: trip.destination }); };
    trip.days.forEach(d => d.activities.forEach(collect));
    (trip.parked ?? []).forEach(collect);
    if (need.length === 0) return { trip, changed: false };

    const results = await geocodeItems(need);
    let changed = false;
    const apply = (a: Activity): Activity => {
        if (needsGeo(a)) {
            const geo = results[a.location as string];
            if (geo) { changed = true; return { ...a, lat: geo.lat, lng: geo.lng, placeId: geo.placeId }; }
        }
        return a;
    };
    const newDays = trip.days.map(d => ({ ...d, activities: d.activities.map(apply) }));
    const newParked = trip.parked ? trip.parked.map(apply) : trip.parked;
    return { trip: changed ? { ...trip, days: newDays, parked: newParked } : trip, changed };
}
