import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, List, Map, Plus, Settings, 
    Train, Plane, Ticket, Wallet, 
    MapPin, Bus, StickyNote, Banknote, RefreshCw, Sparkles, 
    Briefcase, PlusCircle, Share, ListChecks 
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { Trip, TripDay, Activity, Document, VaultFolder, VaultFile, User } from '../../types'; 
import { suggestNextSpot } from '../../services/gemini';
import { recalculateTimeline } from '../../services/timeline';

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
import { TripRemindersModal, type TodoItem } from './modals/TripRemindersModal'; 

import { IOSShareSheet } from '../../components/UI';

// --- Default Checklist Data ---
const DEFAULT_TODOS: TodoItem[] = [
    { id: '1', text: '預訂來回機票', isCompleted: false },
    { id: '2', text: '預訂住宿飯店', isCompleted: false },
    { id: '3', text: '檢查護照效期 (需6個月以上)', isCompleted: false },
    { id: '4', text: '購買旅遊保險', isCompleted: false },
    { id: '5', text: '購買當地網卡 / 開通漫遊', isCompleted: false },
    { id: '6', text: '線上預辦登機', isCompleted: false, time: '24:00' }, 
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

// --- Main Component ---

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
    // User Fallback
    const currentUser: User = user || {
        id: 'me',
        name: '我',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Kelvin',
        joinedDate: new Date().toISOString()
    };
    
    // UI States
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDateEditOpen, setIsDateEditOpen] = useState(false);
    const [isDaysEditOpen, setIsDaysEditOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
    const [isRemindersOpen, setIsRemindersOpen] = useState(false); 
    const [editingDoc, setEditingDoc] = useState<(Document & { folderName?: string }) | null>(null);

    // Data States
    const [todos, setTodos] = useState<TodoItem[]>(DEFAULT_TODOS); 
    
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

    // Notification Logic Ref
    const notifiedRef = useRef<Set<string>>(new Set());

    const currencyCode = trip.currency || 'TWD';
    
    // Helpers
    const incompleteTodosCount = todos.filter(t => !t.isCompleted).length;

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

    // --- Notification Engine (背景通知監聽器) ---
    useEffect(() => {
        const checkNotifications = () => {
            if (Notification.permission !== 'granted') return;

            const now = new Date();
            const currentYYYYMMDD = now.toISOString().split('T')[0];
            const currentHHMM = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            todos.forEach(todo => {
                if (!todo.isCompleted && todo.date && todo.time) {
                    if (todo.date === currentYYYYMMDD && todo.time === currentHHMM) {
                        const notificationKey = `${todo.id}-${currentYYYYMMDD}-${currentHHMM}`;
                        if (!notifiedRef.current.has(notificationKey)) {
                            new Notification(`🔔 行前提醒：${todo.text}`, {
                                body: `時間到了！記得處理您的待辦事項。`,
                                icon: '/icon-192x192.png'
                            });
                            notifiedRef.current.add(notificationKey);
                        }
                    }
                }
            });
        };
        const intervalId = setInterval(checkNotifications, 15000);
        return () => clearInterval(intervalId);
    }, [todos]);

    const requestNotificationPermission = () => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => onUpdateTrip({ ...trip, coverImage: reader.result as string }); reader.readAsDataURL(file); } };
    const handleCurrencyChange = (curr: string) => { onUpdateTrip({ ...trip, currency: curr }); };
    const handleShare = () => { const liteTrip = { ...trip, coverImage: '' }; setShareUrl(`${window.location.origin}${window.location.pathname}?import=${btoa(unescape(encodeURIComponent(JSON.stringify(liteTrip))))}`); setShareOpen(true); };
    
    const handleDateUpdate = (newDate: string) => { onUpdateTrip({ ...trip, startDate: newDate }); setIsDateEditOpen(false); };
    
    const handleDaysUpdate = (newDaysCount: number) => {
        let newDays = [...trip.days];
        if (newDaysCount > trip.days.length) { for (let i = trip.days.length + 1; i <= newDaysCount; i++) newDays.push({ day: i, activities: [] });
        } else { newDays = newDays.slice(0, newDaysCount); }
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
    
    const handleDocumentSave = (updatedDoc: Partial<VaultFile>) => {
        if (onLocalFileUpdate) { onLocalFileUpdate(updatedDoc); }
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
            if (['note', 'expense', 'transport'].includes(type)) { setSelectedActivity({ dayIdx, actIdx: insertIdx, activity: newAct, initialEdit: true }); }
        }
    };

    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[dayIndex].activities.splice(activityIndex, 1);
        newTrip.days[dayIndex] = recalculateTimeline(newTrip.days[dayIndex]);
        onUpdateTrip(newTrip);
        setSelectedActivity(null); 
    }

    const handleUpdateActivity = (updatedAct: Activity) => {
        if (!selectedActivity) return;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[selectedActivity.dayIdx].activities[selectedActivity.actIdx] = updatedAct;
        newTrip.days[selectedActivity.dayIdx] = recalculateTimeline(newTrip.days[selectedActivity.dayIdx]);
        onUpdateTrip(newTrip);
        setSelectedActivity(null);
    }

    const getDateInfo = (startDate: string, dayOffset: number) => {
        if (!startDate) return { dateStr: '--.--', weekDay: '---', isToday: false };
        const [y, m, d] = startDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + dayOffset);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const weekDay = date.toLocaleDateString('en-US', { weekday: 'short' });
        const today = new Date();
        today.setHours(0,0,0,0);
        const isToday = date.getTime() === today.getTime();
        return { dateStr: `${mm}.${dd}`, weekDay, isToday };
    };

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full block overflow-y-auto relative no-scrollbar">
            
            <div className={`relative h-72 w-full ${headerBgClass}`}>
                <div className="absolute top-0 left-0 right-0 z-30 p-5 flex justify-between items-start pointer-events-none">
                    <button onClick={onBack} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all pointer-events-auto shadow-sm border border-white/10"><ArrowLeft className="w-6 h-6" /></button>
                    <div className="flex gap-3 pointer-events-auto">
                        <button onClick={handleShare} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-sm border border-white/10"><Share className="w-5 h-5" /></button>
                        <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-sm border border-white/10"><Settings className="w-5 h-5" /></button>
                    </div>
                </div>

                {(firstType !== 'flight' && firstType !== 'train') && (
                    <>
                        <img src={trip.coverImage} className="w-full h-full object-cover opacity-80" alt="Cover" />
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

                    <div className="mt-auto relative z-30 flex items-end justify-between">
                        {/* 左側資訊列 (Vertical Stack) */}
                        <div className="flex flex-col gap-2 items-start">
                            {/* 1. 憑證按鈕 (TOP) */}
                            <GlassCapsule isActive={showVault} onClick={() => { setShowVault(!showVault); setShowExpenses(false); }} className="text-[10px] sm:text-xs">
                                <Ticket className="w-3.5 h-3.5" /> 
                                憑證 ({linkedDocs.length})
                            </GlassCapsule>

                            {/* 2. 行前提醒按鈕 (BOTTOM) */}
                            <GlassCapsule onClick={() => { setIsRemindersOpen(true); requestNotificationPermission(); }} className="text-[10px] sm:text-xs relative">
                                <ListChecks className="w-3.5 h-3.5" /> 
                                行前提醒
                                {incompleteTodosCount > 0 && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-white"></span>
                                    </div>
                                )}
                            </GlassCapsule>
                        </div>

                        {/* 右側工具 (錢包) */}
                        <div className="flex items-end">
                            <button 
                                onClick={() => { setShowExpenses(!showExpenses); setShowVault(false); }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm border border-white/10 backdrop-blur-md ${showExpenses ? 'bg-white text-[#1D1D1B]' : 'bg-black/20 text-white hover:bg-black/30'}`}
                            >
                                <Wallet className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />
            </div>

            <div className="sticky top-0 z-40 bg-[#E4E2DD]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm px-5 pt-3 pb-3 transition-all">
                <div className="bg-white/50 p-1 rounded-2xl flex shadow-inner">
                    <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><List className="w-4 h-4" /> 列表</button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><Map className="w-4 h-4" /> 地圖</button>
                </div>
            </div>

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
                                <button 
                                    onClick={() => setIsDocPickerOpen(true)}
                                    className="flex flex-col items-center justify-center gap-2 min-w-[120px] bg-[#45846D]/5 rounded-3xl border-2 border-dashed border-[#45846D]/20 hover:bg-[#45846D]/10 transition-colors shrink-0 h-[190px]"
                                >
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
                                    <button 
                                        onClick={() => setIsDocPickerOpen(true)}
                                        className="mt-2 px-5 py-3 bg-[#1D1D1B] text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center gap-2 hover:bg-black hover:shadow-xl"
                                    >
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
                                                <div className={`flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase ${dayInfo.isToday ? 'text-[#45846D]' : 'text-gray-400'}`}>
                                                    <span>{dayInfo.weekDay}</span>
                                                    <span className="opacity-30">|</span>
                                                    <span>DAY {day.day}</span>
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
                                            <button onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: -1 }); setIsPlusMenuOpen(true); }} className="p-1.5 rounded-full text-[#45846D] bg-[#45846D]/10 hover:bg-[#45846D]/20 mb-1"><Plus className="w-5 h-5" /></button>
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
                    todos={todos} 
                    onUpdateTodos={setTodos} 
                    startDate={trip.startDate}
                    onClose={() => setIsRemindersOpen(false)} 
                />
            )}

            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} />
            
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
        </div>
    );
};

export default ItineraryView;