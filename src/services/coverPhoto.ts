// src/services/coverPhoto.ts
// 🖼️ 封面B：目的地嚮往照（前端層）。
//   原則：一趟一張——抓到的 URL 存進 trip.coverImage（http 舊格式，serializeTripForDb 會持久化），之後零 API 呼叫。
//   使用者自訂封面永遠優先（只在 coverImage 為空時補）；寧素勿錯（抓不到維持深色 fallback）。
//   查詢詞優先序：day.cityEn（LLM 生成）→ cityToEn(day.city) 對照表 → cityToEn(destination) → 空白行程「Taiwan」。
import { supabase } from './supabase';
import { cityToEn } from './cityEn';
import type { Trip } from '../types';

/** 呼叫 ai-proxy 抓一張目的地橫幅照；任何失敗回 null（呼叫端不需 try/catch）。 */
export async function fetchCoverPhoto(query: string): Promise<string | null> {
    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { action: 'cover-photo', payload: { query } },
        });
        if (error || data?.error) return null;
        return (data?.url as string) || null;
    } catch {
        return null;
    }
}

/**
 * 為一趟行程決定封面查詢詞。
 * 回傳 null＝不用抓（已有封面）；'Taiwan …'＝空白/無城市行程的保底（Kelvin 定案：空白行程呈現台灣的圖）。
 */
export function coverQueryForTrip(trip: Trip): string | null {
    if ((trip.coverImage || '').trim() || (trip.coverImagePath || '').trim()) return null;   // 使用者自訂/已有 → 不動
    const days = trip.days || [];
    const firstCityDay = days.find(d => (d.cityEn || '').trim() || (d.city || '').trim());
    const en = (firstCityDay?.cityEn || '').trim()
        || cityToEn(firstCityDay?.city)
        || cityToEn(trip.destination);
    if (en) return `${en} travel`;
    return 'Taiwan aerial landscape';   // 空白行程／解不出城市 → 台灣圖保底
}

/**
 * 補上封面（若需要）。回傳補完的 trip；沒抓到或不需要 → 原 trip。
 * 呼叫端拿回傳值決定要不要 persist（不在此處寫 DB，保持純粹）。
 */
export async function enrichTripCover(trip: Trip): Promise<Trip> {
    const query = coverQueryForTrip(trip);
    if (!query) return trip;
    const url = await fetchCoverPhoto(query);
    if (!url) return trip;
    return { ...trip, coverImage: url };
}
