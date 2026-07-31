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

// 🖼️ 縮圖層（效能量測批定案）：縮圖＝原圖路徑的「影子檔」（uuid_t.jpg），命名衍生、不動 DB schema。
//   量測依據：iPhone 真機 profile 顯示每張新照片首次上畫＝解碼＋GPU 貼圖 400~1100ms（膠卷頓的真兇）；
//   ~480px/40KB 縮圖解碼 ~10ms → 膠卷先秀縮圖、大圖背景淡入；亦為 egress 護欄（§3.7）。
export const thumbPathOf = (path: string): string =>
    /\.jpg$/i.test(path) ? path.replace(/\.jpg$/i, '_t.jpg') : `${path}_t`;

const THUMB_MAX_WIDTH = 480;
const THUMB_QUALITY = 0.72;

/** 回憶照片上傳：原圖＋縮圖一起進私有桶。原圖失敗＝整體失敗（throw）；
 *  縮圖失敗＝best-effort（顯示端會退回大圖，不因影子檔壞掉整張照片）。 */
export async function uploadTripImageWithThumb(file: File): Promise<string> {
    const path = await uploadTripImage(file);
    try {
        const base64 = await compressImage(file, THUMB_MAX_WIDTH, THUMB_QUALITY);
        const blob = await (await fetch(base64)).blob();
        await supabase.storage.from(BUCKET).upload(thumbPathOf(path), blob, { contentType: 'image/jpeg' });
    } catch { /* 縮圖 best-effort：缺了就退回大圖 */ }
    return path;
}

// 刪除一張圖（只刪真正的 Storage 路徑；舊 base64/http 略過）。
// 連影子縮圖一起刪——沒有縮圖的路徑（封面/頭貼/舊照）刪不存在的檔＝無害 no-op。
export async function deleteTripImage(path?: string): Promise<void> {
    if (!isStoragePath(path)) return;
    await supabase.storage.from(BUCKET).remove([path as string, thumbPathOf(path as string)]);
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

// 蒐集一個行程裡所有「Storage 路徑」型的圖片（封面 + 記帳照片 + 回憶照片＋回憶縮圖影子檔）
export function collectTripImagePaths(trip: Trip): string[] {
    const paths: (string | undefined)[] = [trip.coverImagePath, ...(trip.memoryPhotoPaths || [])];
    (trip.memoryPhotoPaths || []).forEach(p => { if (isStoragePath(p)) paths.push(thumbPathOf(p)); });
    trip.days?.forEach(d => d.activities?.forEach(a => paths.push(a.expenseImagePath)));
    return Array.from(new Set(paths.filter(isStoragePath))) as string[];
}

// 批次刪除多張圖（只刪真正的 Storage 路徑；回憶照片的縮圖影子檔一併帶走）
export async function deleteTripImages(paths: (string | undefined)[]): Promise<void> {
    const real = Array.from(new Set(paths.filter(isStoragePath))) as string[];
    if (real.length === 0) return;
    const withThumbs = Array.from(new Set([...real, ...real.map(thumbPathOf)]));
    await supabase.storage.from(BUCKET).remove(withThumbs);
}

// 載入後：把行程內圖片路徑換成 signed URL 供顯示（找不到的保留原值＝舊 base64/http passthrough）
export function resolveTripImages(trip: Trip, urlMap: Record<string, string>): Trip {
    const next: Trip = { ...trip };
    if (trip.coverImagePath && urlMap[trip.coverImagePath]) {
        next.coverImage = urlMap[trip.coverImagePath];
    }
    // 🛂 批⑤c 回憶照片：路徑 → signed URL（順序保留；換不到的略過，不塞破圖）。
    // 縮圖層：memoryPhotoThumbs 與 memoryPhotos「同長同序」（同一過濾基準），缺縮圖＝退回大圖 URL。
    if (trip.memoryPhotoPaths?.length) {
        const pairs = trip.memoryPhotoPaths
            .map(pp => ({ full: urlMap[pp], thumb: urlMap[thumbPathOf(pp)] }))
            .filter(x => !!x.full);   // Record 索引型別為 string，runtime 缺項以 falsy 濾除
        next.memoryPhotos = pairs.map(x => x.full);
        next.memoryPhotoThumbs = pairs.map(x => x.thumb || x.full);
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
    delete next.memoryPhotos;        // 顯示用 signed URL 永不入庫（批⑤c）
    delete next.memoryPhotoThumbs;   // 縮圖 signed URL 同規則（縮圖層）
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
