// src/services/geo.ts
// 🗺️ Phase D：地點名稱 → 座標（透過 ai-proxy 的 geocode，走全域快取 + 每日限額）
import { supabase } from './supabase';
import type { Trip, Activity } from '../types';
import { parseMapsUrl, isShortMapsUrl, type LatLng } from '../utils/mapsUrl';

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

// 🧭 T1 正式 cascade：Geocoding 主 → 弱信心升級 Places。回傳含 needsConfirm（低信心→前端標「位置待確認」）。
export interface ResolveResult {
    lat: number; lng: number; placeId?: string;
    source: 'geocode' | 'places'; needsConfirm: boolean;
}
export async function resolvePlaces(
    items: { location: string; context?: string }[],
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

// 補齊行程中「可上地圖但還沒座標」的活動；回傳更新後的 trip 與是否有變動
export async function ensureTripGeocoded(trip: Trip): Promise<{ trip: Trip; changed: boolean }> {
    const need: { location: string; context?: string }[] = [];
    trip.days.forEach(d => d.activities.forEach(a => {
        if (isMappable(a) && (a.lat === undefined || a.lng === undefined)) {
            need.push({ location: a.location as string, context: trip.destination });
        }
    }));
    if (need.length === 0) return { trip, changed: false };

    const results = await geocodeItems(need);
    let changed = false;
    const newDays = trip.days.map(d => ({
        ...d,
        activities: d.activities.map(a => {
            if (isMappable(a) && (a.lat === undefined || a.lng === undefined)) {
                const geo = results[a.location as string];
                if (geo) {
                    changed = true;
                    return { ...a, lat: geo.lat, lng: geo.lng, placeId: geo.placeId };
                }
            }
            return a;
        }),
    }));
    return { trip: changed ? { ...trip, days: newDays } : trip, changed };
}
