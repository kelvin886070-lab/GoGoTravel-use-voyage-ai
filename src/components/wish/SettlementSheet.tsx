// src/components/wish/SettlementSheet.tsx
// 🧾 代購結算：把「對象」有填的購物項目跨行程/跨國依人聚合。
//   每人：品項×數量、原幣小計、換算結算幣別、分享清單、一鍵結清（整個人）。
//   金額＝實際單價 ?? 預算估價，× 數量。結清者沉底變灰。
import React, { useMemo, useState } from 'react';
import { X, Share2, Check, RefreshCw } from 'lucide-react';
import type { WishItem, Trip } from '../../types';
import { getCurrencyRate } from '../../services/gemini';
import { toast } from '../Toast';

const HOME = 'TWD';   // 結算幣別（MVP 固定台幣）
const unitPrice = (w: WishItem) => (w.actualPrice ?? w.budget ?? 0);
const lineTotal = (w: WishItem) => unitPrice(w) * (w.quantity ?? 1);
const shortDate = (iso?: string) => { try { return new Date(iso || '').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); } catch { return ''; } };

interface Props {
    open: boolean;
    wishItems: WishItem[];
    trips: Trip[];
    onClose: () => void;
    onSettlePerson: (name: string, settled: boolean) => void;
}

export const SettlementSheet: React.FC<Props> = ({ open, wishItems, trips, onClose, onSettlePerson }) => {
    const tripMap = useMemo(() => new Map(trips.map(t => [t.id, t])), [trips]);
    const [converted, setConverted] = useState<Record<string, string>>({});   // key: name|currency → 換算字串
    const [converting, setConverting] = useState<string | null>(null);

    const people = useMemo(() => {
        const daigou = wishItems.filter(w => w.type === 'item' && w.forWhom && w.forWhom.trim());
        const map: Record<string, WishItem[]> = {};
        daigou.forEach(w => { const k = w.forWhom!.trim(); (map[k] = map[k] || []).push(w); });
        const list = Object.entries(map).map(([name, items]) => {
            const byCur: Record<string, number> = {};
            items.forEach(i => { const c = i.currency || HOME; byCur[c] = (byCur[c] || 0) + lineTotal(i); });
            // 依「行程 → 否則國家」再分組，讓明細不會跨趟混在一起
            const gm: Record<string, WishItem[]> = {};
            items.forEach(i => { const k = i.tripId ? `t:${i.tripId}` : `c:${i.country || '其他'}`; (gm[k] = gm[k] || []).push(i); });
            const groups = Object.entries(gm).map(([k, its]) => {
                const trip = k.startsWith('t:') ? tripMap.get(k.slice(2)) : null;
                return {
                    key: k,
                    label: trip ? trip.destination : (its[0].country || '其他'),
                    date: trip ? (trip.startDate || '').replace(/-/g, '/') : shortDate(its[0].createdAt),
                    items: its,
                };
            });
            return { name, items, byCur, groups, settled: items.length > 0 && items.every(i => i.isSettled) };
        });
        return list.sort((a, b) => (a.settled ? 1 : 0) - (b.settled ? 1 : 0) || a.name.localeCompare(b.name, 'zh-Hant'));
    }, [wishItems, tripMap]);

    if (!open) return null;

    const convert = async (name: string, cur: string, amount: number) => {
        const key = `${name}|${cur}`;
        if (converted[key]) { setConverted(prev => { const n = { ...prev }; delete n[key]; return n; }); return; }
        if (cur === HOME) { setConverted(prev => ({ ...prev, [key]: `${amount.toLocaleString()} ${HOME}` })); return; }
        setConverting(key);
        const res = await getCurrencyRate(cur, HOME, amount);
        setConverting(null);
        setConverted(prev => ({ ...prev, [key]: (res || '').trim() }));
    };

    const share = async (name: string, items: WishItem[], byCur: Record<string, number>) => {
        const lines = items.map(i => `・${i.title} ×${i.quantity ?? 1}　${i.currency || ''} ${lineTotal(i).toLocaleString()}`);
        const totals = Object.entries(byCur).map(([c, s]) => `${c} ${s.toLocaleString()}`).join(' + ');
        const text = `${name} 的代購清單\n${lines.join('\n')}\n合計：${totals}`;
        try {
            if (navigator.share) await navigator.share({ text });
            else { await navigator.clipboard.writeText(text); toast('已複製清單', 'success'); }
        } catch { /* 使用者取消分享 */ }
    };

    const unsettledCount = people.filter(p => !p.settled).length;

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-md bg-[#F2F2F2] rounded-t-[24px] sm:rounded-[24px] relative z-10 flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-300">
                <div className="shrink-0 flex items-center justify-between p-5 pb-3">
                    <h3 className="font-serif text-xl font-bold text-[#1D1D1B]">代購結算</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#8A857A] bg-[#EAE6DD] px-2.5 py-1 rounded-full">結算幣別 {HOME}</span>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 space-y-2.5">
                    {people.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-16 px-6">還沒有「幫別人買」的項目。<br />在購物項目填上「幫誰買」，這裡就會依人結算。</div>
                    ) : people.map(({ name, items, byCur, groups, settled }) => (
                        <div key={name} className={`bg-white rounded-2xl p-3.5 ${settled ? 'opacity-60' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#FBEAF0] text-[#993556] flex items-center justify-center font-bold flex-shrink-0">{name.slice(0, 1)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-bold text-[#1D1D1B] truncate">{name}</p>
                                    <p className="text-[11px] text-gray-400">{items.length} 樣 · {settled ? '已結清 ✓' : '未結清'}</p>
                                </div>
                                <div className="text-right">
                                    {Object.entries(byCur).map(([c, s]) => (
                                        <p key={c} className={`font-mono text-sm font-bold ${settled ? 'text-gray-400 line-through' : 'text-[#1D1D1B]'}`}>{c} {s.toLocaleString()}</p>
                                    ))}
                                    {!settled && Object.entries(byCur).map(([c, s]) => (
                                        <button key={`b${c}`} onClick={() => convert(name, c, s)} className="text-[11px] font-bold text-[#45846D] mt-0.5 inline-flex items-center gap-1">
                                            {converting === `${name}|${c}` ? '換算中…' : converted[`${name}|${c}`] ? `≈${converted[`${name}|${c}`]}` : (<><RefreshCw className="w-3 h-3" />換算 {HOME}</>)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-[#F0ECE4] flex flex-col gap-2.5">
                                {groups.map(g => (
                                    <div key={g.key}>
                                        <p className="text-[10px] font-bold text-[#93887A] tracking-wide mb-1">{g.label}{g.date ? ` · ${g.date}` : ''}</p>
                                        <div className="flex flex-col gap-1">
                                            {g.items.map(i => (
                                                <div key={i.id} className="flex justify-between text-[12.5px]">
                                                    <span className="text-[#57534E] truncate">{i.title} <span className="text-[#A8A296]">×{i.quantity ?? 1}</span></span>
                                                    <span className="font-mono text-[#57534E] flex-shrink-0 ml-2">{i.currency || ''} {lineTotal(i).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button onClick={() => share(name, items, byCur)} className="flex-1 py-2 rounded-xl bg-[#F1F1F1] text-[#57534E] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><Share2 className="w-4 h-4" />分享清單</button>
                                <button onClick={() => onSettlePerson(name, !settled)} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform ${settled ? 'bg-gray-100 text-gray-500' : 'bg-[#45846D] text-white'}`}>
                                    <Check className="w-4 h-4" />{settled ? '取消結清' : '標記已結清'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {people.length > 0 && (
                    <div className="shrink-0 px-5 py-3 pb-safe border-t border-black/5 bg-white/80 text-center text-xs text-gray-500">
                        還有 <span className="font-bold text-[#45846D]">{unsettledCount}</span> 人未結清
                    </div>
                )}
            </div>
        </div>
    );
};
