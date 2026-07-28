// src/components/wish/WishPhotoCard.tsx
// 🖼️ Stage 2 照片牆卡：兩種密度共用一個元件。
//   variant='row'  → 精簡照片列（預設、挑選快）
//   variant='wall' → Hero 大卡（Uber Eats 邏輯、逛/爽）
//   共用：圖源（上傳圖/分類底圖）、長按進多選、勾選圈、待確認狀態、星、加入行程（綠圓鈕/牆版帶字）。
import React, { useRef } from 'react';
import { Star, Briefcase, Check, MapPinPlus, Coffee, Utensils, Landmark, ShoppingBag, Wine, MapPin } from 'lucide-react';
import type { WishItem } from '../../types';
import { wishPhotoOf } from '../../utils/wishPhoto';
import type { WishCategory } from '../../utils/wishCategory';
import { getTagColor } from '../../utils/tagColor';
import { RatingInline } from './RatingInline';

const CAT_ICON: Record<WishCategory, React.FC<{ className?: string }>> = {
    cafe: Coffee, food: Utensils, sight: Landmark, shop: ShoppingBag, bar: Wine, other: MapPin,
};

interface Props {
    item: WishItem;
    variant: 'row' | 'wall';
    selected?: boolean;
    selectMode?: boolean;
    checked?: boolean;
    onSelect: () => void;
    onAdd: () => void;
    onFavorite: () => void;
    onConfirmLoc?: () => void;
    onToggleSelect?: () => void;
    onLongPress?: () => void;
    onTagClick?: (tag: string) => void;
    refCb?: (el: HTMLDivElement | null) => void;
    reviewMedian?: number;
}

export const WishPhotoCard: React.FC<Props> = ({
    item, variant, selected, selectMode, checked,
    onSelect, onAdd, onFavorite, onConfirmLoc, onToggleSelect, onLongPress, onTagClick, refCb, reviewMedian,
}) => {
    const photo = wishPhotoOf(item);
    const Icon = CAT_ICON[photo.category];

    // 城市/分區/標籤 → 彩色膠囊（之後 Stage 3 讓標籤可點＝篩選）
    const pills = (tagLimit: number) => (
        <div className="flex flex-wrap gap-1 mt-1 overflow-hidden">
            {(item.city || item.area) && <span className="text-[10px] font-bold text-[#57534E] bg-[#EAE6DD] px-2 py-0.5 rounded-md whitespace-nowrap">{[item.city, item.area].filter(Boolean).join(' · ')}</span>}
            {(item.tags || []).slice(0, tagLimit).map(t => (
                onTagClick && !selectMode
                    ? <button key={t} onClick={(e) => { e.stopPropagation(); onTagClick(t); }} className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap active:scale-95 transition-transform ${getTagColor(t)}`}>#{t}</button>
                    : <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${getTagColor(t)}`}>#{t}</span>
            ))}
        </div>
    );

    const pressTimer = useRef<number | undefined>(undefined);
    const longFired = useRef(false);
    const startPress = () => {
        if (selectMode || !onLongPress) return;
        longFired.current = false;
        pressTimer.current = window.setTimeout(() => { longFired.current = true; onLongPress(); }, 500);
    };
    const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = undefined; } };
    const handleClick = () => {
        if (longFired.current) { longFired.current = false; return; }
        if (selectMode) { onToggleSelect?.(); return; }
        onSelect();
    };
    const pointer = { onPointerDown: startPress, onPointerUp: cancelPress, onPointerLeave: cancelPress, onPointerCancel: cancelPress };

    const favBtn = (overlay: boolean) => (
        <button onClick={(e) => { e.stopPropagation(); onFavorite(); }} aria-label="加入最愛"
                className={`${overlay ? 'absolute top-2 right-2 bg-white/90 w-8 h-8' : 'w-9 h-9 flex-shrink-0'} rounded-full flex items-center justify-center`}
                style={overlay ? { color: item.isFavorite ? '#F5B301' : '#B7B2A7' } : { background: item.isFavorite ? 'rgba(245,179,1,.15)' : '#F1F1F1', color: item.isFavorite ? '#F5B301' : '#B7B2A7' }}>
            <Star className="w-4 h-4" fill={item.isFavorite ? 'currentColor' : 'none'} />
        </button>
    );

    if (variant === 'wall') {
        return (
            <div ref={refCb} onClick={handleClick} {...pointer}
                 className={`rounded-2xl overflow-hidden shadow-sm border transition-all cursor-pointer ${selectMode && checked ? 'border-[#45846D] ring-2 ring-[#45846D]/20' : selected ? 'border-[#C0573E]' : 'border-white'}`}>
                <div className="relative w-full h-[150px]" style={{ background: photo.bg }}>
                    {photo.kind === 'image'
                        ? <img src={photo.src} alt={item.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ color: photo.fg }}><Icon className="w-8 h-8" /></div>}
                    {favBtn(true)}
                    {item.needsLocationConfirm && (
                        <button onClick={(e) => { e.stopPropagation(); onConfirmLoc?.(); }}
                                className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#854F0B] bg-[#FAEEDA] px-2 py-0.5 rounded-full">
                            <MapPinPlus className="w-3 h-3" /> 位置待確認
                        </button>
                    )}
                    {selectMode && (
                        <span className={`absolute top-2 left-2 w-[26px] h-[26px] rounded-full flex items-center justify-center ${checked ? 'bg-[#45846D] text-white' : 'bg-white/85 border-2 border-white'}`}>{checked && <Check className="w-4 h-4" />}</span>
                    )}
                </div>
                <div className="bg-white p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                            <p className="text-sm font-bold text-[#1D1D1B] truncate">{item.title}</p>
                            {item.type === 'place' && <RatingInline rating={item.rating} ratingCount={item.ratingCount} reviewMedian={reviewMedian} />}
                        </div>
                        {pills(3)}
                    </div>
                    {!selectMode && (
                        <button onClick={(e) => { e.stopPropagation(); onAdd(); }}
                                className="flex-shrink-0 inline-flex items-center gap-1 bg-[#45846D] text-white text-xs font-bold px-3 py-2 rounded-full active:scale-95 transition-transform">
                            <Briefcase className="w-3.5 h-3.5" /> 加入行程
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // row（精簡）
    return (
        <div ref={refCb} onClick={handleClick} {...pointer}
             className={`flex items-center gap-3 rounded-2xl p-2.5 shadow-sm border transition-all cursor-pointer ${selectMode && checked ? 'bg-[#EDF2F0] border-[#45846D]' : selected ? 'bg-white border-[#C0573E]' : 'bg-white border-white active:scale-[0.99]'}`}>
            {selectMode && (
                <span className={`w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#45846D] text-white' : 'border-2 border-[#D3D0C6]'}`}>{checked && <Check className="w-4 h-4" />}</span>
            )}
            <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden flex-shrink-0" style={{ background: photo.bg }}>
                {photo.kind === 'image'
                    ? <img src={photo.src} alt={item.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center" style={{ color: photo.fg }}><Icon className="w-6 h-6" /></div>}
                {item.needsLocationConfirm && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#EF9F27] border-2 border-white flex items-center justify-center text-white"><MapPinPlus className="w-2 h-2" /></span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-[#1D1D1B] truncate">{item.title}</p>
                    {item.type === 'place' && <RatingInline rating={item.rating} ratingCount={item.ratingCount} reviewMedian={reviewMedian} />}
                </div>
                {pills(2)}
            </div>
            {!selectMode && (
                <>
                    {favBtn(false)}
                    <button onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label="加入行程"
                            className="w-9 h-9 rounded-full bg-[#45846D] text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
                        <Briefcase className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};
