// src/views/ItineraryView/ItineraryView.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, List, Map, Plus, Settings, 
    Train, Plane, Ticket, Wallet, 
    MapPin, Bus, StickyNote, Banknote, RefreshCw, Sparkles, 
    Briefcase, PlusCircle, Share, ListChecks, X, ShoppingBag,
    Check, Trash2, Undo
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { Trip, TripDay, Activity, Document, VaultFolder, VaultFile, User, WishItem } from '../../types'; 
import { suggestNextSpot } from '../../services/gemini';
import { recalculateTimeline } from '../../services/timeline';

import { uploadTripImage, signPaths, deleteTripImage } from '../../services/storage';

import { GlassCapsule } from '../../components/common/GlassCapsule';
import { GhostInsertButton } from '../../components/common/GhostInsertButton';
import { isSystemType } from './shared';

import { ExpenseDashboard } from './components/ExpenseDashboard';
import { DayRouteCard } from './components/DayRouteCard';
import { VaultCard } from './components/VaultCard'; 

import { ActivityItem } from './items/ActivityItem';
import { ProcessItem } from './items/ProcessItem';
import { TransportConnectorItem } from './items/TransportConnectorItem';
import { NoteItem } from './items/NoteItem';
import { ExpensePolaroid } from './items/ExpensePolaroid';

import { SimpleDateEditModal } from './modals/SimpleDateEditModal';
import { SimpleDaysEditModal } from './modals/SimpleDaysEditModal';
import { AddActivityModal } from './modals/AddActivityModal';
import { TripSettingsModal } from './modals/TripSettingsModal';
import { ActivityDetailModal } from './modals/ActivityDetailModal';
import { DocumentPickerModal } from './modals/DocumentPickerModal';
import { DocumentEditModal } from './modals/DocumentEditModal';
import { TripRemindersModal } from './modals/TripRemindersModal';
import { VibeTagEditModal } from './modals/VibeTagEditModal';
import { IOSShareSheet } from '../../components/UI';
import { ShareBottomSheet } from './modals/ShareBottomSheet';

// ============================================================================
// 9.3 專屬：雙向兩段式極限位移手勢卡片 (SwipeableWishCard)
// ============================================================================
const SwipeableWishCard: React.FC<{
    wish: WishItem;
    isAssigned: boolean;
    onToggleCheck: () => void;
    onDelete: () => void;
    onAssign: () => void;
    onRollback: () => void;
}> = ({ wish, isAssigned, onToggleCheck, onDelete, onAssign, onRollback }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [currentAnchor, setCurrentAnchor] = useState<'none' | 'left' | 'right'>('none');
    
    const startXRef = useRef(0);
    const touchStartOffsetRef = useRef(0);

    const ANCHOR_WIDTH = 70;      // 舒適停靠錨點
    const COMFORT_LIMIT = 60;     // 觸發卡定臨界值
    const EXPRESS_LIMIT = 130;    // 觸發一滑到底直接擊殺臨界值
    const MAX_SHIELD_EXTENT = 110; // 物理橡皮筋最大極限位移

    const handleTouchStart = (e: React.TouchEvent) => {
        startXRef.current = e.touches[0].clientX;
        // 記憶目前的起跑點偏移量，防禦再次滑動時的視覺瞬移跳動
        touchStartOffsetRef.current = offsetX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const currentX = e.touches[0].clientX;
        const rawDiff = currentX - startXRef.current;
        let targetOffset = touchStartOffsetRef.current + rawDiff;

        // 🛡️ 安全防禦防線：若已指派，封鎖右滑指派功能
        if (isAssigned && targetOffset > 0) {
            targetOffset = 0;
        }

        // 🧬 注入高階橡皮筋阻尼演算法
        if (targetOffset > ANCHOR_WIDTH) {
            const overExtent = targetOffset - ANCHOR_WIDTH;
            targetOffset = ANCHOR_WIDTH + overExtent * 0.25; // 超過舒適區，阻尼衰減
            if (targetOffset > MAX_SHIELD_EXTENT) targetOffset = MAX_SHIELD_EXTENT;
        } else if (targetOffset < -ANCHOR_WIDTH) {
            const overExtent = -targetOffset - ANCHOR_WIDTH;
            targetOffset = -ANCHOR_WIDTH - overExtent * 0.25;
            if (targetOffset < -MAX_SHIELD_EXTENT) targetOffset = -MAX_SHIELD_EXTENT;
        }

        setOffsetX(targetOffset);
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        const absOffset = Math.abs(offsetX);

        // 宇宙一：超越極致臨界值，發動直達擊殺 / 直接指派
        if (absOffset >= EXPRESS_LIMIT) {
            if (offsetX < 0) {
                if (isAssigned) onRollback(); else onDelete();
            } else {
                if (!isAssigned) onAssign();
            }
            setOffsetX(0);
            setCurrentAnchor('none');
            return;
        }

        // 宇宙二：雙向兩段式卡定清算邏輯
        if (offsetX <= -COMFORT_LIMIT) {
            // 左滑停靠成功
            setOffsetX(-ANCHOR_WIDTH);
            setCurrentAnchor('left');
        } else if (offsetX >= COMFORT_LIMIT && !isAssigned) {
            // 右滑停靠成功
            setOffsetX(ANCHOR_WIDTH);
            setCurrentAnchor('right');
        } else {
            // 未達標準，全數回彈歸零
            setOffsetX(0);
            setCurrentAnchor('none');
        }
    };

    // 點擊本體彈回反悔機制
    const handleCardClick = () => {
        if (currentAnchor !== 'none') {
            setOffsetX(0);
            setCurrentAnchor('none');
        }
    };

    const isChecked = wish.isPurchased || isAssigned;
    const textStyle = isChecked ? 'line-through opacity-40 text-gray-400 font-normal' : 'font-bold text-[#1D1D1B]';

    return (
        <div className="relative w-full overflow-hidden rounded-2xl mb-2 bg-gray-100/50 select-none">
            {/* 底層雙向動作托盤 */}
            <div className="absolute inset-0 flex justify-between items-center px-4">
                {/* 左側底層：右滑指派 */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onAssign(); }}
                    className={`flex items-center gap-2 font-black text-xs text-[#45846D] h-full transition-all duration-200 ${offsetX > 20 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                >
                    <PlusCircle className="w-4 h-4" /> 指派行程
                </button>
                {/* 右側底層：左滑移除 / 抽離 */}
                <button 
                    onClick={(e) => { e.stopPropagation(); if (isAssigned) onRollback(); else onDelete(); }}
                    className={`flex items-center gap-2 font-black text-xs text-red-500 h-full transition-all duration-200 ${offsetX < -20 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                >
                    {isAssigned ? <Undo className="w-4 h-4"/> : <Trash2 className="w-4 h-4"/>}
                    {isAssigned ? '抽離行程' : '移除項目'}
                </button>
            </div>

            {/* 表層卡片本體 */}
            <div
                onClick={handleCardClick}
                className={`relative bg-white p-3 shadow-sm border border-transparent flex items-center gap-3 ${currentAnchor !== 'none' ? 'cursor-pointer' : ''}`}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* 極簡空心勾選圓圈 */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
                    className={`w-5 h-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 ${wish.isPurchased ? 'bg-[#45846D] border-[#45846D]' : 'border-gray-300 bg-transparent'}`}
                >
                    <Check className={`w-3 h-3 text-white transition-opacity duration-300 ${wish.isPurchased ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                </button>

                {/* 文字與預算資訊 */}
                <div className="flex-1 min-w-0 pointer-events-none">
                    <h4 className={`text-sm truncate transition-all duration-300 ${textStyle}`}>
                        {wish.title}
                    </h4>
                    <div className={`flex items-center gap-2 mt-0.5 transition-all duration-300 ${isChecked ? 'opacity-40' : 'opacity-100'}`}>
                        {wish.area && <span className="text-[10px] text-gray-400 truncate font-medium">{wish.area}</span>}
                        {wish.budget && (
                            <span className="text-[10px] font-bold text-gray-600 font-mono">
                                {wish.currency || 'TWD'} {wish.budget.toLocaleString()}
                            </span>
                        )}
                    </div>
                    {isAssigned && (
                        <span className="inline-block mt-1 text-[9px] font-black tracking-wider text-[#45846D] bg-[#45846D]/10 px-1.5 py-0.5 rounded uppercase">
                            ✓ 已排入 DAY {wish.assignedDay}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export interface TripTodoItem {
    id: string;
    text: string;
    isCompleted: boolean;
    time?: string;
    date?: string;
    category?: 'tasks' | 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';
}

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
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-[#45846D]/20"></div></div>
            <div className="relative z-10 bg-[#45846D] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md tracking-wider flex items-center gap-1">
                {isTripEnd ? 'END' : 'FINISH'}
            </div>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-[#45846D]/40 via-[#45846D]/20 to-transparent border-t border-dashed border-[#45846D]/0"></div>
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
    <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[160px] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-gray-400 bg-gray-50/50 transition-all hover:bg-white hover:border-[#45846D]/30 group">
        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
            <Map className="w-8 h-8 text-gray-300 group-hover:text-[#45846D] transition-colors" />
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
    onBack: () => void;
    onDelete: () => void;
    onUpdateTrip: (t: Trip) => void;
    onRefreshVault?: () => void; 
    onLocalFileUpdate?: (file: Partial<VaultFile>) => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ 
    trip, 
    folders = [], 
    files = [], 
    documents = [], 
    user,
    onBack, 
    onDelete, 
    onUpdateTrip,
    onRefreshVault,
    onLocalFileUpdate
}) => {
    const currentUser: User = user || {
        id: 'me',
        name: '我',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Kelvin',
        joinedDate: new Date().toISOString()
    };

    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
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
    const [actionStagedWish, setActionStagedWish] = useState<WishItem | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    const currentTodos: TripTodoItem[] = (trip as any).todos || DEFAULT_TODOS;
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
    const currencyCode = trip.currency || 'TWD';
    const incompleteTodosCount = currentTodos.filter(t => !t.isCompleted).length;

    const shoppingBudgetStats = useMemo(() => {
        const staged = trip.stagedWishes || [];
        const items = staged.filter(w => w.type === 'item');

        const remainingMap: Record<string, number> = {};
        const allocatedMap: Record<string, number> = {};

        items.forEach(w => {
            const cur = w.currency || 'TWD';
            const amt = w.budget || 0;
            if (!w.isPurchased && w.assignedDay === undefined) {
                remainingMap[cur] = (remainingMap[cur] || 0) + amt;
            } else {
                allocatedMap[cur] = (allocatedMap[cur] || 0) + amt;
            }
        });

        const formatCurrencyMap = (map: Record<string, number>) => {
            const entries = Object.entries(map);
            if (entries.length === 0) return '0';
            return entries.map(([cur, amt]) => `${cur} ${amt.toLocaleString()}`).join(' + ');
        };

        return {
            remaining: formatCurrencyMap(remainingMap),
            allocated: formatCurrencyMap(allocatedMap)
        };
    }, [trip.stagedWishes]);

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
                alert("圖片上傳失敗");
            }
        } 
    };

    const handleCurrencyChange = (curr: string) => { onUpdateTrip({ ...trip, currency: curr }); };
    const handleDateUpdate = (newDate: string) => { onUpdateTrip({ ...trip, startDate: newDate }); setIsDateEditOpen(false); };
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

    const handleUnlinkDocument = (docId: string) => {
        if(confirm('確定要從此行程移除這份文件連結嗎？(檔案仍會保留在保管箱中)')) {
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
            if (spot) newAct = spot; else { alert('AI 暫時無法提供靈感'); return; }
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

    const handleTogglePurchase = (wishId: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w =>
            w.id === wishId ? { ...w, isPurchased: !w.isPurchased } : w
        );
        onUpdateTrip(newTrip);
    };

    const handleLocalDeleteWish = (wishId: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.stagedWishes = (newTrip.stagedWishes || []).filter(w => w.id !== wishId);
        onUpdateTrip(newTrip);
        setToastMsg('✕ 已自此行程移除 (未刪除全域靈感收藏)');
        setTimeout(() => setToastMsg(null), 3000);
    };

    const handleInjectWish = (wish: WishItem, dayIndex: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const targetDay = newTrip.days[dayIndex];

        let nextTime = '10:00';
        if (targetDay.activities.length > 0) {
            nextTime = targetDay.activities[targetDay.activities.length - 1].time;
        }

        const newActivity: Activity = {
            id: crypto.randomUUID(),
            time: nextTime,
            title: wish.title,
            description: wish.notes || '',
            type: wish.type === 'item' ? 'shopping' : 'sightseeing',
            location: wish.area || wish.country,
            image: wish.customImage,
            expenseImage: wish.customImage, 
            wishItemId: wish.id,
            cost: wish.type === 'item' ? wish.budget : undefined
        };

        targetDay.activities.push(newActivity);
        newTrip.days[dayIndex] = recalculateTimeline(targetDay);
        
        newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => 
            w.id === wish.id ? { ...w, assignedDay: dayIndex + 1 } : w
        );
        
        onUpdateTrip(newTrip);
        setActionStagedWish(null);
        
        setToastMsg(`✨ 已將「${wish.title}」排入 DAY ${dayIndex + 1}`);
        setTimeout(() => setToastMsg(null), 3000);
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
        setToastMsg('✓ 已抽離行程，恢復至未指派狀態');
        setTimeout(() => setToastMsg(null), 3000);
    };

    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const removedAct = newTrip.days[dayIndex].activities[activityIndex];
        
        if (removedAct.wishItemId) {
            newTrip.stagedWishes = (newTrip.stagedWishes || []).map(w => 
                w.id === removedAct.wishItemId ? { ...w, assignedDay: undefined } : w
            );
        }

        newTrip.days[dayIndex].activities.splice(activityIndex, 1);
        newTrip.days[dayIndex] = recalculateTimeline(newTrip.days[dayIndex]);
        onUpdateTrip(newTrip);
        setSelectedActivity(null); 
    };

    const handleUpdateActivity = (updatedAct: Activity) => {
        if (!selectedActivity) return;
        const { dayIdx, actIdx } = selectedActivity;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[dayIdx].activities[actIdx] = updatedAct;
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
        return (trip.stagedWishes || []).filter(w => w.type === wishTrayTab);
    }, [trip.stagedWishes, wishTrayTab]);

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full block overflow-y-auto relative no-scrollbar">
            
            {/* 置頂大 Banner 區 */}
            <div className={`relative h-72 w-full ${headerBgClass}`}>
                <div className="absolute top-0 left-0 right-0 z-30 p-5 flex justify-between items-start pointer-events-none">
                    <button onClick={onBack} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all pointer-events-auto shadow-sm border border-white/10">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex gap-3 pointer-events-auto">
                        <button onClick={() => setIsShareOpen(true)} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-sm border border-white/10">
                            <Share className="w-5 h-5" />
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-sm border border-white/10">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {trip.coverImage && (
                    <>
                        <img 
                            src={trip.coverImage} 
                            className="w-full h-full object-cover opacity-80" 
                            alt="Cover" 
                            style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1B] via-transparent to-transparent" />
                    </>
                )}
    
                <div className="absolute inset-0 px-6 pt-20 pb-3 flex flex-col justify-end z-20">
                    <div className="absolute top-20 left-6 right-6 pointer-events-none">
                         <div className="flex justify-between items-end border-b border-white/20 pb-4 mb-4">
                            <div><span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">FROM</span><span className="text-5xl font-black font-sans tracking-tight text-white uppercase">{flightDisplayOrigin}</span></div>
                            <div className="mb-2 opacity-80 animate-pulse">{firstType === 'train' ? <Train className="w-8 h-8 text-white" /> : <Plane className="w-8 h-8 text-white" />}</div>
                            <div className="text-right"><span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">TO</span><span className="text-5xl font-black font-sans tracking-tight text-white uppercase">{flightDisplayDest}</span></div>
                        </div>
                    </div>

                    <div className="absolute bottom-3 left-6 right-6 flex items-end justify-between">
                        <div className="flex flex-col gap-2 items-start pointer-events-auto">
                            <GlassCapsule isActive={showVault} onClick={() => { setShowVault(!showVault); setShowExpenses(false); setShowWishTray(false); }} className="text-[10px] sm:text-xs">
                                <Ticket className="w-3.5 h-3.5" /> 憑證 ({linkedDocs.length})
                            </GlassCapsule>
                            <GlassCapsule isActive={showWishTray} onClick={() => { setShowWishTray(true); setShowVault(false); setShowExpenses(false); }} className="text-[10px] sm:text-xs">
                                <Sparkles className="w-3.5 h-3.5" /> 心願盒 ({trip.stagedWishes?.length || 0})
                            </GlassCapsule>
                            <GlassCapsule onClick={() => { setIsRemindersOpen(true); Notification.permission === 'default' && Notification.requestPermission(); }} className="text-[10px] sm:text-xs relative">
                                <ListChecks className="w-3.5 h-3.5" /> 行前提醒
                                {incompleteTodosCount > 0 && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-50 border border-white"></span>
                                    </div>
                                )}
                            </GlassCapsule>
                        </div>
                        <div className="flex items-end pointer-events-auto">
                            <button onClick={() => { setShowExpenses(!showExpenses); setShowVault(false); setShowWishTray(false); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm border border-white/10 backdrop-blur-md ${showExpenses ? 'bg-white text-[#1D1D1B]' : 'bg-black/20 text-white hover:bg-black/30'}`}>
                                <Wallet className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />
            </div>

            {/* 列表 / 地圖切換列 */}
            <div className="sticky top-0 z-40 bg-[#E4E2DD]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm px-5 pt-3 pb-3 transition-all">
                <div className="bg-white/50 p-1 rounded-2xl flex shadow-inner">
                    <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><List className="w-4 h-4" /> 列表</button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 flex-row flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><Map className="w-4 h-4" /> 地圖</button>
                </div>
            </div>

            {/* 行程主體內容區 */}
            <div className="px-5 pb-safe w-full">
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
                                <button onClick={() => setIsDocPickerOpen(true)} className="flex flex-col items-center justify-center gap-2 min-w-[120px] bg-[#45846D]/5 rounded-3xl border-2 border-dashed border-[#45846D]/20 hover:bg-[#45846D]/10 transition-colors shrink-0 h-[190px]">
                                    <div className="w-10 h-10 rounded-full bg-[#45846D] text-white flex items-center justify-center shadow-lg"><Plus className="w-5 h-5" /></div>
                                    <span className="text-xs font-bold text-[#45846D]">連結更多</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-[24px] p-6 text-center border border-white/60 bg-white/40 backdrop-blur-md shadow-sm">
                                <div className="flex flex-col items-center justify-center gap-3">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                                        <Briefcase className="w-6 h-6 text-[#1D1D1B]" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-base text-[#1D1D1B]">尚未加入憑證</h3>
                                        <p className="text-gray-500 text-[11px] leading-relaxed max-w-[200px] mx-auto">建議加入：護照、機票、訂房確認信</p>
                                    </div>
                                    <button onClick={() => setIsDocPickerOpen(true)} className="mt-2 px-5 py-3 bg-[#1D1D1B] text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center gap-2 hover:bg-black hover:shadow-xl">
                                        <PlusCircle className="w-3.5 h-3.5" /> 從保管箱挑選文件
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'list' ? (
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
                                    <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-[#45846D]/20 pb-16">
                                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-[#E4E2DD] shadow-sm transition-colors ${dayInfo.isToday ? 'bg-[#45846D] scale-110' : 'bg-gray-300'}`} />
                                        
                                        <div className="flex justify-between items-end -mt-2 mb-6">
                                            <div className="flex flex-col">
                                                <span className={`text-4xl font-black font-serif tracking-tighter leading-none mb-1 ${dayInfo.isToday ? 'text-[#45846D]' : 'text-[#1D1D1B]'}`}>
                                                    {dayInfo.dateStr}
                                                </span>
                                                <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-bold tracking-[0.15em] uppercase ${dayInfo.isToday ? 'text-[#45846D]' : 'text-gray-400'}`}>
                                                    <span>{dayInfo.weekDay}</span>
                                                    <span className="opacity-30">|</span>
                                                    <span>DAY {day.day}</span>
                                                    
                                                    <button
                                                        onClick={() => setEditingVibeDay(day.day)}
                                                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 hover:bg-gray-200/60 text-gray-600 transition-colors pointer-events-auto normal-case tracking-normal font-sans text-[10px] border border-gray-200/40 shadow-sm active:scale-95"
                                                    >
                                                        {(day as any).vibeTag ? (
                                                            <>
                                                                <span className="text-gray-700 font-bold">{`[ ${(day as any).vibeTag} ]`}</span>
                                                                <span className="text-[9px] opacity-70">✏️</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400/90 font-medium">+ 新增單日主題</span>
                                                        )}
                                                    </button>

                                                    {dayInfo.isToday && (
                                                        <>
                                                            <span className="opacity-30">|</span>
                                                            <span className="flex items-center gap-1.5 text-[#45846D]">
                                                                <span className="relative flex h-1.5 w-1.5">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#45846D] opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#45846D]"></span>
                                                                </span>
                                                                TODAY
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: -1 }); setIsPlusMenuOpen(true); }} className="p-1.5 rounded-full text-[#45846D] bg-[#45846D]/10 hover:bg-[#45846D]/20 mb-1 pointer-events-auto"><Plus className="w-5 h-5" /></button>
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
                    <div className="space-y-6 pb-24 mt-6">
                        {trip.days.map((day) => (
                            <DayRouteCard key={day.day} day={day} startDate={trip.startDate} destination={trip.destination} />
                        ))}
                    </div>
                )}
            </div>
            
            {/* 所有浮層與 Modals */}
            {isDateEditOpen && <SimpleDateEditModal date={trip.startDate} onClose={() => setIsDateEditOpen(false)} onSave={handleDateUpdate} />}
            {isDaysEditOpen && <SimpleDaysEditModal days={trip.days.length} onClose={() => setIsDaysEditOpen(false)} onSave={handleDaysUpdate} />}
            {isSettingsOpen && <TripSettingsModal trip={trip} user={currentUser} onClose={() => setIsSettingsOpen(false)} onUpdate={(updatedTrip: Trip) => { onUpdateTrip(updatedTrip); setIsSettingsOpen(false); }} onDelete={onDelete} />}
            {isAddModalOpen && <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />}
            {selectedActivity && <ActivityDetailModal act={selectedActivity.activity} onClose={() => setSelectedActivity(null)} onSave={handleUpdateActivity} onDelete={() => handleDeleteActivity(selectedActivity.dayIdx, selectedActivity.actIdx)} members={trip.members} initialEdit={selectedActivity.initialEdit} currencySymbol={currencyCode === 'TWD' ? 'NT$' : '$'} />}
            
            {isDocPickerOpen && (
                <DocumentPickerModal documents={documents} folders={folders} files={files} initialSelectedIds={trip.linkedDocumentIds || []} onClose={() => setIsDocPickerOpen(false)} onSave={handleLinkDocuments} />
            )}
            
            {editingDoc && <DocumentEditModal doc={editingDoc} folders={folders} onClose={() => setEditingDoc(null)} onSave={handleDocumentSave} />}
            
            {isRemindersOpen && (
                <TripRemindersModal 
                    todos={currentTodos as any} 
                    onUpdateTodos={(newTodos) => onUpdateTrip({ ...trip, todos: newTodos } as any)} 
                    startDate={trip.startDate}
                    onClose={() => setIsRemindersOpen(false)} 
                />
            )}

            {editingVibeDay !== null && (
                <VibeTagEditModal
                    dayNumber={editingVibeDay}
                    initialValue={(trip.days.find((d: any) => d.day === editingVibeDay) as any)?.vibeTag || ''}
                    onClose={() => setEditingVibeDay(null)}
                    onSave={(newTag) => handleSaveVibeTag(editingVibeDay, newTag)}
                />
            )}

            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} />
            <ShareBottomSheet trip={trip} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
            
            {/* 快速插入選單 */}
            {isPlusMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#1D1D1B]/20 backdrop-blur-sm" onClick={() => setIsPlusMenuOpen(false)} />
                    <div className="bg-white rounded-3xl p-2 shadow-2xl w-full max-w-[200px] animate-in zoom-in-95 relative z-10 flex flex-col gap-1">
                        <p className="text-xs font-bold text-gray-400 text-center py-2 uppercase tracking-wider">插入至行程</p>
                        <button onClick={() => handleQuickAdd('activity')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><MapPin className="w-5 h-5 text-blue-500" /> 新增景點</button>
                        <button onClick={() => handleQuickAdd('transport')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><Bus className="w-5 h-5 text-gray-500" /> 新增交通</button>
                        <button onClick={() => handleQuickAdd('note')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><StickyNote className="w-5 h-5 text-yellow-500" /> 新增備註</button>
                        <button onClick={() => handleQuickAdd('expense')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left text-sm font-bold text-gray-700 transition-colors"><Banknote className="w-5 h-5 text-green-500" /> 快速記帳</button>
                        <div className="h-px bg-gray-100 my-1" />
                        <button onClick={() => handleQuickAdd('ai')} disabled={aiLoading} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#45846D]/5 text-left text-sm font-bold text-[#45846D] transition-colors">
                            {aiLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} AI 靈感推薦
                        </button>
                    </div>
                </div>
            )}

            {/* === 🛡️ 9.3 升級：融合分頁與雙向極限手勢之心願盒面板 === */}
            {showWishTray && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm transition-opacity" onClick={() => setShowWishTray(false)} />
                    <div className="w-full max-w-md bg-[#F2F2F2] rounded-[32px] p-6 relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[75vh]">
                        
                        {/* Header 及 iOS 原生膠囊切換器 */}
                        <div className="shrink-0 pb-3 border-b border-gray-200/60">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-black font-serif text-[#1D1D1B] flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-[#45846D]" /> 靈感心願盒
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
                                    className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-xs font-bold rounded-md transition-colors duration-300 ${wishTrayTab === 'place' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}
                                >
                                    <MapPin className="w-3.5 h-3.5" /> 探索地點
                                </button>
                                <button 
                                    onClick={() => setWishTrayTab('item')}
                                    className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-xs font-bold rounded-md transition-colors duration-300 ${wishTrayTab === 'item' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}
                                >
                                    <ShoppingBag className="w-3.5 h-3.5" /> 購物清單
                                </button>
                            </div>

                            {/* 精品級動態雙金流計量表 */}
                            {wishTrayTab === 'item' && (
                                <div className="bg-white/60 rounded-xl p-3 text-[10px] font-black tracking-wider text-gray-500 flex flex-col gap-1.5 shadow-sm border border-white">
                                    <div className="flex justify-between items-center">
                                        <span>🛍️ 購物尚需預算</span>
                                        <span className="font-mono text-[#1D1D1B] text-xs">{shoppingBudgetStats.remaining}</span>
                                    </div>
                                    <div className="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#45846D] transition-all duration-500" style={{ width: '45%' }}></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5 text-gray-400">
                                        <span>💰 行程已納入花費</span>
                                        <span className="font-mono text-gray-600">{shoppingBudgetStats.allocated}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* 心願項目內容流 */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-safe">
                            {displayedStagedWishes.length === 0 ? (
                                <div className="py-12 border-2 border-dashed border-gray-200 rounded-[24px] flex flex-col items-center justify-center opacity-70">
                                    <Sparkles className="w-8 h-8 text-gray-300 mb-2" />
                                    <p className="text-sm font-bold text-gray-400">此類別目前沒有任何心願</p>
                                    <p className="text-[10px] text-gray-400 mt-1">請前往主分頁收藏新的旅行靈感</p>
                                </div>
                            ) : (
                                <>
                                    {wishTrayTab === 'item' ? (
                                        <div className="flex flex-col gap-5">
                                            {/* A 區：未指派 */}
                                            <div>
                                                <h4 className="text-[10px] font-black text-gray-400 mb-2 tracking-widest uppercase">未指派清單 (滑動：右👉指派 ｜ 左👈移除)</h4>
                                                {displayedStagedWishes.filter(w => w.assignedDay === undefined).length === 0 ? (
                                                    <p className="text-xs text-gray-400 font-medium py-2">目前無未指派之購物清單</p>
                                                ) : (
                                                    displayedStagedWishes.filter(w => w.assignedDay === undefined).map(wish => (
                                                        <SwipeableWishCard
                                                            key={wish.id}
                                                            wish={wish}
                                                            isAssigned={false}
                                                            onToggleCheck={() => handleTogglePurchase(wish.id)}
                                                            onDelete={() => handleLocalDeleteWish(wish.id)}
                                                            onAssign={() => setActionStagedWish(wish)}
                                                            onRollback={() => {}}
                                                        />
                                                    ))
                                                )}
                                            </div>

                                            {/* B 區：已排入行程 */}
                                            {displayedStagedWishes.filter(w => w.assignedDay !== undefined).length > 0 && (
                                                <div>
                                                    <h4 className="text-[10px] font-black text-gray-400 mb-2 tracking-widest uppercase">已排入行程 (左👈滑動可抽離還原)</h4>
                                                    {displayedStagedWishes.filter(w => w.assignedDay !== undefined).map(wish => (
                                                        <SwipeableWishCard
                                                            key={wish.id}
                                                            wish={wish}
                                                            isAssigned={true}
                                                            onToggleCheck={() => handleTogglePurchase(wish.id)}
                                                            onDelete={() => {}}
                                                            onAssign={() => {}}
                                                            onRollback={() => handleRollbackWish(wish.id)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* 地點模式宇宙：維持原本的操作邏輯 */
                                        <div className="flex flex-col gap-3">
                                            {displayedStagedWishes.map(wish => {
                                                const isAssigned = wish.assignedDay !== undefined;
                                                return (
                                                    <div 
                                                        key={wish.id} 
                                                        className={`bg-white rounded-2xl p-3 shadow-sm border border-transparent transition-all flex items-center gap-3
                                                            ${isAssigned ? 'opacity-40 bg-gray-50/50' : 'hover:border-[#45846D]/30'}
                                                        `}
                                                    >
                                                        {wish.customImage ? (
                                                            <img src={wish.customImage} className="w-14 h-14 rounded-xl object-cover shrink-0" alt="" />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                                                                <MapPin className="w-5 h-5 text-gray-300"/>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className={`font-bold text-sm text-[#1D1D1B] truncate ${isAssigned ? 'line-through text-gray-400 font-normal' : ''}`}>
                                                                {wish.title}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {wish.area && <span className="text-[10px] text-gray-400 truncate font-medium">{wish.area}</span>}
                                                            </div>
                                                            {isAssigned && (
                                                                <span className="inline-block mt-1 text-[9px] font-black tracking-wider text-[#45846D] bg-[#45846D]/10 px-1.5 py-0.5 rounded uppercase">
                                                                    已排入 DAY {wish.assignedDay}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {!isAssigned && (
                                                            <button 
                                                                onClick={() => setActionStagedWish(wish)} 
                                                                className="w-9 h-9 shrink-0 rounded-full bg-[#45846D]/10 text-[#45846D] flex items-center justify-center hover:bg-[#45846D] hover:text-white transition-colors active:scale-95"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === 天數指派彈窗 (Sub-Modal) === */}
            {actionStagedWish && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={() => setActionStagedWish(null)} />
                    <div className="bg-white rounded-3xl p-5 shadow-2xl w-full max-w-[260px] animate-in zoom-in-95 relative z-10 flex flex-col gap-2 border border-gray-100">
                        <p className="text-sm font-bold text-[#1D1D1B] text-center mb-3 tracking-wide">排入哪一天的行程？</p>
                        <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2">
                            {trip.days.map((day, idx) => {
                                const dateStr = day.date ? day.date.replace(/-/g, '.') : '';
                                return (
                                    <button 
                                        key={day.day} 
                                        onClick={() => handleInjectWish(actionStagedWish, idx)} 
                                        className="w-full py-3.5 rounded-xl bg-gray-50 hover:bg-[#45846D] text-gray-700 hover:text-white font-bold text-sm transition-all border border-transparent shadow-sm flex items-center justify-center gap-2 active:scale-95"
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

            {/* === 全域 Toast 提示 === */}
            {toastMsg && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
                    <div className="bg-[#1D1D1B]/90 backdrop-blur-md px-5 py-3 rounded-full text-white text-[11px] font-bold tracking-widest shadow-2xl border border-white/20 whitespace-nowrap">
                        {toastMsg}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItineraryView;