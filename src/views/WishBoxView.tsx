// src/views/WishBoxView.tsx
import React, { useState, useMemo } from 'react';
import { 
    MapPin, ShoppingBag, Plus, ArrowLeft, 
    Image as ImageIcon, Sparkles, Map, Globe, X
} from 'lucide-react';
import type { WishItem, WishItemType, Trip } from '../types';

interface WishBoxViewProps {
    wishItems: WishItem[];
    trips: Trip[]; // 🛡️ 9.2 接收所有的活躍行程
    onAddWishToTrip: (wish: WishItem, tripId: string) => void; // 🛡️ 9.2 注入推入函式
    onAddClick: () => void;
    onEditClick: (item: WishItem) => void;
}

const getTagColor = (tag: string) => {
    const colors = [
        'text-pink-600 bg-pink-50',
        'text-blue-600 bg-blue-50',
        'text-orange-600 bg-orange-50',
        'text-purple-600 bg-purple-50',
        'text-cyan-600 bg-cyan-50',
    ];
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export const WishBoxView: React.FC<WishBoxViewProps> = ({ 
    wishItems, trips, onAddWishToTrip, onAddClick, onEditClick 
}) => {
    const [activeTab, setActiveTab] = useState<WishItemType>('place');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);

    // 🛡️ 9.2 互動狀態：記錄當前準備推入行程的 WishItem 與 Toast 提示文字
    const [actionWish, setActionWish] = useState<WishItem | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    const currentTabItems = useMemo(() => {
        return wishItems.filter(item => item.type === activeTab);
    }, [wishItems, activeTab]);

    const countryStats = useMemo(() => {
        const stats: Record<string, { count: number; coverImage: string | null }> = {};
        currentTabItems.forEach(item => {
            const c = item.country || '未分類';
            if (!stats[c]) {
                stats[c] = { count: 0, coverImage: null };
            }
            stats[c].count += 1;
            if (!stats[c].coverImage && item.customImage) {
                stats[c].coverImage = item.customImage;
            }
        });
        return Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
    }, [currentTabItems]);

    const areaStats = useMemo(() => {
        if (!selectedCountry) return [];
        const stats: Record<string, number> = {};
        const countryItems = currentTabItems.filter(item => (item.country || '未分類') === selectedCountry);
        countryItems.forEach(item => {
            if (item.area) stats[item.area] = (stats[item.area] || 0) + 1;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [currentTabItems, selectedCountry]);

    const finalDisplayItems = useMemo(() => {
        if (!selectedCountry) return [];
        let items = currentTabItems.filter(item => (item.country || '未分類') === selectedCountry);
        if (selectedArea) items = items.filter(item => item.area === selectedArea);
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [currentTabItems, selectedCountry, selectedArea]);

    const handleSelectCountry = (country: string) => {
        setSelectedCountry(country);
        setSelectedArea(null);
    };

    return (
        <div className="h-full flex flex-col w-full bg-transparent relative">
            
            {/* === 第一層：心願盒總覽 === */}
            <div className={`absolute inset-0 flex flex-col transition-all duration-500 ease-in-out ${selectedCountry ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
                <div className="flex-shrink-0 pt-16 pb-4 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 w-full sticky top-0">
                    <p className="text-[10px] font-black tracking-[0.2em] text-[#45846D] mb-1">WISH BOX</p>
                    <h1 className="text-3xl font-black font-serif tracking-tight text-[#1D1D1B] mb-5">心願盒</h1>
                    
                    <div className="bg-[#767680]/10 p-[2px] rounded-lg flex relative items-center h-8">
                        <div 
                            className="absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] bg-white rounded-md shadow-[0_3px_1px_rgba(0,0,0,0.04),0_3px_8px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out" 
                            style={{ left: activeTab === 'place' ? '2px' : 'calc(50%)' }} 
                        />
                        <button 
                            onClick={() => setActiveTab('place')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors duration-300 ${activeTab === 'place' ? 'text-[#1D1D1B]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <MapPin className="w-3.5 h-3.5" /> 探索地點
                        </button>
                        <button 
                            onClick={() => setActiveTab('item')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors duration-300 ${activeTab === 'item' ? 'text-[#1D1D1B]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ShoppingBag className="w-3.5 h-3.5" /> 購物清單
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 no-scrollbar">
                    {countryStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-sm font-bold text-gray-400">目前沒有心願</p>
                            <p className="text-xs text-gray-400 mt-1">點擊右下角按鈕隨手收藏靈感</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                             {countryStats.map(([country, stats], index) => {
                                const isUncategorized = country === '未分類';
                                const isHero = index === 0 && !isUncategorized && stats.count > 1;
                                
                                return (
                                    <button
                                        key={country}
                                        onClick={() => handleSelectCountry(country)}
                                        className={`relative rounded-[28px] overflow-hidden group text-left transition-transform active:scale-95 shadow-sm border border-white/20
                                            ${isHero ? 'col-span-2 aspect-[2/1]' : 'col-span-1 aspect-square'}
                                            ${isUncategorized ? 'bg-[#F5F5F4]' : 'bg-[#2A3439]'}
                                        `}
                                    >
                                        {!isUncategorized ? (
                                            <>
                                                {stats.coverImage ? (
                                                    <img src={stats.coverImage} alt={country} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 transition-transform duration-700 group-hover:scale-110" />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                <Globe className="w-16 h-16" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-4 left-5 right-5 flex flex-col">
                                            <span className={`text-lg font-black tracking-wide ${isUncategorized ? 'text-[#1D1D1B]' : 'text-white'}`}>{country}</span>
                                            <span className={`text-xs font-bold mt-0.5 ${isUncategorized ? 'text-gray-400' : 'text-white/80'}`}>{stats.count} 個{activeTab === 'place' ? '地點' : '物品'}</span>
                                        </div>
                                     </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* === 第二層：國家/城市瀑布流卡片 === */}
            <div className={`absolute inset-0 flex flex-col bg-[#E4E2DD] transition-all duration-500 ease-in-out z-40 ${selectedCountry ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                <div className="flex-shrink-0 pt-16 pb-3 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl sticky top-0 z-50">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setSelectedCountry(null)} className="p-2 bg-white/80 rounded-full text-gray-600 hover:bg-white shadow-sm border border-gray-100 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                        <h2 className="text-2xl font-black text-[#1D1D1B] truncate">{selectedCountry}</h2>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 snap-x">
                        <button onClick={() => setSelectedArea(null)} className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${!selectedArea ? 'bg-[#45846D] text-white border-[#45846D] shadow-md' : 'bg-white text-gray-500 border-white hover:border-gray-200'}`}>全部 ({currentTabItems.filter(i => (i.country || '未分類') === selectedCountry).length})</button>
                        {areaStats.map(([area, count]) => (
                            <button key={area} onClick={() => setSelectedArea(area)} className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${selectedArea === area ? 'bg-[#45846D] text-white border-[#45846D] shadow-md' : 'bg-white text-gray-500 border-white hover:border-gray-200'}`}>{area} ({count})</button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32 no-scrollbar">
                    <div className="columns-2 gap-3 space-y-3">
                        {finalDisplayItems.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => onEditClick(item)}
                                className="break-inside-avoid bg-white rounded-2xl p-3 shadow-sm border border-white cursor-pointer hover:border-[#45846D]/30 transition-all group relative"
                            >
                                {/* 🛡️ 9.2 新增：獨立的推入操作鈕，懸浮於卡片右上角 */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // 阻止卡片的編輯事件觸發
                                        setActionWish(item);
                                    }}
                                    className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-[#45846D] transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {(item.customImage || item.url) && (
                                    <div className="w-full rounded-xl overflow-hidden mb-3 bg-gray-50 relative aspect-[4/3]">
                                        {item.customImage ? (
                                            <img src={item.customImage} alt={item.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                {activeTab === 'place' ? <Map className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mb-2 pr-2">
                                    <h3 className="font-bold text-[#1D1D1B] text-sm leading-snug group-hover:text-[#45846D] transition-colors">{item.title}</h3>
                                    {item.area && <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {item.area}</p>}
                                </div>

                                {activeTab === 'item' && (item.budget || (item.tags && item.tags.length > 0)) && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex flex-col gap-2">
                                        {item.budget && <div className="text-[11px] font-black text-[#1D1D1B] font-mono">{item.currency || 'TWD'} {item.budget.toLocaleString()}</div>}
                                        {item.tags && item.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {item.tags.map(tag => <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTagColor(tag)}`}>#{tag}</span>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* === 🛡️ 9.2 升級：動態注入選單 (Bottom Sheet) === */}
            {actionWish && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm transition-opacity" onClick={() => setActionWish(null)} />
                    <div className="w-full max-w-sm bg-[#F2F2F2] rounded-[32px] p-6 relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-black font-serif text-[#1D1D1B]">加入至現有行程</h3>
                            <button onClick={() => setActionWish(null)} className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 transition-colors rounded-full text-gray-500">
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-safe">
                            {trips.length === 0 ? (
                                <p className="text-sm font-bold text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-[24px]">目前沒有正在規劃的行程</p>
                            ) : (
                                trips.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            onAddWishToTrip(actionWish, t.id);
                                            setActionWish(null);
                                            setToastMsg(`✨ 已將「${actionWish.title}」送入 [${t.destination}] 暫存區`);
                                            setTimeout(() => setToastMsg(null), 3000);
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-white rounded-2xl hover:border-[#45846D] border-2 border-transparent hover:shadow-md transition-all active:scale-[0.98] group"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-bold text-[#1D1D1B] text-[15px]">{t.destination}</span>
                                            <span className="text-[11px] text-gray-400 font-bold mt-1 font-mono tracking-widest">{t.startDate.replace(/-/g, '.')}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-[#45846D]/10 group-hover:bg-[#45846D] flex items-center justify-center text-[#45846D] group-hover:text-white transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === 🛡️ 9.2 升級：全域 Toast 提示 === */}
            {toastMsg && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
                    <div className="bg-[#1D1D1B]/90 backdrop-blur-md px-5 py-3 rounded-full text-white text-[11px] font-bold tracking-widest shadow-2xl border border-white/20 whitespace-nowrap">
                        {toastMsg}
                    </div>
                </div>
            )}

            {/* === 頂級懸浮按鈕 === */}
            <div className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-5 z-[60]">
                <button onClick={onAddClick} className="relative group transition-transform active:scale-95">
                    <div className="absolute inset-0 bg-[#45846D]/40 rounded-[20px] blur-md group-hover:bg-[#45846D]/60 transition-all duration-300"></div>
                    <div className="relative w-14 h-14 bg-[#45846D] rounded-[20px] flex items-center justify-center text-white shadow-2xl border-2 border-white/20">
                        <Sparkles className="w-3.5 h-3.5 absolute top-2.5 right-2.5 opacity-80" />
                        <Plus className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                </button>
            </div>
        </div>
    );
};