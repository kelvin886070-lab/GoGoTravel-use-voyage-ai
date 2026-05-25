// src/utils/imageUtils.ts

/**
 * 9.0 前端圖片壓縮引擎 (Image Compression Engine)
 * 解決高解析度原圖導致 PDF 渲染器 (React-PDF) 記憶體溢出 (OOM) 變黑畫面的問題。
 * * @param file 來源圖檔 (File Object)
 * @param maxWidth 限制的最大寬度 (預設 1200px，完美相容 A4 寬度)
 * @param quality JPEG 壓縮品質 (0.0 ~ 1.0，預設 0.8 為視覺與容量的最佳平衡點)
 * @returns 壓縮後的 Base64 字串 (Promise)
 */
export const compressImage = (
    file: File, 
    maxWidth: number = 1200, 
    quality: number = 0.8
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                // 1. 計算等比例縮放後的尺寸
                let targetWidth = img.width;
                let targetHeight = img.height;

                // 若原圖寬度超過上限，則進行等比例縮放
                if (targetWidth > maxWidth) {
                    const ratio = maxWidth / targetWidth;
                    targetWidth = maxWidth;
                    targetHeight = Math.round(img.height * ratio);
                }

                // 2. 建立離線 Canvas (Off-screen Canvas)
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('無法取得 Canvas 2D 渲染環境'));
                    return;
                }

                // 3. 防禦機制：如果原圖是透明 PNG，轉存 JPEG 會導致透明區變黑
                // 解法：在畫圖之前，先用純白色填滿整個畫布
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                
                // 4. 將圖片重新繪製到縮小後的 Canvas 上
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                // 5. 破壞性壓縮匯出：轉為 JPEG 格式並套用 quality 參數
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };

            img.onerror = () => reject(new Error('圖片載入或解析失敗'));
        };

        reader.onerror = () => reject(new Error('實體檔案讀取失敗'));
        
        // 啟動讀取器
        reader.readAsDataURL(file);
    });
};