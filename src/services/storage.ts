// src/services/storage.ts
// 🖼️ 2.2 行程圖片儲存：上傳到 Supabase Storage（trip-media），資料庫只存「路徑」。
import { supabase } from './supabase';
import { compressImage } from '../utils/imageUtils';
import type { Trip } from '../types';

const BUCKET = 'trip-media';
// 🔏 簽名 URL 本地重用（秒開路線圖②，Kelvin 四決策 2026-08-01）：
//   TTL 24h → 7 天——瀏覽器圖片快取以 URL 為 key，URL 穩定＝重複觀看走本機磁碟、egress 歸零。
//   個人旅遊照片、URL 只存自己裝置的 localStorage，風險可接受；vault（證件）不走此快取、維持 24h 短命。
//   安全邊際 24h：剩餘壽命 < 24h 視同過期重簽——URL 永不在使用中斷氣（實際穩定期 ~6 天）。
//   登出必清（clearSignedUrlCache，App 登出流程呼叫）；刪檔清該路徑（dropCachedUrls）。
//   已知邊界（接受）：Supabase 金鑰輪替會讓未到期 URL 集體失效＝圖片破到快取過期，機率極低不蓋工程。
const SIGNED_TTL = 60 * 60 * 24 * 7;              // 7 天
const REUSE_MARGIN_MS = 24 * 60 * 60 * 1000;      // 安全邊際 24h
const URL_CACHE_KEY = 'kt_signed_urls_v1';

type UrlCache = Record<string, { u: string; e: number }>;   // path → { url, 到期 ms }
let _urlCache: UrlCache | null = null;

const loadUrlCache = (): UrlCache => {
    try {
        const raw = localStorage.getItem(URL_CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as UrlCache;
        // 載入時清掉已到期項（防 localStorage 無限膨脹）；負面項（u=''）未到期要保留——它的價值正是在下次冷啟
        const now = Date.now();
        for (const k of Object.keys(parsed)) if (typeof parsed[k]?.e !== 'number' || parsed[k].e <= now) delete parsed[k];
        return parsed;
    } catch { return {}; }   // 私密模式/配額滿＝無快取模式，功能不受影響
};
const getUrlCache = (): UrlCache => (_urlCache ??= loadUrlCache());
const persistUrlCache = (): void => {
    try { localStorage.setItem(URL_CACHE_KEY, JSON.stringify(getUrlCache())); } catch { /* 寫不進＝退化為記憶體快取 */ }
};

/** 登出時清空簽名 URL 快取（換帳號不撿到上一位的照片鑰匙）。 */
export const clearSignedUrlCache = (): void => {
    _urlCache = {};
    try { localStorage.removeItem(URL_CACHE_KEY); } catch { /* ignore */ }
};

/** 刪檔時同步清掉該路徑的快取 URL（避免殘留 404 鑰匙）。 */
const dropCachedUrls = (paths: string[]): void => {
    const c = getUrlCache();
    let dirty = false;
    for (const p of paths) if (c[p]) { delete c[p]; dirty = true; }
    if (dirty) persistUrlCache();
};

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
    const targets = [path as string, thumbPathOf(path as string)];
    dropCachedUrls(targets);   // ② 快取同步清（避免殘留 404 鑰匙）
    await supabase.storage.from(BUCKET).remove(targets);
}

// 批次把多個路徑換成 signed URL（一次 API，不逐張呼叫）。
// ② 快取層：命中（未過期且餘命 > 邊際）直接回、只簽 miss——全 App 簽名的唯一咽喉點，所有呼叫端自動受益。
export async function signPaths(paths: (string | undefined)[]): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    const real = Array.from(new Set(paths.filter(isStoragePath))) as string[];
    if (real.length === 0) return map;

    const cache = getUrlCache();
    const now = Date.now();
    const misses: string[] = [];
    for (const p of real) {
        const hit = cache[p];
        if (hit && hit.u && hit.e - now > REUSE_MARGIN_MS) map[p] = hit.u;          // 正面命中
        else if (hit && !hit.u && hit.e > now) { /* 負面命中：已知不存在，24h 內不重試 */ }
        else misses.push(p);
    }
    if (misses.length === 0) return map;

    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(misses, SIGNED_TTL);
    const expiresAt = now + SIGNED_TTL * 1000;
    const negExpiresAt = now + 24 * 60 * 60 * 1000;   // 負面快取 24h（test06 抓到：舊封面的影子縮圖不存在＝每次冷啟白簽）
    const got = new Set<string>();
    data?.forEach(item => {
        if (item.path && item.signedUrl) {
            map[item.path] = item.signedUrl;
            cache[item.path] = { u: item.signedUrl, e: expiresAt };
            got.add(item.path);
        }
    });
    for (const p of misses) if (!got.has(p)) cache[p] = { u: '', e: negExpiresAt };   // 簽不到＝記負面
    persistUrlCache();
    return map;
}

// 蒐集一個行程裡所有「Storage 路徑」型的圖片（封面＋封面縮圖 + 記帳照片 + 回憶照片＋回憶縮圖影子檔）
export function collectTripImagePaths(trip: Trip): string[] {
    const paths: (string | undefined)[] = [trip.coverImagePath, ...(trip.memoryPhotoPaths || [])];
    if (isStoragePath(trip.coverImagePath)) paths.push(thumbPathOf(trip.coverImagePath as string));
    (trip.memoryPhotoPaths || []).forEach(p => { if (isStoragePath(p)) paths.push(thumbPathOf(p)); });
    trip.days?.forEach(d => d.activities?.forEach(a => { paths.push(a.expenseImagePath); paths.push(a.imagePath); }));
    return Array.from(new Set(paths.filter(isStoragePath))) as string[];
}

// 批次刪除多張圖（只刪真正的 Storage 路徑；回憶照片的縮圖影子檔一併帶走）
export async function deleteTripImages(paths: (string | undefined)[]): Promise<void> {
    const real = Array.from(new Set(paths.filter(isStoragePath))) as string[];
    if (real.length === 0) return;
    const withThumbs = Array.from(new Set([...real, ...real.map(thumbPathOf)]));
    dropCachedUrls(withThumbs);   // ② 快取同步清
    await supabase.storage.from(BUCKET).remove(withThumbs);
}

// 載入後：把行程內圖片路徑換成 signed URL 供顯示（找不到的保留原值＝舊 base64/http passthrough）
export function resolveTripImages(trip: Trip, urlMap: Record<string, string>): Trip {
    const next: Trip = { ...trip };
    if (trip.coverImagePath && urlMap[trip.coverImagePath]) {
        next.coverImage = urlMap[trip.coverImagePath];
        // 封面縮圖（封面縮圖小批）：影子檔有簽到才給；舊封面沒有＝undefined → 顯示端退回大圖
        const ct = urlMap[thumbPathOf(trip.coverImagePath)];
        if (ct) next.coverImageThumb = ct;
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
            activities: (d.activities || []).map(a => {
                let out = a;
                if (a.expenseImagePath && urlMap[a.expenseImagePath]) out = { ...out, expenseImage: urlMap[a.expenseImagePath] };
                if (a.imagePath && urlMap[a.imagePath]) out = { ...out, image: urlMap[a.imagePath] };   // 瘦身①b
                return out;
            }),
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
    delete next.coverImageThumb;     // 封面縮圖 signed URL 同規則（封面縮圖小批）
    if (trip.days) {
        next.days = trip.days.map(d => ({
            ...d,
            activities: (d.activities || []).map(a => {
                let out = a;
                if (a.expenseImagePath) out = { ...out, expenseImage: '' };
                if (a.imagePath) out = { ...out, image: '' };   // 瘦身①b：有路徑就不讓顯示值入庫
                return out;
            }),
        }));
    }
    return next;
}
