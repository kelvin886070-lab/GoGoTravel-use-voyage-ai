// src/services/tripSlimming.ts
// 🐘 trips 瘦身（效能量測批①・一次性背景遷移）：trip_data 內殘留的 base64 圖片 → Storage 路徑。
//   為什麼：真機量測（test-04）冷啟 `trips` 查詢 4.7MB／3.8s——行程純文字 JSON 應為幾十 KB，
//   肥大源＝Storage 遷移（2.2）以前的舊行程把封面/記帳照片以 base64 直接嵌在 JSON 裡。
//   雙重危害：每次冷啟搬 4.7MB（等待）＋吃 DB egress（錢）。
//   設計原則：
//   - 冪等：換完路徑（coverImagePath/expenseImagePath 就位）就不再命中；單圖失敗＝略過、下次冷啟續跑。
//   - 兩段式（patch 模式）防競態：上傳期間使用者可能編輯行程——上傳基於快照、「套用」時以
//     當下 state 合併且逐欄位再驗（欄位仍是 base64 才換），舊快照永不覆蓋新編輯。
//   - 上傳沿用既有壓縮管線（封面走影子縮圖版），順手把老圖也壓到 1200px 規格。
import type { Trip } from '../types';
import { uploadTripImage, uploadTripImageWithThumb, signPaths, thumbPathOf } from './storage';

const isDataUrl = (s?: string): boolean => !!s && s.startsWith('data:');

/** 這趟是否還有 base64 殘留（冪等判準）。①b：活動縮圖 image 欄位一併涵蓋（HAR 解剖抓到的漏網欄位）。 */
export const tripNeedsSlimming = (t: Trip): boolean =>
    (isDataUrl(t.coverImage) && !t.coverImagePath) ||
    (t.days || []).some(d => (d.activities || []).some(a =>
        (isDataUrl(a.expenseImage) && !a.expenseImagePath) || (isDataUrl(a.image) && !a.imagePath)));

const dataUrlToFile = async (dataUrl: string): Promise<File> => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], 'legacy.jpg', { type: blob.type || 'image/jpeg' });
};

export interface SlimPatch {
    tripId: string;
    cover?: { path: string; url: string; thumbUrl?: string };
    /** 活動層的圖：field 指明來源欄位（expenseImage＝記帳照／image＝活動縮圖） */
    expenses: Array<{ activityId: string; field: 'expenseImage' | 'image'; path: string; url: string }>;
}

/** 依快照上傳所有 base64 圖，產出 patch（不動 state、不寫 DB）。全部失敗/無事可做 → null。 */
export async function buildSlimPatch(trip: Trip): Promise<SlimPatch | null> {
    if (!tripNeedsSlimming(trip)) return null;
    const patch: SlimPatch = { tripId: trip.id, expenses: [] };

    if (isDataUrl(trip.coverImage) && !trip.coverImagePath) {
        try {
            const path = await uploadTripImageWithThumb(await dataUrlToFile(trip.coverImage as string));
            const map = await signPaths([path, thumbPathOf(path)]);
            if (map[path]) patch.cover = { path, url: map[path], thumbUrl: map[thumbPathOf(path)] };
        } catch { /* 單圖失敗＝略過，下次冷啟續跑 */ }
    }

    for (const d of trip.days || []) {
        for (const a of d.activities || []) {
            if (!a.id) continue;
            const fields: Array<'expenseImage' | 'image'> = [];
            if (isDataUrl(a.expenseImage) && !a.expenseImagePath) fields.push('expenseImage');
            if (isDataUrl(a.image) && !a.imagePath) fields.push('image');
            for (const field of fields) {
                try {
                    const path = await uploadTripImage(await dataUrlToFile(a[field] as string));
                    const map = await signPaths([path]);
                    if (map[path]) patch.expenses.push({ activityId: a.id, field, path, url: map[path] });
                } catch { /* 同上 */ }
            }
        }
    }
    return (patch.cover || patch.expenses.length > 0) ? patch : null;
}

/** 把 patch 套到「當下」的 trip：逐欄位再驗（仍是 base64 才換）。毫無變更 → 回原參照（呼叫端可據此跳過存檔）。 */
export function applySlimPatch(t: Trip, patch: SlimPatch): Trip {
    let changed = false;
    const next: Trip = { ...t };

    if (patch.cover && isDataUrl(next.coverImage) && !next.coverImagePath) {
        next.coverImagePath = patch.cover.path;
        next.coverImage = patch.cover.url;
        if (patch.cover.thumbUrl) next.coverImageThumb = patch.cover.thumbUrl;
        changed = true;
    }

    if (patch.expenses.length > 0 && next.days) {
        const byKey = new Map(patch.expenses.map(e => [`${e.activityId}|${e.field}`, e]));
        next.days = next.days.map(d => ({
            ...d,
            activities: (d.activities || []).map(a => {
                if (!a.id) return a;
                let out = a;
                const ex = byKey.get(`${a.id}|expenseImage`);
                if (ex && isDataUrl(out.expenseImage) && !out.expenseImagePath) {
                    out = { ...out, expenseImagePath: ex.path, expenseImage: ex.url };
                    changed = true;
                }
                const im = byKey.get(`${a.id}|image`);
                if (im && isDataUrl(out.image) && !out.imagePath) {
                    out = { ...out, imagePath: im.path, image: im.url };
                    changed = true;
                }
                return out;
            }),
        }));
    }
    return changed ? next : t;
}
