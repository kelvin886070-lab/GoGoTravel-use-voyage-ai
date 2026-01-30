//記帳儀表板
import React, { useState, useMemo } from 'react';
import { RefreshCw, Globe, BarChart3, Scale, Copy } from 'lucide-react';
import type { Trip } from '../../../types';
import { getCurrencyRate } from '../../../services/gemini';
import { CURRENCY_SYMBOLS, CATEGORIES, parseCost, getMemberName, getMemberAvatarColor } from '../shared';

// 定義需要的型別，避免 TypeScript 報錯
type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export const ExpenseDashboard: React.FC<{ trip: Trip; onCurrencyChange?: (curr: string) => void }> = ({ trip, onCurrencyChange }) => {
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode as CurrencyCode] || '$';
    const [convertedTotal, setConvertedTotal] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isSelectingCurrency, setIsSelectingCurrency] = useState(false);
    const [tab, setTab] = useState<'analysis' | 'settlement'>('analysis');
    
    const stats = useMemo(() => {
        return trip.days.reduce((acc, day) => {
            day.activities.forEach(act => {
                const cost = parseCost(act.cost);
                const type = act.type || 'other';
                acc.presentCategories.add(type);
                if (cost > 0) {
                    acc.total += cost;
                    acc.byCategory[type] = (acc.byCategory[type] || 0) + cost;
                }
            });
            return acc;
        }, { total: 0, byCategory: {} as Record<string, number>, presentCategories: new Set<string>() });
    }, [trip.days]);

    const settlement = useMemo(() => {
        const balances: Record<string, number> = {}; 
        const myId = trip.members?.find(m => m.isHost || m.id === 'me')?.id || 'me';

        trip.days.forEach(day => {
            day.activities.forEach(act => {
                if (!act.cost) return;
                const cost = parseCost(act.cost);
                if (cost === 0) return;

                const payer = act.payer || myId;
                let splitters: string[] = [];
                if (act.items && act.items.length > 0) {
                    splitters = (act.splitWith && act.splitWith.length > 0) ? act.splitWith : (trip.members || []).map(m => m.id);
                } else {
                    splitters = (act.splitWith && act.splitWith.length > 0) ? act.splitWith : (trip.members || []).map(m => m.id);
                }

                const share = cost / splitters.length;

                splitters.forEach(memberId => {
                    if (memberId !== payer) {
                        if (payer === myId) {
                            balances[memberId] = (balances[memberId] || 0) + share;
                        } else if (memberId === myId) {
                            balances[payer] = (balances[payer] || 0) - share;
                        }
                    }
                });
            });
        });
        return balances;
    }, [trip]);

    const handleConvert = async () => { 
        if (convertedTotal || stats.total === 0) { setConvertedTotal(null); return; } 
        setIsConverting(true); 
        const target = currencyCode === 'TWD' ? 'USD' : 'TWD'; 
        const res = await getCurrencyRate(currencyCode, target, stats.total); 
        setConvertedTotal(res); 
        setIsConverting(false); 
    };
    
    const copySettlement = () => {
        let text = `💰 ${trip.destination} 之旅結算 (${currencyCode}):\n`;
        Object.entries(settlement).forEach(([mid, amount]) => {
            const name = getMemberName(trip.members, mid);
            if (amount > 0) text += `• ${name} 應付給我: $${Math.round(amount)}\n`;
            else if (amount < 0) text += `• 我應付給 ${name}: $${Math.round(Math.abs(amount))}\n`;
        });
        navigator.clipboard.writeText(text);
        alert('結算明細已複製！');
    };

    return (
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-6 relative overflow-hidden transition-all duration-300">
            <div className="flex justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-600 font-bold uppercase">總花費 ({currencyCode})</p>
                        <button 
                            onClick={() => setIsSelectingCurrency(!isSelectingCurrency)}
                            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#45846D] transition-colors"
                        >
                            <Globe className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <h3 className="text-4xl font-black text-[#1D1D1B] mt-1 tracking-tight"><span className="text-xl font-bold text-gray-400 mr-1">{currencySymbol}</span>{stats.total.toLocaleString()}</h3>
                    <div className="h-5 mt-1">{isConverting ? <span className="text-xs text-gray-400 animate-pulse">計算中...</span> : convertedTotal && <span className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-lg">{convertedTotal}</span>}</div>
                </div>
                <button onClick={handleConvert} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><RefreshCw className="w-5 h-5" /></button>
            </div>

            {isSelectingCurrency ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 bg-gray-50 rounded-2xl p-2 max-h-[200px] overflow-y-auto">
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map(cur => (
                            <button 
                                key={cur} 
                                onClick={() => { if(onCurrencyChange) onCurrencyChange(cur); setIsSelectingCurrency(false); }} 
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${currencyCode === cur ? 'bg-[#45846D] text-white shadow-md' : 'bg-white hover:bg-gray-100'}`}
                            >
                                <span className="text-xs font-bold">{cur}</span>
                                <span className="text-[10px] opacity-70">{CURRENCY_SYMBOLS[cur]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-gray-100 p-1.5 rounded-xl flex mb-6 relative gap-1">
                        <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${tab === 'analysis' ? 'left-1.5' : 'left-[calc(50%+3px)]'}`} />
                        <button onClick={() => setTab('analysis')} className={`flex-1 relative z-10 py-1.5 px-6 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'analysis' ? 'text-[#1D1D1B]' : 'text-gray-400'}`}>
                            <BarChart3 className="w-3.5 h-3.5" /> 分析
                        </button>
                        <button onClick={() => setTab('settlement')} className={`flex-1 relative z-10 py-1.5 px-6 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'settlement' ? 'text-[#1D1D1B]' : 'text-gray-400'}`}>
                            <Scale className="w-3.5 h-3.5" /> 結算
                        </button>
                    </div>
                    
                    {tab === 'analysis' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-gray-100">{CATEGORIES.map(c => { const p = stats.total > 0 ? (stats.byCategory[c.id] || 0) / stats.total * 100 : 0; return p > 0 ? <div key={c.id} style={{width:`${p}%`}} className={c.chartClass.split(' ')[0]} /> : null; })}</div>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                {CATEGORIES.map(cat => {
                                    if (!stats.presentCategories.has(cat.id)) return null;
                                    const amount = stats.byCategory[cat.id] || 0;
                                    return (
                                        <div key={cat.id} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${cat.chartClass.split(' ')[0]}`} />
                                                <span className="text-gray-600 font-medium">{cat.label}</span>
                                            </div>
                                            <span className="font-bold text-[#1D1D1B]">{currencySymbol}{amount.toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                            {Object.entries(settlement).length > 0 ? (
                                <>
                                    {Object.entries(settlement).map(([mid, amount]) => {
                                        const m = trip.members?.find(m => m.id === mid);
                                        if (!m || Math.round(amount) === 0) return null;
                                        const isReceiving = amount > 0;
                                        return (
                                            <div key={mid} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getMemberAvatarColor(m.name)}`}>{m.name[0]}</div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-800">{m.name}</span>
                                                        <span className="text-[10px] text-gray-400">{isReceiving ? '應付給你' : '你應付他'}</span>
                                                    </div>
                                                </div>
                                                <div className={`text-lg font-black font-mono ${isReceiving ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isReceiving ? '+' : '-'}{currencySymbol}{Math.abs(Math.round(amount))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <button onClick={copySettlement} className="w-full py-3 mt-2 flex items-center justify-center gap-2 text-xs font-bold text-[#45846D] bg-[#45846D]/10 rounded-xl hover:bg-[#45846D]/20 transition-colors">
                                        <Copy className="w-3.5 h-3.5" /> 複製結算明細
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-8 text-gray-300 text-xs font-bold">目前沒有需要結算的帳目 🎉</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};