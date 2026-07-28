// src/components/brand/BrandLogo.tsx
// 🎟️ 品牌識別：戳章符號 + 襯線字標。
//   戳章直接用 Kelvin 微調後的向量檔 public/brand/kt-mark.svg（綠戳章、透明底），
//   保證 App 內（header/開場動畫）與 App 圖示同一套設計、不會兩邊長不一樣。
//   App 圖示（奶油×綠底）走 public/icons/*.png（由 brand-assets/KELVINTRIP.svg 生成）。
import React from 'react';

export const BrandStamp: React.FC<{ size?: number; className?: string }> = ({ size = 96, className }) => (
    <img src="/brand/kt-mark.svg" width={size} height={size} alt="Kelvin Trip" draggable={false} className={className} style={{ display: 'block' }} />
);

export const BrandWordmark: React.FC<{ size?: number; color?: string; dotColor?: string }> = ({ size = 20, color = '#232320', dotColor = '#3F6B52' }) => (
    <span style={{ fontFamily: "Georgia, 'Noto Serif TC', serif", fontWeight: 700, fontSize: size, color, lineHeight: 1 }}>
        Kelvin&nbsp;Trip<span style={{ color: dotColor }}>.</span>
    </span>
);
