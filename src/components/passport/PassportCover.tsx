// src/components/passport/PassportCover.tsx
// 🛂 護照封面（批② · Kelvin 定稿）：深綠漸層＋燙金——細金框、PASSPORT、中央戳章徽、
//   「旅人護照 / TRAVELER DOCUMENT」。封面＝品牌層（像真護照封面是國家不是人），
//   名字不上封面（翻開的個資頁才是你）；底部不放數字（美感優先，統計住個資頁）。
import React from 'react';

const GOLD = '#C9B98F';

export const PassportCover: React.FC = () => (
    <div
        className="w-full h-full flex flex-col items-center relative select-none"
        style={{ background: 'linear-gradient(160deg, #3A6350, #2C5240 55%, #254536)', borderRadius: 16 }}
    >
        {/* 細金框 */}
        <div style={{ position: 'absolute', inset: 10, border: `1px solid rgba(201,185,143,0.55)`, borderRadius: 10, pointerEvents: 'none' }} />

        <div className="font-mono" style={{ marginTop: '13%', fontSize: 15, letterSpacing: '0.44em', color: GOLD }}>PASSPORT</div>

        {/* 中央戳章徽：Kelvin 正式 logo 的燙金版（brand-assets 原稿去背＋綠換金，見 public/brand/kt-mark-gold.svg） */}
        <img src="/brand/kt-mark-gold.svg" width={196} height={196} alt="Kelvin Trip" draggable={false} style={{ marginTop: '5%', display: 'block' }} />

        <div className="font-serif" style={{ marginTop: '10%', fontSize: 26, fontWeight: 700, color: '#E7DDC4', letterSpacing: '0.08em' }}>旅人護照</div>
        <div className="font-mono" style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.32em', color: 'rgba(201,185,143,0.75)' }}>TRAVELER&nbsp;DOCUMENT</div>

        <div className="font-serif" style={{ position: 'absolute', bottom: 20, fontSize: 11, letterSpacing: '0.24em', color: 'rgba(201,185,143,0.55)' }}>輕觸翻開</div>

        {/* 書口（右緣頁緣感） */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, borderRadius: '0 16px 16px 0', background: 'linear-gradient(90deg, rgba(0,0,0,0.18), rgba(255,255,255,0.06))', pointerEvents: 'none' }} />
    </div>
);
