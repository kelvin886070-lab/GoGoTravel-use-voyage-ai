// src/utils/ratingScore.ts
// 🌟 評分排序與「信心星」的數學核心（純前端、零 API）。
//
// ── 為什麼需要這支檔案 ──────────────────────────────────────────────
// Google 評分有個經典陷阱：`4.9（3 則評論）` 看起來比 `4.6（1200 則）` 高，
// 但後者其實可信得多。若直接用「評分高到低」排序，冷門店的少數好評會不當地
// 壓過口碑成熟的名店。
//
// 更麻煩的是「多少評論才算多」會隨情境變：使用者篩 #小店 標籤時大家可能只有
// 幾十則；搜國家級景點時動輒上萬則。所以我們**不用固定門檻**，而是一切都
// 「相對於使用者當前正在看的這批清單」來計算。
//
// ── 貝氏加權評分（IMDB Weighted Rating）─────────────────────────────
//   WR = (v / (v + m)) * R  +  (m / (v + m)) * C
//     R = 這家店的平均評分（rating）
//     v = 這家店的評論數（ratingCount）
//     C = 「這批清單」的平均評分（先驗平均 / prior mean）
//     m = 先驗權重，這裡取「這批清單的評論數中位數」
//
// 直覺：評論數 v 遠大於 m 時，WR 幾乎等於 R（相信它自己的分數）；
//       v 遠小於 m 時，WR 被往整批平均 C 拉（分數少人評，先別太當真）。
//   → 同質清單（大家評論數差不多）裡，排序看起來幾乎就是純評分；
//     只有出現「高分但超少人評」的離群值時，才會被悄悄壓下去。平滑、不用硬切。
// ────────────────────────────────────────────────────────────────────

interface Rated { type?: string; rating?: number; ratingCount?: number }

export interface RatingStats {
    /** C：這批清單的平均評分（貝氏先驗平均）。 */
    C: number;
    /** m：先驗權重＝這批清單的評論數中位數（少於它的地點會被往 C 拉）。 */
    m: number;
    /** 這批清單的評論數中位數，供「信心星」實心/空心判定（與 m 同值，語意獨立故另取名）。 */
    medianCount: number;
}

function mean(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function median(nums: number[]): number {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

/**
 * 從「當前清單」算出貝氏所需的 C（平均分）與 m（評論數中位數）。
 * 只納入「有評分的地點」；沒有任何有評分地點時回退安全值。
 */
export function computeRatingStats(items: Rated[]): RatingStats {
    const rated = items.filter(i => i.type === 'place' && typeof i.rating === 'number');
    if (rated.length === 0) return { C: 0, m: 1, medianCount: 0 };
    const C = mean(rated.map(r => r.rating as number));
    const med = median(rated.map(r => r.ratingCount ?? 0));
    // m 至少為 1，避免除以 (v + 0) 讓權重失效。
    return { C, m: Math.max(1, med), medianCount: med };
}

/** 貝氏加權評分 WR（見檔頭公式）。rating 為 0–5，回傳同尺度的加權分。 */
export function bayesianScore(rating: number, count: number, C: number, m: number): number {
    const v = Math.max(0, count);
    return (v / (v + m)) * rating + (m / (v + m)) * C;
}

/**
 * 「信心星」判定：這家店的評論數相對「這批中位數」是否足夠 → 實心★；否則空心☆。
 * 門檻取中位數的一半：達到就算口碑扎實。無基準（medianCount=0）時一律視為足夠，
 * 避免整批都畫成空心。
 */
export function isConfident(count: number | undefined, medianCount: number): boolean {
    if (!medianCount) return true;
    return (count ?? 0) >= medianCount * 0.5;
}

/** 便捷函式：直接取「這批清單」的評論數中位數（信心星用）。 */
export function reviewMedian(items: Rated[]): number {
    return computeRatingStats(items).medianCount;
}
