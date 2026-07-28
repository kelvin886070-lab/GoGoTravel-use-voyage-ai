// src/components/wish/DraggableSheet.tsx
// 🗺️ Level-2 容器：地圖全屏墊底、底部卡可上下拖（三吸附點：露一點/半屏/幾乎全屏）。
//   高度式（非 translate）。關鍵：把「展開卡」與「捲清單」耦合，解手機手勢衝突——
//   未到全屏 → 清單鎖捲、拖哪裡都是展開卡；到全屏 → 清單才可捲；全屏且捲到頂再下拖 → 收合。
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    header?: React.ReactNode;
    children: React.ReactNode;
    snaps?: number[];        // 可見高度佔容器比例，由小到大
    initialIndex?: number;
    collapseSignal?: number; // 外部遞增此值 → 卡收到最小（露出地圖）
    forceFull?: boolean;     // 鎖在全屏、停用拖曳（多選模式用）
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const DraggableSheet: React.FC<Props> = ({ header, children, snaps = [0.34, 0.64, 0.92], initialIndex = 1, collapseSignal = 0, forceFull = false }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [wrapH, setWrapH] = useState(0);
    const [idx, setIdx] = useState(initialIndex);
    const [dragH, setDragH] = useState<number | null>(null);
    const drag = useRef<{ startY: number; baseH: number; fromContent: boolean; active: boolean } | null>(null);

    const lastIdx = snaps.length - 1;
    const shownIdx = forceFull ? lastIdx : idx;
    const atFull = shownIdx === lastIdx;

    useEffect(() => {
        const measure = () => setWrapH(wrapRef.current?.clientHeight ?? 0);
        measure();
        const ro = new ResizeObserver(measure);
        if (wrapRef.current) ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, []);

    // 外部訊號 → 收到最小（露出地圖）
    useEffect(() => { if (collapseSignal > 0) setIdx(0); }, [collapseSignal]);

    const snapH = (i: number) => wrapH * snaps[i];
    const curH = (forceFull ? null : dragH) ?? snapH(shownIdx);

    const onDown = useCallback((e: React.PointerEvent) => {
        if (forceFull) return;
        const fromContent = !!contentRef.current?.contains(e.target as Node);
        drag.current = { startY: e.clientY, baseH: curH || snapH(idx), fromContent, active: false };
    }, [curH, idx, wrapH, forceFull]);

    const onMove = useCallback((e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dy = d.startY - e.clientY;           // 往上拖 → 正
        const scrollTop = contentRef.current?.scrollTop ?? 0;

        // 決定這次手勢是「拖卡」還是「讓清單原生捲動」
        if (d.fromContent && atFull) {
            // 全屏時：往上拖或清單還沒到頂 → 交給原生捲動，不劫持
            if (dy > 0 || scrollTop > 0) { d.active = false; return; }
        }
        d.active = true;
        const next = clamp(d.baseH + dy, snapH(0), snapH(lastIdx));
        setDragH(next);
    }, [atFull, lastIdx, wrapH, snaps]);

    const endDrag = useCallback(() => {
        const d = drag.current;
        drag.current = null;
        if (!d || !d.active) { setDragH(null); return; }
        const h = dragH ?? snapH(idx);
        let best = 0, bestD = Infinity;
        snaps.forEach((_, i) => { const dd = Math.abs(snapH(i) - h); if (dd < bestD) { bestD = dd; best = i; } });
        setIdx(best);
        setDragH(null);
    }, [dragH, idx, snaps, wrapH]);

    return (
        <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 bottom-0 bg-[#F2F2F2] rounded-t-[24px] shadow-[0_-8px_28px_rgba(0,0,0,0.10)] flex flex-col pointer-events-auto"
                 style={{ height: curH ? `${curH}px` : `${(snaps[initialIndex] * 100).toFixed(0)}%`, transition: dragH == null ? 'height .3s cubic-bezier(.25,.8,.35,1)' : 'none' }}
                 onPointerDown={onDown} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
                {/* 把手 + header（固定，永遠可拖） */}
                <div className="shrink-0 select-none" style={{ touchAction: 'none' }}>
                    {!forceFull && <div className="w-10 h-1 rounded-full bg-[#CFCCC3] mx-auto mt-2.5 mb-1.5 cursor-grab" />}
                    {header && <div className={`px-4 pb-1 ${forceFull ? 'pt-2.5' : ''}`}>{header}</div>}
                </div>
                {/* 內容：未到全屏鎖捲（拖動＝展開卡）；到全屏才可捲 */}
                <div ref={contentRef} className="flex-1 overflow-y-auto no-scrollbar overscroll-contain px-4 pb-32"
                     style={{ overflowY: atFull ? 'auto' : 'hidden', touchAction: atFull ? 'pan-y' : 'none' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};
