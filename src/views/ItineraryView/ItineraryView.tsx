// src/views/ItineraryView/ItineraryView.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, List, Map, Plus, Settings, 
    Train, Plane, Ticket, Wallet, 
    MapPin, Bus, StickyNote, Banknote, RefreshCw, Sparkles, 
    Briefcase, PlusCircle, Share, ListChecks, X, ShoppingBag,
    Check, Trash2, Undo, Clock, ChevronDown, CalendarPlus, Navigation, Pencil, Inbox, AlertTriangle, Search
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { Trip, TripDay, Activity, Document, VaultFolder, VaultFile, User, WishItem, WishList, TripTodoItem } from '../../types';
import { suggestNextSpot } from '../../services/gemini';
import { recalculateTimeline } from '../../services/timeline';
import { planArrangement, activityTypeOf, insertionTimeForDay, dayDistanceKm } from '../../services/scheduler';
import { ensureTripGeocoded, isMappable, geocodeItems } from '../../services/geo';
import { locationWarnings, type LatLng } from '../../services/geoCheck';
import { TimePickerWheel } from '../../components/common/TimePickerWheel';
import { useNearby, haversineKm, fmtDist } from '../../hooks/useNearby';

import { uploadTripImage, signPaths, deleteTripImage } from '../../services/storage';

import { GlassCapsule } from '../../components/common/GlassCapsule';
import { GhostInsertButton } from '../../components/common/GhostInsertButton';
import { isSystemType } from './shared';

import { ExpenseDashboard } from './components/ExpenseDashboard';
import { TripMapView } from './components/TripMapView';
import { VaultCard } from './components/VaultCard'; 

import { ActivityItem } from './items/ActivityItem';
import { BuyHereCard } from './items/BuyHereCard';
import { TripWalkView } from './TripWalkView';
import { StageSpine, computeStage, ACTIVATE_DAYS } from './StageSpine';
import { PrepareFace, EveFace, MemoryFace } from './StageFaces';
import { BookingImportSheet } from './modals/BookingImportSheet';
import { ReconcileReceipt } from './modals/ReconcileReceipt';
import { ParkedTray } from './modals/ParkedTray';
import { applyBookingsToTrip, mergeParked, type ReconcileChange } from '../../services/reconcile/applyReconcile';
import { reconcileDay, paceBuffer, detectDayIssues, type Conflict } from '../../services/reconcile/reconcile';
import type { StoredBooking, FlightBooking, HotelBooking, Traveler, PaxType } from '../../types/booking';
import { ProcessItem } from './items/ProcessItem';
import { TransportConnectorItem } from './items/TransportConnectorItem';
import { NoteItem } from './items/NoteItem';
import { ExpensePolaroid } from './items/ExpensePolaroid';

import { SimpleDateEditModal } from './modals/SimpleDateEditModal';
import { SimpleDaysEditModal } from './modals/SimpleDaysEditModal';
import { AddActivityModal } from './modals/AddActivityModal';
import { PlaceSearchSheet, type SelectedPlace } from './modals/PlaceSearchSheet';
import { SaveToListSheet } from './modals/SaveToListSheet';
import { TripSettingsModal } from './modals/TripSettingsModal';
import { ActivityDetailModal } from './modals/ActivityDetailModal';
import { DocumentPickerModal } from './modals/DocumentPickerModal';
import { DocumentEditModal } from './modals/DocumentEditModal';
import { TripRemindersModal } from './modals/TripRemindersModal';
import { VibeTagEditModal } from './modals/VibeTagEditModal';
import { IOSShareSheet } from '../../components/UI';
import { ShareBottomSheet } from './modals/ShareBottomSheet';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmDialog';


const DEFAULT_TODOS: TripTodoItem[] = [
    { id: 't1', text: '預訂來回機票', isCompleted: false, category: 'tasks' },
    { id: 't2', text: '預訂住宿飯店', isCompleted: false, category: 'tasks' },
    { id: 't3', text: '購買旅遊保險', isCompleted: false, category: 'tasks' },
    { id: 't4', text: '購買當地網卡 / 開通漫遊', isCompleted: false, category: 'tasks' },
    { id: 't5', text: '線上預辦登機', isCompleted: false, time: '24:00', category: 'tasks' },
    { id: 'd1', text: '護照 (檢查效期需6個月以上)', isCompleted: false, category: 'documents' },
    { id: 'd2', text: '簽證影本', isCompleted: false, category: 'documents' },
    { id: 'd3', text: '機票證明', isCompleted: false, category: 'documents' },
    { id: 'd4', text: '外幣/信用卡', isCompleted: false, category: 'documents' },
    { id: 'c1', text: '換洗衣物', isCompleted: false, category: 'clothes' },
    { id: 'c2', text: '保暖外套', isCompleted: false, category: 'clothes' },
    { id: 'p1', text: '牙刷牙膏', isCompleted: false, category: 'toiletries' },
    { id: 'p2', text: '個人常備藥品', isCompleted: false, category: 'toiletries' },
    { id: 'g1', text: '手機充電器', isCompleted: false, category: 'gadgets' },
    { id: 'g2', text: '行動電源', isCompleted: false, category: 'gadgets' },
    { id: 'g3', text: '萬用轉接頭', isCompleted: false, category: 'gadgets' },
];

const EndOfDayIndicator: React.FC<{ isTripEnd: boolean }> = ({ isTripEnd }) => (
    <div className="relative flex items-center gap-3 my-6 animate-in fade-in slide-in-from-left duration-700 opacity-80">
        <div className="w-[55px] flex justify-center relative">
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-[#3F6B52]/20"></div></div>
            <div className="relative z-10 bg-[#3F6B52] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md tracking-wider flex items-center gap-1">
                {isTripEnd ? 'END' : 'FINISH'}
            </div>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-[#3F6B52]/40 via-[#3F6B52]/20 to-transparent border-t border-dashed border-[#3F6B52]/0"></div>
    </div>
);

const CurrentTimeIndicator: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { setTimeout(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500); }, []);
    return (
        <div ref={ref} className="relative flex items-center gap-3 my-6 animate-in fade-in slide-in-from-left duration-700">
            <div className="w-[55px] flex justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-rose-200"></div></div>
                <div className="relative z-10 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg ring-2 ring-white tracking-wider flex items-center gap-1">NOW</div>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-rose-400 via-rose-300 to-transparent border-t border-dashed border-rose-300/0"></div>
        </div>
    );
};

const EmptyDayPlaceholder: React.FC<{ provided: any }> = ({ provided }) => (
    <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[160px] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-gray-400 bg-gray-50/50 transition-all hover:bg-white hover:border-[#3F6B52]/30 group">
        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
            <Map className="w-8 h-8 text-gray-300 group-hover:text-[#3F6B52] transition-colors" />
        </div>
        <p className="text-sm font-bold text-gray-500 mb-1">這天還是空的</p>
        <div className="hidden">{provided.placeholder}</div>
    </div>
);

interface ItineraryViewProps { 
    trip: Trip;
    folders?: VaultFolder[];
    files?: VaultFile[];
    documents?: Document[];
    user?: User;
    wishItems?: WishItem[]; // 🧱 C1-2 全域收藏圖書館（供「從收藏加入」）
    onBack: () => void;
    onDelete: () => void;
    onUpdateTrip: (t: Trip) => void;
    bookings?: StoredBooking[];                       // 🎟️ 這趟的訂位（視圖）
    onImportBooking?: (b: StoredBooking) => void;     // 🎟️ 核對表確認後回傳
    onDeleteBooking?: (id: string) => void;           // 🎟️ 刪除一筆訂位
    travelers?: Traveler[];                           // 🧑‍🤝‍🧑 我的旅伴（跨行程）
    onCreateTraveler?: (legalName: string, paxType?: PaxType) => Promise<Traveler>;
    onUpdateTraveler?: (id: string, patch: Partial<Traveler>) => void;
    onTagWishesToTrip?: (ids: string[], tripId: string | null) => void;   // 🧾 購物參照：設/清 tripId
    onTogglePurchased?: (id: string) => void;   // 🧾 購物參照：切換已買（改動 wishbox 項）
    onSetWishStop?: (ids: string[], stopId: string | null, tripId?: string) => void;  // 🛍️「在這裡要買」綁定
    onSaveWish?: (place: { placeId?: string; name: string; address?: string; lat?: number; lng?: number; city?: string }, opts?: { listId?: string | null; favorite?: boolean }) => void;  // 🔖 D2.3：搜尋結果存進全域心願盒（可帶相簿/最愛）
    onUnsaveWish?: (placeId: string) => void;   // 🔖 取消收藏（依 placeId）
    wishLists?: WishList[];                       // 📚 相簿
    onCreateWishList?: (name: string) => Promise<WishList | null>;
    tripDestById?: Record<string, string>;      // 🧾 挑選器標「屬 其他行程」用
    onRefreshVault?: () => void;
    onLocalFileUpdate?: (file: Partial<VaultFile>) => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ 
    trip, 
    folders = [], 
    files = [], 
    documents = [],
    user,
    wishItems = [],
    onBack,
    onDelete,
    onUpdateTrip,
    bookings = [],
    onImportBooking,
    onDeleteBooking,
    travelers = [],
    onCreateTraveler,
    onUpdateTraveler,
    onTagWishesToTrip,
    onTogglePurchased,
    onSetWishStop,
    onSaveWish,
    onUnsaveWish,
    wishLists,
    onCreateWishList,
    tripDestById = {},
    onRefreshVault,
    onLocalFileUpdate
}) => {
    const currentUser: User = user || {
        id: 'me',
        name: '我',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Kelvin',
        joinedDate: new Date().toISOString()
    };

    // 🧭 走模式：今天∈行程日期＝旅途中（LIVE），預設落在走模式；否則預設列表
    const tripActiveToday = useMemo(() => {
        const p = (s: string) => { const [y, m, d] = (s || '').split('-').map(Number); if (!y) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt.getTime(); };
        const s = p(trip.startDate), e = p(trip.endDate);
        if (s == null || e == null) return false;
        const t = new Date(); t.setHours(0, 0, 0, 0);
        return t.getTime() >= s && t.getTime() <= e;
    }, [trip.startDate, trip.endDate]);

    // 🎟️ 五段 stepper：viewMode 擴充；階段↔viewMode 對映；預設落在時間偵測的當前段
    const stageToVM = ['list', 'prepare', 'eve', 'walk', 'memory'] as const;
    const vmToStage = (vm: string) => vm === 'prepare' ? 1 : vm === 'eve' ? 2 : vm === 'walk' ? 3 : vm === 'memory' ? 4 : 0;
    const currentStageIdx = useMemo(() => computeStage(trip), [trip.startDate, trip.endDate]);
    const daysToDep = useMemo(() => {
        const [y, m, d] = (trip.startDate || '').split('-').map(Number); if (!y) return 0;
        const s = new Date(y, m - 1, d); s.setHours(0, 0, 0, 0); const t = new Date(); t.setHours(0, 0, 0, 0);
        return Math.ceil((s.getTime() - t.getTime()) / 86400000);
    }, [trip.startDate]);
    const [viewMode, setViewMode] = useState<'list' | 'map' | 'walk' | 'prepare' | 'eve' | 'memory'>(stageToVM[computeStage(trip)]);
    // 🎟️ 鎖定段（前夕/旅途/回憶未到）被點時的溫柔說明 toast——不是「解鎖」，是說明何時自動亮＋提供提前彩排入口
    const [lockToast, setLockToast] = useState<{ title: string; sub: string; cta?: { label: string; go: () => void } } | null>(null);
    const handleLockedTap = (i: number) => {
        const dateLabel = (trip.startDate || '').slice(5).replace('-', '/');
        if (i === 4) { // 回憶：過去無法預覽，純時間閘門＋溫暖說明
            setLockToast({ title: '回憶會在旅程結束後亮起', sub: '這裡會收藏這趟走過的地方，回來再看 🎞' });
            return;
        }
        // 前夕(2)／旅途(3)：能走就先走，缺座標就引導匯入（＝機票/住宿的訂購資訊）
        const hasRoutePoints = trip.days.some(d => d.activities.some(a => a.lat != null && a.lng != null));
        const whenLine = i === 2
            ? `出發前 3 天自動亮起${dateLabel ? `（約 ${dateLabel} 前）` : ''}`
            : `${dateLabel ? dateLabel + ' ' : ''}出發當天自動亮起`;
        if (hasRoutePoints) {
            setLockToast({
                title: i === 2 ? '前夕還沒到——想先看看嗎？' : '旅途還沒開始——先走一遍？',
                sub: `時間到會自動亮；不想等就現在彩排。${whenLine}`,
                cta: { label: '先走一遍 →', go: () => { setLockToast(null); setViewMode('walk'); } },
            });
        } else {
            setLockToast({
                title: '想提前彩排這趟？',
                sub: '匯入機票／住宿，就能看真正的起訖點、先走一遍。',
                cta: { label: '去匯入 →', go: () => { setLockToast(null); setViewMode('list'); } },
            });
        }
    };
    // 🎟️ 準備臉：就緒明確蓋章（存進 trip.readiness，跟著 trip_data 一起持久化）
    const markReady = (k: 'flight' | 'hotel' | 'docs' | 'pack', v: boolean) =>
        onUpdateTrip({ ...trip, readiness: { ...(trip.readiness || {}), [k]: v } });
    // 「去補齊」→ 導去外部訂購（affiliate 之後在這裡換 deep link 即可）／保管箱／行李
    const openBooking = (k: 'flight' | 'hotel' | 'docs' | 'pack') => {
        const dest = trip.destination || '';
        const ci = trip.startDate || '', co = trip.endDate || '';
        if (k === 'flight') {
            const q = trip.origin ? `flights from ${trip.origin} to ${dest} on ${ci}` : `flights to ${dest} on ${ci}`;
            window.open(`https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`, '_blank', 'noopener');
        } else if (k === 'hotel') {
            window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest)}${ci ? `&checkin=${ci}` : ''}${co ? `&checkout=${co}` : ''}`, '_blank', 'noopener');
        } else if (k === 'docs') {
            setIsDocPickerOpen(true);
        } else {
            setLockToast({ title: '行李清單即將推出', sub: '先照自己的清單打包，收好後回來按「已備」蓋章 ✓' });
        }
    };
    // 🎟️ 脊椎啟動：出發前 30 天內（或已在旅途/回憶）才點亮「現在」；更早整條變暗（傳 current=-1）。
    const spineActivated = currentStageIdx >= 1 || daysToDep <= ACTIVATE_DAYS;
    // 🎟️ 機票就緒＝這趟有連到 flight booking（取代結構偵測的假陽性與手動蓋章）
    const hasFlightBooking = useMemo(() => bookings.some(b => b.kind === 'flight'), [bookings]);
    const flightBookings = useMemo(() => bookings.filter(b => b.kind === 'flight') as FlightBooking[], [bookings]);
    const hotelBookings = useMemo(() => bookings.filter(b => b.kind === 'hotel') as HotelBooking[], [bookings]);
    const [importOpen, setImportOpen] = useState(false);
    const [viewBooking, setViewBooking] = useState<StoredBooking | null>(null);
    // 🎟️ Phase 4a：對帳收據 ＋ 待安排托盤
    const [receipt, setReceipt] = useState<{ flightLabel?: string; changes: ReconcileChange[]; conflicts: Conflict[] } | null>(null);
    const [parkedTrayOpen, setParkedTrayOpen] = useState(false);
    const parkedCount = trip.parked?.length ?? 0;

    // 🎟️ Phase 4a：把待安排的活動放回某一天（使用者選擇 → 以 user 血統插入、再對帳這天）
    const keyOfActivity = (a: Activity) => a.id ?? `${a.title}|${a.time}`;
    const handleMoveParkedToDay = (activity: Activity, dayIndex: number) => {
        const target = trip.days[dayIndex];
        if (!target) return;
        const remaining = (trip.parked ?? []).filter(a => keyOfActivity(a) !== keyOfActivity(activity));
        // point 1：用心願盒同一套 geo 邏輯給合理插入時間；離那天太遠就溫柔提醒（不擋，只告知）
        const placed: Activity = { ...activity, source: 'user', time: insertionTimeForDay(trip, dayIndex) };
        const dayWith: TripDay = { ...target, activities: [...target.activities, placed] };
        // 使用者明確指定放這天 → 尊重（precedence：使用者 ＞ 自動）。用寬鬆的 dayEnd，不因「一天太滿」把它彈回待安排；
        // 只有真正的釘死錨（離開航班）才會 gate。使用者要把一天玩很滿是他的自由。
        const rec = reconcileDay(dayWith, { bufferMin: paceBuffer(trip.pace), dayEndMin: 30 * 60 });
        const newDays = trip.days.map((d, i) => (i === dayIndex ? rec.day : d));
        const stillParked = mergeParked(remaining, rec.parked);
        onUpdateTrip({ ...trip, days: newDays, parked: stillParked });
        const dist = dayDistanceKm(trip, dayIndex, activity);
        if (dist != null && dist > 20) {
            toast(`「${activity.title}」離 Day ${target.day} 的行程有點遠（約 ${Math.round(dist)} 公里），到時候記得多留點交通時間`, 'info');
        }
        if (stillParked.length === 0) setParkedTrayOpen(false);
    };

    // 🧭 空間類·第二刀：地點把關的「順路建議」一鍵移動——把排錯城的活動移到它該在的那天（precedence：使用者確認）。
    const handleMoveActivityToDay = (activityId: string, toDayNumber: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        let moved: Activity | undefined;
        for (const d of newTrip.days) {
            const i = d.activities.findIndex((a: Activity) => a.id === activityId);
            if (i >= 0) { moved = d.activities.splice(i, 1)[0]; break; }
        }
        if (!moved) return;
        const targetIdx = newTrip.days.findIndex((d: TripDay) => d.day === toDayNumber);
        if (targetIdx < 0) return;
        const placed: Activity = { ...moved, source: 'user', time: insertionTimeForDay(newTrip, targetIdx) };
        newTrip.days[targetIdx].activities.push(placed);
        newTrip.days[targetIdx] = reconcileDay(newTrip.days[targetIdx], { bufferMin: paceBuffer(newTrip.pace), dayEndMin: 30 * 60 }).day;
        onUpdateTrip(newTrip);
        toast(`已把「${moved.title}」移到 Day ${toDayNumber}`, 'success');
    };

    // 🛣️ C：手動一鍵「收進待安排」——把塞不下那張搬進 parked（使用者按了才動；移除後重排＝連接卡重生＋時間）。
    const handleParkActivity = (dayIndex: number, actId: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const day = newTrip.days[dayIndex];
        if (!day) return;
        const i = day.activities.findIndex((a: Activity) => a.id === actId);
        if (i < 0) return;
        const moved = day.activities.splice(i, 1)[0];
        newTrip.days[dayIndex] = recalculateTimeline(day);
        newTrip.parked = mergeParked(newTrip.parked, [{ ...moved, source: 'user' }]);
        onUpdateTrip(newTrip);
        toast(`已將「${moved.title}」收進待安排`, 'info');
    };
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDateEditOpen, setIsDateEditOpen] = useState(false);
    const [isDaysEditOpen, setIsDaysEditOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
    const [isRemindersOpen, setIsRemindersOpen] = useState(false); 
    const [editingDoc, setEditingDoc] = useState<(Document & { folderName?: string }) | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [editingVibeDay, setEditingVibeDay] = useState<number | null>(null); 
    
    const [showWishTray, setShowWishTray] = useState(false);
    const [wishTrayTab, setWishTrayTab] = useState<'place' | 'item'>('place');
    // 🛍️ #3 本趟購物清單的「附近」排序
    const [tripShopNearbyOn, setTripShopNearbyOn] = useState(false);
    const tripShopNearby = useNearby();
    const [actionStagedWish, setActionStagedWish] = useState<WishItem | null>(null);

    // 🧱 C1-2 從我的收藏加入（多選挑選器）
    const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
    // 🎟️ D1：從 ＋新增流程開心願盒 picker 時，記住要落到哪天（null＝走原本的「加入暫存區」流程）
    const [injectTargetDayIdx, setInjectTargetDayIdx] = useState<number | null>(null);
    // 🔎 D2：搜尋地點 sheet 要落到哪天（null＝關閉）
    const [searchTargetDayIdx, setSearchTargetDayIdx] = useState<number | null>(null);
    // 📚 批2：存到清單 sheet 的目標地點（含 city；null＝關閉）
    const [saveTargetPlace, setSaveTargetPlace] = useState<(SelectedPlace & { city?: string }) | null>(null);
    const [pickerScope, setPickerScope] = useState<'trip' | 'all' | 'nearby'>('trip');
    // 📚 批5：相簿子濾（僅地點）。null＝所有相簿；'__fav__'＝最愛；'__none__'＝未分類；其餘＝listId。
    const [pickerListFilter, setPickerListFilter] = useState<string | null>(null);
    const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
    const pickerNearby = useNearby();

    // 🧭 C1-3 一鍵順路排入
    const [arrangeOpen, setArrangeOpen] = useState(false);
    const [arrangeAddDay, setArrangeAddDay] = useState(false);
    const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>({}); // 預覽中手動改的時間
    // 統一的滾輪時間選擇器（預覽微調 / 手動排入設時間共用）
    const [timeWheel, setTimeWheel] = useState<{ value: string; onPick: (v: string) => void } | null>(null);

    // 🧭 C1-3 待排入卡設定「希望時段」（點 chip → 選單；寫入該行程的 staged 心願）
    const [slotPickerWish, setSlotPickerWish] = useState<WishItem | null>(null);
    const setStagedSlot = (wishId: string, slot: WishItem['preferredSlot']) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => w.id === wishId ? { ...w, preferredSlot: slot } : w);
        onUpdateTrip(newTrip);
        setSlotPickerWish(null);
    };
    const slotLabel = (s?: WishItem['preferredSlot']) => s === 'morning' ? '上午' : s === 'afternoon' ? '下午' : s === 'evening' ? '晚上' : '希望時段';

    const matchesTrip = (w: WishItem) => {
        const dest = (trip.destination || '').toLowerCase();
        if (!dest) return false;
        return [w.city, w.country].filter(Boolean).some(v => {
            const s = (v as string).toLowerCase();
            return dest.includes(s) || s.includes(dest);
        });
    };
    // 已在本趟：地點看 staging、購物看 tripId（參照）
    const stagedIds = useMemo(() => {
        if (wishTrayTab === 'item') return new Set(wishItems.filter(w => w.type === 'item' && w.tripId === trip.id).map(w => w.id));
        return new Set((trip.stagedWishes || []).map(w => w.id));
    }, [trip.stagedWishes, wishTrayTab, wishItems, trip.id]);
    // 附近範圍：依距離排序，並記下每點距離
    const nearbyKm = useMemo(() => {
        const m: Record<string, number> = {};
        if (pickerScope !== 'nearby' || !pickerNearby.pos) return m;
        wishItems.forEach(w => { if (w.type === wishTrayTab && w.lat != null && w.lng != null) m[w.id] = haversineKm(pickerNearby.pos!, { lat: w.lat as number, lng: w.lng as number }); });
        return m;
    }, [wishItems, wishTrayTab, pickerScope, pickerNearby.pos]);
    const pickerItems = useMemo(() => {
        let base = wishItems.filter(w => w.type === wishTrayTab);
        // 相簿子濾（僅地點 tab 有相簿概念）；與 scope 為 AND
        if (wishTrayTab === 'place' && pickerListFilter) {
            base = base.filter(w =>
                pickerListFilter === '__fav__' ? !!w.isFavorite
                : pickerListFilter === '__none__' ? !w.listId
                : w.listId === pickerListFilter);
        }
        if (pickerScope === 'nearby') {
            return base.filter(w => nearbyKm[w.id] != null).sort((a, b) => nearbyKm[a.id] - nearbyKm[b.id]);
        }
        return base.filter(w => pickerScope === 'all' || matchesTrip(w));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wishItems, wishTrayTab, pickerScope, pickerListFilter, trip.destination, nearbyKm]);

    const togglePick = (id: string) => setPickerSelected(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });

    const openLibraryPicker = () => { setInjectTargetDayIdx(null); setPickerSelected(new Set()); setPickerScope('trip'); setPickerListFilter(null); setLibraryPickerOpen(true); };
    // 🎟️ D1：從 ＋新增流程開 picker，挑了直接落到「這天」（不經暫存區）
    const openWishPickerForDay = (dayIdx: number) => {
        setInjectTargetDayIdx(dayIdx);
        setWishTrayTab('place');
        setPickerSelected(new Set());
        setPickerScope('trip');
        setPickerListFilter(null);
        setLibraryPickerOpen(true);
    };

    const handleAddFromLibrary = async () => {
        // 🎟️ D1：從 ＋新增流程進來 → 直接把選到的「地點」心願排入那天（不進暫存區）
        if (injectTargetDayIdx != null) {
            const places = wishItems.filter(w => pickerSelected.has(w.id) && w.type === 'place');
            injectWishesToDay(places, injectTargetDayIdx);
            setInjectTargetDayIdx(null);
            setLibraryPickerOpen(false);
            setPickerSelected(new Set());
            return;
        }
        const toAdd = wishItems.filter(w => pickerSelected.has(w.id) && !stagedIds.has(w.id));
        if (toAdd.length === 0) { setLibraryPickerOpen(false); return; }
        if (wishTrayTab === 'item') {
            // 🧾 二階段確認：有屬於別趟的項 → 說明會「移過來」
            const crossTrip = toAdd.filter(w => w.tripId && w.tripId !== trip.id);
            if (crossTrip.length > 0) {
                const names = [...new Set(crossTrip.map(w => tripDestById[w.tripId!] || '其他行程'))].join('、');
                const ok = await confirmDialog({
                    title: '會從原行程移過來',
                    message: `有 ${crossTrip.length} 項原本屬於「${names}」，加入「${trip.destination}」後會從原行程移到這趟（改成在這裡買）。要繼續嗎？`,
                    confirmText: '移到這趟',
                });
                if (!ok) return;
            }
            // 🧾 購物：設 tripId（參照），不複製
            onTagWishesToTrip?.(toAdd.map(w => w.id), trip.id);
        } else {
            const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
            newTrip.stagedWishes = [...(newTrip.stagedWishes || []), ...toAdd];
            onUpdateTrip(newTrip);
        }
        setLibraryPickerOpen(false);
        setPickerSelected(new Set());
        toast(`已加入 ${toAdd.length} 項到行程`, 'success');
    };

    // 🧭 C1-3 一鍵順路排入
    const pendingPlaceWishes = useMemo(
        () => (trip.stagedWishes || []).filter(w => w.type === 'place' && w.assignedDay === undefined),
        [trip.stagedWishes],
    );
    const arrangePlan = useMemo(() => {
        const planTrip: Trip = arrangeAddDay
            ? { ...trip, days: [...trip.days, { day: trip.days.length + 1, activities: [] }] }
            : trip;
        return planArrangement(planTrip, pendingPlaceWishes);
    }, [trip, pendingPlaceWishes, arrangeAddDay]);

    const openArrange = () => { setArrangeAddDay(false); setTimeOverrides({}); setArrangeOpen(true); };

    const applyArrangement = () => {
        const plan = arrangePlan;
        if (plan.totalPlaced === 0) { setArrangeOpen(false); return; }
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const maxIdx = Math.max(...plan.byDay.map(d => d.dayIndex));
        const start = new Date(trip.startDate);
        while (newTrip.days.length <= maxIdx) {
            const idx = newTrip.days.length;
            const dt = new Date(start.getTime() + idx * 86400000);
            const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            newTrip.days.push({ day: idx + 1, date: dateStr, activities: [] });
        }
        const dayNumById: Record<string, number> = {};
        plan.byDay.forEach(pd => {
            const day = newTrip.days[pd.dayIndex];
            if (!day) return;
            pd.items.forEach(({ wish, time }) => {
                const finalTime = timeOverrides[wish.id] || time;
                day.activities.push({
                    id: crypto.randomUUID(), time: finalTime, title: wish.title, description: wish.notes || '',
                    type: activityTypeOf(wish), location: wish.area || wish.city || wish.country,
                    image: wish.customImage, wishItemId: wish.id,
                    lat: wish.lat, lng: wish.lng, placeId: wish.placeId,
                } as Activity);
                dayNumById[wish.id] = pd.dayIndex + 1;
            });
            Object.assign(day, recalculateTimeline(day));
        });
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w =>
            dayNumById[w.id] ? { ...w, assignedDay: dayNumById[w.id] } : w
        );
        onUpdateTrip(newTrip);
        setArrangeOpen(false);
        setArrangeAddDay(false);
        toast(`已為你順路排入 ${plan.totalPlaced} 個點`, 'success');
    };

    const currentTodos: TripTodoItem[] = trip.todos || DEFAULT_TODOS;
    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const [showExpenses, setShowExpenses] = useState(false);
    const [showVault, setShowVault] = useState(false);
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    const [menuTargetIndex, setMenuTargetIndex] = useState<{dayIdx: number, actIdx: number} | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<{ dayIdx: number, actIdx: number, activity: Activity, initialEdit: boolean } | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const notifiedRef = useRef<Set<string>>(new Set());
    // 🗺️ G4：打開行程時補跑一次 geocode——回填舊行程、手動新增的點（生成端已在建立時 geocode）。
    //   以 trip.id 為觸發（每趟開一次），ref 防重入，只在真有變動時 onUpdateTrip，避免蓋掉編輯。
    const geocodingRef = useRef(false);
    useEffect(() => {
        if (geocodingRef.current) return;
        const hasMissing = (trip.days ?? []).some(d => (d.activities ?? []).some(a => isMappable(a) && (a.lat === undefined || a.lng === undefined)));
        if (!hasMissing) return;
        geocodingRef.current = true;
        ensureTripGeocoded(trip)
            .then(({ trip: g, changed }) => { if (changed) onUpdateTrip(g); })
            .catch(() => { /* geocode 失敗不擋；下次再補 */ })
            .finally(() => { geocodingRef.current = false; });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trip.id]);
    const currencyCode = trip.currency || 'TWD';
    const incompleteTodosCount = currentTodos.filter(t => !t.isCompleted).length;

    // 🧭 空間類·第二刀：地點把關。geocode 目的地城市→質心，比對每個活動是否排錯城/太遠。
    const destinationCities = useMemo(() => {
        // 🧭 優先用「各天的 city」（生成第一刀標的真城市，如首爾/釜山）——最可靠。
        //   否則退回 constraints.legs，再退回把 destination 拆字（行程名如「首爾釜山雙城線」拆不出城市，只能盡力）。
        const fromDays = (trip.days ?? []).map(d => d.city).filter((c): c is string => !!c && !!c.trim());
        const fromLegs = (trip.constraints?.legs ?? []).map(l => l.city).filter(Boolean);
        const src = fromDays.length ? fromDays
            : (fromLegs.length ? fromLegs : (trip.destination || '').split(/[+＋、,\s]+/).map(s => s.trim()).filter(Boolean));
        return Array.from(new Set(src));
    }, [trip.days, trip.constraints, trip.destination]);
    const [cityCentroids, setCityCentroids] = useState<Record<string, LatLng>>({});
    useEffect(() => {
        let cancelled = false;
        const missing = destinationCities.filter(c => !cityCentroids[c]);
        if (missing.length === 0) return;
        geocodeItems(missing.map(c => ({ location: c })))
            .then(res => {
                if (cancelled) return;
                const add: Record<string, LatLng> = {};
                for (const c of missing) { const g = res[c]; if (g) add[c] = { lat: g.lat, lng: g.lng }; }
                if (Object.keys(add).length) setCityCentroids(prev => ({ ...prev, ...add }));
            })
            .catch(() => { /* 城市 geocode 失敗 → 把關暫不啟用，不擋畫面 */ });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [destinationCities]);
    const locWarnings = useMemo(() => locationWarnings(trip.days, cityCentroids), [trip.days, cityCentroids]);
    // 🧭 把關可忽略（有時刻意排、如當日來回）＋頂部收合；內聯在卡片上、頂部只當總覽。
    const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
    const [warnListOpen, setWarnListOpen] = useState(false);
    const activeWarnings = useMemo(() => locWarnings.filter(w => !w.activityId || !dismissedWarnings.has(w.activityId)), [locWarnings, dismissedWarnings]);
    // ⚠️ 本檔 lucide 的 `Map` 圖示遮蔽了原生 Map 建構子 → 用純物件，不要 new Map()。
    const warnByActId = useMemo(() => {
        const m: Record<string, typeof activeWarnings[number]> = {};
        for (const w of activeWarnings) if (w.activityId) m[w.activityId] = w;
        return m;
    }, [activeWarnings]);
    const dismissWarning = (id?: string) => { if (id) setDismissedWarnings(prev => new Set(prev).add(id)); };

    // 🛣️ C：溢位偵測（手動編輯 warn-only）——單點 memo 掃全天，算出「這天塞不下的 victim」。
    //   不動任何東西；只在那張卡旁顯示警示＋一鍵「收進待安排」。系統變動（匯入/改日期）另走自動 park。
    const overflowByActId = useMemo(() => {
        const m: Record<string, { dayIndex: number; message: string }> = {};
        trip.days.forEach((day, dayIndex) => {
            // 🛣️ 偵測用 buffer 0＝「純物理是否塞得下」，與畫面（recalculateTimeline，不加 pace buffer）同一套，
            //   避免「硬塞 30 分緩衝」造成假警報（例：排到 23:45 其實塞得下卻被誤報）。只在真超過深夜上限/撞牆才報。
            const res = detectDayIssues(day, { bufferMin: 0 });
            for (const id of res.overflowIds) {
                const issue = res.issues.find(i => i.activityId === id);
                m[id] = { dayIndex, message: issue?.message ?? '這天可能排不下這個行程' };
            }
        });
        return m;
    }, [trip.days, trip.pace]);
    const [dismissedOverflow, setDismissedOverflow] = useState<Set<string>>(new Set());
    // 🔎 D2：已在行程的 placeId（跨天）→ 搜尋結果標「已加入」
    const existingPlaceIds = useMemo(() => {
        const s = new Set<string>();
        for (const d of trip.days) for (const a of d.activities) if (a.placeId) s.add(a.placeId);
        return s;
    }, [trip.days]);
    // 📚 批2：已存進心願盒的 placeId（供搜尋結果 🔖 顯示 ✓、toggle 取消）
    const savedPlaceIds = useMemo(() => {
        const s = new Set<string>();
        for (const w of wishItems) if (w.placeId) s.add(w.placeId);
        return s;
    }, [wishItems]);


    const linkedDocs = useMemo(() => {
        if (!trip.linkedDocumentIds || trip.linkedDocumentIds.length === 0) return [];
        const foundFiles = files.filter(f => trip.linkedDocumentIds?.includes(f.id));
        return foundFiles.map(f => {
            const parentFolder = folders.find(folder => folder.id === f.parentId);
            const folderName = parentFolder ? parentFolder.name : '一般文件';
            return {
                id: f.id,
                title: f.name,
                type: f.category || (f.type === 'pdf' ? 'other' : 'other'), 
                fileUrl: f.data,
                createdAt: f.date,
                isOffline: false, 
                documentNumber: f.documentNumber,
                notes: f.notes,
                folderName: folderName, 
            } as (Document & { folderName: string });
        });
    }, [trip.linkedDocumentIds, files, folders]);

    const flightDisplayOrigin = trip.origin || 'ORIGIN';
    const flightDisplayDest = trip.destination || 'DEST';
    // 🎟️ 封面 B/V1：航線只放「短城市」當 TO（避免把長行程名塞進去）；日期範圍 MM.DD–MM.DD。
    const coverRouteTo = (destinationCities[0] && destinationCities[0].length <= 4) ? destinationCities[0] : '';
    const coverDateRange = (() => {
        if (!trip.startDate) return '';
        const fmtMD = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        const start = new Date(trip.startDate);
        const end = new Date(start.getTime() + (Math.max(1, trip.days.length) - 1) * 86400000);
        return `${fmtMD(start)}–${fmtMD(end)}`;
    })();
    const firstType = trip.days[0]?.activities[0]?.type || 'other';
    const headerBgClass = firstType === 'flight' ? 'bg-[#2C5E4B]' : firstType === 'train' ? 'bg-[#ea580c]' : 'bg-transparent';
    const today = new Date().toISOString().split('T')[0];
    
    const currentDayIndex = trip.days.findIndex(d => {
        const tripStart = new Date(trip.startDate);
        const currentTripDate = new Date(tripStart);
        currentTripDate.setDate(tripStart.getDate() + (d.day - 1));
        return currentTripDate.toISOString().split('T')[0] === today;
    });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    useEffect(() => {
        if (!trip.members || trip.members.length === 0) {
            onUpdateTrip({ ...trip, members: [{ id: 'me', name: '我', isHost: true }] });
        }
    }, []);

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0];
        if (file) { 
            try {
                const oldPath = trip.coverImagePath;                 // 記住舊路徑，稍後清除
                const path = await uploadTripImage(file);             // 壓縮並上傳到 Storage
                const urlMap = await signPaths([path]);               // 立刻換 signed URL 供顯示
                onUpdateTrip({ ...trip, coverImage: urlMap[path] || '', coverImagePath: path, coverImagePositionY: 50 });
                deleteTripImage(oldPath);                             // 清掉舊封面，避免孤兒檔（fire-and-forget）
            } catch (err) {
                console.error(err);
                toast("圖片上傳失敗");
            }
        } 
    };

    const handleCurrencyChange = (curr: string) => { onUpdateTrip({ ...trip, currency: curr }); };
    // 🎟️ Phase 4a（point 3）：任何會改動日期的入口都走這個關卡——重投影+對帳，超範圍機票報 out-of-range。
    //   nextTrip 已含新的 startDate/endDate（及其他設定變更，一併保留）。
    const reconcileAfterDateChange = (nextTrip: Trip) => {
        const res = applyBookingsToTrip(nextTrip, bookings);
        onUpdateTrip({ ...nextTrip, days: res.days, parked: mergeParked(nextTrip.parked, res.parked) });
        if (res.conflicts.length) setReceipt({ changes: res.changes, conflicts: res.conflicts });
    };
    const handleDateUpdate = (newDate: string) => {
        reconcileAfterDateChange({ ...trip, startDate: newDate });
        setIsDateEditOpen(false);
    };
    const handleDaysUpdate = (newDaysCount: number) => {
        let newDays = [...trip.days];
        if (newDaysCount > trip.days.length) { 
            for (let i = trip.days.length + 1; i <= newDaysCount; i++) newDays.push({ day: i, activities: [] });
        } else { 
            newDays = newDays.slice(0, newDaysCount);
        }
        onUpdateTrip({ ...trip, days: newDays });
        setIsDaysEditOpen(false);
    };

    const handleLinkDocuments = (selectedIds: string[]) => {
        onUpdateTrip({ ...trip, linkedDocumentIds: selectedIds });
        setIsDocPickerOpen(false);
    };

    const handleUnlinkDocument = async (docId: string) => {
        if(await confirmDialog({ title: '移除這份文件連結？', message: '檔案仍會保留在保管箱中，只是取消與此行程的連結。', confirmText: '移除連結' })) {
            const newIds = (trip.linkedDocumentIds || []).filter(id => id !== docId);
            onUpdateTrip({ ...trip, linkedDocumentIds: newIds });
        }
    };

    // 🛡️ 9.3 核心漏洞補回：處理文件編輯存檔並安全關閉
    const handleDocumentSave = (updatedDoc: Partial<VaultFile>) => {
        if (onLocalFileUpdate) { 
            onLocalFileUpdate(updatedDoc); 
        }
        setEditingDoc(null);
    };

    const handleSaveVibeTag = (dayNumber: number, newTag: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const targetDay = newTrip.days.find((d: any) => d.day === dayNumber);
        if (targetDay) {
            targetDay.vibeTag = newTag; 
            onUpdateTrip(newTrip);     
        }
        setEditingVibeDay(null);
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const sourceDayIndex = parseInt(result.source.droppableId.replace('day-', '')) - 1;
        const destDayIndex = parseInt(result.destination.droppableId.replace('day-', '')) - 1;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const [moved] = newTrip.days[sourceDayIndex].activities.splice(result.source.index, 1);
        newTrip.days[destDayIndex].activities.splice(result.destination.index, 0, moved);
        newTrip.days[destDayIndex] = recalculateTimeline(newTrip.days[destDayIndex]);
        if (sourceDayIndex !== destDayIndex) newTrip.days[sourceDayIndex] = recalculateTimeline(newTrip.days[sourceDayIndex]);
        onUpdateTrip(newTrip);
    };

    const handleAddActivity = (newActivity: Activity) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const dayIdx = activeDayForAdd - 1;
        newTrip.days[dayIdx].activities.push(newActivity);
        newTrip.days[dayIdx].activities.sort((a: any, b: any) => a.time.localeCompare(b.time));
        newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
        onUpdateTrip(newTrip);
        setIsAddModalOpen(false);
    };

    const handleQuickAdd = async (type: 'activity' | 'transport' | 'note' | 'expense' | 'ai') => {
        setIsPlusMenuOpen(false);
        if (!menuTargetIndex) return;
        const { dayIdx, actIdx } = menuTargetIndex;
        if (type === 'activity') { setActiveDayForAdd(dayIdx + 1); setIsAddModalOpen(true); return; }

        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const insertIdx = actIdx + 1;
        const prevAct = newTrip.days[dayIdx].activities[actIdx];
        const nextTime = prevAct ? prevAct.time : '09:00';
        let newAct: Activity | null = null;
        if (type === 'ai') {
            setAiLoading(true);
            const spot = await suggestNextSpot(prevAct?.location || trip.destination, nextTime, 'food, sightseeing');
            setAiLoading(false);
            if (spot) newAct = spot; else { toast('靈感暫時想不出來，晚點再試'); return; }
        } else if (type === 'transport') {
            newAct = { time: nextTime, title: '移動', type: 'transport', description: '', transportDetail: { mode: 'bus', duration: '30 min', instruction: '搭乘交通工具' } };
        } else if (type === 'note') {
            newAct = { time: nextTime, title: '新備註', type: 'note', description: '點擊編輯內容', cost: 0 };
        } else if (type === 'expense') {
            newAct = { time: nextTime, title: '新支出', type: 'expense', description: '', cost: 0, payer: trip.members?.[0]?.id, layout: 'polaroid' };
        }

        if (newAct) {
            newTrip.days[dayIdx].activities.splice(insertIdx, 0, newAct);
            newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
            onUpdateTrip(newTrip);
            if (['note', 'expense', 'transport'].includes(type)) { 
                setSelectedActivity({ dayIdx, actIdx: insertIdx, activity: newAct, initialEdit: true });
            }
        }
    };

    // 🧭 走模式 FAB：加到指定天的末尾。臨時加點＝開新增地點；記一筆＝直接插一張拍立得記帳卡並開編輯。
    const addSpotToDay = (dayIdx: number) => { setActiveDayForAdd(dayIdx + 1); setIsAddModalOpen(true); };
    const addExpenseToDay = (dayIdx: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const acts = newTrip.days[dayIdx].activities;
        const nextTime = acts.length ? acts[acts.length - 1].time : '09:00';
        const newAct: Activity = { time: nextTime, title: '新支出', type: 'expense', description: '', cost: 0, payer: trip.members?.[0]?.id, layout: 'polaroid' };
        const insertIdx = acts.length;
        acts.splice(insertIdx, 0, newAct);
        newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
        onUpdateTrip(newTrip);
        setSelectedActivity({ dayIdx, actIdx: insertIdx, activity: newAct, initialEdit: true });
    };

    const handleLocalDeleteWish = (wishId: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.stagedWishes = (newTrip.stagedWishes || []).filter(w => w.id !== wishId);
        onUpdateTrip(newTrip);
        toast('已自此行程移除（未刪除收藏）');
    };

    // 🎟️ D1：心願 → 活動（帶 lat/lng/placeId，供 C 自動接路；source=user）
    const wishToActivity = (wish: WishItem, time: string): Activity => ({
        id: crypto.randomUUID(),
        time,
        title: wish.title,
        description: wish.notes || '',
        type: wish.type === 'item' ? 'shopping' : 'sightseeing',
        location: wish.area || wish.country,
        image: wish.customImage,
        expenseImage: wish.customImage,
        wishItemId: wish.id,
        cost: wish.type === 'item' ? wish.budget : undefined,
        lat: wish.lat,
        lng: wish.lng,
        placeId: wish.placeId,
        source: 'user',
    });

    // 🎟️ D1：批次把多個心願排入某天（一次 trip 更新，避免逐筆 onUpdateTrip 互相覆蓋）
    const injectWishesToDay = (wishes: WishItem[], dayIndex: number) => {
        if (wishes.length === 0) return;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const targetDay = newTrip.days[dayIndex];
        if (!targetDay) return;
        const baseTime = insertionTimeForDay(trip, dayIndex);
        for (const w of wishes) targetDay.activities.push(wishToActivity(w, baseTime));
        newTrip.days[dayIndex] = recalculateTimeline(targetDay);
        const ids = new Set(wishes.map(w => w.id));
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => ids.has(w.id) ? { ...w, assignedDay: dayIndex + 1 } : w);
        onUpdateTrip(newTrip);
        toast(`已把 ${wishes.length} 個心願排入 DAY ${dayIndex + 1}`, 'success');
    };

    // 🔎 D2：把搜尋選到的地點排入某天（帶座標/placeId，供自動接路）
    const addPlaceToDay = (place: SelectedPlace, dayIndex: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const targetDay = newTrip.days[dayIndex];
        if (!targetDay) return;
        const act: Activity = {
            id: crypto.randomUUID(),
            time: insertionTimeForDay(trip, dayIndex),
            title: place.name,
            description: '',
            type: 'sightseeing',
            location: place.address,
            lat: place.lat,
            lng: place.lng,
            placeId: place.placeId,
            source: 'user',
        };
        targetDay.activities.push(act);
        newTrip.days[dayIndex] = recalculateTimeline(targetDay);
        onUpdateTrip(newTrip);
        setSearchTargetDayIdx(null);
        toast(`已把「${place.name}」排入 DAY ${dayIndex + 1}`, 'success');
    };

    const handleInjectWish = (wish: WishItem, dayIndex: number, time?: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const targetDay = newTrip.days[dayIndex];

        let nextTime = time || '10:00';
        if (!time && targetDay.activities.length > 0) {
            nextTime = targetDay.activities[targetDay.activities.length - 1].time;
        }

        const newActivity: Activity = wishToActivity(wish, nextTime);

        targetDay.activities.push(newActivity);
        newTrip.days[dayIndex] = recalculateTimeline(targetDay);
        
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => 
            w.id === wish.id ? { ...w, assignedDay: dayIndex + 1 } : w
        );
        
        onUpdateTrip(newTrip);
        setActionStagedWish(null);
        
        toast(`已將「${wish.title}」排入 DAY ${dayIndex + 1}`, 'success');
    };

    const handleRollbackWish = (wishId: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        
        newTrip.days.forEach(day => {
            const originalLength = day.activities.length;
            day.activities = day.activities.filter(a => a.wishItemId !== wishId);
            if (day.activities.length !== originalLength) {
                Object.assign(day, recalculateTimeline(day));
            }
        });
        
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w =>
            w.id === wishId ? { ...w, assignedDay: undefined } : w
        );

        onUpdateTrip(newTrip);
        toast('已抽離行程，恢復未指派');
    };

    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const acts = newTrip.days[dayIndex].activities as Activity[];
        // 🧱 F1：優先用 id 定位，避免索引位移刪錯卡
        const wantId = selectedActivity?.activity?.id;
        const byId = wantId ? acts.findIndex(a => a.id === wantId) : -1;
        const activityIndexResolved = byId >= 0 ? byId : activityIndex;
        const removedAct = newTrip.days[dayIndex].activities[activityIndexResolved];

        if (removedAct.wishItemId) {
            newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => 
                w.id === removedAct.wishItemId ? { ...w, assignedDay: undefined } : w
            );
        }

        newTrip.days[dayIndex].activities.splice(activityIndexResolved, 1);
        newTrip.days[dayIndex] = recalculateTimeline(newTrip.days[dayIndex]);
        onUpdateTrip(newTrip);
        deleteTripImage(removedAct.expenseImagePath); // 🖼️ 2.2b 刪記帳卡連帶刪其照片，避免孤兒檔
        setSelectedActivity(null);
    };

    const handleUpdateActivity = (updatedAct: Activity) => {
        if (!selectedActivity) return;
        const { dayIdx, actIdx } = selectedActivity;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const acts = newTrip.days[dayIdx].activities as Activity[];
        // 🧱 F1：優先用 id 定位（索引會因自動插卡而位移，改編到錯的卡）
        // 🧱 F2：使用者編輯過的活動標 source:'user' → 時間受保護、precedence 高於自動重算
        const edited: Activity = { ...updatedAct, source: 'user' };
        const byId = edited.id ? acts.findIndex(a => a.id === edited.id) : -1;
        acts[byId >= 0 ? byId : actIdx] = edited;
        newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
        onUpdateTrip(newTrip);
        setSelectedActivity(null);
    };

    const getDateInfo = (startDate: string, dayOffset: number) => {
        if (!startDate) return { dateStr: '--.--', weekDay: '---', isToday: false };
        const [y, m, d] = startDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + dayOffset);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const weekDay = date.toLocaleDateString('en-US', { weekday: 'short' });
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        const isToday = date.getTime() === todayObj.getTime();
        return { dateStr: `${mm}.${dd}`, weekDay, isToday };
    };

    const displayedStagedWishes = useMemo(() => {
        // 🧾 購物改參照：讀「tripId＝本趟」的購物心願（不再靠複製到 staging）
        if (wishTrayTab === 'item') return wishItems.filter(w => w.type === 'item' && w.tripId === trip.id);
        return (trip.stagedWishes || []).filter(w => w.type === wishTrayTab);
    }, [trip.stagedWishes, wishTrayTab, wishItems, trip.id]);

    // 🛍️「在這裡要買」綁定資料：合法站 id 集、依站分組、未綁候選池
    const validStopIds = useMemo(() => {
        const s = new Set<string>();
        trip.days.forEach(d => d.activities.forEach(a => { if (a.id) s.add(a.id); }));
        return s;
    }, [trip.days]);

    const boundByStop = useMemo(() => {
        const m: Record<string, WishItem[]> = {};
        wishItems.forEach(w => {
            if (w.type === 'item' && w.stopId && w.tripId === trip.id) (m[w.stopId] = m[w.stopId] || []).push(w);
        });
        return m;
    }, [wishItems, trip.id]);

    // 本趟未買、未綁任何「有效」站的購物池（綁到已刪站的孤兒→自動退回候選，不會靜默遺失）
    const unboundCandidates = useMemo(() => (
        wishItems.filter(w => w.type === 'item' && w.tripId === trip.id && !w.isPurchased && (!w.stopId || !validStopIds.has(w.stopId)))
    ), [wishItems, trip.id, validStopIds]);

    // 綁定時才「懶回填」activity.id（避免每次開行程都重寫整趟），再寫入 item.stopId
    const bindItemsToActivity = (dayIndex: number, activityIndex: number, itemIds: string[]) => {
        if (!onSetWishStop) return;
        let id = trip.days[dayIndex].activities[activityIndex].id;
        if (!id) {
            id = (crypto as Crypto).randomUUID();
            const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
            newTrip.days[dayIndex].activities[activityIndex].id = id;
            onUpdateTrip(newTrip);
        }
        onSetWishStop(itemIds, id, trip.id);
    };


    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full block overflow-y-auto relative no-scrollbar">
            
            {/* 置頂 Banner 區（🎟️ 收窄至 h-60：行程更快出現；裁切由 coverImagePositionY 拖曳重新定位處理） */}
            <div className={`relative h-60 w-full ${headerBgClass}`}>
                {/* 🎟️ B 封面：頂部漸層保證上緣圖示對比；方案1＝裸白圖示、無玻璃 */}
                <div className="absolute inset-x-0 top-0 h-24 pointer-events-none z-20" style={{ background: 'linear-gradient(rgba(0,0,0,0.42), transparent)' }} />
                <div className="absolute top-0 left-0 right-0 z-30 p-5 flex justify-between items-start pointer-events-none">
                    <button onClick={onBack} aria-label="返回" className="w-10 h-10 flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex gap-4 pointer-events-auto">
                        <button onClick={() => setIsShareOpen(true)} aria-label="分享" className="w-10 h-10 flex items-center justify-center text-white active:scale-90 transition-transform" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
                            <Share className="w-[22px] h-[22px]" />
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} aria-label="設定" className="w-10 h-10 flex items-center justify-center text-white active:scale-90 transition-transform" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
                            <Settings className="w-[22px] h-[22px]" />
                        </button>
                    </div>
                </div>

                {trip.coverImage ? (
                    <img
                        src={trip.coverImage}
                        className="absolute inset-0 w-full h-full object-cover"
                        alt="Cover"
                        style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }}
                    />
                ) : (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
                )}
                {/* 底部票根帶漸層（保證標題/航線對比） */}
                <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none z-10" style={{ background: 'linear-gradient(transparent, rgba(35,35,32,0.9))' }} />
    
                {/* 🎟️ B/V1 票根帶：行程名（serif 主角）＋ 一行 mono 航線/日期 */}
                <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-4">
                    <h1 className="font-serif text-[32px] font-bold text-white leading-[1.15]" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.35)' }}>{trip.destination}</h1>
                    <div className="font-mono text-[12.5px] mt-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.78)' }}>
                        {flightDisplayOrigin}{coverRouteTo && ` → ${coverRouteTo}`}{coverDateRange && ` · ${coverDateRange}`} · {trip.days.length} 天
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />
            </div>

            {/* 🎟️ 五段脊椎（頂部導覽）＋規劃時的列表/地圖鏡頭 */}
            <div className="sticky top-0 z-40 bg-[#E4E2DD]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm px-5 pt-3 pb-3 transition-all">
                <StageSpine current={spineActivated ? currentStageIdx : -1} selected={vmToStage(viewMode)} onSelect={(i) => setViewMode(stageToVM[i])} onLockedTap={handleLockedTap} />
                {(viewMode === 'list' || viewMode === 'map') && (
                    <div className="flex justify-center mt-3">
                        <div className="inline-flex p-[3px] rounded-xl" style={{ background: '#F6F1E7', border: '0.5px solid #E0D8C6', width: 220 }}>
                            <button onClick={() => setViewMode('list')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-lg transition-all" style={viewMode === 'list' ? { background: '#232320', color: '#F6F1E7' } : { color: '#8A8266' }}><List className="w-4 h-4" /> 列表</button>
                            <button onClick={() => setViewMode('map')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-lg transition-all" style={viewMode === 'map' ? { background: '#232320', color: '#F6F1E7' } : { color: '#8A8266' }}><Map className="w-4 h-4" /> 地圖</button>
                        </div>
                    </div>
                )}
                {/* 🎟️ Phase 4a：規劃臉匯入入口（不階段閘控）＋ 常駐「待安排 · N」膠囊 */}
                {(viewMode === 'list' || viewMode === 'map') && (
                    <div className="flex justify-center items-center gap-2 mt-2.5">
                        <button onClick={() => { setViewBooking(null); setImportOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]" style={{ border: '1px dashed #A23B2E', color: '#A23B2E', background: 'transparent' }}>
                            <Plus className="w-3.5 h-3.5" /> 匯入訂位
                        </button>
                        {parkedCount > 0 && (
                            <button onClick={() => setParkedTrayOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: '#FBF3E4', border: '0.5px solid #E7D9BE', color: '#8A6A2B' }}>
                                <Inbox className="w-3.5 h-3.5" /> 待安排 · {parkedCount}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 🎟️ 鎖定段溫柔說明 toast（票根風） */}
            {lockToast && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8" onClick={() => setLockToast(null)}>
                    <div className="absolute inset-0 bg-black/20 animate-in fade-in" />
                    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in" style={{ background: '#F6F1E7', border: '0.5px solid #E0D8C6', boxShadow: '0 12px 40px rgba(35,35,32,0.18)' }}>
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#232320' }}>
                            <span className="font-mono text-[9px] tracking-[2px]" style={{ color: '#C9B98F' }}>NOT YET</span>
                            <button onClick={() => setLockToast(null)} className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.55)' }}>關閉</button>
                        </div>
                        <div className="p-4">
                            <div className="font-serif text-[16px] font-medium" style={{ color: '#232320' }}>{lockToast.title}</div>
                            <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: '#8A8266' }}>{lockToast.sub}</div>
                            {lockToast.cta && (
                                <button onClick={lockToast.cta.go} className="mt-3.5 w-full py-2.5 rounded-lg text-[13px] font-medium active:scale-[0.98] transition-transform" style={{ background: '#232320', color: '#F6F1E7' }}>{lockToast.cta.label}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🎟️ 訂位匯入核對表 */}
            <BookingImportSheet
                open={importOpen}
                trip={trip}
                userId={user?.id || ''}
                viewBooking={viewBooking}
                travelers={travelers}
                onCreateTraveler={onCreateTraveler}
                onUpdateTraveler={onUpdateTraveler}
                onDelete={(id) => { onDeleteBooking?.(id); setImportOpen(false); setViewBooking(null); }}
                onClose={() => { setImportOpen(false); setViewBooking(null); }}
                onImported={(b) => {
                    // 🎟️ Phase 4a（point 4）：重複匯入偵測——同 pnr/航班已在庫 → 全域提醒使用者（不責備，只告知已更新）
                    const dupFlight = b.kind === 'flight' && bookings.some(x =>
                        x.kind === 'flight' && x.id !== b.id && (
                            (!!x.pnr && !!b.pnr && x.pnr === b.pnr) ||
                            (!!x.segments?.[0]?.flightNo && x.segments[0].flightNo === b.segments?.[0]?.flightNo)
                        ));

                    onImportBooking?.(b);

                    // 🎟️ 單向投影：機票 booking → 行程 origin/起訖日（讓前夕登機證與時間軸長出來）
                    let base: Trip = trip;
                    if (b.kind === 'flight' && b.segments.length) {
                        const s0 = b.segments[0], sN = b.segments[b.segments.length - 1];
                        const start = (s0.depLocal || '').slice(0, 10);
                        const end = (sN.arrLocal || '').slice(0, 10);
                        base = {
                            ...trip,
                            origin: s0.fromIata || trip.origin,
                            startDate: start || trip.startDate,
                            endDate: end || trip.endDate,
                        };
                    }

                    // 🎟️ Phase 4a：把這筆（含剛匯入的）投影成錨 → 對帳 → 更新 days/待安排 → 跳收據
                    const effective: StoredBooking[] = [...bookings.filter(x => x.id !== b.id), b];
                    const res = applyBookingsToTrip(base, effective);
                    onUpdateTrip({ ...base, days: res.days, parked: mergeParked(base.parked, res.parked) });

                    setImportOpen(false);
                    setViewBooking(null);
                    if (dupFlight) {
                        toast('這班機你先前已匯過，已幫你更新為最新資料', 'info');
                    }
                    if (res.changes.length || res.conflicts.length) {
                        const fl = b.kind === 'flight' && b.segments[0]?.flightNo
                            ? `${b.segments[0].flightNo} · ${(b.segments[0].arrLocal || '').slice(11, 16)}`
                            : undefined;
                        setReceipt({ flightLabel: fl, changes: res.changes, conflicts: res.conflicts });
                    } else if (!dupFlight) {
                        toast('匯入完成，已加進行程', 'success');
                    }
                }}
            />

            {/* 🎟️ Phase 4a：行程調整收據（匯入/改日期後跳一次）。4b 才傳 onReoptimize，這裡先不傳 → 只留「好，我知道了」 */}
            <ReconcileReceipt
                open={!!receipt}
                onClose={() => setReceipt(null)}
                flightLabel={receipt?.flightLabel}
                changes={receipt?.changes ?? []}
                conflicts={receipt?.conflicts ?? []}
            />

            {/* 🎟️ Phase 4a：待安排托盤（規劃臉常駐膠囊點開） */}
            <ParkedTray
                open={parkedTrayOpen}
                onClose={() => setParkedTrayOpen(false)}
                parked={trip.parked ?? []}
                trip={trip}
                onMoveToDay={handleMoveParkedToDay}
            />

            {/* 行程主體內容區 */}
            <div className="px-5 pb-safe w-full">
                {/* 🧭 空間類·第二刀：地點把關。頂部只當「收合總覽」；實際提示內聯在出問題的卡片上。 */}
                {(viewMode === 'list' || viewMode === 'map') && activeWarnings.length > 0 && (
                    <div className="mt-4 mb-1">
                        <button onClick={() => setWarnListOpen(o => !o)} className="w-full flex items-center justify-between rounded-2xl px-4 py-2.5" style={{ background: '#FBF3E4', border: '0.5px solid #E7D9BE' }}>
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: '#7A5E24' }}>
                                <Navigation className="w-3.5 h-3.5" /> 行程把關 · 地點 {activeWarnings.length}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${warnListOpen ? 'rotate-180' : ''}`} style={{ color: '#B08A3A' }} />
                        </button>
                        {warnListOpen && (
                            <div className="rounded-2xl px-4 py-3 mt-1.5" style={{ background: '#FBF3E4', border: '0.5px solid #E7D9BE' }}>
                                {activeWarnings.map((w, i) => (
                                    <div key={i} className="mb-2.5 last:mb-0">
                                        <p className="text-[11.5px] leading-relaxed" style={{ color: '#7A5E24' }}>{w.message}</p>
                                        <div className="flex gap-2 mt-1.5">
                                            {w.suggestDayNumber && w.activityId && (
                                                <button onClick={() => handleMoveActivityToDay(w.activityId!, w.suggestDayNumber!)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]" style={{ border: '0.5px solid #3F6B52', color: '#3F6B52' }}><Navigation className="w-3 h-3" /> 移到 Day {w.suggestDayNumber}</button>
                                            )}
                                            <button onClick={() => dismissWarning(w.activityId)} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ border: '0.5px solid #E0D8C6', color: '#8A8266' }}>忽略</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {showExpenses && <ExpenseDashboard trip={trip} onCurrencyChange={handleCurrencyChange} />}
              
                {showVault && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-4">
                        {linkedDocs.length > 0 ? (
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-5 px-5 snap-x">
                                {linkedDocs.map(doc => (
                                    <div key={doc.id} className="snap-center">
                                        <VaultCard doc={doc} onRemove={() => handleUnlinkDocument(doc.id)} onEdit={() => setEditingDoc(doc)} />
                                    </div>
                                ))}
                                <button onClick={() => setIsDocPickerOpen(true)} className="flex flex-col items-center justify-center gap-2 min-w-[120px] bg-[#3F6B52]/5 rounded-3xl border-2 border-dashed border-[#3F6B52]/20 hover:bg-[#3F6B52]/10 transition-colors shrink-0 h-[190px]">
                                    <div className="w-10 h-10 rounded-full bg-[#3F6B52] text-white flex items-center justify-center shadow-lg"><Plus className="w-5 h-5" /></div>
                                    <span className="text-xs font-bold text-[#3F6B52]">連結更多</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-[24px] p-6 text-center border border-white/60 bg-white/40 backdrop-blur-md shadow-sm">
                                <div className="flex flex-col items-center justify-center gap-3">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                                        <Briefcase className="w-6 h-6 text-[#232320]" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-base text-[#232320]">尚未加入憑證</h3>
                                        <p className="text-gray-500 text-[11px] leading-relaxed max-w-[200px] mx-auto">建議加入：護照、機票、訂房確認信</p>
                                    </div>
                                    <button onClick={() => setIsDocPickerOpen(true)} className="mt-2 px-5 py-3 bg-[#232320] text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center gap-2 hover:bg-black hover:shadow-xl">
                                        <PlusCircle className="w-3.5 h-3.5" /> 從保管箱挑選文件
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'prepare' ? (
                    <div className="py-4"><PrepareFace trip={trip} daysToDep={daysToDep} flightBookings={flightBookings} hotelBookings={hotelBookings} onImport={() => { setViewBooking(null); setImportOpen(true); }} onView={(b) => { setViewBooking(b); setImportOpen(true); }} onMarkReady={markReady} onFix={openBooking} /></div>
                ) : viewMode === 'eve' ? (
                    <div className="py-4"><EveFace trip={trip} daysToDep={daysToDep} onRehearse={() => setViewMode('walk')} /></div>
                ) : viewMode === 'memory' ? (
                    <div className="py-4"><MemoryFace trip={trip} /></div>
                ) : viewMode === 'walk' ? (
                    <TripWalkView
                        trip={trip}
                        wishItems={wishItems}
                        live={tripActiveToday}
                        onOpenActivity={(dayIdx, actIdx) => {
                            const activity = trip.days[dayIdx]?.activities[actIdx];
                            if (activity) setSelectedActivity({ dayIdx, actIdx, activity, initialEdit: false });
                        }}
                        onAddSpot={addSpotToDay}
                        onAddExpense={addExpenseToDay}
                    />
                ) : viewMode === 'list' ? (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="py-4 space-y-0">
                            {trip.days.map((day: TripDay, dayIndex: number) => {
                                const isCurrentDay = dayIndex === currentDayIndex;
                                const activities = day.activities;
                                const lastActivityTime = activities.length > 0 ? activities[activities.length - 1].time : '00:00';
                                const isEndOfDay = isCurrentDay && currentTime > lastActivityTime && activities.length > 0;
                                const isTripEnd = dayIndex === trip.days.length - 1;
                                const dayInfo = getDateInfo(trip.startDate, dayIndex);

                                return (
                                    <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-[#3F6B52]/20 pb-16">
                                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-[#E4E2DD] shadow-sm transition-colors ${dayInfo.isToday ? 'bg-[#3F6B52] scale-110' : 'bg-gray-300'}`} />
                                        
                                        {/* 🎟️ 日抬頭 A：左日期＋meta、右城市（深綠襯線、中線對齊）。風格膠囊已退（穿搭靈感移至準備/前夕） */}
                                        <div className="flex justify-between items-center -mt-2 mb-6">
                                            <div className="flex flex-col">
                                                <span className={`text-4xl font-black font-serif tracking-tighter leading-none ${dayInfo.isToday ? 'text-[#3F6B52]' : 'text-[#232320]'}`}>
                                                    {dayInfo.dateStr}
                                                </span>
                                                <div className={`flex items-center gap-x-2 mt-1.5 text-[11px] font-bold tracking-[0.15em] uppercase font-mono ${dayInfo.isToday ? 'text-[#3F6B52]' : 'text-gray-400'}`}>
                                                    <span>{dayInfo.weekDay}</span>
                                                    <span className="opacity-30">·</span>
                                                    <span>DAY {day.day}</span>

                                                    {dayInfo.isToday && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span className="flex items-center gap-1.5 text-[#3F6B52]">
                                                                <span className="relative flex h-1.5 w-1.5">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3F6B52] opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#3F6B52]"></span>
                                                                </span>
                                                                TODAY
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 pointer-events-auto">
                                                {day.city && <span className="font-serif font-bold text-[22px] leading-none" style={{ color: '#3F6B52' }}>{day.city}</span>}
                                                <button onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: -1 }); setIsPlusMenuOpen(true); }} className="p-1.5 rounded-full text-[#3F6B52] bg-[#3F6B52]/10 hover:bg-[#3F6B52]/20"><Plus className="w-5 h-5" /></button>
                                            </div>
                                        </div>

                                        <Droppable droppableId={`day-${dayIndex + 1}`}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0 min-h-[50px]">
                                                    {activities.length === 0 && <EmptyDayPlaceholder provided={provided} />}
                                                    {activities.map((act: Activity, index: number) => {
                                                        const isNextActivity = isCurrentDay && act.time > currentTime && (index === 0 || activities[index - 1].time <= currentTime);
                                                        return (
                                                            <React.Fragment key={`${day.day}-${index}`}>
                                                                {isNextActivity && <CurrentTimeIndicator />}
                                                                <Draggable draggableId={`${day.day}-${index}`} index={index}>
                                                                    {(provided, snapshot) => {
                                                                        if (isSystemType(act.type)) {
                                                                            if (act.type === 'transport') return <TransportConnectorItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                            if (act.type === 'note') return <NoteItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                            return <ProcessItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                        }
                                                                        if (act.layout === 'polaroid') {
                                                                            return <ExpensePolaroid act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} currencySymbol={currencyCode === 'TWD' ? 'NT$' : '$'} members={trip.members} />;
                                                                        }
                                                                        return <ActivityItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} currencySymbol={currencyCode === 'TWD' ? 'NT$' : '$'} />;
                                                                    }}
                                                                </Draggable>
                                                                {/* 🧭 地點把關·內聯：這張卡若排錯城/太遠，就地提示＋一鍵移＋忽略 */}
                                                                {act.id && warnByActId[act.id] && (() => {
                                                                    const w = warnByActId[act.id!]!;
                                                                    const inlineMsg = w.kind === 'wrong-city'
                                                                        ? `這個點看起來在 ${w.nearestCity}，這天安排在 ${w.dayCity}`
                                                                        : `這個點離你的目的地約 ${Math.round(w.km)} 公里，可能排錯地方了`;
                                                                    return (
                                                                        <div className="mx-1 my-1 rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: '#FBF3E4', border: '0.5px solid #E7D9BE' }}>
                                                                            <Navigation className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#8A6A2B' }} />
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-[11px] leading-relaxed" style={{ color: '#7A5E24' }}>{inlineMsg}</p>
                                                                                <div className="flex gap-2 mt-1.5">
                                                                                    {w.suggestDayNumber && (
                                                                                        <button onClick={() => handleMoveActivityToDay(act.id!, w.suggestDayNumber!)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px]" style={{ border: '0.5px solid #3F6B52', color: '#3F6B52' }}><Navigation className="w-3 h-3" /> 移到 Day {w.suggestDayNumber}</button>
                                                                                    )}
                                                                                    <button onClick={() => dismissWarning(act.id)} className="px-2.5 py-1 rounded-lg text-[10.5px]" style={{ border: '0.5px solid #E0D8C6', color: '#8A8266' }}>忽略</button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {/* 🛣️ C：溢位·內聯（手動編輯 warn-only）：塞不下就地提示＋一鍵收進待安排＋忽略 */}
                                                                {act.id && overflowByActId[act.id] && !dismissedOverflow.has(act.id) && (
                                                                    <div className="mx-1 my-1 rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: '#FBF3E4', border: '0.5px solid #E7D9BE' }}>
                                                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#C08A2E' }} />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[11px] leading-relaxed" style={{ color: '#7A5E24' }}>{overflowByActId[act.id!]!.message}</p>
                                                                            <div className="flex gap-2 mt-1.5">
                                                                                <button onClick={() => handleParkActivity(overflowByActId[act.id!]!.dayIndex, act.id!)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px]" style={{ border: '0.5px solid #3F6B52', color: '#3F6B52' }}><Inbox className="w-3 h-3" /> 收進待安排</button>
                                                                                <button onClick={() => setDismissedOverflow(prev => new Set(prev).add(act.id!))} className="px-2.5 py-1 rounded-lg text-[10.5px]" style={{ border: '0.5px solid #E0D8C6', color: '#8A8266' }}>忽略</button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {(() => {
                                                                    if (!onSetWishStop || isSystemType(act.type) || act.layout === 'polaroid') return null;
                                                                    const bound = act.id ? (boundByStop[act.id] || []) : [];
                                                                    const isShoppingStop = act.type === 'shopping';
                                                                    if (!isShoppingStop && bound.length === 0) return null;   // 非購物站不主動浮
                                                                    return (
                                                                        <BuyHereCard
                                                                            stopTitle={act.title}
                                                                            isShopping={isShoppingStop}
                                                                            boundItems={bound}
                                                                            candidates={unboundCandidates}
                                                                            onBind={(ids) => bindItemsToActivity(dayIndex, index, ids)}
                                                                            onUnbind={(itemId) => onSetWishStop?.([itemId], null)}
                                                                            onTogglePurchased={(itemId) => onTogglePurchased?.(itemId)}
                                                                        />
                                                                    );
                                                                })()}
                                                                <GhostInsertButton onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: index }); setIsPlusMenuOpen(true); }} />
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    {isEndOfDay && <EndOfDayIndicator isTripEnd={isTripEnd} />}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                );
                            })}
                            <div className="h-24"></div>
                        </div>
                    </DragDropContext>
                ) : (
                    <TripMapView trip={trip} onUpdateTrip={onUpdateTrip} />
                )}
            </div>
            
            {/* 所有浮層與 Modals */}
            {isDateEditOpen && <SimpleDateEditModal date={trip.startDate} onClose={() => setIsDateEditOpen(false)} onSave={handleDateUpdate} />}
            {isDaysEditOpen && <SimpleDaysEditModal days={trip.days.length} onClose={() => setIsDaysEditOpen(false)} onSave={handleDaysUpdate} />}
            {isSettingsOpen && <TripSettingsModal trip={trip} user={currentUser} onClose={() => setIsSettingsOpen(false)} onUpdate={(updatedTrip: Trip) => {
                // 🎟️ point 3：設定齒輪是使用者實際改日期的門 → 日期有變就導進對帳（補上 out-of-range 警告）；沒變才直接寫入
                const dateChanged = updatedTrip.startDate !== trip.startDate || updatedTrip.endDate !== trip.endDate;
                if (dateChanged) reconcileAfterDateChange(updatedTrip);
                else onUpdateTrip(updatedTrip);
                setIsSettingsOpen(false);
            }} onDelete={onDelete}
                onOpenWishTray={() => setShowWishTray(true)}
                onOpenExpenses={() => setShowExpenses(true)}
                onOpenReminders={() => { setIsRemindersOpen(true); Notification.permission === 'default' && Notification.requestPermission(); }}
            />}
            {isAddModalOpen && <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />}
            {searchTargetDayIdx != null && (() => {
                const d = trip.days[searchTargetDayIdx];
                const city = d?.city;
                const bias = city ? cityCentroids[city] : undefined;
                const routeCoords = (d?.activities || [])
                    .filter(a => typeof a.lat === 'number' && typeof a.lng === 'number')
                    .map(a => ({ lat: a.lat as number, lng: a.lng as number }));
                return (
                    <PlaceSearchSheet
                        dayNumber={d?.day ?? searchTargetDayIdx + 1}
                        dayCity={city}
                        bias={bias}
                        routeCoords={routeCoords}
                        wishItems={wishItems}
                        existingPlaceIds={existingPlaceIds}
                        onSelect={(p) => addPlaceToDay(p, searchTargetDayIdx)}
                        savedPlaceIds={savedPlaceIds}
                        onSave={(p) => {
                            if (p.placeId && savedPlaceIds.has(p.placeId)) { onUnsaveWish?.(p.placeId); toast('已從心願盒移除', 'info'); }
                            else setSaveTargetPlace({ ...p, city });
                        }}
                        onClose={() => setSearchTargetDayIdx(null)}
                    />
                );
            })()}
            {saveTargetPlace && (
                <SaveToListSheet
                    placeName={saveTargetPlace.name}
                    lists={wishLists ?? []}
                    onCreateList={onCreateWishList ?? (async () => null)}
                    onPick={(opts) => {
                        if (saveTargetPlace) {
                            onSaveWish?.(saveTargetPlace, opts);
                            const label = opts.favorite ? '最愛' : opts.listId ? (wishLists?.find(l => l.id === opts.listId)?.name ?? '清單') : '未分類';
                            toast(`已存到「${label}」`, 'success');
                        }
                        setSaveTargetPlace(null);
                    }}
                    onClose={() => setSaveTargetPlace(null)}
                />
            )}
            {selectedActivity && <ActivityDetailModal act={selectedActivity.activity} onClose={() => setSelectedActivity(null)} onSave={handleUpdateActivity} onDelete={() => handleDeleteActivity(selectedActivity.dayIdx, selectedActivity.actIdx)} members={trip.members} initialEdit={selectedActivity.initialEdit} currencySymbol={currencyCode === 'TWD' ? 'NT$' : '$'} />}
            
            {isDocPickerOpen && (
                <DocumentPickerModal documents={documents} folders={folders} files={files} initialSelectedIds={trip.linkedDocumentIds || []} onClose={() => setIsDocPickerOpen(false)} onSave={handleLinkDocuments} />
            )}
            
            {editingDoc && <DocumentEditModal doc={editingDoc} folders={folders} onClose={() => setEditingDoc(null)} onSave={handleDocumentSave} />}
            
            {isRemindersOpen && (
                <TripRemindersModal
                    todos={currentTodos}
                    onUpdateTodos={(newTodos) => onUpdateTrip({ ...trip, todos: newTodos })}
                    startDate={trip.startDate}
                    onClose={() => setIsRemindersOpen(false)} 
                />
            )}

            {editingVibeDay !== null && (
                <VibeTagEditModal
                    dayNumber={editingVibeDay}
                    initialValue={trip.days.find((d) => d.day === editingVibeDay)?.vibeTag || ''}
                    onClose={() => setEditingVibeDay(null)}
                    onSave={(newTag) => handleSaveVibeTag(editingVibeDay, newTag)}
                />
            )}

            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} />
            <ShareBottomSheet trip={trip} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
            
            {/* 快速插入選單 */}
            {isPlusMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/20 backdrop-blur-sm" onClick={() => setIsPlusMenuOpen(false)} />
                    <div className="bg-white rounded-3xl p-2 shadow-2xl w-full max-w-[200px] animate-in zoom-in-95 relative z-10 flex flex-col gap-1">
                        <p className="text-xs font-bold text-gray-400 text-center py-2 uppercase tracking-wider">插入至行程</p>
                        <button onClick={() => handleQuickAdd('activity')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><MapPin className="w-5 h-5 text-blue-500" /> 新增景點</button>
                        <button onClick={() => { setIsPlusMenuOpen(false); if (menuTargetIndex) openWishPickerForDay(menuTargetIndex.dayIdx); }} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#3F6B52]/5 text-left text-sm font-bold text-[#3F6B52] transition-colors"><Sparkles className="w-5 h-5" /> 從心願盒</button>
                        <button onClick={() => { setIsPlusMenuOpen(false); if (menuTargetIndex) setSearchTargetDayIdx(menuTargetIndex.dayIdx); }} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><Search className="w-5 h-5 text-blue-500" /> 搜尋地點</button>
                        <button onClick={() => handleQuickAdd('transport')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><Bus className="w-5 h-5 text-gray-500" /> 新增交通</button>
                        <button onClick={() => handleQuickAdd('note')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><StickyNote className="w-5 h-5 text-yellow-500" /> 新增備註</button>
                        <button onClick={() => handleQuickAdd('expense')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><Banknote className="w-5 h-5 text-green-500" /> 快速記帳</button>
                        <div className="h-px bg-gray-100 my-1" />
                        <button onClick={() => handleQuickAdd('ai')} disabled={aiLoading} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#3F6B52]/5 text-left text-sm font-bold text-[#3F6B52] transition-colors">
                            {aiLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} 靈感推薦
                        </button>
                    </div>
                </div>
            )}

            {/* === 🛡️ 9.3 升級：融合分頁與雙向極限手勢之心願盒面板 === */}
            {showWishTray && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/40 backdrop-blur-sm transition-opacity" onClick={() => setShowWishTray(false)} />
                    <div className="w-full max-w-md bg-[#F2F2F2] rounded-[32px] p-6 relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[75vh]">
                        
                        {/* Header 及 iOS 原生膠囊切換器 */}
                        <div className="shrink-0 pb-3 border-b border-gray-200/60">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-black font-serif text-[#232320] flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-[#3F6B52]" /> 靈感心願盒
                                </h3>
                                <button onClick={() => setShowWishTray(false)} className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 transition-colors rounded-full text-gray-500">
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>

                            {/* iOS Segmented UI 切換滑塊 */}
                            <div className="bg-[#767680]/10 p-[2px] rounded-lg flex relative items-center h-8 mb-3">
                                <div 
                                    className="absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] bg-white rounded-md shadow-[0_3px_1px_rgba(0,0,0,0.04),0_3px_8px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out" 
                                    style={{ left: wishTrayTab === 'place' ? '2px' : 'calc(50%)' }} 
                                />
                                <button 
                                    onClick={() => setWishTrayTab('place')}
                                    className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-xs font-bold rounded-md transition-colors duration-300 ${wishTrayTab === 'place' ? 'text-[#232320]' : 'text-gray-500'}`}
                                >
                                    <MapPin className="w-3.5 h-3.5" /> 探索地點
                                </button>
                                <button 
                                    onClick={() => setWishTrayTab('item')}
                                    className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-xs font-bold rounded-md transition-colors duration-300 ${wishTrayTab === 'item' ? 'text-[#232320]' : 'text-gray-500'}`}
                                >
                                    <ShoppingBag className="w-3.5 h-3.5" /> 購物清單
                                </button>
                            </div>

                            {/* 🧱 C1-2 從我的收藏加入 */}
                            <button onClick={openLibraryPicker} className="w-full mb-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#3F6B52]/10 text-[#3F6B52] text-xs font-bold hover:bg-[#3F6B52]/20 transition-colors">
                                <Plus className="w-4 h-4" /> 從我的收藏加入
                            </button>

                        </div>
                        
                        {/* 心願項目內容流 */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-safe">
                            {displayedStagedWishes.length === 0 ? (
                                <div className="py-10 border-2 border-dashed border-gray-200 rounded-[24px] flex flex-col items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-gray-300 mb-2" />
                                    <p className="text-sm font-bold text-gray-400">這趟行程還沒有心願</p>
                                    <button onClick={openLibraryPicker} className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#3F6B52] text-white text-xs font-bold active:scale-95 transition-transform">
                                        <Plus className="w-4 h-4" /> 從我的收藏加入
                                    </button>
                                </div>
                            ) : wishTrayTab === 'place' ? (
                                /* === 地點：待排入 + 已排入行程（明確按鈕，無滑動） === */
                                <div className="flex flex-col gap-4">
                                    {pendingPlaceWishes.length > 0 && (
                                        <button onClick={openArrange} className="w-full flex flex-col items-center py-2.5 rounded-2xl bg-[#3F6B52] text-white shadow-lg shadow-[#3F6B52]/20 active:scale-[0.99] transition-transform">
                                            <span className="flex items-center gap-2 text-sm font-bold"><Sparkles className="w-4 h-4" /> 一鍵排全部（{pendingPlaceWishes.length}）</span>
                                            <span className="text-[10px] text-white/80 mt-0.5">依位置自動排好各天</span>
                                        </button>
                                    )}
                                    {(() => {
                                        const pending = displayedStagedWishes.filter(w => w.assignedDay === undefined);
                                        const assigned = displayedStagedWishes.filter(w => w.assignedDay !== undefined);
                                        return (
                                            <>
                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-400 mb-2 px-1">待排入 · {pending.length}</p>
                                                    {pending.length === 0 ? (
                                                        <p className="text-xs text-gray-400 px-1 py-2">都排好了 👍</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {pending.map(wish => (
                                                                <div key={wish.id} className="bg-white rounded-2xl p-2.5 shadow-sm flex items-center gap-3">
                                                                    {wish.customImage
                                                                        ? <img src={wish.customImage} className="w-11 h-11 rounded-xl object-cover shrink-0" alt="" />
                                                                        : <div className="w-11 h-11 rounded-xl bg-[#E9E5DC] flex items-center justify-center shrink-0 text-[#3F6B52]"><MapPin className="w-5 h-5" /></div>}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-bold text-sm text-[#232320] truncate">{wish.title}</h4>
                                                                        <div className="flex items-center gap-1.5 mt-1">
                                                                            {wish.area && <span className="text-[11px] text-gray-400">{wish.area}</span>}
                                                                            <button onClick={() => setSlotPickerWish(wish)} className={`flex items-center gap-0.5 text-[10px] font-bold pl-1.5 pr-1 py-0.5 rounded-md transition-colors ${wish.preferredSlot ? 'bg-[#EDF2F0] text-[#3F6B52]' : 'bg-gray-100 text-gray-400'}`}>
                                                                                <Clock className="w-2.5 h-2.5" /> {slotLabel(wish.preferredSlot)} <ChevronDown className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={() => setActionStagedWish(wish)} className="flex items-center gap-1 bg-white border border-[#3F6B52]/30 text-[#3F6B52] text-xs font-bold px-3 h-8 rounded-full active:scale-95 transition-transform shrink-0">
                                                                        <CalendarPlus className="w-3.5 h-3.5" /> 排入某天
                                                                    </button>
                                                                    <button onClick={() => handleLocalDeleteWish(wish.id)} className="w-8 h-8 rounded-full bg-[#F3EFE7] text-gray-400 hover:text-[#C0573E] flex items-center justify-center shrink-0 transition-colors">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {assigned.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-400 mb-2 px-1">已排入行程</p>
                                                        <div className="space-y-2">
                                                            {assigned.map(wish => (
                                                                <div key={wish.id} className="bg-[#F6F5F2] rounded-2xl p-2.5 flex items-center gap-3">
                                                                    <div className="w-11 h-11 rounded-xl bg-[#E9E5DC] flex items-center justify-center shrink-0 text-[#3F6B52]"><MapPin className="w-5 h-5" /></div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-bold text-sm text-[#232320] truncate">{wish.title}</h4>
                                                                        <span className="inline-block mt-1 text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded">已排入 DAY {wish.assignedDay}</span>
                                                                    </div>
                                                                    <button onClick={() => handleRollbackWish(wish.id)} className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-[#C0573E] flex items-center justify-center shrink-0 transition-colors">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                /* === 購物：本趟購物清單（依店家分組、可勾買、附近排序）+ 進度 === */
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <span className="text-[11px] font-bold text-gray-400">本趟購物 · {displayedStagedWishes.length} 樣</span>
                                        <button onClick={() => setTripShopNearbyOn(v => { const n = !v; if (n) tripShopNearby.locate(); return n; })}
                                                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${tripShopNearbyOn ? 'bg-[#3F6B52] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                            <Navigation className="w-3.5 h-3.5" /> 附近
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(() => {
                                            const sorted = [...displayedStagedWishes].sort((a, b) => (a.isPurchased ? 1 : 0) - (b.isPurchased ? 1 : 0));
                                            const groups: Record<string, WishItem[]> = {};
                                            sorted.forEach(it => { const k = it.area || '其他'; (groups[k] = groups[k] || []).push(it); });
                                            let entries = Object.entries(groups).map(([cat, items]) => {
                                                const c = items.find(i => i.lat != null && i.lng != null);
                                                const km = (tripShopNearbyOn && tripShopNearby.pos && c) ? haversineKm(tripShopNearby.pos, { lat: c.lat as number, lng: c.lng as number }) : null;
                                                return { cat, items, km };
                                            });
                                            if (tripShopNearbyOn) entries = entries.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
                                            return entries.map(({ cat, items, km }) => (
                                                <div key={cat} className="bg-white rounded-2xl shadow-sm px-4 pt-2 pb-1">
                                                    <p className="text-[12px] font-bold text-[#3F6B52] pt-1 pb-0.5 flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> <span className="flex-1 truncate">{cat}</span>{km != null && <span className="text-[11px] font-bold text-white bg-[#3F6B52] px-2 py-0.5 rounded-full flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" />{fmtDist(km)}</span>}</p>
                                                    {items.map(item => {
                                                        const bought = !!item.isPurchased;
                                                        return (
                                                            <div key={item.id} className={`flex items-center gap-3 py-2.5 border-b border-dashed border-[#EFECE5] last:border-b-0 ${bought ? 'opacity-50' : ''}`}>
                                                                <button onClick={() => onTogglePurchased?.(item.id)} className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-colors ${bought ? 'bg-[#3F6B52] text-white' : 'border-[1.5px] border-gray-300 hover:border-[#3F6B52]'}`}>
                                                                    {bought && <Check className="w-3.5 h-3.5" />}
                                                                </button>
                                                                <span className={`flex-1 text-sm font-medium ${bought ? 'line-through text-gray-400' : 'text-[#232320]'}`}>{item.title}{item.quantity != null && item.quantity > 1 && <span className="text-[11px] text-gray-400 ml-1">×{item.quantity}</span>}</span>
                                                                {item.forWhom && !bought && <span className="text-[10px] font-bold text-[#993556] bg-[#FBEAF0] px-2 py-0.5 rounded-md shrink-0">{item.forWhom}</span>}
                                                                {item.budget != null && <span className={`font-mono text-xs shrink-0 ${bought ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{item.currency || 'TWD'} {item.budget.toLocaleString()}</span>}
                                                                <button onClick={() => onTagWishesToTrip?.([item.id], null)} className="w-7 h-7 rounded-full bg-[#F3EFE7] text-gray-400 hover:text-[#C0573E] flex items-center justify-center shrink-0 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-3 mt-4 px-1">
                                        <div className="flex-1 h-2 rounded-full bg-[#E2DFD8] overflow-hidden">
                                            <div className="h-full bg-[#3F6B52] rounded-full transition-all" style={{ width: `${displayedStagedWishes.length ? (displayedStagedWishes.filter(w => w.isPurchased).length / displayedStagedWishes.length) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-[#3F6B52] shrink-0">
                                            {displayedStagedWishes.filter(w => w.isPurchased).length === displayedStagedWishes.length ? '全部買完 🎉' : `已買 ${displayedStagedWishes.filter(w => w.isPurchased).length} / ${displayedStagedWishes.length}`}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === 🧱 C1-2 從我的收藏加入 挑選器 === */}
            {libraryPickerOpen && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/50 backdrop-blur-sm" onClick={() => setLibraryPickerOpen(false)} />
                    <div className="w-full max-w-md bg-[#F2F2F2] rounded-[32px] relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[80vh]">
                        <div className="shrink-0 p-5 pb-3">
                            <div className="flex items-center gap-2.5 mb-3">
                                <button onClick={() => setLibraryPickerOpen(false)} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                                <h3 className="font-serif text-lg font-bold text-[#232320]">從我的收藏加入</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setPickerScope('trip')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${pickerScope === 'trip' ? 'bg-[#3F6B52] text-white' : 'bg-[#EAE6DD] text-gray-600'}`}>此行程 · {trip.destination}</button>
                                <button onClick={() => setPickerScope('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${pickerScope === 'all' ? 'bg-[#3F6B52] text-white' : 'bg-[#EAE6DD] text-gray-600'}`}>全部收藏</button>
                                {wishTrayTab === 'place' && (
                                    <button onClick={() => { setPickerScope('nearby'); pickerNearby.locate(); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${pickerScope === 'nearby' ? 'bg-[#3F6B52] text-white' : 'bg-[#EAE6DD] text-gray-600'}`}><Navigation className="w-3 h-3" />附近</button>
                                )}
                            </div>
                            {/* 📚 批5：相簿子濾（墨黑＝相簿軸，與上排綠色 scope 軸區隔） */}
                            {wishTrayTab === 'place' && (((wishLists?.length ?? 0) > 0) || wishItems.some(w => w.type === 'place' && w.isFavorite)) && (
                                <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                                    {([{ key: null, label: '所有相簿' }, { key: '__fav__', label: '最愛' }, ...(wishLists ?? []).map(l => ({ key: l.id, label: l.name })), { key: '__none__', label: '未分類' }] as { key: string | null; label: string }[]).map(chip => {
                                        const on = pickerListFilter === chip.key;
                                        return (
                                            <button key={chip.key ?? '__all__'} onClick={() => setPickerListFilter(chip.key)}
                                                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${on ? 'bg-[#232320] text-white' : 'bg-[#EAE6DD] text-gray-600'}`}>
                                                {chip.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2">
                            {pickerScope === 'nearby' && pickerNearby.status === 'loading' ? (
                                <div className="text-center text-gray-400 text-sm py-16 flex flex-col items-center gap-2"><Navigation className="w-6 h-6 animate-pulse text-[#3F6B52]" />定位中…</div>
                            ) : pickerScope === 'nearby' && (pickerNearby.status === 'denied' || pickerNearby.status === 'error') ? (
                                <div className="text-center text-gray-400 text-sm py-16 flex flex-col items-center gap-3">
                                    {pickerNearby.status === 'denied' ? '未取得定位權限，請在瀏覽器設定開啟' : '無法定位，請稍後再試'}
                                    <button onClick={() => pickerNearby.locate()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#3F6B52] text-white text-xs font-bold active:scale-95 transition-transform"><Navigation className="w-3.5 h-3.5" />重新定位</button>
                                </div>
                            ) : pickerItems.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-16">{pickerListFilter ? '這個相簿在目前範圍沒有地點，試試切換相簿或改成「全部收藏」' : pickerScope === 'trip' ? `沒有與「${trip.destination}」相關的收藏，試試「全部收藏」` : pickerScope === 'nearby' ? '附近沒有已收藏且含座標的地點' : '你的收藏是空的'}</div>
                            ) : pickerItems.map(w => {
                                const added = stagedIds.has(w.id);
                                const picked = pickerSelected.has(w.id);
                                return (
                                    <button key={w.id} disabled={added} onClick={() => togglePick(w.id)}
                                            className={`w-full flex items-center gap-3 bg-white rounded-2xl p-3 border text-left transition-all ${added ? 'opacity-60' : ''} ${picked ? 'border-[#3F6B52]' : 'border-white'}`}>
                                        {added ? (
                                            <span className="text-[10px] font-bold text-[#3F6B52] bg-[#EDF2F0] px-2 py-1 rounded-md flex-shrink-0">已加入</span>
                                        ) : (
                                            <span className={`w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0 ${picked ? 'bg-[#3F6B52] text-white' : 'border-2 border-[#D3D0C6]'}`}>{picked && <Check className="w-3.5 h-3.5" />}</span>
                                        )}
                                        <span className="w-11 h-11 rounded-xl overflow-hidden bg-[#E9E5DC] flex-shrink-0 flex items-center justify-center text-[#3F6B52]">
                                            {w.customImage ? <img src={w.customImage} alt={w.title} className="w-full h-full object-cover" /> : (w.type === 'place' ? <MapPin className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#232320] truncate">{w.title}</p>
                                            <div className="flex gap-1 mt-1">
                                                {pickerScope === 'nearby' && nearbyKm[w.id] != null && <span className="text-[10px] font-bold text-white bg-[#3F6B52] px-2 py-0.5 rounded-md flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" />{fmtDist(nearbyKm[w.id])}</span>}
                                                {w.type === 'item' && w.tripId && w.tripId !== trip.id && <span className="text-[10px] font-bold text-[#185FA5] bg-[#E6F1FB] px-2 py-0.5 rounded-md">屬 {tripDestById[w.tripId] || '其他行程'}</span>}
                                                {w.city && <span className="text-[10px] font-bold text-[#57534E] bg-[#EAE6DD] px-2 py-0.5 rounded-md">{w.city}</span>}
                                                {w.area && <span className="text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md">{w.area}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="shrink-0 p-4 pb-safe">
                            <button onClick={handleAddFromLibrary} disabled={pickerSelected.size === 0}
                                    className="w-full py-3.5 rounded-2xl bg-[#3F6B52] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all">
                                <Plus className="w-5 h-5" /> 加入 {pickerSelected.size} 項到行程
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === 🧭 C1-3 一鍵順路排入 預覽 === */}
            {arrangeOpen && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/50 backdrop-blur-sm" onClick={() => setArrangeOpen(false)} />
                    <div className="w-full max-w-md bg-[#F2F2F2] rounded-[32px] relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85vh]">
                        <div className="shrink-0 p-5 pb-3 bg-white rounded-t-[32px] border-b border-black/5">
                            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#3F6B52]" /><h3 className="font-serif text-lg font-bold text-[#232320]">順路排入預覽</h3></div>
                            <p className="text-xs text-gray-500 mt-1.5">已依位置就近排入 {arrangePlan.totalPlaced} 個點{arrangePlan.overflow.length > 0 ? `，${arrangePlan.overflow.length} 個排不下` : ''}・<span className="text-[#3F6B52]">時間可點擊調整</span></p>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
                            {arrangePlan.byDay.map(pd => (
                                <div key={pd.dayIndex} className="bg-white rounded-2xl p-3.5">
                                    <p className="text-sm font-bold text-[#232320] mb-2">DAY {pd.dayIndex + 1}{pd.region && <span className="text-[#3F6B52] text-xs font-normal"> · {pd.region}一帶</span>}</p>
                                    {pd.items.map(({ wish, time }) => {
                                        const shownTime = timeOverrides[wish.id] || time;
                                        const edited = !!timeOverrides[wish.id];
                                        return (
                                            <div key={wish.id} className="flex items-center gap-2.5 py-1">
                                                <span className="w-5 h-5 rounded-full bg-[#3F6B52] text-white text-[11px] font-bold flex items-center justify-center shrink-0">＋</span>
                                                <span className="flex-1 text-[13px] text-[#232320] truncate">{wish.title}</span>
                                                <button onClick={() => setTimeWheel({ value: shownTime, onPick: (v) => setTimeOverrides(o => ({ ...o, [wish.id]: v })) })}
                                                        className={`font-mono text-[12px] shrink-0 px-2 py-0.5 rounded-md active:scale-95 transition-transform ${edited ? 'text-[#3F6B52] font-bold bg-[#EDF2F0]' : 'text-gray-500 bg-gray-100'}`}>
                                                    {shownTime}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            {arrangePlan.overflow.length > 0 && (
                                <div className="bg-[#FBF3E7] border border-[#F0D9A8] rounded-2xl p-3.5">
                                    <p className="text-xs font-bold text-[#854F0B] mb-2">⚠️ 這 {arrangePlan.overflow.length} 個排不下（超過每天上限）</p>
                                    {arrangePlan.overflow.map(w => (
                                        <div key={w.id} className="flex items-center gap-2 py-0.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span className="text-[13px] text-[#57534E]">{w.title}</span></div>
                                    ))}
                                    <div className="flex gap-2 mt-2.5">
                                        <button onClick={() => setArrangeAddDay(true)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${arrangeAddDay ? 'bg-[#3F6B52] text-white border-[#3F6B52]' : 'bg-white text-[#854F0B] border-[#F0D9A8]'}`}>＋ 新增一天放它們</button>
                                        <button onClick={() => setArrangeAddDay(false)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${!arrangeAddDay ? 'bg-white text-[#232320] border-gray-300' : 'bg-white text-gray-400 border-gray-200'}`}>留在待排入</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="shrink-0 p-4 pb-safe flex gap-3">
                            <button onClick={() => setArrangeOpen(false)} className="w-12 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500"><X className="w-5 h-5" /></button>
                            {arrangePlan.totalPlaced > 0 ? (
                                <button onClick={applyArrangement} className="flex-1 py-3.5 rounded-xl bg-[#3F6B52] text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><Check className="w-4 h-4" /> 確認排入 {arrangePlan.totalPlaced} 個點</button>
                            ) : (
                                <button onClick={() => setArrangeOpen(false)} className="flex-1 py-3.5 rounded-xl bg-gray-200 text-gray-600 font-bold active:scale-[0.98] transition-all">沒有可排入的天，先關閉</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === 🧭 C1-3 希望時段 選單 === */}
            {slotPickerWish && (
                <div className="fixed inset-0 z-[130] flex items-end justify-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/40 backdrop-blur-sm" onClick={() => setSlotPickerWish(null)} />
                    <div className="w-full max-w-sm bg-white rounded-[28px] p-5 relative z-10 animate-in slide-in-from-bottom duration-300">
                        <p className="text-sm font-bold text-[#232320] text-center mb-1">希望排在什麼時段？</p>
                        <p className="text-[11px] text-gray-400 text-center mb-4 truncate">{slotPickerWish.title}</p>
                        <div className="grid grid-cols-2 gap-2.5">
                            {([['morning', '上午'], ['afternoon', '下午'], ['evening', '晚上'], [undefined, '不指定']] as const).map(([val, label]) => {
                                const active = (slotPickerWish.preferredSlot || undefined) === val;
                                return <button key={label} onClick={() => setStagedSlot(slotPickerWish.id, val)} className={`py-3 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-[#3F6B52] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>;
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* === 🧭 C1-3 統一滾輪時間選擇器 === */}
            {timeWheel && (
                <TimePickerWheel value={timeWheel.value} onChange={(v) => timeWheel.onPick(v)} onClose={() => setTimeWheel(null)} />
            )}

            {/* === 天數指派彈窗 (Sub-Modal) === */}
            {actionStagedWish && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#232320]/40 backdrop-blur-sm" onClick={() => setActionStagedWish(null)} />
                    <div className="bg-white rounded-3xl p-5 shadow-2xl w-full max-w-[260px] animate-in zoom-in-95 relative z-10 flex flex-col gap-2 border border-gray-100">
                        <p className="text-sm font-bold text-[#232320] text-center mb-3 tracking-wide">排入哪一天的行程？</p>
                        <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2">
                            {trip.days.map((day, idx) => {
                                const dateStr = day.date ? day.date.replace(/-/g, '.') : '';
                                return (
                                    <button
                                        key={day.day}
                                        onClick={() => { const w = actionStagedWish; setTimeWheel({ value: '10:00', onPick: (v) => handleInjectWish(w, idx, v) }); }}
                                        className="w-full py-3.5 rounded-xl bg-gray-50 hover:bg-[#3F6B52] text-gray-700 hover:text-white font-bold text-sm transition-all border border-transparent shadow-sm flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <span>DAY {day.day}</span>
                                        <span className="text-[10px] opacity-70 font-mono font-medium">{dateStr}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setActionStagedWish(null)} className="w-full py-3 mt-1 rounded-xl text-gray-400 font-bold text-sm hover:bg-gray-50 transition-colors">取消</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ItineraryView;