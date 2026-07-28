// src/components/wish/RatingInline.tsx
// 🌟 A 樣式評分：貼在店名旁的 mono 數字＋「信心星」。不做成膠囊，避免和地點/標籤膠囊混在一起。
//   實心 gold 星＝評論數相對「這批清單」足夠（口碑扎實）；
//   半透明空心星＋柔化數字＝評論相對少（參考就好）。判定見 utils/ratingScore.ts。
import React from 'react';
import { Star } from 'lucide-react';
import { isConfident } from '../../utils/ratingScore';

// 評論數縮寫：486→486、1202→1.2k、48210→48k
function fmtCount(n: number): string {
    if (n < 1000) return `${n}`;
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
}

export const RatingInline: React.FC<{ rating?: number; ratingCount?: number; reviewMedian?: number }> = ({ rating, ratingCount, reviewMedian = 0 }) => {
    if (rating == null) return null;
    const confident = isConfident(ratingCount, reviewMedian);
    const starColor = confident ? '#E7B23A' : '#C4BEB0';
    const numColor = confident ? '#232320' : '#A9A395';
    const countColor = confident ? '#B4AE9E' : '#C4BEB0';
    return (
        <span className="inline-flex items-center gap-[3px] font-mono text-[12px] font-bold whitespace-nowrap flex-shrink-0" style={{ color: numColor }}>
            <Star className="w-[11px] h-[11px]" style={{ color: starColor }} fill={confident ? '#E7B23A' : 'none'} />
            {rating.toFixed(1)}
            {ratingCount != null && <span className="font-normal" style={{ color: countColor }}> ·{fmtCount(ratingCount)}</span>}
        </span>
    );
};
