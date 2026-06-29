// src/services/storage.ts
// 🖼️ 2.2 行程圖片儲存：上傳到 Supabase Storage（trip-media），資料庫只存「路徑」。
import { supabase } from './supabase';
import { compressImage } from '../utils/imageUtils';

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
