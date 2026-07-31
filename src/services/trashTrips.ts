// src/services/trashTrips.ts
// 🐘 垃圾桶 lazy-load（秒開路線圖①後續，Kelvin 提案）：
//   HAR 實測（test03/04）：35 趟中垃圾桶 31 趟＝冷啟 99% 重量。冷啟改抓「輕量投影」
//   （id/目的地/起訖日/封面路徑——每趟 <1KB），復原/永久刪除時才抓該趟全量。
//   PostgREST JSON 投影：select 走 `trip_data->>欄位`；過濾走 `trip_data->>isDeleted eq true`。
//   防禦：查詢失敗（語法不被舊版 PostgREST 支援等）回空陣列＋console.error——保管箱顯示空清單
//   但不影響主 App；復原端另有全量退路。
import { supabase } from './supabase';
import { signPaths, thumbPathOf, isStoragePath } from './storage';
import { smallCoverUrl } from './coverPhoto';
import type { Trip, TrashSummary } from '../types';

// 起訖日（YYYY-MM-DD）推天數（含首尾）；無效＝0（UI 不顯示天數）
const daysFromRange = (start?: string | null, end?: string | null): number => {
    const ms = (s?: string | null) => {
        const [y, m, d] = (s || '').split('-').map(Number);
        return y && m && d ? new Date(y, m - 1, d).getTime() : NaN;
    };
    const a = ms(start), b = ms(end);
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
};

interface TrashRow {
    id: string;
    destination: string | null;
    start: string | null;
    end: string | null;
    coverPath: string | null;
    cover: string | null;
}

/** 冷啟用：垃圾桶輕量投影（不含 days/activities 等重欄位）。 */
export async function fetchTrashSummaries(): Promise<TrashSummary[]> {
    try {
        const { data, error } = await supabase
            .from('trips')
            .select('id, destination:trip_data->>destination, start:trip_data->>startDate, end:trip_data->>endDate, coverPath:trip_data->>coverImagePath, cover:trip_data->>coverImage')
            .eq('trip_data->>isDeleted', 'true')
            .order('updated_at', { ascending: false });
        if (error || !data) {
            if (error) console.error('垃圾桶投影查詢失敗', error);
            return [];
        }
        const rows = data as unknown as TrashRow[];
        // 封面小圖：Storage 路徑 → 影子縮圖優先（缺影子退大圖）；http（Pexels）→ URL 縮放
        const storagePaths = rows
            .filter(r => isStoragePath(r.coverPath || undefined))
            .flatMap(r => [thumbPathOf(r.coverPath as string), r.coverPath as string]);
        const urlMap = await signPaths(storagePaths);
        return rows.map(r => {
            let coverThumb: string | undefined;
            if (isStoragePath(r.coverPath || undefined)) {
                coverThumb = urlMap[thumbPathOf(r.coverPath as string)] || urlMap[r.coverPath as string];
            } else if ((r.cover || '').startsWith('http')) {
                coverThumb = smallCoverUrl(r.cover as string);
            }
            return {
                id: r.id,
                destination: (r.destination || '').trim() || '未命名行程',
                daysCount: daysFromRange(r.start, r.end),
                coverThumb,
            };
        });
    } catch (e) {
        console.error('垃圾桶投影查詢失敗', e);
        return [];
    }
}

/** 復原／永久刪除用：抓單趟全量（raw trip_data＋id；顯示層解析交給呼叫端）。 */
export async function fetchTrashTripFull(tripId: string): Promise<Trip | null> {
    try {
        const { data, error } = await supabase
            .from('trips').select('id, trip_data').eq('id', tripId).maybeSingle();
        if (error || !data) return null;
        const td = (data as { id: string; trip_data: Trip }).trip_data;
        return { ...td, id: (data as { id: string }).id };
    } catch {
        return null;
    }
}
