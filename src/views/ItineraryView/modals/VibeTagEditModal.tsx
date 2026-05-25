// src/views/ItineraryView/modals/VibeTagEditModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

interface VibeTagEditModalProps {
    dayNumber: number;
    initialValue: string;
    onClose: () => void;
    onSave: (newTag: string) => void;
}

export const VibeTagEditModal: React.FC<VibeTagEditModalProps> = ({
    dayNumber,
    initialValue,
    onClose,
    onSave
}) => {
    const [tag, setTag] = useState(initialValue);
    const maxLength = 15; // 🛡️ 嚴格限制 15 字以內，死守 PDF 匯出時的完美排版邊界

    // 當開啟時，同步初始值
    useEffect(() => {
        setTag(initialValue);
    }, [initialValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(tag.trim());
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* 🌌 高級感毛玻璃背景與淡入動畫 */}
            <div 
                className="absolute inset-0 bg-[#1D1D1B]/20 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose} 
            />

            {/* 🎫 對話框主體：行動端底部滑出，桌面端中央放大 */}
            <div className="bg-white/95 backdrop-blur-md w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl relative z-10 border border-white/40 transform animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col gap-4">
                
                {/* 頂部標頭區 */}
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#45846D]/10 flex items-center justify-center text-[#45846D]">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-[#1D1D1B]">設定單日主題</h3>
                            <p className="text-[11px] text-gray-400 font-bold tracking-wider uppercase">{`DAY ${dayNumber} TOTAL VIBE`}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 編輯表單 */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            maxLength={maxLength}
                            placeholder="例如：地標巡禮與高空微醺"
                            autoFocus
                            className="w-full bg-gray-50/80 border border-gray-200/80 focus:border-[#45846D] focus:ring-2 focus:ring-[#45846D]/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-800 transition-all outline-none"
                        />
                        {/* ⏳ 剩餘字數精確計數器 */}
                        <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold ${tag.length >= maxLength ? 'text-rose-500' : 'text-gray-400'}`}>
                            {`${tag.length}/${maxLength}`}
                        </span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed px-1">
                        提示：此主題會同步顯示於手機行程頁頭，並完美注入 PDF 每日章節扉頁中。限制 15 字以內以達最佳視覺美學。
                    </p>

                    {/* 按鈕操作組 */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold text-sm rounded-xl transition-all active:scale-98"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-[#1D1D1B] hover:bg-black text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-gray-200 active:scale-98"
                        >
                            儲存修改
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};