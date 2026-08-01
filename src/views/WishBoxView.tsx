// src/views/WishBoxView.tsx
// 🧱 Phase C1-1：靈感頁三層階層（國家護照卡 → 城市地圖中樞 → 地點）。
//   含：分類圖示圖釘、全域搜尋、排序、卡片↔圖釘雙向連動、點空白取消。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import {
    MapPin, ShoppingBag, Plus, ArrowLeft, Globe, Sparkles, X,
    List, Navigation, Edit3, Check, Store,
    Coffee, Utensils, Landmark, Wine, Search, ArrowDownUp, Star, MapPinPlus, Briefcase, Trash2, LayoutGrid, Receipt, Image as ImageIcon, Share2, Pin
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { WishItem, WishItemType, WishList, Trip } from '../types';
import { categoryKeyOf } from '../utils/wishCategory';
import { computeRatingStats, bayesianScore, reviewMedian } from '../utils/ratingScore';
import { useNearby, haversineKm, fmtDist } from '../hooks/useNearby';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { uploadTripImage } from '../services/storage';   // 📚 批3b：相簿封面上傳（沿用 trip 封面那套）
import { LocationPinSheet } from '../components/wish/LocationPinSheet';
import { BatchLocationConfirmSheet } from '../components/wish/BatchLocationConfirmSheet';
import { DraggableSheet } from '../components/wish/DraggableSheet';
import { WishPhotoCard } from '../components/wish/WishPhotoCard';
import { RatingInline } from '../components/wish/RatingInline';
import { SettlementSheet } from '../components/wish/SettlementSheet';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string;

// 護照印章：油墨色（依國名雜湊）與統一斜度
const STAMP_INKS = ['#C0573E', '#45846D', '#5B7C9B', '#B5852A', '#8A5A83', '#3F7E7E'];
const STAMP_ANGLE = -6;
const inkOf = (s: string) => STAMP_INKS[Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % STAMP_INKS.length];
const COUNTRY_CODES: Record<string, string> = {
    '台灣': 'TW', '臺灣': 'TW', '日本': 'JP', '韓國': 'KR', '南韓': 'KR', '泰國': 'TH',
    '美國': 'US', '法國': 'FR', '義大利': 'IT', '英國': 'GB', '德國': 'DE', '西班牙': 'ES',
    '越南': 'VN', '新加坡': 'SG', '馬來西亞': 'MY', '香港': 'HK', '中國': 'CN', '澳洲': 'AU',
    '加拿大': 'CA', '菲律賓': 'PH', '印尼': 'ID', '荷蘭': 'NL', '瑞士': 'CH',
};
const codeOf = (c: string) => COUNTRY_CODES[c] || '';

// 分類 → 圖示與顏色（分類邏輯共用 utils/wishCategory，單一真相）
const CAT_STYLE: Record<string, { Icon: React.FC<{ className?: string }>; color: string }> = {
    cafe: { Icon: Coffee, color: '#8A5A2B' },
    bar: { Icon: Wine, color: '#7A3E8A' },
    food: { Icon: Utensils, color: '#C0573E' },
    shop: { Icon: ShoppingBag, color: '#B5852A' },
    sight: { Icon: Landmark, color: '#45846D' },
    other: { Icon: MapPin, color: '#45846D' },
};
const categorize = (w: WishItem): { Icon: React.FC<{ className?: string }>; color: string } => {
    if (w.type === 'item') return { Icon: ShoppingBag, color: '#B5852A' };
    return CAT_STYLE[categoryKeyOf(w)];
};

const getTagColor = (tag: string) => {
    const colors = ['text-pink-600 bg-pink-50', 'text-blue-600 bg-blue-50', 'text-orange-600 bg-orange-50', 'text-purple-600 bg-purple-50', 'text-cyan-600 bg-cyan-50'];
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

interface WishBoxViewProps {
    wishItems: WishItem[];
    trips: Trip[];
    onAddWishToTrip: (wish: WishItem, tripId: string) => void;
    onEditClick: (item: WishItem) => void;
    onOpenImport: (initialType: WishItemType) => void;
    onToggleFavorite: (id: string) => void;
    onTogglePurchased: (id: string) => void;
    onConfirmLocation: (id: string, lat: number, lng: number) => void;   // 🧭 T3
    onConfirmLocations: (ids: string[]) => void;   // 🧭 Round2b 批次確認
    onDeleteWishes: (ids: string[]) => void;   // 🗂️ 多選批次刪除
    // 📚 批3：相簿/清單
    wishLists: WishList[];
    onCreateList: (name: string) => Promise<WishList | null>;
    onRenameList: (id: string, name: string) => void;
    onDeleteList: (id: string) => void;
    onSetListCover: (id: string, path: string | null) => void;
    onReorderLists: (orderedIds: string[]) => void;             // 📚 批A：編輯模式拖曳排序
    onSetListPinned: (id: string, pinned: boolean) => void;    // 📚 批A：釘選置頂
    onSettlePerson: (name: string, settled: boolean) => void;   // 🧾 代購結算
}

// 小進度環
const ProgressRing: React.FC<{ done: number; total: number; size?: number }> = ({ done, total, size = 46 }) => {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const pct = total ? done / total : 0;
    return (
        <svg width={size} height={size} className="flex-shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2DFD8" strokeWidth={4} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#45846D" strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#45846D" style={{ fontSize: 11, fontWeight: 700 }}>{done}/{total}</text>
        </svg>
    );
};

// 收據風購物列（勾選=已買，刪除線）。支援多選：selectMode 時 已買鈕換成選取圈、整列點擊＝勾選。
const ShoppingRow: React.FC<{ item: WishItem; onToggle: () => void; onEdit: () => void; tripLabel?: string; selectMode?: boolean; checked?: boolean; onToggleSelect?: () => void; onLongPress?: () => void }> = ({ item, onToggle, onEdit, tripLabel, selectMode, checked, onToggleSelect, onLongPress }) => {
    const bought = !!item.isPurchased;
    const pressTimer = useRef<number | undefined>(undefined);
    const longFired = useRef(false);
    const startPress = () => { if (selectMode || !onLongPress) return; longFired.current = false; pressTimer.current = window.setTimeout(() => { longFired.current = true; onLongPress(); }, 500); };
    const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = undefined; } };
    const guard = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); if (longFired.current) { longFired.current = false; return; } fn(); };
    const rowClick = () => { if (longFired.current) { longFired.current = false; return; } if (selectMode) onToggleSelect?.(); };
    return (
        <div onClick={rowClick} onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
             className={`flex items-center gap-3 py-3 border-b border-dashed border-[#EFECE5] last:border-b-0 transition-opacity ${bought && !selectMode ? 'opacity-50' : ''} ${selectMode ? 'cursor-pointer' : ''}`}>
            {selectMode ? (
                <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#45846D] text-white' : 'border-2 border-[#D3D0C6]'}`}>{checked && <Check className="w-3.5 h-3.5" />}</span>
            ) : (
                <button onClick={guard(onToggle)} className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${bought ? 'bg-[#45846D] text-white' : 'border-[1.5px] border-gray-300 hover:border-[#45846D]'}`}>
                    {bought && <Check className="w-3.5 h-3.5" />}
                </button>
            )}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${bought && !selectMode ? 'line-through text-gray-400' : 'text-[#1D1D1B]'}`}>
                    {item.title}{item.quantity != null && item.quantity > 1 && <span className="text-[11px] text-gray-400 ml-1">×{item.quantity}</span>}
                </p>
                {(item.tags && item.tags.length > 0) && (!bought || selectMode) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {(item.tags || []).slice(0, 2).map(t => <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTagColor(t)}`}>#{t}</span>)}
                    </div>
                )}
            </div>
            {tripLabel && !bought && <span className="text-[10px] font-bold text-[#185FA5] bg-[#E6F1FB] px-2 py-0.5 rounded-md flex-shrink-0">{tripLabel}</span>}
            {item.forWhom && !bought && <span className="text-[10px] font-bold text-[#993556] bg-[#FBEAF0] px-2 py-0.5 rounded-md flex-shrink-0">{item.forWhom}</span>}
            {item.budget != null && <span className={`font-mono text-sm flex-shrink-0 ${bought && !selectMode ? 'line-through text-gray-400' : 'text-[#1D1D1B]'}`}>{item.currency || 'TWD'} {item.budget.toLocaleString()}</span>}
            {!selectMode && <button onClick={guard(onEdit)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>}
        </div>
    );
};

// 自動框住地圖上所有圖釘
const FitBounds: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
    const map = useMap();
    const coreLib = useMapsLibrary('core');
    useEffect(() => {
        if (!map || !coreLib || points.length === 0) return;
        if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); return; }
        const bounds = new coreLib.LatLngBounds();
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, 60);
    }, [map, coreLib, points]);
    return null;
};

// 選取圖釘 → 平移並適度拉近
const PanTo: React.FC<{ target: { lat: number; lng: number } | null }> = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !target) return;
        map.panTo(target);
        if ((map.getZoom() || 0) < 14) map.setZoom(15);
    }, [map, target]);
    return null;
};

// 聚合圖釘：點多/縮小時合併成群集泡泡（markerclusterer）
const ClusteredWishMarkers: React.FC<{ pins: WishItem[]; selectedId: string | null; onSelect: (w: WishItem) => void }> = ({ pins, selectedId, onSelect }) => {
    const map = useMap();
    const clustererRef = useRef<MarkerClusterer | null>(null);
    const markersRef = useRef<Record<string, Marker>>({});

    useEffect(() => {
        if (!map) return;
        clustererRef.current = new MarkerClusterer({ map });
        return () => { clustererRef.current?.clearMarkers(); clustererRef.current = null; };
    }, [map]);

    // 穩定回呼 + 用 ref 收集 marker（不觸發 setState，避免無限迴圈）
    const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
        if (marker && markersRef.current[key] === marker) return;
        if (marker) markersRef.current[key] = marker;
        else delete markersRef.current[key];
    }, []);

    // 圖釘「集合」變動時才同步聚合器（與順序無關 → 排序不會重建 marker、不掉自訂內容）
    const pinKey = pins.map(p => p.id).slice().sort().join(',');
    useEffect(() => {
        const c = clustererRef.current;
        if (!c) return;
        c.clearMarkers();
        c.addMarkers(Object.values(markersRef.current));
    }, [pinKey, map]);

    return (
        <>
            {pins.map((w, i) => {
                const { Icon, color } = categorize(w);
                const sel = selectedId === w.id;
                return (
                    <AdvancedMarker key={w.id} ref={marker => setMarkerRef(marker, w.id)} position={{ lat: w.lat as number, lng: w.lng as number }} onClick={() => onSelect(w)} zIndex={sel ? 999 : i}>
                        <div className={`rounded-full flex items-center justify-center border-2 border-white shadow-md transition-all ${sel ? 'w-9 h-9 ring-2 ring-[#C0573E] scale-110' : 'w-7 h-7'}`} style={{ backgroundColor: sel ? '#C0573E' : color }}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                    </AdvancedMarker>
                );
            })}
        </>
    );
};

const WishMap: React.FC<{ items: WishItem[]; selectedId: string | null; onSelect: (w: WishItem) => void; onDeselect: () => void }> = ({ items, selectedId, onSelect, onDeselect }) => {
    const pins = useMemo(() => items.filter(w => w.lat != null && w.lng != null), [items]);
    const points = useMemo(() => pins.map(w => ({ lat: w.lat as number, lng: w.lng as number })), [pins]);
    const target = useMemo(() => {
        const w = pins.find(p => p.id === selectedId);
        return w ? { lat: w.lat as number, lng: w.lng as number } : null;
    }, [pins, selectedId]);
    if (!MAPS_KEY || !MAP_ID) return <div className="h-full flex items-center justify-center text-gray-400 text-sm px-6 text-center">地圖金鑰未設定</div>;
    if (pins.length === 0) return <div className="h-full flex items-center justify-center text-gray-400 text-sm px-6 text-center">這裡的收藏還沒有座標，稍後會自動定位</div>;
    return (
        <APIProvider apiKey={MAPS_KEY}>
            <Map mapId={MAP_ID} defaultCenter={points[0]} defaultZoom={12} gestureHandling="greedy" disableDefaultUI className="w-full h-full" onClick={() => onDeselect()}>
                <ClusteredWishMarkers pins={pins} selectedId={selectedId} onSelect={onSelect} />
                <FitBounds points={points} />
                <PanTo target={target} />
            </Map>
        </APIProvider>
    );
};

// 收藏卡（Level 2 清單與搜尋結果共用）
//   本體點擊 = 選取（連動地圖）；筆 = 編輯；＋ = 加入行程
const WishCard: React.FC<{ item: WishItem; selected?: boolean; onSelect: () => void; onEdit?: () => void; onAdd: () => void; onFavorite: () => void; onConfirmLoc?: () => void; refCb?: (el: HTMLDivElement | null) => void; selectMode?: boolean; checked?: boolean; onToggleSelect?: () => void; onLongPress?: () => void; reviewMedian?: number }> = ({ item, selected, onSelect, onAdd, onFavorite, onConfirmLoc, refCb, selectMode, checked, onToggleSelect, onLongPress, reviewMedian }) => {
    const { Icon } = categorize(item);
    // 長按進入多選（僅在提供 onLongPress 的清單啟用；點擊誤觸由 longFired 抑制）
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
    return (
        <div ref={refCb} onClick={handleClick}
             onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
             className={`flex gap-3 rounded-2xl p-3 shadow-sm border cursor-pointer transition-all ${selectMode && checked ? 'bg-[#EDF2F0] border-[#45846D]' : selected ? 'bg-white border-[#C0573E] ring-2 ring-[#C0573E]/20' : 'bg-white border-white hover:border-[#45846D]/40 active:scale-[0.99]'}`}>
            {selectMode && (
                <span className={`self-center w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[#45846D] text-white' : 'border-2 border-[#D3D0C6]'}`}>
                    {checked && <Check className="w-4 h-4" />}
                </span>
            )}
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#E9E5DC] flex-shrink-0 flex items-center justify-center text-[#45846D]">
                {item.customImage ? <img src={item.customImage} alt={item.title} className="w-full h-full object-cover" /> : <Icon className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <h3 className="font-bold text-[#1D1D1B] text-sm leading-snug truncate">{item.title}</h3>
                    {item.type === 'place' && <RatingInline rating={item.rating} ratingCount={item.ratingCount} reviewMedian={reviewMedian} />}
                </div>
                {item.notes && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{item.notes}</p>}
                {item.type === 'item' && item.budget != null && <p className="text-[11px] font-bold text-[#1D1D1B] mt-0.5 font-mono">{item.currency || 'TWD'} {item.budget.toLocaleString()}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {(item.city || item.area) && <span className="text-[10px] font-bold text-[#57534E] bg-[#EAE6DD] px-2 py-0.5 rounded-md">{[item.city, item.area].filter(Boolean).join(' · ')}</span>}
                    {(item.tags || []).slice(0, 2).map(t => <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTagColor(t)}`}>#{t}</span>)}
                </div>
                {item.needsLocationConfirm && (
                    <button onClick={(e) => { e.stopPropagation(); onConfirmLoc?.(); }}
                            className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-[#854F0B] bg-[#FAEEDA] px-2 py-0.5 rounded-full active:scale-95 transition-transform">
                        <MapPinPlus className="w-3 h-3" /> 位置待確認・點我修正
                    </button>
                )}
            </div>
            {/* 🎨 A 卡：拿掉冗餘的筆（點卡片即編輯）＋「＋」改成帶字的主行動「加入行程」。多選模式時整組收起。 */}
            {!selectMode && (
                <div className="flex items-center gap-2 self-center flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onFavorite(); }} aria-label="加入最愛"
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${item.isFavorite ? 'bg-[#F5B301]/15 text-[#F5B301]' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}>
                        <Star className="w-[18px] h-[18px]" fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(); }}
                            className="inline-flex items-center gap-1.5 bg-[#45846D] hover:bg-[#3B7460] text-white text-xs font-bold pl-2.5 pr-3 py-2 rounded-full transition-colors active:scale-95">
                        <Briefcase className="w-3.5 h-3.5" /> 加入行程
                    </button>
                </div>
            )}
        </div>
    );
};

// 📚 批B（視覺統一）：編輯模式的「格狀」拖曳排序（framer-motion）。
//   維持相簿格狀外觀，拖曳時以卡片中心 overlap 偵測即時重排，layout 動畫讓鄰卡讓位。
//   放下時「穩定分區」讓釘選永遠置頂（與釘選規則不打架）。
const AlbumEditGrid: React.FC<{
    lists: WishList[];
    countInList: (id: string) => number;
    photosOf: (id: string) => string[];
    onReorder: (orderedIds: string[]) => void;
    onSetPinned: (id: string, pinned: boolean) => void;
}> = ({ lists, countInList, photosOf, onReorder, onSetPinned }) => {
    const [order, setOrder] = useState<string[]>(() => lists.map(l => l.id));
    // 外部（釘選重排/新增刪除）變動 → 同步本地順序
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部重排/增刪的順序同步（受控鏡像）
    useEffect(() => { setOrder(lists.map(l => l.id)); }, [lists]);
    // ⚠️ 本檔第 5 行 import 了 @vis.gl 的 Map 元件，蓋掉全域 Map 建構子；故用 Record 查找表，不用 new Map。
    const byId = useMemo(() => {
        const m: Record<string, WishList> = {};
        lists.forEach(l => { m[l.id] = l; });
        return m;
    }, [lists]);
    const refs = useRef<Record<string, HTMLDivElement | null>>({});

    const onDragCard = (id: string) => {
        const self = refs.current[id];
        if (!self) return;
        const sr = self.getBoundingClientRect();
        const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
        for (const oid of order) {
            if (oid === id) continue;
            const el = refs.current[oid];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            const mx = r.width * 0.25, my = r.height * 0.25;   // 落在對方內部 50% 才換，避免邊緣抖動
            if (cx > r.left + mx && cx < r.right - mx && cy > r.top + my && cy < r.bottom - my) {
                setOrder(prev => {
                    const from = prev.indexOf(id), to = prev.indexOf(oid);
                    if (from < 0 || to < 0 || from === to) return prev;
                    const next = [...prev];
                    next.splice(from, 1);
                    next.splice(to, 0, id);
                    return next;
                });
                return;
            }
        }
    };

    const commit = () => {
        const ordered = order.map(id => byId[id]).filter(Boolean) as WishList[];
        const partitioned = [...ordered.filter(l => l.pinned), ...ordered.filter(l => !l.pinned)];
        const ids = partitioned.map(l => l.id);
        setOrder(ids);
        onReorder(ids);
    };

    return (
        <div className="grid grid-cols-2 gap-3">
            {order.map(id => {
                const l = byId[id];
                if (!l) return null;
                const photos = photosOf(id);
                return (
                    <motion.div key={id} layout
                        ref={(el: HTMLDivElement | null) => { refs.current[id] = el; }}
                        drag dragSnapToOrigin dragElastic={0.12}
                        whileDrag={{ scale: 1.06, zIndex: 50, boxShadow: '0 16px 38px rgba(29,29,27,0.26)' }}
                        onDrag={() => onDragCard(id)}
                        onDragEnd={commit}
                        transition={{ type: 'spring', stiffness: 600, damping: 40 }}
                        className="relative h-[118px] rounded-[16px] overflow-hidden bg-[#3F6B52]"
                        style={{ touchAction: 'none' }}>
                        {l.coverImage ? <img src={l.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" /> : photos.length > 0 ? (
                            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">{[0, 1, 2, 3].map(i => <div key={i} className="bg-[#D8CFBB]" style={photos[i] ? { backgroundImage: `url(${photos[i]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />)}</div>
                        ) : <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#6b7a63,#3F6B52)' }} />}
                        {/* 釘選鈕（左上）；pointerDown 阻擋，避免點釘選誤觸拖曳 */}
                        <button onPointerDown={e => e.stopPropagation()} onClick={() => onSetPinned(l.id, !l.pinned)}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center z-10"
                            style={{ background: l.pinned ? '#FBF1D9' : 'rgba(35,35,32,0.42)' }}>
                            <Pin className="w-3.5 h-3.5" style={{ color: l.pinned ? '#C9A24A' : '#fff' }} fill={l.pinned ? '#C9A24A' : 'none'} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 pointer-events-none" style={{ background: 'linear-gradient(transparent,rgba(29,29,27,0.6))' }}>
                            <div className="font-serif text-[15px] text-white truncate">{l.name}</div>
                            <div className="text-[9px] text-white/80 font-mono">{countInList(l.id)} 個地點{l.pinned ? ' · 已釘選' : ''}</div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};

export const WishBoxView: React.FC<WishBoxViewProps> = ({
    wishItems, trips, onAddWishToTrip, onEditClick, onOpenImport, onToggleFavorite, onTogglePurchased, onConfirmLocation, onConfirmLocations, onDeleteWishes, onSettlePerson,
    wishLists, onCreateList, onRenameList, onDeleteList, onSetListCover, onReorderLists, onSetListPinned
}) => {
    const [settlementOpen, setSettlementOpen] = useState(false);   // 🧾 代購結算
    const [activeTab, setActiveTab] = useState<WishItemType>('place');
    // 📚 批3：相簿瀏覽
    const [browseMode, setBrowseMode] = useState<'region' | 'list'>('region');
    const [openListId, setOpenListId] = useState<string | null>(null);   // 真 id ／ '__fav__' ／ '__none__'
    const [creatingAlbum, setCreatingAlbum] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [, setViewMode] = useState<'map' | 'list'>('map');   // lint 清理：讀值端已改地圖常駐
    const [actionWish, setActionWish] = useState<WishItem | null>(null);
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'recent' | 'name' | 'rating' | 'reputation'>('recent');
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    // 🧭 C2-1 附近雷達
    const [nearbyMode, setNearbyMode] = useState(false);
    // 🧭 T3 位置待確認：篩選 chip + 拖釘面板
    const [confirmFilter, setConfirmFilter] = useState(false);
    const [pinEditWish, setPinEditWish] = useState<WishItem | null>(null);
    const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);   // 🧭 Round2b 批次確認地圖
    // 🗂️ 多選模式：批次加入行程
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchInjectOpen, setBatchInjectOpen] = useState(false);
    // 🖼️ Stage 2 密度：rows（精簡，預設）/ wall（Hero 大卡）；多選時強制精簡
    const [density, setDensity] = useState<'rows' | 'wall'>('rows');
    // 🔎 Stage 3：Level-2 搜尋 + 標籤點擊篩選 + 點卡片收合底部卡
    const [sheetQuery, setSheetQuery] = useState('');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [sheetCollapse, setSheetCollapse] = useState(0);
    // 🛍️ 購物「附近」在地雷達（複用 useNearby）
    const [shopNearbyOn, setShopNearbyOn] = useState(false);
    const enterSelect = (seedId?: string) => { setSelectMode(true); setSelectedIds(seedId ? new Set([seedId]) : new Set()); };
    const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    // 破壞性、須確認：批次刪除選取的收藏
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        const ok = await confirmDialog({ title: '刪除收藏', message: `確定刪除選取的 ${selectedIds.size} 個收藏？此動作無法復原。`, confirmText: '刪除', tone: 'danger' });
        if (!ok) return;
        onDeleteWishes([...selectedIds]);
        exitSelect();
    };
    const nearby = useNearby();
    const toggleNearby = () => { setNearbyMode(m => { const next = !m; if (next) nearby.locate(); return next; }); };
    const nearbyItems = useMemo(() => {
        if (!nearby.pos) return [];
        return wishItems
            .filter(w => w.type === 'place' && w.lat != null && w.lng != null)
            .map(w => ({ w, km: haversineKm(nearby.pos!, { lat: w.lat as number, lng: w.lng as number }) }))
            .sort((a, b) => a.km - b.km);
    }, [wishItems, nearby.pos]);

    useEffect(() => {
        if (selectedPin) cardRefs.current[selectedPin]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [selectedPin]);
    useEffect(() => { setSelectedPin(null); }, [selectedCity]);

    const unit = activeTab === 'item' ? '項目' : '地點';
    const tabItems = useMemo(() => wishItems.filter(i => i.type === activeTab), [wishItems, activeTab]);
    const tripDestById = useMemo(() => Object.fromEntries(trips.map(t => [t.id, t.destination])) as Record<string, string>, [trips]);   // 🧾 #1 購物列行程膠囊

    // 🌟 排序：純評分（rating，直覺高→低）／口碑（reputation，相對貝氏防呆）。
    //   評分兩軸都用「當前清單」算 C/m，故 stats 於此地計算（見 utils/ratingScore.ts 檔頭說明）。
    const sortItems = (list: WishItem[]) => {
        const arr = [...list];
        if (sortBy === 'rating' || sortBy === 'reputation') {
            const { C, m } = computeRatingStats(arr);
            const scoreOf = (w: WishItem): number => {
                if (w.type !== 'place' || w.rating == null) return -1;   // 無評分 → 排最後
                return sortBy === 'reputation' ? bayesianScore(w.rating, w.ratingCount ?? 0, C, m) : w.rating;
            };
            arr.sort((a, b) => {
                if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;   // 最愛永遠置頂
                const sa = scoreOf(a), sb = scoreOf(b);
                if (sb !== sa) return sb - sa;
                return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);                    // 同分：評論多者優先
            });
            return arr;
        }
        arr.sort((a, b) => {
            if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;   // 我的最愛永遠置頂
            if (sortBy === 'name') return a.title.localeCompare(b.title, 'zh-Hant');
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return arr;
    };
    const SORT_ORDER = ['recent', 'name', 'rating', 'reputation'] as const;
    const SORT_LABEL: Record<typeof sortBy, string> = { recent: '最新', name: '名稱', rating: '評分', reputation: '口碑' };
    const cycleSort = () => setSortBy(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);
    const SortButton = () => (
        <button onClick={cycleSort} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
            <ArrowDownUp className="w-3.5 h-3.5" /> {SORT_LABEL[sortBy]}
        </button>
    );

    // 全域搜尋結果（目前分頁內）
    const q = query.trim().toLowerCase();
    const searchResults = useMemo(() => {
        if (!q) return [];
        return tabItems.filter(it => `${it.title} ${it.country} ${it.city || ''} ${it.area || ''} ${(it.tags || []).join(' ')} ${it.notes || ''}`.toLowerCase().includes(q));
    }, [tabItems, q]);

    // Level 1：依國家彙整
    const countryStats = useMemo(() => {
        const m: Record<string, { count: number; done: number; cities: Record<string, number> }> = {};
        tabItems.forEach(it => {
            const c = it.country || '其他';
            if (!m[c]) m[c] = { count: 0, done: 0, cities: {} };
            m[c].count++;
            if (it.isPurchased) m[c].done++;
            if (it.city) m[c].cities[it.city] = (m[c].cities[it.city] || 0) + 1;
        });
        return Object.entries(m).sort((a, b) => b[1].count - a[1].count);
    }, [tabItems]);

    // 📚 批3：相簿（清單）衍生資料
    const placeItems = useMemo(() => wishItems.filter(w => w.type === 'place'), [wishItems]);
    const countInList = (listId: string) => placeItems.filter(w => w.listId === listId).length;
    const favCount = useMemo(() => placeItems.filter(w => w.isFavorite).length, [placeItems]);
    const noneCount = useMemo(() => placeItems.filter(w => !w.listId).length, [placeItems]);
    const coverPhotos = (pred: (w: WishItem) => boolean) => placeItems.filter(w => pred(w) && w.customImage).slice(0, 4).map(w => w.customImage as string);
    const openListName = openListId === '__fav__' ? '最愛' : openListId === '__none__' ? '未分類' : (wishLists.find(l => l.id === openListId)?.name || '');
    const openListItems = useMemo(() => {
        if (openListId === '__fav__') return sortItems(placeItems.filter(w => w.isFavorite));
        if (openListId === '__none__') return sortItems(placeItems.filter(w => !w.listId));
        if (openListId) return sortItems(placeItems.filter(w => w.listId === openListId));
        return [];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openListId, placeItems, sortBy]);
    const handleCreateAlbum = async () => {
        const name = newAlbumName.trim();
        if (!name) return;
        const list = await onCreateList(name);
        setCreatingAlbum(false); setNewAlbumName('');
        if (list) setOpenListId(list.id);
    };

    // 📚 批3b/4：相簿管理（iOS 原生長按 context menu／改名／換封面／刪除）
    //   menu 帶著被長按卡片的 DOMRect，用來把暗色浮卡錨定在卡片旁（圖一）。
    const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
    const [renamingList, setRenamingList] = useState<{ id: string; name: string } | null>(null);
    const albumPressTimer = useRef<number | undefined>(undefined);
    const albumLongFired = useRef(false);
    const albumStartRef = useRef<{ x: number; y: number } | null>(null);
    const coverTargetRef = useRef<string | null>(null);
    const albumFileRef = useRef<HTMLInputElement>(null);
    // 長按 450ms 觸發；rect 在 press 當下同步擷取（timeout 內 event 已失效）。
    // 用 pointer 事件統一 touch/mouse，避免行動裝置 touch+mouse 重複觸發。
    const albumStartPress = (id: string, el: HTMLElement, x: number, y: number) => {
        albumLongFired.current = false;
        albumStartRef.current = { x, y };
        const rect = el.getBoundingClientRect();
        albumPressTimer.current = window.setTimeout(() => {
            albumLongFired.current = true;
            setMenu({ id, rect });
            try { if ('vibrate' in navigator) navigator.vibrate(8); } catch { /* 無震動則忽略 */ }
        }, 450);
    };
    // 位移超過 12px 才算滑動而取消，避免手指微抖誤殺長按。
    const albumMovePress = (x: number, y: number) => {
        const s = albumStartRef.current;
        if (s && Math.hypot(x - s.x, y - s.y) > 12) albumEndPress();
    };
    const albumEndPress = () => { if (albumPressTimer.current) { clearTimeout(albumPressTimer.current); albumPressTimer.current = undefined; } };
    const albumClick = (open: () => void) => { if (albumLongFired.current) { albumLongFired.current = false; return; } open(); };
    const openCoverPicker = (id: string) => { coverTargetRef.current = id; setMenu(null); albumFileRef.current?.click(); };
    const handleAlbumCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; const id = coverTargetRef.current; e.target.value = '';
        if (!file || !id) return;
        try { const path = await uploadTripImage(file); onSetListCover(id, path); toast('封面已更新', 'success'); }
        catch { toast('封面上傳失敗，請再試一次。'); }
        coverTargetRef.current = null;
    };
    const doRename = () => { if (renamingList && renamingList.name.trim()) onRenameList(renamingList.id, renamingList.name.trim()); setRenamingList(null); };

    // 📚 批A/B：相簿編輯模式（拖曳排序＋釘選）
    const [editingAlbums, setEditingAlbums] = useState(false);
    // 顯示排序：釘選置頂 → position → createdAt desc（樂觀更新後本地再排一次，穩定）
    const sortedLists = useMemo(() => [...wishLists].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.position !== b.position) return a.position - b.position;
        return b.createdAt.localeCompare(a.createdAt);
    }), [wishLists]);
    // 拖曳排序 UI 與「釘選永遠置頂」的穩定分區，移到 AlbumEditGrid（framer-motion 格狀）。
    const doDeleteList = async (id: string) => {
        setMenu(null);
        const ok = await confirmDialog({ title: '刪除清單', message: '刪除這本清單？裡面的地點會變回「未分類」，不會被刪除。', confirmText: '刪除', tone: 'danger' });
        if (ok) onDeleteList(id);
    };

    // Level 2
    const countryItems = useMemo(() => tabItems.filter(it => (it.country || '其他') === selectedCountry), [tabItems, selectedCountry]);
    // 🧭 T3 該國家內「位置待確認」數（篩選 chip 用；置於國家層 全部/城市 那排）
    const countryNeedsConfirm = useMemo(() => countryItems.filter(w => w.needsLocationConfirm).length, [countryItems]);
    // 修完歸零 → 自動收起篩選
    useEffect(() => { if (confirmFilter && countryNeedsConfirm === 0) setConfirmFilter(false); }, [confirmFilter, countryNeedsConfirm]);
    // 多選：被選心願（批次匯入用）
    const selectedWishes = useMemo(() => wishItems.filter(w => selectedIds.has(w.id)), [wishItems, selectedIds]);
    const cityChips = useMemo(() => {
        const m: Record<string, number> = {};
        countryItems.forEach(it => { if (it.city) m[it.city] = (m[it.city] || 0) + 1; });
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    }, [countryItems]);
    const displayItems = useMemo(() => {
        let base = selectedCity ? countryItems.filter(it => it.city === selectedCity) : countryItems;
        if (confirmFilter) base = base.filter(it => it.needsLocationConfirm);   // 🧭 T3 只看待確認
        if (tagFilter) base = base.filter(it => (it.tags || []).includes(tagFilter));   // 🔎 標籤篩選
        const sq = sheetQuery.trim().toLowerCase();
        if (sq) base = base.filter(it => `${it.title} ${it.city || ''} ${it.area || ''} ${(it.tags || []).join(' ')} ${it.notes || ''}`.toLowerCase().includes(sq));
        return sortItems(base);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countryItems, selectedCity, sortBy, confirmFilter, tagFilter, sheetQuery]);
    // 🗺️ 地圖顯示「這個城市的全部點」（空間脈絡），不吃搜尋/標籤篩選 → 篩到 0 也不會白掉
    const mapItems = useMemo(
        () => (selectedCity ? countryItems.filter(it => it.city === selectedCity) : countryItems),
        [countryItems, selectedCity],
    );

    const resetL2Filters = () => { setConfirmFilter(false); setTagFilter(null); setSheetQuery(''); };
    const openCountry = (c: string) => { setSelectedCountry(c); setSelectedCity(null); setSelectedPin(null); setViewMode('map'); resetL2Filters(); exitSelect(); };
    const backToCountries = () => { setSelectedCountry(null); setSelectedCity(null); setSelectedPin(null); resetL2Filters(); exitSelect(); };

    // ---- Level 2 城市中樞 ----
    if (selectedCountry) {
        const isPlace = activeTab === 'place';
        return (
            <div className="h-full flex flex-col w-full bg-[#E4E2DD] relative">
                <div className="flex-shrink-0 pt-14 pb-3 px-5 bg-white/95 backdrop-blur-xl sticky top-0 z-40 border-b border-black/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={backToCountries} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
                            <div className="min-w-0">
                                <p className="text-[10px] tracking-[0.15em] text-gray-400">{codeOf(selectedCountry) || 'WISH'}</p>
                                <h2 className="font-serif text-2xl font-bold text-[#1D1D1B] truncate leading-tight">{selectedCountry}</h2>
                            </div>
                        </div>
                    </div>

                    {selectMode ? (
                        <div className="flex items-center justify-between pt-3">
                            <button onClick={exitSelect} className="text-sm text-gray-500 font-medium px-1">取消</button>
                            <span className="text-sm font-bold text-[#1D1D1B]">已選 {selectedIds.size} 項</span>
                            <button onClick={() => {
                                        const allSel = displayItems.length > 0 && displayItems.every(w => selectedIds.has(w.id));
                                        setSelectedIds(allSel ? new Set() : new Set(displayItems.map(w => w.id)));
                                    }}
                                    className="text-sm text-[#45846D] font-bold px-1">
                                {displayItems.length > 0 && displayItems.every(w => selectedIds.has(w.id)) ? '取消全選' : '全選'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 pt-3">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 -mx-1 px-1">
                                <button onClick={() => { setSelectedCity(null); setConfirmFilter(false); }} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!selectedCity && !confirmFilter ? 'bg-[#45846D] text-white' : 'bg-[#F1EFE8] text-gray-600'}`}>全部 · {countryItems.length}</button>
                                {isPlace && countryNeedsConfirm > 0 && (
                                    <button onClick={() => setBatchConfirmOpen(true)}
                                            className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-[#FAEEDA] text-[#854F0B] active:scale-95">
                                        <MapPinPlus className="w-3.5 h-3.5" /> 位置待確認 · {countryNeedsConfirm}
                                    </button>
                                )}
                                {cityChips.map(([city, n]) => (
                                    <button key={city} onClick={() => { setSelectedCity(city); setConfirmFilter(false); }} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCity === city && !confirmFilter ? 'bg-[#45846D] text-white' : 'bg-[#F1EFE8] text-gray-600'}`}>{city} · {n}</button>
                                ))}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                                {isPlace && (
                                    <div className="flex bg-[#767680]/10 rounded-lg p-[2px]">
                                        <button onClick={() => setDensity('rows')} className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors ${density === 'rows' ? 'bg-white text-[#1D1D1B] shadow-sm' : 'text-gray-500'}`}><List className="w-4 h-4" /></button>
                                        <button onClick={() => setDensity('wall')} className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors ${density === 'wall' ? 'bg-white text-[#1D1D1B] shadow-sm' : 'text-gray-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                                    </div>
                                )}
                                <SortButton />
                                {displayItems.length > 0 && (
                                    <button onClick={() => enterSelect()} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">選取</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {isPlace ? (
                    /* 🗺️ 地圖全屏墊底 + 可拖曳底部卡（Stage 1：拿掉地圖/列表切換，純拖曳） */
                    <div className="relative flex-1 min-h-0 bg-gray-100">
                        <div className="absolute inset-0">
                            <WishMap items={mapItems} selectedId={selectedPin} onSelect={(w) => setSelectedPin(w.id)} onDeselect={() => setSelectedPin(null)} />
                        </div>
                        {(() => {
                            const w = mapItems.find(x => x.id === selectedPin);
                            if (!w || selectMode) return null;
                            return (
                                <div className="absolute top-3 left-3 right-3 z-30 bg-white rounded-2xl shadow-lg p-3 animate-in slide-in-from-top-2 flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#1D1D1B] text-sm truncate">{w.title}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{[w.city, w.area].filter(Boolean).join(' · ') || '未分區'}</p>
                                    </div>
                                    <button onClick={() => onEditClick(w)} className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                    <a href={w.lat != null ? `https://www.google.com/maps/search/?api=1&query=${w.lat},${w.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.title)}`} target="_blank" rel="noreferrer" className="flex-shrink-0 flex items-center gap-1 bg-[#45846D] text-white text-xs font-bold px-3 h-9 rounded-full active:scale-95 transition-transform"><Navigation className="w-3.5 h-3.5" /> 導航</a>
                                </div>
                            );
                        })()}
                        <DraggableSheet collapseSignal={sheetCollapse} forceFull={selectMode} header={selectMode ? undefined : (
                            <div className="pt-1">
                                <div className="flex items-center gap-2 bg-white rounded-xl px-3 h-10 border border-gray-200">
                                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <input value={sheetQuery} onChange={e => setSheetQuery(e.target.value)} placeholder={`搜尋 ${selectedCountry} 的收藏…`}
                                           className="flex-1 bg-transparent text-sm text-[#1D1D1B] outline-none" />
                                    {sheetQuery && <button onClick={() => setSheetQuery('')} className="text-gray-400"><X className="w-4 h-4" /></button>}
                                </div>
                                {tagFilter && (
                                    <button onClick={() => setTagFilter(null)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#45846D] bg-[#EDF2F0] px-3 py-1.5 rounded-full">
                                        篩選：#{tagFilter} <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}>
                            {displayItems.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-16">{sheetQuery || tagFilter ? '找不到符合的收藏' : '這個分類還沒有收藏'}</div>
                            ) : (
                                <div className="space-y-2.5 pt-1">
                                    {(() => { const med = reviewMedian(displayItems); return displayItems.map(item => (
                                        <WishPhotoCard key={item.id} item={item} reviewMedian={med}
                                                  variant={selectMode || density === 'rows' ? 'row' : 'wall'}
                                                  selected={selectedPin === item.id}
                                                  refCb={el => { cardRefs.current[item.id] = el; }}
                                                  onSelect={() => { setSelectedPin(item.id); setSheetCollapse(c => c + 1); }}
                                                  onAdd={() => setActionWish(item)}
                                                  onFavorite={() => onToggleFavorite(item.id)}
                                                  onConfirmLoc={() => setPinEditWish(item)}
                                                  onTagClick={(t) => setTagFilter(t)}
                                                  selectMode={selectMode} checked={selectedIds.has(item.id)}
                                                  onToggleSelect={() => toggleSelect(item.id)}
                                                  onLongPress={() => enterSelect(item.id)} />
                                    )); })()}
                                    {selectMode && <div className="h-20" />}
                                </div>
                            )}
                        </DraggableSheet>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-3 pb-32">
                        {/* 🔎 購物搜尋 + 附近雷達 */}
                        {!selectMode && (
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 h-10 border border-gray-200">
                                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <input value={sheetQuery} onChange={e => setSheetQuery(e.target.value)} placeholder={`搜尋 ${selectedCountry} 的購物…`}
                                           className="flex-1 bg-transparent text-sm text-[#1D1D1B] outline-none" />
                                    {sheetQuery && <button onClick={() => setSheetQuery('')} className="text-gray-400"><X className="w-4 h-4" /></button>}
                                </div>
                                <button onClick={() => setShopNearbyOn(v => { const n = !v; if (n) nearby.locate(); return n; })}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${shopNearbyOn ? 'bg-[#45846D] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                    <Navigation className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {shopNearbyOn && nearby.status === 'loading' && <p className="text-center text-gray-400 text-xs py-2">定位中…</p>}
                        {shopNearbyOn && (nearby.status === 'denied' || nearby.status === 'error') && (
                            <p className="text-center text-gray-400 text-xs py-2">無法定位，點右上重新定位或關閉附近</p>
                        )}
                        {displayItems.length === 0 ? (
                            <div className="text-center text-gray-400 text-sm py-16">{sheetQuery ? '找不到符合的購物項目' : '這個分類還沒有收藏'}</div>
                        ) : (
                            /* 購物：依「店家 / 類別」分組（附近開啟時依距離排序、顯示距離） */
                            <div className="space-y-3">
                                {(() => {
                                    const sorted = [...displayItems].sort((a, b) => (a.isPurchased ? 1 : 0) - (b.isPurchased ? 1 : 0));
                                    const row = (item: WishItem, showTrip: boolean) => (
                                        <ShoppingRow key={item.id} item={item} onToggle={() => onTogglePurchased(item.id)} onEdit={() => onEditClick(item)}
                                                     tripLabel={showTrip && item.tripId ? tripDestById[item.tripId] : undefined}
                                                     selectMode={selectMode} checked={selectedIds.has(item.id)}
                                                     onToggleSelect={() => toggleSelect(item.id)} onLongPress={() => enterSelect(item.id)} />
                                    );
                                    const storeCard = (key: string, cat: string, items: WishItem[], km: number | null, showTrip: boolean) => (
                                        <div key={key} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                            <div className="px-4 pt-3 pb-0.5 flex items-center gap-1.5 text-[12px] font-bold text-[#45846D]">
                                                <Store className="w-3.5 h-3.5" /> <span className="flex-1 truncate">{cat}</span>
                                                {km != null && <span className="text-[11px] font-bold text-white bg-[#45846D] px-2 py-0.5 rounded-full flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" />{fmtDist(km)}</span>}
                                            </div>
                                            <div className="px-4 pb-1">{items.map(i => row(i, showTrip))}</div>
                                        </div>
                                    );

                                    if (shopNearbyOn) {
                                        // 附近：店家扁平、依距離排序、列上標行程
                                        const g: Record<string, WishItem[]> = {};
                                        sorted.forEach(it => { const k = it.area || '其他'; (g[k] = g[k] || []).push(it); });
                                        return Object.entries(g).map(([cat, items]) => {
                                            const c = items.find(i => i.lat != null && i.lng != null);
                                            const km = (nearby.pos && c) ? haversineKm(nearby.pos, { lat: c.lat as number, lng: c.lng as number }) : null;
                                            return { cat, items, km };
                                        }).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).map(({ cat, items, km }) => storeCard(cat, cat, items, km, true));
                                    }

                                    // 一般：行程（外層大標）→ 店家（內層）
                                    const tg: Record<string, WishItem[]> = {};
                                    sorted.forEach(it => { const k = it.tripId || '__none'; (tg[k] = tg[k] || []).push(it); });
                                    return Object.entries(tg).sort((a, b) => {
                                        if (a[0] === '__none') return 1; if (b[0] === '__none') return -1;
                                        return (trips.find(t => t.id === a[0])?.startDate || '').localeCompare(trips.find(t => t.id === b[0])?.startDate || '');
                                    }).map(([tk, tItems]) => {
                                        const t = tk === '__none' ? null : trips.find(x => x.id === tk);
                                        const sg: Record<string, WishItem[]> = {};
                                        tItems.forEach(it => { const k = it.area || '其他'; (sg[k] = sg[k] || []).push(it); });
                                        return (
                                            <div key={tk} className="space-y-2">
                                                <div className="flex items-center gap-1.5 px-1 pt-1">
                                                    <Briefcase className="w-3.5 h-3.5 text-[#185FA5]" />
                                                    <span className="text-sm font-bold text-[#1D1D1B]">{t ? t.destination : '未綁行程'}</span>
                                                    {t?.startDate && <span className="text-[11px] text-gray-400">· {t.startDate.replace(/-/g, '/')}</span>}
                                                </div>
                                                {Object.entries(sg).map(([cat, items]) => storeCard(`${tk}:${cat}`, cat, items, null, false))}
                                            </div>
                                        );
                                    });
                                })()}
                                {selectMode && <div className="h-20" />}
                            </div>
                        )}
                    </div>
                )}

                {/* 購物：底部購買進度條（多選時讓位給動作條） */}
                {!isPlace && !selectMode && displayItems.length > 0 && (
                    <div className="flex-shrink-0 px-5 pb-safe pt-2 pb-4 bg-white/95 backdrop-blur border-t border-black/5">
                        {(() => {
                            const done = displayItems.filter(i => i.isPurchased).length;
                            const total = displayItems.length;
                            return (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full bg-[#E2DFD8] overflow-hidden">
                                        <div className="h-full bg-[#45846D] rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-[#45846D] flex-shrink-0">{done === total ? '全部買完 🎉' : `已買 ${done} / ${total}`}</span>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {actionWish && <InjectSheet wishes={[actionWish]} trips={trips} onClose={() => setActionWish(null)} onInject={onAddWishToTrip} />}

                {/* 🗂️ 多選底部動作條（釘在五分頁上方）：綠色主行動＝加入行程；次要破壞性＝刪除 */}
                {selectMode && (
                    <div className="fixed left-0 right-0 z-[60] px-4 flex justify-center"
                         style={{ bottom: 'calc(var(--bottom-nav-h, 70px) + env(safe-area-inset-bottom) + 10px)' }}>
                        <div className="w-full max-w-md flex items-center gap-2.5">
                            <button disabled={selectedIds.size === 0} onClick={handleBatchDelete} aria-label="刪除選取的收藏"
                                    className="w-14 h-[52px] rounded-2xl bg-white border border-[#EAD9D2] text-[#C0573E] flex items-center justify-center shadow-xl disabled:opacity-40 active:scale-[0.96] transition-all flex-shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button disabled={selectedIds.size === 0} onClick={() => setBatchInjectOpen(true)}
                                    className="flex-1 py-3.5 rounded-2xl bg-[#45846D] text-white font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40 active:scale-[0.98] transition-all">
                                <Briefcase className="w-5 h-5" /> 加入行程 · {selectedIds.size}
                            </button>
                        </div>
                    </div>
                )}
                {batchInjectOpen && <InjectSheet wishes={selectedWishes} trips={trips} onClose={() => setBatchInjectOpen(false)} onDone={exitSelect} onInject={onAddWishToTrip} />}

                {/* 🧭 T3 拖釘（Level-2 也要能開，否則卡片膠囊點了沒反應） */}
                <LocationPinSheet
                    key={pinEditWish?.id}
                    open={!!pinEditWish}
                    title={pinEditWish?.title || ''}
                    area={pinEditWish?.area || pinEditWish?.city}
                    initial={{ lat: pinEditWish?.lat, lng: pinEditWish?.lng }}
                    onConfirm={(lat, lng) => { if (pinEditWish) onConfirmLocation(pinEditWish.id, lat, lng); setPinEditWish(null); }}
                    onClose={() => setPinEditWish(null)}
                />

                {/* 🧭 Round2b 批次位置確認地圖 */}
                <BatchLocationConfirmSheet
                    open={batchConfirmOpen}
                    items={countryItems.filter(w => w.needsLocationConfirm && w.lat != null && w.lng != null)}
                    reference={countryItems.filter(w => !w.needsLocationConfirm && w.lat != null && w.lng != null)}
                    onFixOne={(item) => setPinEditWish(item)}
                    onConfirmAll={(ids) => { onConfirmLocations(ids); setBatchConfirmOpen(false); }}
                    onClose={() => setBatchConfirmOpen(false)}
                />
            </div>
        );
    }

    // ---- Level 1 國家總覽 ----
    const searching = q.length > 0;
    return (
        <div className="h-full flex flex-col w-full bg-transparent relative">
            <div className="flex-shrink-0 pt-16 pb-4 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 w-full sticky top-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-black tracking-[0.2em] text-[#45846D] mb-1">WISH BOX</p>
                        <h1 className="text-3xl font-black font-serif tracking-tight text-[#1D1D1B]">心願盒</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab === 'place' && (
                            <button onClick={toggleNearby}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${nearbyMode ? 'bg-[#45846D] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                <Navigation className="w-5 h-5" />
                            </button>
                        )}
                        {activeTab === 'item' && (
                            <button onClick={() => setSettlementOpen(true)}
                                    className="h-10 px-3.5 rounded-full flex items-center gap-1.5 bg-white text-[#993556] border border-gray-200 text-xs font-bold">
                                <Receipt className="w-4 h-4" /> 代購結算
                            </button>
                        )}
                        <button onClick={() => { setSearchOpen(o => !o); if (searchOpen) setQuery(''); }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${searchOpen ? 'bg-[#45846D] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {searchOpen ? (
                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 h-11 border border-gray-200">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={`搜尋${unit}、標籤、城市…`}
                               className="flex-1 bg-transparent text-sm text-[#1D1D1B] outline-none" />
                    </div>
                ) : (
                    <div className="bg-[#767680]/10 p-[2px] rounded-lg flex relative items-center h-8">
                        <div className="absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] bg-white rounded-md shadow-sm transition-all duration-300" style={{ left: activeTab === 'place' ? '2px' : 'calc(50%)' }} />
                        <button onClick={() => setActiveTab('place')} className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors ${activeTab === 'place' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}><MapPin className="w-3.5 h-3.5" /> 探索地點</button>
                        <button onClick={() => setActiveTab('item')} className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors ${activeTab === 'item' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}><ShoppingBag className="w-3.5 h-3.5" /> 購物清單</button>
                    </div>
                )}
                {activeTab === 'place' && !searchOpen && !nearbyMode && (
                    <div className="flex items-center gap-4 mt-3 px-1">
                        <button onClick={() => { setBrowseMode('list'); setOpenListId(null); }} className={`text-[12px] font-bold pb-1 transition-colors ${browseMode === 'list' ? 'text-[#1D1D1B] border-b-2 border-[#45846D]' : 'text-gray-500'}`}>清單</button>
                        <button onClick={() => { setBrowseMode('region'); setEditingAlbums(false); }} className={`text-[12px] font-bold pb-1 transition-colors ${browseMode === 'region' ? 'text-[#1D1D1B] border-b-2 border-[#45846D]' : 'text-gray-500'}`}>地區</button>
                        {browseMode === 'list' && !openListId && wishLists.length > 0 && (
                            <button onClick={() => setEditingAlbums(v => !v)} className="ml-auto text-[12px] font-bold pb-1 text-[#45846D]">{editingAlbums ? '完成' : '編輯'}</button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 no-scrollbar">
                {activeTab === 'place' && browseMode === 'list' && !nearbyMode && !searching ? (
                    openListId ? (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <button onClick={() => setOpenListId(null)} className="p-2 bg-white rounded-full text-gray-600 border border-gray-200"><ArrowLeft className="w-4 h-4" /></button>
                                <h2 className="font-serif text-xl font-bold text-[#1D1D1B]">{openListName}</h2>
                                <span className="text-xs text-gray-400">{openListItems.length} 個</span>
                            </div>
                            {openListItems.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-16">這本清單還沒有地點</div>
                            ) : (
                                <div className="space-y-2.5">
                                    {(() => { const med = reviewMedian(openListItems); return openListItems.map(item => (
                                        <WishCard key={item.id} item={item} reviewMedian={med} onSelect={() => onEditClick(item)} onEdit={() => onEditClick(item)} onAdd={() => setActionWish(item)} onFavorite={() => onToggleFavorite(item.id)} onConfirmLoc={() => setPinEditWish(item)} />
                                    )); })()}
                                </div>
                            )}
                        </div>
                    ) : editingAlbums ? (
                        <div>
                            <p className="text-[11px] text-gray-400 mb-3 px-1">拖曳卡片排序・點左上圖釘置頂</p>
                            {sortedLists.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-16">還沒有相簿</div>
                            ) : (
                                <AlbumEditGrid
                                    lists={sortedLists}
                                    countInList={countInList}
                                    photosOf={(id) => coverPhotos(w => w.listId === id)}
                                    onReorder={onReorderLists}
                                    onSetPinned={onSetListPinned}
                                />
                            )}
                        </div>
                    ) : (
                        <div>
                            {creatingAlbum && (
                                <div className="flex items-center gap-2 mb-3">
                                    <input autoFocus value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateAlbum()} placeholder="清單名稱…" className="flex-1 bg-white rounded-xl px-3 h-10 border border-gray-200 text-sm text-[#1D1D1B] outline-none" />
                                    <button onClick={handleCreateAlbum} className="h-10 px-4 rounded-xl bg-[#45846D] text-white text-sm font-bold">建立</button>
                                    <button onClick={() => { setCreatingAlbum(false); setNewAlbumName(''); }} className="h-10 px-3 text-gray-500 text-sm">取消</button>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                {favCount > 0 && (
                                    <button onClick={() => setOpenListId('__fav__')} className="relative h-[118px] rounded-[16px] overflow-hidden" style={{ background: 'linear-gradient(135deg,#F6D98A,#E7B23A)' }}>
                                        <div className="absolute top-2 left-2"><Star className="w-5 h-5 text-white" fill="#fff" /></div>
                                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2" style={{ background: 'linear-gradient(transparent,rgba(29,29,27,0.55))' }}><div className="font-serif text-[15px] text-white">最愛</div><div className="text-[9px] text-white/80 font-mono">{favCount} · 內建</div></div>
                                    </button>
                                )}
                                {sortedLists.map(l => {
                                    const photos = coverPhotos(w => w.listId === l.id);
                                    return (
                                        <button key={l.id}
                                            onClick={() => albumClick(() => setOpenListId(l.id))}
                                            onContextMenu={e => e.preventDefault()}
                                            onPointerDown={e => albumStartPress(l.id, e.currentTarget, e.clientX, e.clientY)}
                                            onPointerMove={e => albumMovePress(e.clientX, e.clientY)}
                                            onPointerUp={albumEndPress} onPointerCancel={albumEndPress} onPointerLeave={albumEndPress}
                                            style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
                                            className="relative h-[118px] rounded-[16px] overflow-hidden bg-[#3F6B52]">
                                            {l.coverImage ? <img src={l.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" /> : photos.length > 0 ? (
                                                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">{[0, 1, 2, 3].map(i => <div key={i} className="bg-[#D8CFBB]" style={photos[i] ? { backgroundImage: `url(${photos[i]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />)}</div>
                                            ) : <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#6b7a63,#3F6B52)' }} />}
                                            {l.pinned && <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(35,35,32,0.42)' }}><Pin className="w-3.5 h-3.5 text-white" fill="#fff" /></div>}
                                            <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2" style={{ background: 'linear-gradient(transparent,rgba(29,29,27,0.6))' }}><div className="font-serif text-[15px] text-white truncate">{l.name}</div><div className="text-[9px] text-white/80 font-mono">{countInList(l.id)} 個地點</div></div>
                                        </button>
                                    );
                                })}
                                {noneCount > 0 && (
                                    <button onClick={() => setOpenListId('__none__')} className="relative h-[118px] rounded-[16px] overflow-hidden" style={{ background: 'linear-gradient(135deg,#9a958c,#6f6650)' }}>
                                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2" style={{ background: 'linear-gradient(transparent,rgba(29,29,27,0.55))' }}><div className="font-serif text-[15px] text-white">未分類</div><div className="text-[9px] text-white/80 font-mono">{noneCount} 個</div></div>
                                    </button>
                                )}
                                <button onClick={() => setCreatingAlbum(true)} className="h-[118px] rounded-[16px] border border-dashed border-[#C9B98F] flex flex-col items-center justify-center gap-1.5 text-[#45846D]"><Plus className="w-5 h-5" /><span className="text-[11px] font-bold">新建清單</span></button>
                            </div>
                        </div>
                    )
                ) : nearbyMode && activeTab === 'place' ? (
                    <div>
                        {nearby.status === 'loading' && <div className="text-center text-gray-400 text-sm py-16">定位中…</div>}
                        {(nearby.status === 'denied' || nearby.status === 'error') && (
                            <div className="text-center text-gray-400 text-sm py-16 px-6 flex flex-col items-center gap-3">
                                {nearby.status === 'denied' ? '請允許定位權限，才能顯示附近的收藏。' : '無法取得目前位置。'}
                                <button onClick={() => nearby.locate()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#45846D] text-white text-xs font-bold active:scale-95 transition-transform"><Navigation className="w-3.5 h-3.5" />重新定位</button>
                            </div>
                        )}
                        {nearby.status === 'ready' && (
                            nearbyItems.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-16">附近沒有可定位的收藏地點。</div>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-500 mb-3">依距離排序・附近 {nearbyItems.filter(x => x.km <= 5).length} 個在 5 km 內</p>
                                    <div className="space-y-2">
                                        {nearbyItems.map(({ w, km }) => {
                                            const { Icon, color } = categorize(w);
                                            const near = km <= 5;
                                            return (
                                                <div key={w.id} onClick={() => onEditClick(w)} className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm cursor-pointer active:scale-[0.99] transition-transform">
                                                    <span className="w-11 h-11 rounded-xl bg-[#E9E5DC] flex items-center justify-center flex-shrink-0" style={{ color }}><Icon className="w-5 h-5" /></span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-[#1D1D1B] truncate">{w.title}</p>
                                                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{[w.country, w.city, w.area].filter(Boolean).join('・') || '未分區'}</p>
                                                    </div>
                                                    <span className={`font-mono text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${near ? 'text-[#45846D] bg-[#EDF2F0]' : 'text-gray-400 bg-[#F1EFE8]'}`}>{fmtDist(km)}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setActionWish(w); }} className="w-8 h-8 rounded-full bg-[#EDF2F0] hover:bg-[#45846D] text-[#45846D] hover:text-white flex items-center justify-center flex-shrink-0 transition-colors"><Plus className="w-4 h-4" /></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )
                        )}
                    </div>
                ) : searching ? (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-gray-500">找到 {searchResults.length} 個結果</p>
                            <SortButton />
                        </div>
                        {searchResults.length === 0 ? (
                            <div className="text-center text-gray-400 text-sm py-16">沒有符合的收藏</div>
                        ) : (
                            <div className="space-y-2.5">
                                {(() => { const med = reviewMedian(searchResults); return sortItems(searchResults).map(item => (
                                    <WishCard key={item.id} item={item} reviewMedian={med} onSelect={() => onEditClick(item)} onEdit={() => onEditClick(item)} onAdd={() => setActionWish(item)} onFavorite={() => onToggleFavorite(item.id)} onConfirmLoc={() => setPinEditWish(item)} />
                                )); })()}
                            </div>
                        )}
                    </div>
                ) : countryStats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-sm font-bold text-gray-400">目前沒有心願</p>
                        <p className="text-xs text-gray-400 mt-1">用「貼上匯入」或右下角按鈕收藏靈感</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {countryStats.map(([country, stats]) => {
                            const ink = inkOf(country);
                            const topCities = Object.entries(stats.cities).sort((a, b) => b[1] - a[1]).slice(0, 3);
                            const isShop = activeTab === 'item';
                            return (
                                <button key={country} onClick={() => openCountry(country)}
                                        className="w-full flex items-center gap-4 bg-[#F3EFE7] border border-[#1D1D1B]/10 rounded-[22px] p-4 text-left active:scale-[0.99] transition-transform">
                                    {isShop ? (
                                        <div className="w-[52px] h-[52px] rounded-[16px] bg-[#EDF2F0] flex items-center justify-center flex-shrink-0 text-[#45846D]">
                                            <ShoppingBag className="w-6 h-6" />
                                        </div>
                                    ) : (
                                        <div className="w-[58px] h-[58px] rounded-full flex flex-col items-center justify-center flex-shrink-0"
                                             style={{ border: `2px dashed ${ink}`, color: ink, transform: `rotate(${STAMP_ANGLE}deg)` }}>
                                            <Globe className="w-[18px] h-[18px]" />
                                            {codeOf(country) && <span className="text-[9px] font-black tracking-[0.12em] mt-0.5">{codeOf(country)}</span>}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-serif text-[22px] font-bold text-[#1D1D1B] leading-tight">{country}</p>
                                        {isShop ? (
                                            <p className="text-[12px] text-gray-500 mt-1">{stats.count} 項 · 已買 {stats.done}</p>
                                        ) : topCities.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {topCities.map(([city, n]) => (
                                                    <span key={city} className="text-[11px] font-bold text-[#57534E] bg-[#EAE6DD] px-2.5 py-0.5 rounded-full">{city} {n}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {isShop ? (
                                        <ProgressRing done={stats.done} total={stats.count} />
                                    ) : (
                                        <div className="flex items-baseline gap-1 flex-shrink-0">
                                            <span className="font-serif text-[26px] font-bold text-[#45846D] leading-none">{stats.count}</span>
                                            <span className="text-[11px] text-gray-400">{unit}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {actionWish && <InjectSheet wishes={[actionWish]} trips={trips} onClose={() => setActionWish(null)} onInject={onAddWishToTrip} />}

            {/* 🧭 T3 拖釘確認位置 */}
            <LocationPinSheet
                key={pinEditWish?.id}
                open={!!pinEditWish}
                title={pinEditWish?.title || ''}
                area={pinEditWish?.area || pinEditWish?.city}
                initial={{ lat: pinEditWish?.lat, lng: pinEditWish?.lng }}
                onConfirm={(lat, lng) => { if (pinEditWish) onConfirmLocation(pinEditWish.id, lat, lng); setPinEditWish(null); }}
                onClose={() => setPinEditWish(null)}
            />

            {/* 單一新增 FAB → 開「新增收藏」面板 */}
            <div className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-5 z-[60]">
                <button onClick={() => onOpenImport(activeTab)} className="w-14 h-14 rounded-full bg-[#45846D] flex items-center justify-center text-white shadow-2xl active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" strokeWidth={2.5} />
                </button>
            </div>

            {/* 📚 批3b：相簿封面上傳 input */}
            <input ref={albumFileRef} type="file" accept="image/*" className="hidden" onChange={handleAlbumCover} />

            {/* 📚 批4：iOS 原生長按 context menu（圖一）— 暗色浮卡錨定被按卡片 */}
            {menu && (() => {
                const MW = 216, MH = 300, GAP = 10, PAD = 12;
                const vw = window.innerWidth, vh = window.innerHeight;
                const below = menu.rect.bottom + GAP + MH <= vh;
                const top = below ? menu.rect.bottom + GAP : Math.max(PAD, menu.rect.top - GAP - MH);
                const left = Math.min(Math.max(PAD, menu.rect.left + menu.rect.width / 2 - MW / 2), vw - MW - PAD);
                const origin = below ? 'top center' : 'bottom center';
                const soon = () => { toast('即將推出，敬請期待'); setMenu(null); };
                // 灰階佔位項；有 icon 入口，功能留待未來（協作/冷啟動架構就緒後）
                const Row = ({ icon: Ic, label, onClick, tone, soonTag }: { icon: React.ElementType; label: string; onClick: () => void; tone?: 'danger'; soonTag?: boolean }) => (
                    <button onClick={onClick}
                        className="w-full flex items-center gap-3 px-4 h-[52px] text-left active:bg-white/10 transition-colors"
                        style={{ opacity: soonTag ? 0.42 : 1 }}>
                        <Ic className="w-[18px] h-[18px] flex-shrink-0" style={{ color: tone === 'danger' ? '#FF6A5A' : '#EDEAE2' }} strokeWidth={1.8} />
                        <span className="flex-1 text-[15px]" style={{ color: tone === 'danger' ? '#FF6A5A' : '#F4F1E9' }}>{label}</span>
                        {soonTag && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: '#CFC9BB' }}>即將推出</span>}
                    </button>
                );
                const Div = () => <div style={{ height: 0.5, background: 'rgba(255,255,255,0.09)' }} />;
                return (
                    <div className="fixed inset-0 z-[130]" onClick={() => setMenu(null)}>
                        <style>{`@keyframes wbCtx{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}`}</style>
                        <div className="absolute inset-0" style={{ background: 'rgba(20,19,17,0.34)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
                        <div onClick={e => e.stopPropagation()} className="absolute rounded-[15px] overflow-hidden"
                            style={{ top, left, width: MW, transformOrigin: origin, background: '#2B2A27', boxShadow: '0 14px 44px rgba(0,0,0,0.42)', animation: 'wbCtx 150ms cubic-bezier(0.2,0.9,0.3,1.25)' }}>
                            <Row icon={Navigation} label="用這本開一趟" onClick={soon} soonTag />
                            <Row icon={Share2} label="分享" onClick={soon} soonTag />
                            <Div />
                            <Row icon={Edit3} label="改名" onClick={() => { const l = wishLists.find(x => x.id === menu.id); setRenamingList(l ? { id: l.id, name: l.name } : null); setMenu(null); }} />
                            <Row icon={ImageIcon} label="換封面" onClick={() => openCoverPicker(menu.id)} />
                            <Div />
                            <Row icon={Trash2} label="刪除" onClick={() => doDeleteList(menu.id)} tone="danger" />
                        </div>
                    </div>
                );
            })()}

            {/* 📚 批3b：改名 */}
            {renamingList && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setRenamingList(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-xs bg-white rounded-3xl p-5">
                        <p className="text-sm font-bold text-[#1D1D1B] mb-3">清單改名</p>
                        <input autoFocus value={renamingList.name} onChange={e => setRenamingList({ ...renamingList, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && doRename()} className="w-full bg-gray-50 rounded-xl px-3 h-11 border border-gray-200 text-sm outline-none text-[#1D1D1B]" />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setRenamingList(null)} className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">取消</button>
                            <button onClick={doRename} className="flex-1 h-10 rounded-xl bg-[#45846D] text-white text-sm font-bold">儲存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🧾 代購結算 */}
            <SettlementSheet open={settlementOpen} wishItems={wishItems} trips={trips} onClose={() => setSettlementOpen(false)} onSettlePerson={onSettlePerson} />
        </div>
    );
};

// 加入至現有行程的底部選單（支援單筆或批次）
const InjectSheet: React.FC<{ wishes: WishItem[]; trips: Trip[]; onClose: () => void; onInject: (w: WishItem, tripId: string) => void; onDone?: () => void }> = ({ wishes, trips, onClose, onInject, onDone }) => {
    const n = wishes.length;
    const label = n === 1 ? `「${wishes[0].title}」` : `${n} 個地點`;
    return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
        <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-sm bg-[#F2F2F2] rounded-[32px] p-6 relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-black font-serif text-[#1D1D1B]">加入至現有行程</h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-safe">
                {trips.length === 0 ? (
                    <p className="text-sm font-bold text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-[24px]">目前沒有正在規劃的行程</p>
                ) : trips.map(t => (
                    <button key={t.id}
                            onClick={async () => {
                                // 🧾 二階段確認：把屬於別趟的購物項移過來前先問
                                const cross = wishes.filter(w => w.type === 'item' && w.tripId && w.tripId !== t.id);
                                if (cross.length > 0) {
                                    const names = [...new Set(cross.map(w => trips.find(x => x.id === w.tripId)?.destination || '其他行程'))].join('、');
                                    const ok = await confirmDialog({ title: '會從原行程移過來', message: `有 ${cross.length} 項原本屬於「${names}」，加入「${t.destination}」後會從原行程移到這趟（改成在這裡買）。要繼續嗎？`, confirmText: '移到這趟' });
                                    if (!ok) return;
                                }
                                wishes.forEach(w => onInject(w, t.id)); onClose(); onDone?.(); toast(`已將${label}送入 ${t.destination} 暫存區`, 'success');
                            }}
                            className="w-full flex items-center justify-between p-4 bg-white rounded-2xl hover:border-[#45846D] border-2 border-transparent hover:shadow-md transition-all active:scale-[0.98] group">
                        <div className="flex flex-col items-start">
                            <span className="font-bold text-[#1D1D1B] text-[15px]">{t.destination}</span>
                            <span className="text-[11px] text-gray-400 font-bold mt-1 font-mono tracking-widest">{t.startDate.replace(/-/g, '.')}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#45846D]/10 group-hover:bg-[#45846D] flex items-center justify-center text-[#45846D] group-hover:text-white transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </div>
    );
};
