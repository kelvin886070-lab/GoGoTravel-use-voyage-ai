// src/components/passport/PassportBook.tsx
// 🛂 護照翻頁引擎（批② · T2 級）：核心模型＝「連續閱讀位置 p」（單一 motionValue）——
//   p=0 封面闔上、p=1 翻開到第一頁、p=k 已翻過 k 張。每張頁的 rotateY 由 p 導出：
//   sheet i 在 p∈[i, i+1] 間從 0° 轉到 -180°（繞左緣書脊、帶透視）。
//   跟手拖拽（水平 pan 直接推 p）、放手依進度+速度補完、點左右緣翻頁，
//   全部共用同一條數學 → 不存在多套狀態互打。
//   感官層：動態翻頁陰影（翻到一半最深＝紙的重量感）＋紙質背面（>90° 看到的是紙背不是鏡像字）。
//   開啟（Kelvin 定案）：封面由使用者親手翻開（儀式感，無自動翻）；session 內記住停留頁，再進直接回到該頁。
//   音效：留 stub（批⑥ 接素材與開關）。
import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, type MotionValue } from 'framer-motion';

const OPENED_KEY = 'kt_pp_open';    // 本 session 已翻開過
const PAGE_KEY = 'kt_pp_page';      // 上次停留頁（session）
const HINT_KEY = 'kt_pp_hint';      // 首次翻頁提示已看過（永久）
// ⚠️ 自動翻開已移除（Kelvin 定案）：封面由使用者親手翻開＝儀式感；session 內記住停留頁不變。
// 翻頁彈簧：偏慢偏穩（真書頁的重量），Kelvin 兩輪反饋後定為 72/19/1.15（更沉、更有質感）。
const FLIP_SPRING = { type: 'spring', stiffness: 72, damping: 19, mass: 1.15 } as const;
// 拖拽靈敏度：滑 78% 寬度＝翻滿一頁（全寬才翻滿會覺得「重、卡」）。
const DRAG_RATIO = 0.78;

// 🎵 批⑥接素材：翻頁完成的紙聲（此處先留接口，永不 throw）
export const playFlipSound = () => { /* stub：批⑥ 實作（素材＋設定開關） */ };

// 單張書頁：正面內容＋紙質背面＋動態陰影。rotateY 由連續位置 p 導出。
const Sheet: React.FC<{
    i: number;
    p: MotionValue<number>;
    zIndex: number;
    flipped: boolean;            // 已完全翻過（隱形且不可點）
    children: React.ReactNode;
}> = ({ i, p, zIndex, flipped, children }) => {
    const rotateY = useTransform(p, [i, i + 1], [0, -180]);
    const shade = useTransform(p, [i, i + 0.5, i + 1], [0, 0.30, 0]);
    return (
        <motion.div
            style={{
                position: 'absolute', inset: 0, transformOrigin: 'left center',
                transformStyle: 'preserve-3d', rotateY, zIndex,
                pointerEvents: flipped ? 'none' : 'auto',
                willChange: 'transform',   // 手感：讓瀏覽器把頁面提前放上 GPU 圖層
            }}
        >
            {/* 正面：頁面內容＋翻頁陰影 */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)' }}>
                {children}
                <motion.div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(0,0,0,0.45), rgba(0,0,0,0) 60%)', opacity: shade, pointerEvents: 'none' }} />
            </div>
            {/* 背面：紙質（翻超過 90° 時看到的那一面） */}
            <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 16, background: '#EFE9DA', border: '1px solid #E0D8C6' }} />
        </motion.div>
    );
};

export const PassportBook: React.FC<{
    cover: React.ReactNode;
    pages: React.ReactNode[];
    /** 目前頁變更回呼（頁碼指示外掛用） */
    onPageChange?: (idx: number) => void;
}> = ({ cover, pages, onPageChange }) => {
    const sheets = [cover, ...pages];
    const maxP = sheets.length - 1;

    // 初始位置：session 已翻開過 → 直接回上次頁；否則封面
    const initial = (() => {
        try {
            if (sessionStorage.getItem(OPENED_KEY)) {
                const saved = Number(sessionStorage.getItem(PAGE_KEY));
                if (Number.isFinite(saved)) return Math.min(Math.max(saved, 0), maxP);
            }
        } catch { /* ignore */ }
        return 0;
    })();

    const p = useMotionValue(initial);
    const [idx, setIdx] = useState(initial);          // 已定格的頁（整數）
    const [hint, setHint] = useState(false);          // 首次翻頁提示
    const containerRef = useRef<HTMLDivElement>(null);
    const panState = useRef<{ from: number; horizontal: boolean | null }>({ from: 0, horizontal: null });

    const settle = (target: number) => {
        const t = Math.min(Math.max(Math.round(target), 0), maxP);
        // 頁碼指示「翻頁一開始」就同步（不等彈簧收尾——Kelvin 反饋延遲/慢半拍）；
        // idx（pointerEvents 用）仍等動畫完成才切，避免翻到一半頁面互動錯亂。
        if (t !== idx) onPageChange?.(t);
        try {
            sessionStorage.setItem(PAGE_KEY, String(t));
            if (t >= 1) sessionStorage.setItem(OPENED_KEY, '1');
        } catch { /* ignore */ }
        animate(p, t, FLIP_SPRING).then(() => {
            setIdx(t);
            if (t !== idx) playFlipSound();
            try {
                if (t >= 1 && !localStorage.getItem(HINT_KEY)) { setHint(true); localStorage.setItem(HINT_KEY, '1'); }
            } catch { /* ignore */ }
        });
    };

    // 提示自動淡出
    useEffect(() => {
        if (!hint) return;
        const t = window.setTimeout(() => setHint(false), 2600);
        return () => window.clearTimeout(t);
    }, [hint]);

    // 點擊：封面任意處＝翻開；內頁點右緣 30%＝下一頁、左緣 30%＝上一頁；互動元素放行
    const onTap = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, [data-no-flip]')) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        if (idx === 0) { settle(1); return; }
        if (x > rect.width * 0.7) settle(idx + 1);
        else if (x < rect.width * 0.3) settle(idx - 1);
    };

    // 跟手拖拽：水平位移直接推 p（-dx/寬 ＝ 翻頁進度）；垂直手勢放行給頁內捲動
    const onPanStart = () => {
        panState.current = { from: p.get(), horizontal: null };
    };
    const onPan = (_: unknown, info: { offset: { x: number; y: number } }) => {
        const s = panState.current;
        if (s.horizontal === null) {
            if (Math.abs(info.offset.x) < 6 && Math.abs(info.offset.y) < 6) return;   // 還看不出方向
            s.horizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y);
        }
        if (!s.horizontal) return;
        const w = (containerRef.current?.getBoundingClientRect().width || 320) * DRAG_RATIO;
        const next = Math.min(Math.max(s.from + (-info.offset.x / w), 0), maxP);
        p.set(next);
    };
    const onPanEnd = (_: unknown, info: { velocity: { x: number } }) => {
        const s = panState.current;
        if (!s.horizontal) return;
        const w = (containerRef.current?.getBoundingClientRect().width || 320) * DRAG_RATIO;
        const projected = p.get() + (-info.velocity.x / w) * 0.16;   // 甩動速度也算進去
        settle(projected);
    };

    return (
        <motion.div
            ref={containerRef}
            onClick={onTap}
            onPanStart={onPanStart}
            onPan={onPan}
            onPanEnd={onPanEnd}
            style={{ position: 'relative', width: '100%', height: '100%', perspective: 1400, touchAction: 'pan-y' }}
        >
            {sheets.map((content, i) => (
                <Sheet key={i} i={i} p={p} zIndex={sheets.length - i} flipped={i < idx}>
                    {content}
                </Sheet>
            ))}

            {/* 首次翻頁提示（一次性，2.6s 淡出） */}
            {hint && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none" style={{ zIndex: 99 }}>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-white px-3 py-1.5 rounded-full" style={{ background: 'rgba(35,35,32,0.72)' }}>
                        ← 滑動或點邊緣翻頁 →
                    </span>
                </div>
            )}
        </motion.div>
    );
};
