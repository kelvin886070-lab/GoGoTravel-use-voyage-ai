// src/utils/wishCategory.ts
// 🧱 D8：心願分類的「單一真相」——WishBoxView（圖示/顏色）與 scheduler（停留/活動類型）共用。
import type { WishItem } from '../types';

export type WishCategory = 'cafe' | 'food' | 'sight' | 'shop' | 'bar' | 'other';

export const categoryKeyOf = (w: WishItem): WishCategory => {
    const hay = `${w.title} ${(w.tags || []).join(' ')} ${w.notes || ''}`.toLowerCase();
    if (/咖啡|cafe|coffee|珈琲|甜點|蛋糕|bakery|麵包|菓/.test(hay)) return 'cafe';
    if (/酒|bar|pub|居酒屋/.test(hay)) return 'bar';
    if (/餐|食|拉麵|飯|麵|壽司|燒|鍋|restaurant|eat|bistro|diner|小吃|早午餐|brunch/.test(hay)) return 'food';
    if (/店|shop|買|市場|mall|百貨|藥妝|outlet/.test(hay)) return 'shop';
    if (/museum|美術|神社|寺|公園|park|塔|館|城|景|古蹟|展/.test(hay)) return 'sight';
    return 'other';
};
