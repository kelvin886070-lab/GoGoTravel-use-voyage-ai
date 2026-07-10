// src/views/WishBoxView.tsx
// 🧱 Phase C1-1：靈感頁三層階層（國家護照卡 → 城市地圖中樞 → 地點）。
//   含：分類圖示圖釘、全域搜尋、排序、卡片↔圖釘雙向連動、點空白取消。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import {
    MapPin, ShoppingBag, Plus, ArrowLeft, Globe, Sparkles, X,
    Map as MapIcon, List, Navigation, Edit3, Check, Store,
    Coffee, Utensils, Landmark, Wine, Search, ArrowDownUp, Star, MapPinPlus, Briefcase, Trash2
} from 'lucide-react';
import type { WishItem, WishItemType, Trip } from '../types';
import { categoryKeyOf } from '../utils/wishCategory';
import { useNearby, haversineKm, fmtDist } from '../hooks/useNearby';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { LocationPinSheet } from '../components/wish/LocationPinSheet';

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
    onOpenImport: () => void;
    onToggleFavorite: (id: string) => void;
    onTogglePurchased: (id: string) => void;
    onConfirmLocation: (id: string, lat: number, lng: number) => void;   // 🧭 T3
    onDeleteWishes: (ids: string[]) => void;   // 🗂️ 多選批次刪除
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

// 收據風購物列（勾選=已買，刪除線）
const ShoppingRow: React.FC<{ item: WishItem; onToggle: () => void; onEdit: () => void }> = ({ item, onToggle, onEdit }) => {
    const bought = !!item.isPurchased;
    return (
        <div className={`flex items-center gap-3 py-3 border-b border-dashed border-[#EFECE5] last:border-b-0 transition-opacity ${bought ? 'opacity-50' : ''}`}>
            <button onClick={onToggle} className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${bought ? 'bg-[#45846D] text-white' : 'border-[1.5px] border-gray-300 hover:border-[#45846D]'}`}>
                {bought && <Check className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${bought ? 'line-through text-gray-400' : 'text-[#1D1D1B]'}`}>{item.title}</p>
                {(item.tags && item.tags.length > 0) && !bought && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {(item.tags || []).slice(0, 2).map(t => <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTagColor(t)}`}>#{t}</span>)}
                    </div>
                )}
            </div>
            {item.budget != null && <span className={`font-mono text-sm flex-shrink-0 ${bought ? 'line-through text-gray-400' : 'text-[#1D1D1B]'}`}>{item.currency || 'TWD'} {item.budget.toLocaleString()}</span>}
            <button onClick={onEdit} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
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
const WishCard: React.FC<{ item: WishItem; selected?: boolean; onSelect: () => void; onEdit?: () => void; onAdd: () => void; onFavorite: () => void; onConfirmLoc?: () => void; refCb?: (el: HTMLDivElement | null) => void; selectMode?: boolean; checked?: boolean; onToggleSelect?: () => void; onLongPress?: () => void }> = ({ item, selected, onSelect, onAdd, onFavorite, onConfirmLoc, refCb, selectMode, checked, onToggleSelect, onLongPress }) => {
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
                <h3 className="font-bold text-[#1D1D1B] text-sm leading-snug truncate">{item.title}</h3>
                {item.notes && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{item.notes}</p>}
                {item.type === 'item' && item.budget != null && <p className="text-[11px] font-bold text-[#1D1D1B] mt-0.5 font-mono">{item.currency || 'TWD'} {item.budget.toLocaleString()}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.city && <span className="text-[10px] font-bold text-[#57534E] bg-[#EAE6DD] px-2 py-0.5 rounded-md">{item.city}</span>}
                    {item.area && <span className="text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md">{item.area}</span>}
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

export const WishBoxView: React.FC<WishBoxViewProps> = ({
    wishItems, trips, onAddWishToTrip, onEditClick, onOpenImport, onToggleFavorite, onTogglePurchased, onConfirmLocation, onDeleteWishes
}) => {
    const [activeTab, setActiveTab] = useState<WishItemType>('place');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [actionWish, setActionWish] = useState<WishItem | null>(null);
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    // 🧭 C2-1 附近雷達
    const [nearbyMode, setNearbyMode] = useState(false);
    // 🧭 T3 位置待確認：篩選 chip + 拖釘面板
    const [confirmFilter, setConfirmFilter] = useState(false);
    const [pinEditWish, setPinEditWish] = useState<WishItem | null>(null);
    // 🗂️ 多選模式：批次加入行程
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchInjectOpen, setBatchInjectOpen] = useState(false);
    const enterSelect = (seedId?: string) => { setSelectMode(true); setSelectedIds(seedId ? new Set([seedId]) : new Set()); };
    const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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

    const sortItems = (list: WishItem[]) => {
        const arr = [...list];
        arr.sort((a, b) => {
            // 我的最愛永遠置頂
            if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
            if (sortBy === 'name') return a.title.localeCompare(b.title, 'zh-Hant');
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return arr;
    };
    const cycleSort = () => setSortBy(s => s === 'recent' ? 'name' : 'recent');
    const SortButton = () => (
        <button onClick={cycleSort} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
            <ArrowDownUp className="w-3.5 h-3.5" /> {sortBy === 'recent' ? '最新' : '名稱'}
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

    // Level 2
    const countryItems = useMemo(() => tabItems.filter(it => (it.country || '其他') === selectedCountry), [tabItems, selectedCountry]);
    // 🧭 T3 該國家內「位置待確認」數（篩選 chip 用；置於國家層 全部/城市 那排）
    const countryNeedsConfirm = useMemo(() => countryItems.filter(w => w.needsLocationConfirm).length, [countryItems]);
    // 修完歸零 → 自動收起篩選
    useEffect(() => { if (confirmFilter && countryNeedsConfirm === 0) setConfirmFilter(false); }, [confirmFilter, countryNeedsConfirm]);
    // 多選：被選心願（批次匯入用）；切到地圖模式自動退出多選
    const selectedWishes = useMemo(() => wishItems.filter(w => selectedIds.has(w.id)), [wishItems, selectedIds]);
    useEffect(() => { if (viewMode === 'map' && selectMode) exitSelect(); }, [viewMode, selectMode]);
    const cityChips = useMemo(() => {
        const m: Record<string, number> = {};
        countryItems.forEach(it => { if (it.city) m[it.city] = (m[it.city] || 0) + 1; });
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    }, [countryItems]);
    const displayItems = useMemo(() => {
        let base = selectedCity ? countryItems.filter(it => it.city === selectedCity) : countryItems;
        if (confirmFilter) base = base.filter(it => it.needsLocationConfirm);   // 🧭 T3 只看待確認
        return sortItems(base);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countryItems, selectedCity, sortBy, confirmFilter]);

    const openCountry = (c: string) => { setSelectedCountry(c); setSelectedCity(null); setSelectedPin(null); setViewMode('map'); setConfirmFilter(false); exitSelect(); };
    const backToCountries = () => { setSelectedCountry(null); setSelectedCity(null); setSelectedPin(null); setConfirmFilter(false); exitSelect(); };

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
                        {isPlace && (
                            <div className="flex bg-[#767680]/10 rounded-lg p-[2px] flex-shrink-0">
                                <button onClick={() => setViewMode('map')} className={`flex items-center gap-1 px-3 h-8 rounded-md text-xs font-bold transition-colors ${viewMode === 'map' ? 'bg-white text-[#1D1D1B] shadow-sm' : 'text-gray-500'}`}><MapIcon className="w-3.5 h-3.5" /> 地圖</button>
                                <button onClick={() => setViewMode('list')} className={`flex items-center gap-1 px-3 h-8 rounded-md text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-white text-[#1D1D1B] shadow-sm' : 'text-gray-500'}`}><List className="w-3.5 h-3.5" /> 列表</button>
                            </div>
                        )}
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
                                    <button onClick={() => { setSelectedCity(null); setConfirmFilter(v => !v); }}
                                            className={`flex-shrink-0 inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${confirmFilter ? 'bg-[#854F0B] text-white' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
                                        <MapPinPlus className="w-3.5 h-3.5" /> 位置待確認 · {countryNeedsConfirm}
                                    </button>
                                )}
                                {cityChips.map(([city, n]) => (
                                    <button key={city} onClick={() => { setSelectedCity(city); setConfirmFilter(false); }} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCity === city && !confirmFilter ? 'bg-[#45846D] text-white' : 'bg-[#F1EFE8] text-gray-600'}`}>{city} · {n}</button>
                                ))}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                                <SortButton />
                                {isPlace && viewMode === 'list' && displayItems.length > 0 && (
                                    <button onClick={() => enterSelect()} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">選取</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {isPlace && viewMode === 'map' && (
                    <div className="relative flex-shrink-0 h-[42vh] bg-gray-100">
                        <WishMap items={displayItems} selectedId={selectedPin} onSelect={(w) => setSelectedPin(w.id)} onDeselect={() => setSelectedPin(null)} />
                        {(() => {
                            const w = displayItems.find(x => x.id === selectedPin);
                            if (!w) return null;
                            return (
                                <div className="absolute bottom-3 left-3 right-3 z-20 bg-white rounded-2xl shadow-lg p-3 animate-in slide-in-from-bottom-2 flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#1D1D1B] text-sm truncate">{w.title}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{[w.city, w.area].filter(Boolean).join(' · ') || '未分區'}</p>
                                    </div>
                                    <button onClick={() => onEditClick(w)} className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                    <a href={w.lat != null ? `https://www.google.com/maps/search/?api=1&query=${w.lat},${w.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.title)}`} target="_blank" rel="noreferrer" className="flex-shrink-0 flex items-center gap-1 bg-[#45846D] text-white text-xs font-bold px-3 h-9 rounded-full active:scale-95 transition-transform"><Navigation className="w-3.5 h-3.5" /> 導航</a>
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-3 pb-32">
                    {displayItems.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-16">這個分類還沒有收藏</div>
                    ) : isPlace ? (
                        <div className="space-y-2.5">
                            {displayItems.map(item => (
                                <WishCard key={item.id} item={item} selected={selectedPin === item.id}
                                          refCb={el => { cardRefs.current[item.id] = el; }}
                                          onSelect={() => (viewMode === 'map') ? setSelectedPin(item.id) : onEditClick(item)}
                                          onEdit={() => onEditClick(item)}
                                          onAdd={() => setActionWish(item)}
                                          onFavorite={() => onToggleFavorite(item.id)}
                                          onConfirmLoc={() => setPinEditWish(item)}
                                          selectMode={selectMode} checked={selectedIds.has(item.id)}
                                          onToggleSelect={() => toggleSelect(item.id)}
                                          onLongPress={() => enterSelect(item.id)} />
                            ))}
                        </div>
                    ) : (
                        /* 購物：依「類別/店家」分組的收據風清單（已買沉底 + 刪除線） */
                        <div className="space-y-3">
                            {(() => {
                                const sorted = [...displayItems].sort((a, b) => (a.isPurchased ? 1 : 0) - (b.isPurchased ? 1 : 0));
                                const groups: Record<string, WishItem[]> = {};
                                sorted.forEach(it => { const k = it.area || '其他'; (groups[k] = groups[k] || []).push(it); });
                                return Object.entries(groups).map(([cat, items]) => (
                                    <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                        <div className="px-4 pt-3 pb-0.5 flex items-center gap-1.5 text-[12px] font-bold text-[#45846D]"><Store className="w-3.5 h-3.5" /> {cat}</div>
                                        <div className="px-4 pb-1">
                                            {items.map(item => (
                                                <ShoppingRow key={item.id} item={item} onToggle={() => onTogglePurchased(item.id)} onEdit={() => onEditClick(item)} />
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>

                {/* 購物：底部購買進度條 */}
                {!isPlace && displayItems.length > 0 && (
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
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 no-scrollbar">
                {nearbyMode && activeTab === 'place' ? (
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
                                {sortItems(searchResults).map(item => (
                                    <WishCard key={item.id} item={item} onSelect={() => onEditClick(item)} onEdit={() => onEditClick(item)} onAdd={() => setActionWish(item)} onFavorite={() => onToggleFavorite(item.id)} onConfirmLoc={() => setPinEditWish(item)} />
                                ))}
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
                <button onClick={onOpenImport} className="w-14 h-14 rounded-full bg-[#45846D] flex items-center justify-center text-white shadow-2xl active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" strokeWidth={2.5} />
                </button>
            </div>
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
                            onClick={() => { wishes.forEach(w => onInject(w, t.id)); onClose(); onDone?.(); toast(`已將${label}送入 ${t.destination} 暫存區`, 'success'); }}
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
