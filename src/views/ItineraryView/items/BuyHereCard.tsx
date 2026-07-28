// src/views/ItineraryView/items/BuyHereCard.tsx
// 🛍️「在這裡要買」：掛在購物 stop 下方的「副卡」。份量對齊交通卡、不搶主視覺。
//   ─ 未綁：入口（購物站帶待買數；其他站安靜）→ 點開 picker 一鍵＋綁定。
//   ─ 綁了：預設收合＝一行摘要＋進度；展開＝發票明細（可勾＝已買、可移除、可再加）。
//   綁定寫 item.stopId；勾選走 onTogglePurchased（同步 #3 清單與代購結算）。
import React, { useMemo, useState } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp, Plus, Check, X } from 'lucide-react';
import type { WishItem } from '../../../types';

interface BuyHereCardProps {
    stopTitle: string;
    isShopping: boolean;          // 購物型 stop：入口帶待買數、較有存在感
    boundItems: WishItem[];       // stopId === 本 activity.id 的購物項
    candidates: WishItem[];       // 本趟未買、未綁任何站的購物池（共用）
    onBind: (itemIds: string[]) => void;
    onUnbind: (itemId: string) => void;
    onTogglePurchased: (itemId: string) => void;
}

const qty = (w: WishItem) => w.quantity ?? 1;

const BuyHereCardImpl: React.FC<BuyHereCardProps> = ({
    stopTitle, isShopping, boundItems, candidates, onBind, onUnbind, onTogglePurchased,
}) => {
    const [open, setOpen] = useState(false);       // 預設收合（清爽優先）
    const [pickerOpen, setPickerOpen] = useState(false);
    const [tagFilter, setTagFilter] = useState<string>('全部');

    const total = boundItems.length;
    const bought = boundItems.filter(w => w.isPurchased).length;
    const remaining = total - bought;

    // picker 標籤（僅候選多時才浮，短清單直接平舖，避免反向增加負擔）
    const tags = useMemo(() => {
        const s = new Set<string>();
        candidates.forEach(w => (w.tags || []).forEach(t => t && s.add(t)));
        return Array.from(s);
    }, [candidates]);
    const showFilter = candidates.length > 8 && tags.length > 1;
    const shown = useMemo(() => (
        showFilter && tagFilter !== '全部'
            ? candidates.filter(w => (w.tags || []).includes(tagFilter))
            : candidates
    ), [candidates, showFilter, tagFilter]);

    const openPicker = () => { setTagFilter('全部'); setPickerOpen(true); };

    // ── 未綁：只顯示入口 ──────────────────────────────
    const entry = total === 0 ? (
        candidates.length === 0 ? null : isShopping ? (
            <button
                onClick={openPicker}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-[#EF9F27] bg-[#FAEEDA] text-[#854F0B] text-xs font-bold active:scale-[0.98] transition-transform"
            >
                <Plus className="w-3.5 h-3.5" />這裡要買？· {candidates.length} 待買
            </button>
        ) : (
            <button
                onClick={openPicker}
                className="flex items-center gap-1 py-1 px-1.5 text-[11px] font-bold text-gray-400 hover:text-[#854F0B] transition-colors"
            >
                <Plus className="w-3 h-3" />這裡要買
            </button>
        )
    ) : null;

    return (
        <>
            <div className="ml-6 mr-1 -mt-1 mb-2">
                {entry}

                {total > 0 && !open && (
                    <button
                        onClick={() => setOpen(true)}
                        className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-gray-50/80 border border-gray-200/50 active:scale-[0.98] transition-transform"
                    >
                        <ShoppingBag className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="flex-1 text-left text-xs font-bold text-gray-600">
                            在這裡要買 · {total} · <span className="font-mono">{bought}/{total}</span> 已買
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                )}

                {total > 0 && open && (
                    <div className="rounded-xl bg-gray-50/80 border border-gray-200/50 px-3 pt-2.5 pb-2">
                        <div className="flex items-center justify-between pb-2 border-b border-dashed border-gray-300">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                <ShoppingBag className="w-3.5 h-3.5" />在這裡要買
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={openPicker}
                                    className="flex items-center gap-0.5 text-[11px] font-bold text-gray-500 border border-gray-300 rounded-lg px-2 py-0.5 active:scale-95 transition-transform"
                                >
                                    <Plus className="w-3 h-3" />加
                                </button>
                                <button onClick={() => setOpen(false)} className="text-gray-400 p-0.5"><ChevronUp className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {boundItems.map((w, i) => (
                            <div key={w.id} className={`flex items-center gap-2 py-1.5 ${i > 0 ? 'border-t border-dashed border-gray-200' : ''}`}>
                                <button
                                    onClick={() => onTogglePurchased(w.id)}
                                    className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-colors ${w.isPurchased ? 'bg-[#45846D] text-white' : 'border-[1.5px] border-gray-300 hover:border-[#45846D]'}`}
                                >
                                    {w.isPurchased && <Check className="w-3 h-3" />}
                                </button>
                                <span className={`flex-1 min-w-0 truncate text-[12.5px] ${w.isPurchased ? 'text-gray-400 line-through' : 'text-[#1D1D1B]'}`}>{w.title}</span>
                                {qty(w) > 1 && <span className="font-mono text-[11px] text-gray-400 shrink-0">×{qty(w)}</span>}
                                {w.forWhom && <span className="text-[10px] text-[#993556] bg-[#FBEAF0] px-1.5 py-0.5 rounded-full shrink-0">{w.forWhom}</span>}
                                <button onClick={() => onUnbind(w.id)} className="text-gray-300 hover:text-gray-500 p-0.5 shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                        ))}

                        <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-300 text-[11px] text-gray-400">
                            <span>{remaining > 0 ? `還要買 ${remaining} 樣` : '都買齊了 ✓'}</span>
                            <span className="font-mono">{bought} / {total}</span>
                        </div>
                    </div>
                )}
            </div>

            {pickerOpen && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={() => setPickerOpen(false)}>
                    <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm" />
                    <div className="w-full max-w-md bg-[#F2F2F2] rounded-t-[24px] sm:rounded-[24px] relative z-10 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="shrink-0 flex items-center justify-between p-5 pb-3">
                            <h3 className="font-bold text-[#1D1D1B] text-[15px] truncate pr-2">在{stopTitle}要買哪些？</h3>
                            <button onClick={() => setPickerOpen(false)} className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                        </div>

                        {showFilter && (
                            <div className="shrink-0 flex gap-2 px-5 pb-2 overflow-x-auto no-scrollbar">
                                {['全部', ...tags].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTagFilter(t)}
                                        className={`shrink-0 text-[11px] px-3 py-1 rounded-full transition-colors ${tagFilter === t ? 'bg-[#45846D] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                    >{t}</button>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-5 space-y-1.5">
                            {shown.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-14 px-6">本趟沒有未綁定的待買項目。<br />可到「靈感心願盒 · 購物清單」新增。</div>
                            ) : shown.map(w => (
                                <div key={w.id} className="flex items-center gap-3 bg-white rounded-xl px-3.5 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13.5px] text-[#1D1D1B] truncate">{w.title}{qty(w) > 1 && <span className="font-mono text-[11px] text-gray-400 ml-1">×{qty(w)}</span>}</div>
                                        {(w.tags?.length || w.forWhom) && (
                                            <div className="text-[11px] text-gray-400 truncate mt-0.5">{[w.tags?.[0], w.forWhom ? `給${w.forWhom}` : null].filter(Boolean).join(' · ')}</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onBind([w.id])}
                                        className="w-8 h-8 rounded-full border border-[#EF9F27] text-[#854F0B] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                                    ><Plus className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export const BuyHereCard = React.memo(BuyHereCardImpl);
