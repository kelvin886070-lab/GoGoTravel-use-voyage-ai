import React, { useState, useMemo } from 'react';
import { 
    MapPin, ShoppingBag, Plus, ArrowLeft, 
    Image as ImageIcon, Sparkles, Map, Globe
} from 'lucide-react';
import type { WishItem, WishItemType } from '../types';

interface WishBoxViewProps {
    wishItems: WishItem[];
    onAddClick: () => void;
    onEditClick: (item: WishItem) => void;
}

// 產生一致的標籤顏色 (模擬 ActivityDetailModal 的質感)
const getTagColor = (tag: string) => {
    const colors = [
        'text-pink-600 bg-pink-50',
        'text-blue-600 bg-blue-50',
        'text-orange-600 bg-orange-50',
        'text-purple-600 bg-purple-50',
        'text-cyan-600 bg-cyan-50',
    ];
    // 簡單的 hash 決定顏色，確保同一個標籤顏色永遠一樣
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export const WishBoxView: React.FC<WishBoxViewProps> = ({ wishItems, onAddClick, onEditClick }) => {
    // UI 狀態
    const [activeTab, setActiveTab] = useState<WishItemType>('place');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);

    // 1. 過濾出當前 Tab 的心願 (地點 vs 物品)
    const currentTabItems = useMemo(() => {
        return wishItems.filter(item => item.type === activeTab);
    }, [wishItems, activeTab]);

    // 2. 計算便當盒 (國家畫廊) 的統計數據
    const countryStats = useMemo(() => {
        const stats: Record<string, number> = {};
        currentTabItems.forEach(item => {
            const c = item.country || '未分類';
            stats[c] = (stats[c] || 0) + 1;
        });
        // 依照數量由多到少排序
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [currentTabItems]);

    // 3. 進入特定國家後，計算該國家的分區濾鏡 (Area Filter)
    const areaStats = useMemo(() => {
        if (!selectedCountry) return [];
        const stats: Record<string, number> = {};
        const countryItems = currentTabItems.filter(item => (item.country || '未分類') === selectedCountry);
        
        countryItems.forEach(item => {
            if (item.area) {
                stats[item.area] = (stats[item.area] || 0) + 1;
            }
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [currentTabItems, selectedCountry]);

    // 4. 最終顯示在瀑布流的項目 (套用國家與分區濾鏡)
    const finalDisplayItems = useMemo(() => {
        if (!selectedCountry) return [];
        let items = currentTabItems.filter(item => (item.country || '未分類') === selectedCountry);
        if (selectedArea) {
            items = items.filter(item => item.area === selectedArea);
        }
        // 依據建立時間排序 (最新的在最上面)
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [currentTabItems, selectedCountry, selectedArea]);

    // 處理進入國家
    const handleSelectCountry = (country: string) => {
        setSelectedCountry(country);
        setSelectedArea(null); // 重置分區濾鏡
    };

    return (
        <div className="h-full flex flex-col w-full bg-transparent relative">
            
            {/* === 第一層：心願盒總覽 (Bento Grid) === */}
            <div className={`absolute inset-0 flex flex-col transition-all duration-500 ease-in-out ${selectedCountry ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
                
                {/* 雜誌風 Header */}
                <div className="flex-shrink-0 pt-16 pb-4 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 w-full sticky top-0">
                    <p className="text-[10px] font-black tracking-[0.2em] text-[#45846D] mb-1">WISH BOX</p>
                    <h1 className="text-3xl font-black font-serif tracking-tight text-[#1D1D1B] mb-5">心願盒</h1>
                    
                    {/* Apple 原生感雙切換膠囊 */}
                    <div className="bg-gray-200/60 p-1 rounded-2xl flex relative shadow-inner">
                        {/* 滑動的白色背景色塊 */}
                        <div 
                            className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out" 
                            style={{ left: activeTab === 'place' ? '0.25rem' : 'calc(50%)' }} 
                        />
                        <button 
                            onClick={() => setActiveTab('place')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${activeTab === 'place' ? 'text-[#1D1D1B]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <MapPin className="w-4 h-4" /> 探索地點
                        </button>
                        <button 
                            onClick={() => setActiveTab('item')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${activeTab === 'item' ? 'text-[#1D1D1B]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ShoppingBag className="w-4 h-4" /> 購物清單
                        </button>
                    </div>
                </div>

                {/* 內容區：便當盒網格 (Bento Grid) */}
                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 no-scrollbar">
                    {countryStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-sm font-bold text-gray-400">目前沒有心願</p>
                            <p className="text-xs text-gray-400 mt-1">點擊右下角按鈕隨手收藏靈感</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {countryStats.map(([country, count], index) => {
                                const isUncategorized = country === '未分類';
                                // 便當盒邏輯：資料最多(第一筆) 且不是未分類時，給予橫向大版面
                                const isHero = index === 0 && !isUncategorized && count > 1;
                                
                                return (
                                    <button
                                        key={country}
                                        onClick={() => handleSelectCountry(country)}
                                        className={`relative rounded-[28px] overflow-hidden group text-left transition-transform active:scale-95 shadow-sm border border-white/20
                                            ${isHero ? 'col-span-2 aspect-[2/1]' : 'col-span-1 aspect-square'}
                                            ${isUncategorized ? 'bg-[#F5F5F4]' : 'bg-gray-200'}
                                        `}
                                    >
                                        {!isUncategorized ? (
                                            <>
                                                {/* 國家背景圖 (使用佔位圖服務模擬) */}
                                                <img 
                                                    src={`https://picsum.photos/seed/${country}/600/600`} 
                                                    alt={country} 
                                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                <Globe className="w-16 h-16" />
                                            </div>
                                        )}

                                        <div className="absolute bottom-4 left-5 right-5 flex flex-col">
                                            <span className={`text-lg font-black tracking-wide ${isUncategorized ? 'text-[#1D1D1B]' : 'text-white'}`}>
                                                {country}
                                            </span>
                                            <span className={`text-xs font-bold mt-0.5 ${isUncategorized ? 'text-gray-400' : 'text-white/80'}`}>
                                                {count} 個{activeTab === 'place' ? '地點' : '物品'}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* === 第二層：國家/城市專屬頁 (Detail View) === */}
            <div className={`absolute inset-0 flex flex-col bg-[#E4E2DD] transition-all duration-500 ease-in-out z-40 ${selectedCountry ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                
                {/* 國家 Header */}
                <div className="flex-shrink-0 pt-16 pb-3 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl sticky top-0 z-50">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setSelectedCountry(null)} className="p-2 bg-white/80 rounded-full text-gray-600 hover:bg-white shadow-sm border border-gray-100 transition-colors">
                            <ArrowLeft className="w-5 h-5" /> 
                        </button>
                        <h2 className="text-2xl font-black text-[#1D1D1B] truncate">{selectedCountry}</h2>
                    </div>

                    {/* 手動分區驅動的扁平化膠囊濾鏡 */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 snap-x">
                        <button 
                            onClick={() => setSelectedArea(null)}
                            className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${!selectedArea ? 'bg-[#45846D] text-white border-[#45846D] shadow-md' : 'bg-white text-gray-500 border-white hover:border-gray-200'}`}
                        >
                            全部 ({currentTabItems.filter(i => (i.country || '未分類') === selectedCountry).length})
                        </button>
                        {areaStats.map(([area, count]) => (
                            <button 
                                key={area}
                                onClick={() => setSelectedArea(area)}
                                className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${selectedArea === area ? 'bg-[#45846D] text-white border-[#45846D] shadow-md' : 'bg-white text-gray-500 border-white hover:border-gray-200'}`}
                            >
                                {area} ({count})
                            </button>
                        ))}
                    </div>
                </div>

                {/* 內容區：瀑布流 (Masonry) 卡片 */}
                <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32 no-scrollbar">
                    {/* CSS 多欄佈局實現瀑布流效果 */}
                    <div className="columns-2 gap-3 space-y-3">
                        {finalDisplayItems.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => onEditClick(item)}
                                className="break-inside-avoid bg-white rounded-2xl p-3 shadow-sm border border-white cursor-pointer hover:border-[#45846D]/30 transition-all group"
                            >
                                {/* 圖片區 (優雅降級：如果有自訂圖優先，否則如果有網址給預設，都沒有就不顯示) */}
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

                                {/* 標題與分區 */}
                                <div className="mb-2">
                                    <h3 className="font-bold text-[#1D1D1B] text-sm leading-snug group-hover:text-[#45846D] transition-colors">
                                        {item.title}
                                    </h3>
                                    {item.area && (
                                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                            <MapPin className="w-2.5 h-2.5" /> {item.area}
                                        </p>
                                    )}
                                </div>

                                {/* 預算與標籤 (購物模式專屬) */}
                                {activeTab === 'item' && (item.budget || (item.tags && item.tags.length > 0)) && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex flex-col gap-2">
                                        {item.budget && (
                                            <div className="text-[11px] font-black text-[#1D1D1B] font-mono">
                                                {item.currency || 'TWD'} {item.budget.toLocaleString()}
                                            </div>
                                        )}
                                        {item.tags && item.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {item.tags.map(tag => (
                                                    <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTagColor(tag)}`}>
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* === 頂級懸浮按鈕 (Premium FAB) === */}
            <div className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-5 z-[60]">
                <button 
                    onClick={onAddClick} 
                    className="relative group transition-transform active:scale-95"
                >
                    {/* 毛玻璃光暈外框 */}
                    <div className="absolute inset-0 bg-[#45846D]/40 rounded-[20px] blur-md group-hover:bg-[#45846D]/60 transition-all duration-300"></div>
                    
                    {/* 本體 */}
                    <div className="relative w-14 h-14 bg-[#45846D] rounded-[20px] flex items-center justify-center text-white shadow-2xl border-2 border-white/20">
                        <Sparkles className="w-3.5 h-3.5 absolute top-2.5 right-2.5 opacity-80" />
                        <Plus className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                </button>
            </div>
        </div>
    );
};