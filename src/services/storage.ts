// src/services/storage.ts
// 🖼️ 2.2 行程圖片儲存：上傳到 Supabase Storage（trip-media），資料庫只存「路徑」。
import { supabase } from './supabase';
import { compressImage } from '../utils/imageUtils';
import type { Trip } from '../types';

const BUCKET = 'trip-media';
const SIGNED_TTL = 60 * 60 * 24; // 24 小時

// 判斷一個值是否為「Storage 路徑」（而非舊的 base64 或外部 http 圖）
export const isStoragePath = (value?: string): boolean =>
    !!value && !value.startsWith('data:') && !value.startsWith('http');

// 壓縮後上傳，回傳「路徑」（例如 使用者id/uuid.jpg）
export async function uploadTripImage(file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('尚未登入');

    const base64 = await compressImage(file);          // 沿用既有壓縮引擎
    const blob = await (await fetch(base64)).blob();    // data URL → Blob
    const path = `${user.id}/${crypto.randomUUID()}.jpg`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
}

// 刪除一張圖（只刪真正的 Storage 路徑；舊 base64/http 略過）
export async function deleteTripImage(path?: string): Promise<void> {
    if (!isStoragePath(path)) return;
    await supabase.storage.from(BUCKET).remove([path as string]);
}

// 批次把多個路徑換成 signed URL（一次 API，不逐張呼叫）
export async function signPaths(paths: (string | undefined)[]): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    const real = Array.from(new Set(paths.filter(isStoragePath))) as string[];
    if (real.length === 0) return map;

    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(real, SIGNED_TTL);
    data?.forEach(item => {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    });
    return map;
}

// 蒐集一個行程裡所有「Storage 路徑」型的圖片（封面 + 所有記帳照片）
export function collectTripImagePaths(trip: Trip): string[] {
    const paths: (string | undefined)[] = [trip.coverImagePath];
    trip.days?.forEach(d => d.activities?.forEach(a => paths.push(a.expenseImagePath)));
    return Array.from(new Set(paths.filter(isStoragePath))) as string[];
}

// 批次刪除多張圖（只刪真正的 Storage 路徑）
export async function deleteTripImages(paths: (string | undefined)[]): Promise<void> {
    const real = Array.from(new Set(paths.filter(isStoragePath))) as string[];
    if (real.length === 0) return;
    await supabase.storage.from(BUCKET).remove(real);
}

// 載入後：把行程內圖片路徑換成 signed URL 供顯示（找不到的保留原值＝舊 base64/http passthrough）
export function resolveTripImages(trip: Trip, urlMap: Record<string, string>): Trip {
    const next: Trip = { ...trip };
    if (trip.coverImagePath && urlMap[trip.coverImagePath]) {
        next.coverImage = urlMap[trip.coverImagePath];
    }
    if (trip.days) {
        next.days = trip.days.map(d => ({
            ...d,
            activities: (d.activities || []).map(a =>
                a.expenseImagePath && urlMap[a.expenseImagePath]
                    ? { ...a, expenseImage: urlMap[a.expenseImagePath] }
                    : a
            ),
        }));
    }
    return next;
}

// 存進 DB 前：把有 Storage 路徑的圖片「顯示值」清空（不把暫時的 signed URL 寫進 DB）
export function serializeTripForDb(trip: Trip): Trip {
    const next: Trip = { ...trip };
    if (trip.coverImagePath) next.coverImage = '';
    if (trip.days) {
        next.days = trip.days.map(d => ({
            ...d,
            activities: (d.activities || []).map(a =>
                a.expenseImagePath ? { ...a, expenseImage: '' } : a
            ),
        }));
    }
    return next;
}
