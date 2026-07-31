// src/components/passport/PhotoViewer.tsx
// 🛂 批⑤c（底片定稿）：回憶照片瀏覽器＝「一卷有重量的膠卷」。
//   類比物件家族（護照/紙/票券/印章）的同族成員：上下齒孔帶、細白框、KT-格號（膠卷邊緣印字）。
//   互動與護照一致（Kelvin 定案）：點左右緣換格、底部頁點可點跳；滑動不翻（手勢留給未來縮放）。
//   電影感＝疊化 crossfade 450ms＋極輕縮放（慢即是重量）；不做刮痕濾鏡/轉盤音效（過度擬物）。
//   頂列＝關閉／KT-格號計數／加照片／刪除（confirmDialog）。data-no-flip：不觸發護照翻頁。
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';
import { confirmDialog } from '../ConfirmDialog';

// 齒孔帶：黑帶上的一排小圓角方孔（CSS 漸層程序生成，零圖片資產）
const Sprockets: React.FC = () => (
    <div style={{
        height: 22, flexShrink: 0,
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(246,241,231,0.16) 10px 24px, transparent 24px 34px)',
        backgroundSize: '34px 10px', backgroundRepeat: 'repeat-x', backgroundPosition: 'center',
    }} />
);

export const PhotoViewer: React.FC<{
    photos: string[];            // signed URL（順序＝memoryPhotoPaths）
    start: number;
    adding: boolean;             // 上傳中（外部狀態）
    onClose: () => void;
    onDelete: (index: number) => Promise<void> | void;
    onAddFiles: (files: FileList) => void;
}> = ({ photos, start, adding, onClose, onDelete, onAddFiles }) => {
    const [current, setCurrent] = useState(Math.min(Math.max(start, 0), Math.max(photos.length - 1, 0)));
    const fileRef = React.useRef<HTMLInputElement>(null);

    // 照片數變化（刪除/新增）後夾住索引；刪到空自動關閉
    useEffect(() => {
        if (photos.length === 0) { onClose(); return; }
        if (current > photos.length - 1) setCurrent(photos.length - 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos.length]);

    const step = (d: 1 | -1) => setCurrent(c => Math.min(Math.max(c + d, 0), photos.length - 1));

    // 點左右緣換格（與護照同文法）；中央區不動作（保留給未來縮放）
    const onFrameTap = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width * 0.65) step(1);
        else if (x < rect.width * 0.35) step(-1);
    };

    const handleDelete = async () => {
        const ok = await confirmDialog({ title: '刪除這張照片？', message: '照片會從這段回憶中移除，無法復原。', confirmText: '刪除', tone: 'danger' });
        if (ok) await onDelete(current);
    };

    const pad2 = (n: number) => String(n).padStart(2, '0');

    return (
        <div data-no-flip className="fixed inset-0 z-[130] flex flex-col" style={{ background: 'rgba(10,10,9,0.97)' }} onClick={e => e.stopPropagation()}>
            {/* 頂列 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <button onClick={onClose} aria-label="關閉" className="p-2 -m-2"><X className="w-5 h-5 text-white/85" /></button>
                {/* KT-格號：膠卷邊緣印字 */}
                <span className="font-mono text-[11px] tracking-[0.22em]" style={{ color: 'rgba(231,221,196,0.8)' }}>
                    {photos.length ? `KT-${pad2(current + 1)} / ${pad2(photos.length)}` : 'KT-00'}
                </span>
                <div className="flex items-center gap-4">
                    <button onClick={() => fileRef.current?.click()} disabled={adding} aria-label="加照片" className="p-2 -m-2 disabled:opacity-50">
                        {adding ? <Loader2 className="w-5 h-5 text-white/85 animate-spin" /> : <Plus className="w-5 h-5 text-white/85" />}
                    </button>
                    <button onClick={() => { void handleDelete(); }} aria-label="刪除" className="p-2 -m-2"><Trash2 className="w-5 h-5 text-white/85" /></button>
                </div>
            </div>

            {/* 膠卷格：齒孔帶｜相片（細白框＋疊化）｜齒孔帶 */}
            <div className="flex-1 min-h-0 flex flex-col justify-center" onClick={onFrameTap}>
                <Sprockets />
                <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 py-2" style={{ maxHeight: '72vh' }}>
                    <AnimatePresence mode="popLayout">
                        <motion.img
                            key={photos[current] || current}
                            src={photos[current]}
                            alt={`照片 ${current + 1}`}
                            draggable={false}
                            initial={{ opacity: 0, scale: 1.03 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.45, ease: 'easeOut' }}
                            className="max-w-full max-h-full object-contain"
                            style={{ border: '3px solid rgba(246,241,231,0.9)', borderRadius: 2, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                        />
                    </AnimatePresence>
                </div>
                <Sprockets />
            </div>

            {/* 頁點：可點跳（與護照工具列同文法） */}
            <div className="pb-6 pt-3 flex justify-center">
                {photos.map((_, i) => (
                    <button key={i} onClick={() => setCurrent(i)} aria-label={`第 ${i + 1} 張`}
                        className="flex items-center justify-center" style={{ width: 22, height: 22 }}>
                        <span className="rounded-full" style={{ width: i === current ? 14 : 5, height: 5, background: i === current ? '#E7DDC4' : 'rgba(246,241,231,0.35)', transition: 'all .25s' }} />
                    </button>
                ))}
            </div>

            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files?.length) onAddFiles(e.target.files); e.target.value = ''; }} />
        </div>
    );
};
