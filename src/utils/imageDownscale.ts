// src/utils/imageDownscale.ts
// 🖼️ 送 AI 辨識前的影像縮圖（2026-08-14 資安批）。
// 為什麼要在客戶端做：
//   ① 成本——OCR/抽取用不到原始解析度，30MB 手機照 base64 後 40MB 打進 Edge Function，
//     錢在「送出去」那一刻就花了；長邊 1600px 對文件辨識綽綽有餘。
//   ② 延遲——上傳量縮一個數量級，使用者等的時間跟著縮。
//   ③ 與伺服端護欄成對：ai-proxy 的 vision 有 base64 大小硬上限（超過直接拒），
//     客戶端先縮，正常使用者永遠碰不到那道牆——**前端擋君子，後端擋直接打 API 的人**。
// 失敗策略：瀏覽器解不開的格式（部分 HEIC）→ 退回原檔 base64，但仍受大小上限保護。

/** 送 AI 前的原始檔案大小硬上限（超過連讀都不讀，直接請使用者換張圖） */
export const AI_IMAGE_MAX_BYTES = 15 * 1024 * 1024;   // 15MB

const MAX_EDGE = 1600;      // 長邊上限（文件辨識實測足夠）
const JPEG_QUALITY = 0.85;  // 文字邊緣仍銳利的最低壓縮

/** File → 純 base64（無 data: 前綴）。能縮就縮；解碼失敗退回原檔。 */
export async function fileToAiBase64(file: File): Promise<string> {
    if (file.size > AI_IMAGE_MAX_BYTES) {
        throw new Error('圖片太大了（上限 15MB），請換一張或先截圖');
    }
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no-2d-context');
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const b64 = dataUrl.split(',')[1] || '';
        if (!b64) throw new Error('empty-b64');
        return b64;
    } catch {
        // 解不開（HEIC 等）→ 原檔直接轉 base64（已受 15MB 上限保護；伺服端另有硬上限）
        return await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => {
                const b64 = String(r.result).split(',')[1] || '';
                if (b64) resolve(b64);
                else reject(new Error('讀取圖片失敗'));
            };
            r.onerror = () => reject(new Error('讀取圖片失敗'));
            r.readAsDataURL(file);
        });
    }
}
