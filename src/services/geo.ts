// src/services/geo.ts
// 🗺️ Phase D：地點名稱 → 座標（透過 ai-proxy 的 geocode，走全域快取 + 每日限額）
import { supabase } from './supabase';
import type { Trip, Activity } from '../types';

export interface GeoResult { lat: number; lng: number; placeId?: string; }

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
