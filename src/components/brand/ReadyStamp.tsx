// src/components/brand/ReadyStamp.tsx
// 🎟️ 批 C：「就緒」護照蓋章——五段里程碑全亮（readinessSummary.allReady）的獎勵時刻。
//   B＋C 定版：護照點線框／KELVIN TRIP／中心 PASS／底部「出發日」。
//   播放模型＝煙火（與 Kelvin 定案）：掛載時壓印「演一次」→ 停在蓋好的姿態（慶祝會結束才是慶祝）；
//   點章＝重播一次（播完自動停）。無限循環刻意不做（會膩、吃電、干擾回訪查資料）。
//   尊重系統「減少動態」：prefers-reduced-motion 直接顯示靜態蓋好姿態。
//   小尺寸（<80px）自動簡化：捨棄微環字、只留框＋PASS（legibility）。
//   ⚠️ 語意：PASS＝通關完成——「玩過的行程」（回憶卡）的印記；未出發的首頁 hero 不放（見 docs）。
import React, { useState } from 'react';

const GREEN = '#3F6B52';

export const ReadyStamp: React.FC<{
    /** 出發日（YYYY-MM-DD），顯示為 YYYY.MM.DD */
    startDate?: string;
    size?: number;
    /** 壓印動畫（演一次停住；點章重播）；false＝純靜態章 */
    animated?: boolean;
    /** 章色；照片封面上可用白色（預設品牌綠） */
    color?: string;
}> = ({ startDate, size = 104, animated = false, color = GREEN }) => {
    // runId：每 +1 就 remount 動畫節點 → 從頭重播一次（animation 跑完以 forwards 停在蓋好姿態）
    const [runId, setRunId] = useState(0);
    const compact = size < 80;                       // 小尺寸簡化：微字在 <80px 會糊，只留 PASS
    const date = (startDate || '').slice(0, 10).replace(/-/g, '.');

    // 章面（不含姿態/動畫；姿態由外層 wrapper 決定）
    const face = (
        <div style={{ width: size, height: size, borderRadius: '50%', border: `2px dashed ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: size * 0.82, height: size * 0.82, borderRadius: '50%', border: `1.5px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: size * 0.02 }}>
                {!compact && (
                    <span style={{ fontFamily: "ui-monospace, 'Roboto Mono', monospace", fontSize: Math.max(7, size * 0.08), letterSpacing: '.16em', color }}>KELVIN&nbsp;TRIP</span>
                )}
                <span style={{ fontFamily: "Georgia, 'Noto Serif TC', serif", fontWeight: 700, fontSize: size * (compact ? 0.3 : 0.23), letterSpacing: '.08em', color, lineHeight: 1 }}>PASS</span>
                {!compact && date && (
                    <span style={{ fontFamily: "ui-monospace, 'Roboto Mono', monospace", fontSize: Math.max(7, size * 0.08), letterSpacing: '.1em', color }}>{date}</span>
                )}
            </div>
        </div>
    );

    if (!animated) return <div style={{ transform: 'rotate(-8deg)' }}>{face}</div>;

    return (
        <button
            type="button"
            onClick={() => setRunId(r => r + 1)}
            aria-label="重播蓋章動畫"
            // 圓形 hit area（border-radius 會裁掉四角的點擊範圍），避免騎縫位置誤擋下方按鈕
            style={{ position: 'relative', width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
            {/* 油墨暈開圈：演完淡出（forwards 停在 opacity 0） */}
            <span key={`i${runId}`} className="kts-ink" style={{ position: 'absolute', inset: -(size * 0.06), borderRadius: '50%', border: `2px solid ${color}`, opacity: 0, pointerEvents: 'none' }} />
            <div key={`p${runId}`} className="kts-press" style={{ transform: 'rotate(-8deg)', willChange: 'transform' }}>{face}</div>
            <style>{`
                @keyframes kts-press{0%{transform:translateY(-${Math.round(size * 0.3)}px) scale(1.7) rotate(-15deg);opacity:0}55%{transform:translateY(0) scale(.9) rotate(-8deg);opacity:1}68%{transform:scale(1.05) rotate(-8deg)}100%{transform:translateY(0) scale(1) rotate(-8deg);opacity:1}}
                @keyframes kts-ink{0%,50%{transform:scale(.55);opacity:0}62%{opacity:.4}100%{transform:scale(1.7);opacity:0}}
                @media (prefers-reduced-motion: no-preference){
                    .kts-press{animation:kts-press 2.2s cubic-bezier(.2,.8,.3,1) 1 forwards}
                    .kts-ink{animation:kts-ink 2.2s ease-out 1 forwards}
                }
            `}</style>
        </button>
    );
};
