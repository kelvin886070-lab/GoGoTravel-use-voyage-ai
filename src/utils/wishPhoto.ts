// src/utils/wishPhoto.ts
// 🖼️ Stage 2 圖源（免費組合）：有使用者上傳圖就用圖；沒有 → 依分類給「底圖樣式」。
//   分類底圖不是真實照片，而是「柔和底色 + 分類圖示」，讓照片牆永遠有畫面、$0、不違反 Google ToS。
//   未來要接 Google Places Photo（付費）時，只要在這裡多一層 fallback 即可。
import type { WishItem } from '../types';
import { categoryKeyOf, type WishCategory } from './wishCategory';

// 分類底圖：柔和底色 + 前景色（給圖示用）。色系呼應 app 的奶油/大地調。
const CATEGORY_STYLE: Record<WishCategory, { bg: string; fg: string }> = {
    cafe: { bg: '#EAE6DD', fg: '#8A6D3B' },
    food: { bg: '#EFE4DA', fg: '#B4552F' },
    sight: { bg: '#E3EBDD', fg: '#3B6D11' },
    shop: { bg: '#E9E4EC', fg: '#6E4B86' },
    bar: { bg: '#E7E1EA', fg: '#7A3B6B' },
    other: { bg: '#E9E5DC', fg: '#45846D' },
};

export interface WishPhoto {
    kind: 'image' | 'placeholder';
    src?: string;              // kind==='image' 時的圖片網址（customImage）
    bg: string;                // placeholder 底色（image 時當載入前底色）
    fg: string;                // placeholder 圖示前景色
    category: WishCategory;
}

export function wishPhotoOf(w: WishItem): WishPhoto {
    const category = categoryKeyOf(w);
    const style = CATEGORY_STYLE[category];
    if (w.customImage) {
        return { kind: 'image', src: w.customImage, bg: style.bg, fg: style.fg, category };
    }
    return { kind: 'placeholder', bg: style.bg, fg: style.fg, category };
}
