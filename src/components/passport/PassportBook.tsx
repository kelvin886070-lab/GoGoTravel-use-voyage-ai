// src/components/passport/PassportBook.tsx
// 🛂 護照翻頁引擎（批② · T2 級）：核心模型＝「連續閱讀位置 p」（單一 motionValue）——
//   p=0 封面闔上、p=1 翻開到第一頁、p=k 已翻過 k 張。每張頁的 rotateY 由 p 導出：
//   sheet i 在 p∈[i, i+1] 間從 0° 轉到 -180°（繞左緣書脊、帶透視）。
//   點左右緣翻頁＋外部 goTo 跳頁（ref API，目錄/頁點用），全部共用同一條數學 → 不存在多套狀態互打。
//   滑動翻頁已退役（Kelvin 定案）：手勢空間全讓給頁內內容，互動模型＝「點＝翻頁、滑＝頁內」。
//   跳頁 riffle：距離 >1 頁時用 tween（每頁 ~0.16s、全程封頂 1.6s）——連續 p 模型會讓中間頁自動依序嘩啦翻過。
//   感官層：動態翻頁陰影（翻到一半最深＝紙的重量感）＋紙質背面（>90° 看到的是紙背不是鏡像字）。
//   開啟（Kelvin 定案）：封面由使用者親手翻開（儀式感，無自動翻）；session 內記住停留頁，再進直接回到該頁。
//   音效：留 stub（批⑥ 接素材與開關）。
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, type MotionValue } from 'framer-motion';

const OPENED_KEY = 'kt_pp_open';    // 本 session 已翻開過
const PAGE_KEY = 'kt_pp_page';      // 上次停留頁（session）
const HINT_KEY = 'kt_pp_hint';      // 首次翻頁提示已看過（永久）
// ⚠️ 自動翻開已移除（Kelvin 定案）：封面由使用者親手翻開＝儀式感；session 內記住停留頁不變。
// 翻頁彈簧：偏慢偏穩（真書頁的重量），Kelvin 兩輪反饋後定為 72/19/1.15（更沉、更有質感）。
const FLIP_SPRING = { type: 'spring', stiffness: 72, damping: 19, mass: 1.15 } as const;

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

export interface PassportBookHandle {
    /** 跳到第 n 張（0=封面）。距離 >1 自動 riffle 快翻。 */
    goTo: (target: number) => void;
}

export const PassportBook = forwardRef<PassportBookHandle, {
    cover: React.ReactNode;
    pages: React.ReactNode[];
    /** 目前頁變更回呼（頁碼指示外掛用） */
    onPageChange?: (idx: number) => void;
}>(({ cover, pages, onPageChange }, ref) => {
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

    const settle = (target: number) => {
        const t = Math.min(Math.max(Math.round(target), 0), maxP);
        const dist = Math.abs(t - idx);
        // riffle：跳多頁改用 tween，中間頁依序翻過；節奏放慢（每頁 ~0.16s、封頂 1.6s）——
        // 太快會讓紙變輕、質感減分（Kelvin 反饋調降）。單頁維持書頁彈簧。
        const transition = dist > 1
            ? ({ duration: Math.min(1.6, 0.16 * dist + 0.3), ease: 'easeInOut' } as const)
            : FLIP_SPRING;
        // 頁碼指示「翻頁一開始」就同步（不等彈簧收尾——Kelvin 反饋延遲/慢半拍）；
        // idx（pointerEvents 用）仍等動畫完成才切，避免翻到一半頁面互動錯亂。
        if (t !== idx) onPageChange?.(t);
        try {
            sessionStorage.setItem(PAGE_KEY, String(t));
            if (t >= 1) sessionStorage.setItem(OPENED_KEY, '1');
        } catch { /* ignore */ }
        animate(p, t, transition).then(() => {
            setIdx(t);
            if (t !== idx) playFlipSound();
            try {
                if (t >= 1 && !localStorage.getItem(HINT_KEY)) { setHint(true); localStorage.setItem(HINT_KEY, '1'); }
            } catch { /* ignore */ }
        });
    };

    useImperativeHandle(ref, () => ({ goTo: settle }));

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

    return (
        <div
            ref={containerRef}
            onClick={onTap}
            style={{ position: 'relative', width: '100%', height: '100%', perspective: 1400 }}
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
                        ← 點左右邊緣或下方頁點翻頁 →
                    </span>
                </div>
            )}
        </div>
    );
});
PassportBook.displayName = 'PassportBook';
