import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, ArrowLeftRight, Trash2, Camera, List, Map, Plus, GripVertical, Wallet, 
    Settings, X, Utensils, Bed, Bus, Plane, Tag as TagIcon, 
    RefreshCw, PenTool, Share, Train, Calendar, 
    Car, Footprints, TramFront, Clock, MapPin, ChevronRight, Edit3, Save, ExternalLink,
    StickyNote, Banknote, Sparkles, UserCheck, 
    Check, Loader2, ZoomIn, Receipt,
    ScanLine, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, Copy, BarChart3, Scale, Image as ImageIcon,
    Ticket, Pill, Coffee, MapPin as MapPinIcon, FileText, MoveVertical, Navigation,
    Globe, Bell, FileDown, LogOut
} from 'lucide-react';
import type { Trip, TripDay, Activity, Member, ExpenseItem } from '../types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { IOSInput, IOSShareSheet } from '../components/UI';
import { getCurrencyRate, suggestNextSpot } from '../services/gemini';
import { recalculateTimeline } from '../services/timeline';

// ============================================================================
// 1. Constants & Types
// ============================================================================

const CURRENCY_SYMBOLS = {
    'TWD': 'NT$', 'USD': '$', 'JPY': '¥', 'KRW': '₩', 'EUR': '€', 'CNY': '¥', 'HKD': 'HK$'
} as const;

type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
    'TWD': '新台幣', 'USD': '美金', 'JPY': '日圓', 'KRW': '韓元', 'EUR': '歐元', 'CNY': '人民幣', 'HKD': '港幣'
};

const CATEGORIES = [
    // --- 一般消費活動 ---
    { id: 'food', label: '美食', icon: Utensils, tagClass: 'bg-orange-100 text-orange-600 border-orange-200', chartClass: 'bg-orange-500' },
    { id: 'commute', label: '交通費', icon: Car, tagClass: 'bg-blue-100 text-blue-600 border-blue-200', chartClass: 'bg-blue-500' }, 
    { id: 'shopping', label: '購物', icon: TagIcon, tagClass: 'bg-pink-100 text-pink-600 border-pink-200', chartClass: 'bg-pink-500' },
    { id: 'sightseeing', label: '景點', icon: Camera, tagClass: 'bg-indigo-100 text-indigo-600 border-indigo-200', chartClass: 'bg-indigo-500' },
    { id: 'hotel', label: '住宿', icon: Bed, tagClass: 'bg-purple-100 text-purple-600 border-purple-200', chartClass: 'bg-purple-500' },
    { id: 'gift', label: '伴手禮', icon: TagIcon, tagClass: 'bg-rose-100 text-rose-600 border-rose-200', chartClass: 'bg-rose-500' },
    { id: 'bar', label: '酒吧', icon: Utensils, tagClass: 'bg-violet-100 text-violet-600 border-violet-200', chartClass: 'bg-violet-500' },
    { id: 'activity', label: '體驗', icon: Sparkles, tagClass: 'bg-cyan-100 text-cyan-600 border-cyan-200', chartClass: 'bg-cyan-500' },
    { id: 'tickets', label: '票券', icon: Ticket, tagClass: 'bg-sky-100 text-sky-600 border-sky-200', chartClass: 'bg-sky-500' },
    { id: 'snacks', label: '點心', icon: Coffee, tagClass: 'bg-amber-100 text-amber-600 border-amber-200', chartClass: 'bg-amber-500' },
    { id: 'health', label: '藥妝', icon: Pill, tagClass: 'bg-teal-100 text-teal-600 border-teal-200', chartClass: 'bg-teal-500' },
    { id: 'expense', label: '一般支出', icon: Banknote, tagClass: 'bg-green-100 text-green-600 border-green-200', chartClass: 'bg-green-500' },
    { id: 'other', label: '其他', icon: Banknote, tagClass: 'bg-gray-100 text-gray-600 border-gray-200', chartClass: 'bg-gray-400' },
    
    // --- 系統特殊功能 ---
    { id: 'transport', label: '移動', icon: Bus, tagClass: 'bg-gray-100 text-gray-600', chartClass: 'bg-gray-400', isSystem: true }, 
    { id: 'flight', label: '航班', icon: Plane, tagClass: 'bg-emerald-100 text-emerald-600', chartClass: 'bg-emerald-500', isSystem: true },
    { id: 'note', label: '備註', icon: StickyNote, tagClass: 'bg-yellow-100 text-yellow-600', chartClass: 'bg-yellow-500', isSystem: true },
    { id: 'process', label: '程序', icon: UserCheck, tagClass: 'bg-slate-100 text-slate-600', chartClass: 'bg-slate-500', isSystem: true },
];

const parseCost = (costStr?: string | number): number => {
    if (costStr === undefined || costStr === null || costStr === '') return 0;
    if (typeof costStr === 'number') return costStr;
    const cleanStr = costStr.toString().replace(/,/g, '');
    const match = cleanStr.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
    return 0;
};

// ============================================================================
// 2. Helper Functions
// ============================================================================

const getMemberName = (members: Member[] | undefined, id?: string) => {
    if (!members || !id) return '我';
    const m = members.find(m => m.id === id);
    return m ? m.name : '我';
};

const getMemberAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const isSystemType = (type: string) => {
    const cat = CATEGORIES.find(c => c.id === type);
    return cat ? !!cat.isSystem : false;
};

// ============================================================================
// 3. UI Components
// ============================================================================

// 毛玻璃按鈕基礎樣式
const GlassCapsule: React.FC<{ 
    onClick?: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    className?: string;
}> = ({ onClick, isActive, children, className = '' }) => {
    const activeClass = isActive 
        ? 'bg-[#45846D] text-white border-transparent shadow-md transform scale-105' 
        : 'bg-black/30 backdrop-blur-md border-white/20 text-white hover:bg-black/40'; 

    return (
        <button 
            onClick={onClick} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border active:scale-95 ${activeClass} ${className}`}
        >
            {children}
        </button>
    );
};

// 顯示地點超連結的元件 (用於 Detail Modal)
const LocationLink: React.FC<{ location?: string }> = ({ location }) => {
    if (!location) return null;
    return (
        <a 
            href={`http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(location)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} 
            className="flex items-center gap-1 text-sm font-bold text-[#45846D] hover:underline mt-1 w-fit group py-1"
        >
            <MapPinIcon className="w-4 h-4 fill-current" />
            <span className="truncate max-w-[250px]">{location}</span>
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
    );
};

// iOS 風格輕量級編輯 Modal 容器
const LightweightModal: React.FC<{ title: string, onClose: () => void, onSave: () => void, children: React.ReactNode }> = ({ title, onClose, onSave, children }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="bg-white w-full max-w-xs rounded-[32px] p-6 relative z-10 shadow-2xl animate-in zoom-in-95 scale-100">
            <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-[#1D1D1B]">{title}</h3>
            </div>
            <div className="mb-6">
                {children}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onClose} className="py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm">取消</button>
                <button onClick={onSave} className="py-3 rounded-xl bg-[#45846D] text-white font-bold text-sm shadow-md active:scale-95 transition-transform">儲存</button>
            </div>
        </div>
    </div>
);

const TimePickerWheel: React.FC<{ value: string, onChange: (val: string) => void, onClose: () => void }> = ({ value, onChange, onClose }) => {
    const [hour, setHour] = useState(parseInt(value.split(':')[0] || '9'));
    const [minute, setMinute] = useState(parseInt(value.split(':')[1] || '0'));
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (hourRef.current) hourRef.current.scrollTop = hour * 40;
        if (minuteRef.current) minuteRef.current.scrollTop = minute * 40;
    }, []);

    const handleScroll = (type: 'hour' | 'minute', e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const index = Math.round(target.scrollTop / 40);
        if (type === 'hour') setHour(index);
        else setMinute(index);
    };

    const handleConfirm = () => {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        onChange(`${h}:${m}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-t-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={onClose} className="text-gray-400 font-bold text-sm">取消</button>
                    <span className="text-lg font-bold text-[#1D1D1B]">選擇時間</span>
                    <button onClick={handleConfirm} className="text-[#45846D] font-bold text-sm">確認</button>
                </div>
                <div className="relative h-40 flex justify-center gap-4 overflow-hidden mask-gradient-to-b">
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-10 bg-gray-100/50 rounded-lg pointer-events-none border-y border-gray-200/50" />
                    <div ref={hourRef} onScroll={(e) => handleScroll('hour', e)} className="w-20 h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar text-center py-[60px]">
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} className={`h-10 flex items-center justify-center snap-center text-xl font-mono transition-all duration-100 ${i === hour ? 'font-black text-[#1D1D1B] scale-110' : 'text-gray-300 scale-90'}`}>{i.toString().padStart(2, '0')}</div>
                        ))}
                        <div className="h-[60px]" />
                    </div>
                    <div className="flex items-center pb-1 font-bold text-gray-300">:</div>
                    <div ref={minuteRef} onScroll={(e) => handleScroll('minute', e)} className="w-20 h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar text-center py-[60px]">
                        {Array.from({ length: 60 }).map((_, i) => (
                            <div key={i} className={`h-10 flex items-center justify-center snap-center text-xl font-mono transition-all duration-100 ${i === minute ? 'font-black text-[#1D1D1B] scale-110' : 'text-gray-300 scale-90'}`}>{i.toString().padStart(2, '0')}</div>
                        ))}
                        <div className="h-[60px]" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Tag: React.FC<{ type: string }> = ({ type }) => {
    const cat = CATEGORIES.find(c => c.id === type) || CATEGORIES.find(c => c.id === 'other');
    const Icon = cat?.icon || TagIcon;
    const tagClass = cat?.tagClass || 'bg-gray-100 text-gray-600';
    const label = cat?.label || type;

    return (
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1 w-fit ${tagClass} bg-opacity-10 text-opacity-100`}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
};

const GhostInsertButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="h-6 -my-3 relative group z-10 flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <div className="absolute inset-0 bg-transparent" />
        <div className="w-[2px] h-full bg-[#45846D] opacity-0 group-hover:opacity-100 transition-opacity absolute left-[26px]" />
        <div className="w-6 h-6 rounded-full bg-[#45846D] text-white flex items-center justify-center shadow-md transform scale-0 group-hover:scale-100 transition-all absolute left-[15px]">
            <Plus className="w-4 h-4" />
        </div>
    </div>
);

const CurrentTimeIndicator: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setTimeout(() => {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500); 
    }, []);

    return (
        <div ref={ref} className="relative flex items-center gap-3 my-6 animate-in fade-in slide-in-from-left duration-700">
            <div className="w-[55px] flex justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-full h-px bg-rose-200"></div>
                </div>
                <div className="relative z-10 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg ring-2 ring-white tracking-wider flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5 fill-current" /> NOW
                </div>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-rose-400 via-rose-300 to-transparent border-t border-dashed border-rose-300/0"></div>
        </div>
    );
};

const EmptyDayPlaceholder: React.FC<{ provided: any }> = ({ provided }) => {
    return (
        <div 
            ref={provided.innerRef} 
            {...provided.droppableProps}
            className="min-h-[160px] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-gray-400 bg-gray-50/50 transition-all hover:bg-white hover:border-[#45846D]/30 group"
        >
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Map className="w-8 h-8 text-gray-300 group-hover:text-[#45846D] transition-colors" />
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">這天還是空的</p>
            <p className="text-xs opacity-60">從側邊欄加入行程，或把別天的行程拖曳過來吧！</p>
            <div className="hidden">{provided.placeholder}</div>
        </div>
    );
};

// ============================================================================
// 4. List Items
// ============================================================================

const ProcessItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`relative flex items-center py-2 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative"><div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div></div>
            <div className="flex-1 flex items-center">
                <div className="bg-slate-100 border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer hover:bg-slate-200">
                    <UserCheck className="w-4 h-4 text-slate-500" /><span className="text-xs font-bold text-slate-700">{act.title}</span><div className="w-px h-3 bg-slate-300 mx-1"></div><span className="text-xs font-mono text-slate-500">{detail?.duration || '60 min'}</span>
                </div>
                <div {...provided.dragHandleProps} className="text-transparent group-hover:text-gray-300 p-2 ml-auto" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
            </div>
        </div>
    );
};

const TransportConnectorItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    const getIcon = () => {
        const m = detail?.mode || 'bus';
        if (m.includes('train') || m.includes('subway')) return <Train className="w-4 h-4" />;
        if (m.includes('walk')) return <Footprints className="w-4 h-4" />;
        if (m.includes('car') || m.includes('taxi')) return <Car className="w-4 h-4" />;
        if (m.includes('tram')) return <TramFront className="w-4 h-4" />;
        if (m.includes('flight')) return <Plane className="w-4 h-4" />;
        return <Bus className="w-4 h-4" />;
    };
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`relative flex items-center gap-3 py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div>
                <div className="relative z-10 bg-gray-100 border-2 border-white text-gray-500 rounded-full p-1.5 shadow-sm mt-2">{getIcon()}</div>
            </div>
            <div className="flex-1 bg-gray-50/80 rounded-xl p-3 border border-gray-200/50 flex items-center justify-between gap-3 backdrop-blur-sm active:scale-[0.98] transition-transform cursor-pointer hover:bg-gray-100/80 overflow-hidden">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{detail?.mode || 'Transport'}</span>
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />{detail?.duration || '15 min'}</span>
                    </div>
                    {(detail?.fromStation || detail?.toStation) ? (
                        <div className="text-xs text-gray-800 font-bold flex flex-wrap items-center gap-1 min-w-0">
                            <span className="truncate max-w-[40%]">{detail.fromStation || '起點'}</span><ArrowLeftRight className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="truncate max-w-[40%]">{detail.toStation || '終點'}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-800 font-medium truncate">{detail?.instruction || act.description || '移動至下個地點'}</div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0"><ChevronRight className="w-4 h-4 text-gray-300" /><div {...provided.dragHandleProps} className="text-gray-300 p-1" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div></div>
            </div>
        </div>
    );
};

const NoteItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any }> = ({ act, onClick, provided, snapshot }) => {
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`flex gap-3 py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] pt-2"><StickyNote className="w-4 h-4 text-yellow-400" /></div>
            <div className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-100 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                <div className="min-w-0"><h4 className="font-bold text-yellow-800 text-sm truncate">{act.title || '備註'}</h4><p className="text-xs text-yellow-600/80 truncate">{act.description || '點擊編輯內容...'}</p></div>
                <div {...provided.dragHandleProps} className="text-yellow-300 p-1" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
            </div>
        </div>
    );
};

const ExpensePolaroid: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string, members?: Member[] }> = ({ act, onClick, provided, snapshot, currencySymbol, members }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : '0';
    const payerName = getMemberName(members, act.payer);
    const avatarColor = getMemberAvatarColor(payerName);
    const category = CATEGORIES.find(c => c.id === act.type) || CATEGORIES.find(c => c.id === 'expense');

    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`flex gap-3 py-2 group ${snapshot.isDragging ? 'z-50 scale-[1.02]' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative pt-2">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-200 left-1/2 -ml-[1px] -z-10"></div>
                {/* 根據類別顯示不同的左側圖示 */}
                <div className={`w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm z-10 text-xs font-bold ${category?.tagClass.replace('bg-', 'text-').replace('100', '500')}`}>
                    {category?.icon ? <category.icon className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                </div>
            </div>
            <div className="flex-1 bg-white p-3 pb-4 rounded-sm shadow-md border border-gray-100 rotate-1 transition-transform hover:rotate-0 active:scale-[0.98] cursor-pointer relative overflow-hidden group/card">
                <div {...provided.dragHandleProps} className="absolute top-2 left-2 z-20 text-white/80 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 bg-black/20 backdrop-blur-sm rounded-full" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
                
                {/* 照片顯示區塊 */}
                <div className="h-40 w-full bg-gray-100 mb-3 rounded-sm overflow-hidden relative border border-gray-100">
                    {act.expenseImage ? 
                        <img 
                            src={act.expenseImage} 
                            alt="Receipt" 
                            className="w-full h-full object-cover" 
                            style={{ objectPosition: `center ${act.imagePositionY ?? 50}%` }} // 讀取裁切位置
                        /> : 
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 pattern-dots"><Camera className="w-8 h-8 opacity-30 mb-1" /><span className="text-[10px] font-bold opacity-30">無照片</span></div>
                    }
                    {/* 右上角顯示付款人 */}
                    <div className={`absolute top-2 right-2 ${avatarColor} text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border border-white transform rotate-6`}>{payerName} 付款</div>
                </div>

                <div className="flex justify-between items-end px-1">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="font-handwriting font-bold text-gray-800 text-lg leading-none mb-1 truncate">{act.title || category?.label || '新項目'}</div>
                        <div className="flex items-center gap-2">
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">{act.time} {act.items && act.items.length > 0 && <span className="bg-gray-100 px-1 rounded text-gray-500">{act.items.length} 筆明細</span>}</div>
                            {category && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${category.tagClass}`}>{category.label}</span>}
                        </div>
                    </div>
                    <div className="text-right"><div className="font-mono font-bold text-xl text-green-600">{currencySymbol}{displayCost}</div></div>
                </div>
            </div>
        </div>
    );
};

// [條列式版型] 適用於：一般行程
const ActivityItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : null;
    const category = CATEGORIES.find(c => c.id === act.type);

    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col gap-2 group relative cursor-pointer active:scale-[0.98] transition-all hover:shadow-md ${snapshot.isDragging ? 'shadow-lg z-50 scale-[1.02]' : ''}`} onClick={onClick}>
            <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1 min-w-[55px]"><span className="text-xs font-bold text-[#1D1D1B] bg-gray-100 px-2 py-1 rounded-md">{act.time}</span></div>
                <div className="flex-1 min-w-0 border-l border-gray-100 pl-4">
                    <h4 className="font-bold text-[#1D1D1B] truncate text-base leading-tight">{act.title}</h4>
                    <div className="flex items-center justify-between mt-2">
                        {category ? <Tag type={act.type} /> : <Tag type="other" />}
                        {displayCost !== null && Number(displayCost) > 0 && <span className="text-xs text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded-md">{currencySymbol} {displayCost}</span>}
                    </div>
                    
                    {/* [List View 不顯示地點連結，保持乾淨] */}
                    
                    {act.description && <p className="text-xs text-gray-500 mt-2 font-medium line-clamp-2 leading-relaxed">{act.description}</p>}
                </div>
                <div {...provided.dragHandleProps} className="flex flex-col justify-between items-end pl-1" onClick={(e) => e.stopPropagation()}><div className="text-gray-300 p-1"><GripVertical className="w-5 h-5" /></div></div>
            </div>
        </div>
    );
};

// ============================================================================
// 5. Modals (Detail, Dashboard, Settings, etc.)
// ============================================================================

const ActivityDetailModal: React.FC<{ 
    act: Activity; 
    onClose: () => void;
    onSave: (updatedAct: Activity) => void; 
    onDelete: () => void; 
    members?: Member[]; 
    initialEdit?: boolean;
    currencySymbol: string; 
}> = ({ act, onClose, onSave, onDelete, members = [], initialEdit = false, currencySymbol }) => {
    const [isEditing, setIsEditing] = useState(initialEdit);
    const [edited, setEdited] = useState<Activity>({ ...act });
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
    const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false); 
    
    // 圖片拖曳位置狀態
    const [imagePositionY, setImagePositionY] = useState(act.imagePositionY ?? 50);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const imageDragStartY = useRef(0);
    const imageStartPos = useRef(50);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    // Stealth Toolbar State
    const [showLocationField, setShowLocationField] = useState(!!act.location);
    const [showNoteField, setShowNoteField] = useState(!!act.description);

    const isSystem = isSystemType(edited.type);
    const isReceiptMode = !isSystem; 
    const isTransport = edited.type === 'transport'; 
    const isNote = edited.type === 'note';
    
    const newItemInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!edited.payer && members.length > 0) {
            setEdited(prev => ({ ...prev, payer: members[0].id }));
        }
    }, []);

    // 儲存圖片位置變更
    useEffect(() => {
        setEdited(prev => ({ ...prev, imagePositionY }));
    }, [imagePositionY]);

    const handleChange = (field: keyof Activity, value: any) => {
        setEdited(prev => ({ ...prev, [field]: value }));
    };

    // 圖片拖曳邏輯
    const handleImageMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isEditing) return;
        setIsDraggingImage(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        imageDragStartY.current = clientY;
        imageStartPos.current = imagePositionY;
    };

    const handleImageMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDraggingImage || !imageContainerRef.current) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - imageDragStartY.current;
        const containerHeight = imageContainerRef.current.clientHeight;
        const percentChange = (deltaY / containerHeight) * 100 * 1.5; 
        
        let newPos = imageStartPos.current - percentChange;
        newPos = Math.max(0, Math.min(100, newPos)); 
        setImagePositionY(newPos);
    };

    const handleImageMouseUp = () => {
        setIsDraggingImage(false);
    };

    const handleTransportDetailChange = (field: string, value: string) => {
        setEdited(prev => ({
            ...prev,
            transportDetail: {
                ...prev.transportDetail,
                mode: prev.transportDetail?.mode || 'bus',
                duration: prev.transportDetail?.duration || '',
                [field]: value
            } as any
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setEdited(prev => ({ ...prev, expenseImage: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const addItem = () => {
        const newItem: ExpenseItem = { id: Date.now().toString(), name: '', amount: 0, assignedTo: [] };
        setEdited(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
        setTimeout(() => newItemInputRef.current?.focus(), 100);
    };

    const updateItem = (id: string, field: keyof ExpenseItem, value: any) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => item.id === id ? { ...item, [field]: value } : item);
            const newTotal = newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            return { ...prev, items: newItems, cost: newTotal };
        });
    };

    const deleteItem = (id: string) => {
        setEdited(prev => {
            const newItems = (prev.items || []).filter(item => item.id !== id);
            const newTotal = newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            return { ...prev, items: newItems, cost: newTotal };
        });
    };

    const toggleItemMember = (itemId: string, memberId?: string) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id !== itemId) return item;
                if (!memberId) return { ...item, assignedTo: [] };
                const current = item.assignedTo || [];
                let newAssigned: string[] = [];
                if (current.includes(memberId)) {
                    newAssigned = current.filter(id => id !== memberId);
                } else {
                    newAssigned = [...current, memberId];
                }
                return { ...item, assignedTo: newAssigned };
            });
            return { ...prev, items: newItems };
        });
    };

    const splitSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        const currentTotal = Number(edited.cost || 0);
        if (edited.items && edited.items.length > 0) {
            edited.items.forEach(item => {
                const amount = Number(item.amount) || 0;
                const splitters = (item.assignedTo && item.assignedTo.length > 0) 
                    ? item.assignedTo 
                    : members.map(m => m.id); 
                
                if (splitters.length > 0) {
                    const share = amount / splitters.length;
                    splitters.forEach(mid => summary[mid] = (summary[mid] || 0) + share);
                }
            });
        } else {
            if (currentTotal > 0) {
                const share = currentTotal / members.length;
                members.forEach(m => summary[m.id] = (summary[m.id] || 0) + share);
            }
        }
        return summary;
    }, [edited.items, edited.cost, members]);

    const activePayerName = getMemberName(members, edited.payer);
    const activePayerAvatarColor = getMemberAvatarColor(activePayerName);
    const currentCategory = CATEGORIES.find(c => c.id === edited.type) || CATEGORIES.find(c => c.id === 'other');

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex-shrink-0 bg-white z-20 px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">{isEditing ? '編輯內容' : '詳情資訊'}</h3>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <button onClick={() => { if(confirm('確定刪除此行程？')) onDelete(); }} className="bg-red-50 p-2 rounded-full text-red-500 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => setIsEditing(true)} className="bg-[#1D1D1B] p-2 rounded-full text-white hover:bg-gray-800 transition-colors shadow-md"><Edit3 className="w-4 h-4" /></button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 text-sm font-bold px-2">取消</button>
                        )}
                        <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[#FAFAFA]" onMouseUp={handleImageMouseUp} onTouchEnd={handleImageMouseUp}>
                    
                    {/* --- RECEIPT STYLE UI (For ALL consumption types) --- */}
                    {isReceiptMode ? (
                        <div className="space-y-4">
                            {/* 1. Hero Photo (Interactive Crop) */}
                            <div 
                                ref={imageContainerRef}
                                className={`relative w-full h-48 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden group transition-colors hover:border-[#45846D]/30 hover:bg-[#45846D]/5 ${isEditing ? 'cursor-ns-resize' : ''}`}
                                onMouseDown={handleImageMouseDown}
                                onMouseMove={handleImageMouseMove}
                                onTouchStart={handleImageMouseDown}
                                onTouchMove={handleImageMouseMove}
                            >
                                {edited.expenseImage ? (
                                    <>
                                        <img 
                                            src={edited.expenseImage} 
                                            className="w-full h-full object-cover pointer-events-none select-none" 
                                            style={{ objectPosition: `center ${imagePositionY}%` }}
                                        />
                                        {!isEditing && <div className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white cursor-pointer hover:bg-black/70 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}><ZoomIn className="w-4 h-4" /></div>}
                                        
                                        {/* Overlay Hint for Editing */}
                                        {isEditing && (
                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg pointer-events-none">
                                                    <MoveVertical className="w-3 h-3" /> 拖曳調整位置
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Change Photo Button (Bottom Right) */}
                                        {isEditing && (
                                            <div className="absolute bottom-2 right-2">
                                                <label className="bg-white/90 hover:bg-white text-[#1D1D1B] text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border border-gray-200 flex items-center gap-1.5 transition-all active:scale-95">
                                                    <Camera className="w-3.5 h-3.5" /> 更換
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                                </label>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    isEditing ? (
                                        <label className="text-gray-400 flex flex-col items-center p-4 text-center cursor-pointer w-full h-full justify-center">
                                            <Camera className="w-10 h-10 opacity-20 mb-2" />
                                            <span className="text-sm font-bold text-[#45846D]">上傳收據 / 照片</span>
                                            <span className="text-[10px] opacity-60 mt-1">點擊上傳</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    ) : <div className="text-gray-300 text-xs py-4">無照片</div>
                                )}
                            </div>

                            {/* 2. Info Row (Time & Category) */}
                            <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {isEditing ? (
                                        <button onClick={() => setShowTimePicker(true)} className="font-mono font-bold text-lg text-[#1D1D1B] border-b border-dotted border-gray-300 hover:text-[#45846D]">{edited.time}</button>
                                    ) : (
                                        <span className="font-mono font-bold text-lg text-[#1D1D1B]">{edited.time}</span>
                                    )}
                                </div>
                                {/* Smart Capsule for Category */}
                                {isEditing ? (
                                    <button 
                                        onClick={() => setIsCategorySheetOpen(true)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${currentCategory?.tagClass.replace('bg-opacity-10 text-opacity-100', '')} border shadow-sm active:scale-95`}
                                    >
                                        {currentCategory?.icon && <currentCategory.icon className="w-3 h-3" />}
                                        {currentCategory?.label}
                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                    </button>
                                ) : (
                                    <Tag type={edited.type} />
                                )}
                            </div>

                            {/* 3. Title Input (Editable) */}
                            <div className="px-1">
                                {isEditing ? (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">名稱</label>
                                        <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} placeholder="項目名稱 (如: 晚餐)" />
                                    </div>
                                ) : (
                                    <div className="font-bold text-xl text-[#1D1D1B] mt-2 mb-1">{edited.title}</div>
                                )}
                            </div>

                            {/* 4. Items List with Per-Item Splitting */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
                                <div className="h-1 bg-[radial-gradient(circle,transparent_0.2rem,#f3f4f6_0.2rem)] bg-[length:0.5rem_0.5rem] absolute top-0 left-0 right-0 -mt-1 opacity-50" />
                                <div className="space-y-4">
                                    {/* Header Row */}
                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2"><span>Item Details</span><span>Cost & Split</span></div>
                                    
                                    {edited.items && edited.items.length > 0 ? (
                                        edited.items.map((item, idx) => (
                                            <div key={item.id} className="flex flex-col gap-2 border-b border-dashed border-gray-50 pb-2 last:border-0 last:pb-0">
                                                {/* Top Row: Name & Cost */}
                                                <div className="flex justify-between items-center">
                                                    {isEditing ? <input ref={idx === (edited.items?.length || 0) - 1 ? newItemInputRef : null} className="bg-transparent border-none outline-none font-bold text-[#1D1D1B] w-full placeholder-gray-300 text-sm" value={item.name} placeholder="品項名稱" onChange={(e) => updateItem(item.id, 'name', e.target.value)} /> : <span className="font-bold text-[#1D1D1B] text-sm">{item.name || '未命名'}</span>}
                                                    <div className="flex items-center gap-2">
                                                        {isEditing ? <input type="number" className="w-16 bg-transparent border-none outline-none font-bold text-[#1D1D1B] text-right text-sm" value={item.amount} placeholder="0" onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))} /> : <span className="font-bold text-[#1D1D1B] text-right text-sm">{item.amount}</span>}
                                                        {isEditing && <button onClick={() => deleteItem(item.id)} className="text-gray-200 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                                                    </div>
                                                </div>
                                                
                                                {/* Bottom Row: Splitting Avatars (Only visible in Edit Mode or if specific split exists) */}
                                                {(isEditing || (item.assignedTo && item.assignedTo.length > 0)) && (
                                                    <div className="flex justify-end items-center gap-1">
                                                        {isEditing && <button onClick={() => toggleItemMember(item.id)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${(!item.assignedTo || item.assignedTo.length === 0) ? 'bg-[#45846D] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>ALL</button>}
                                                        {members.map(m => {
                                                            const isAssigned = (item.assignedTo || []).includes(m.id);
                                                            if (!isEditing && !isAssigned && item.assignedTo && item.assignedTo.length > 0) return null;
                                                            return <button key={m.id} onClick={() => isEditing && toggleItemMember(item.id, m.id)} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all duration-200 ${isAssigned ? `${getMemberAvatarColor(m.name)} text-white border-transparent shadow-sm ${isEditing ? 'active:scale-90 scale-110' : ''}` : 'bg-gray-100 text-gray-300 border-transparent hover:bg-gray-200'} ${!isEditing && !isAssigned ? 'hidden' : ''}`} disabled={!isEditing}>{isAssigned ? <Check className="w-2.5 h-2.5" /> : m.name[0]}</button>
                                                        })}
                                                        {!isEditing && (!item.assignedTo || item.assignedTo.length === 0) && <span className="text-[9px] font-bold text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded ml-1">ALL</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : <div className="text-center text-xs text-gray-300 italic py-2">無明細，請輸入總金額</div>}
                                </div>
                                {isEditing && <button onClick={addItem} className="w-full mt-3 py-2 text-xs font-bold text-[#45846D] bg-[#45846D]/5 hover:bg-[#45846D]/10 rounded-lg border border-dashed border-[#45846D]/30 transition-colors">+ 新增品項</button>}
                            </div>

                            {/* 5. Total & Payer Footer */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-gray-400 uppercase">TOTAL</span>
                                    <div className="flex items-center">
                                        <span className="text-xl font-bold text-gray-400 mr-1">{currencySymbol}</span>
                                        <span className="text-4xl font-black text-[#1D1D1B]">{edited.cost}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start border-t border-dashed border-gray-100 pt-4">
                                    <div className="relative">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Paid By</label>
                                        <button onClick={() => isEditing && setIsPayerDropdownOpen(!isPayerDropdownOpen)} className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gray-50 border border-gray-200 ${isEditing ? 'active:scale-95' : ''}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activePayerAvatarColor}`}>{activePayerName[0]}</div>
                                            <span className="text-xs font-bold text-gray-700">{activePayerName}</span>
                                        </button>
                                        {isPayerDropdownOpen && isEditing && (
                                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-20 min-w-[120px] animate-in slide-in-from-bottom-2">
                                                {members.map(m => (
                                                    <button key={m.id} onClick={() => { handleChange('payer', m.id); setIsPayerDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors ${edited.payer === m.id ? 'text-[#45846D]' : 'text-gray-600'}`}><div className={`w-2 h-2 rounded-full ${getMemberAvatarColor(m.name)}`} /> {m.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-1 pl-4">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Split Summary</label>
                                        <div className="space-y-1">
                                            {Object.entries(splitSummary).map(([mid, amount]) => {
                                                const mName = getMemberName(members, mid);
                                                if (amount <= 0 || (mid === edited.payer)) return null; 
                                                return <div key={mid} className="text-xs font-mono text-gray-600 flex justify-end gap-2"><span>{mName}</span><span className="font-bold border-b border-dotted border-gray-300 text-[#1D1D1B]">{currencySymbol}{Math.round(amount)}</span></div>
                                            })}
                                            {Object.keys(splitSummary).length === 0 && <span className="text-xs text-gray-300">無分帳資訊 (全員平分)</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Stealth Toolbar (Location & Note) & Read-Only Display */}
                            <div className="pt-2 flex flex-col gap-3">
                                {/* READ ONLY VIEW: Show text if exists */}
                                {!isEditing && edited.location && (
                                    <div className="flex items-center gap-2 text-gray-500 text-xs px-2">
                                        {/* [修改點] 在編輯模式下只顯示靜態文字，或可點擊的智慧連結 (這裡是 Modal 內，所以顯示連結) */}
                                        <LocationLink location={edited.location} />
                                    </div>
                                )}
                                {!isEditing && edited.description && (
                                    <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-600 leading-relaxed mx-1">
                                        {edited.description}
                                    </div>
                                )}

                                {/* EDITING: Show Inputs if active */}
                                {isEditing && showLocationField && (
                                    <div className="animate-in slide-in-from-bottom-2 fade-in">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">地點</label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input className="w-full bg-white border border-gray-200 h-10 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50" value={edited.location || ''} onChange={e => handleChange('location', e.target.value)} placeholder="輸入地點..." autoFocus />
                                            <button onClick={() => { setShowLocationField(false); handleChange('location', ''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                )}
                                {isEditing && showNoteField && (
                                    <div className="animate-in slide-in-from-bottom-2 fade-in">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">備註</label>
                                        <div className="relative">
                                            <textarea className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 min-h-[80px]" value={edited.description || ''} onChange={e => handleChange('description', e.target.value)} placeholder="輸入備註..." autoFocus />
                                            <button onClick={() => { setShowNoteField(false); handleChange('description', ''); }} className="absolute right-2 top-2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* The Toolbar Icons (Only in Edit Mode) */}
                                {isEditing && (
                                    <div className="flex justify-center gap-6 pb-2 opacity-50 hover:opacity-100 transition-opacity">
                                        {!showLocationField && <button onClick={() => setShowLocationField(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><MapPinIcon className="w-5 h-5" /></button>}
                                        {!showNoteField && <button onClick={() => setShowNoteField(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><FileText className="w-5 h-5" /></button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // --- SYSTEM LAYOUT ---
                        <div className="space-y-4">
                            {!isNote && (
                                <div className="flex gap-4">
                                    <div className="w-2/5">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">時間</label>
                                        {isEditing ? (
                                            <button onClick={() => setShowTimePicker(true)} className="w-full bg-white border border-gray-200 h-12 rounded-xl font-bold text-center flex items-center justify-center text-[#1D1D1B] shadow-sm active:scale-95 transition-transform">{edited.time}</button>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 h-12 flex items-center justify-center rounded-xl font-bold text-[#1D1D1B] font-mono shadow-sm">{edited.time}</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">{isTransport ? '標題' : '名稱'}</label>
                                        {isEditing ? <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} /> : <div className="w-full bg-white border border-gray-100 px-4 h-12 flex items-center rounded-xl font-bold text-[#1D1D1B] shadow-sm truncate">{edited.title}</div>}
                                    </div>
                                </div>
                            )}

                            {isTransport && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">工具</label><div className="font-bold text-lg">{edited.transportDetail?.mode}</div></div>
                                        <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">耗時</label><div className="font-bold text-lg">{edited.transportDetail?.duration}</div></div>
                                    </div>
                                    <div className="text-sm text-gray-600">{edited.transportDetail?.instruction}</div>
                                </div>
                            )}

                            {isNote && (
                                <div className="bg-yellow-50 p-4 rounded-xl">
                                    <div className="font-bold text-yellow-800 mb-2">{edited.title}</div>
                                    <div className="text-sm text-yellow-900 whitespace-pre-wrap">{edited.description}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white z-20">
                    {isEditing ? (
                        <button 
                            onClick={() => { onSave(edited); setIsEditing(false); }} 
                            className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> 儲存變更
                        </button>
                    ) : (
                         <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm active:scale-95 transition-transform">確認</button>
                    )}
                </div>
            </div>

            {/* Category Drawer (Bottom Sheet) */}
            {isCategorySheetOpen && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCategorySheetOpen(false)} />
                    <div className="bg-white w-full max-w-sm rounded-t-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-[#1D1D1B]">選擇類別</h3>
                            <button onClick={() => setIsCategorySheetOpen(false)} className="bg-gray-100 p-2 rounded-full"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            {CATEGORIES.filter(c => !c.isSystem).map(cat => (
                                <button 
                                    key={cat.id} 
                                    onClick={() => { handleChange('type', cat.id); setIsCategorySheetOpen(false); }}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${edited.type === cat.id ? 'bg-[#45846D]/10 ring-2 ring-[#45846D]' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.tagClass.replace('bg-opacity-10 text-opacity-100', '')}`}>
                                        <cat.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {lightboxOpen && edited.expenseImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxOpen(false)}><img src={edited.expenseImage} className="max-w-full max-h-full object-contain" /><button className="absolute top-6 right-6 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors"><X className="w-6 h-6" /></button></div>}
            {showTimePicker && <TimePickerWheel value={edited.time} onChange={(val) => handleChange('time', val)} onClose={() => setShowTimePicker(false)} />}
        </div>
    );
};

// ============================================================================
// 6. Expense Dashboard (with Currency Flip)
// ============================================================================

const ExpenseDashboard: React.FC<{ trip: Trip; onCurrencyChange?: (curr: string) => void }> = ({ trip, onCurrencyChange }) => {
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode as CurrencyCode] || '$';
    const [convertedTotal, setConvertedTotal] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isSelectingCurrency, setIsSelectingCurrency] = useState(false); // [新增] 幣別選擇狀態
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

    const handleConvert = async () => { if (convertedTotal || stats.total === 0) { setConvertedTotal(null); return; } setIsConverting(true); const target = currencyCode === 'TWD' ? 'USD' : 'TWD'; const res = await getCurrencyRate(currencyCode, target, stats.total); setConvertedTotal(res); setIsConverting(false); };
    
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
                        {/* [新增] 幣別切換按鈕 (地球) */}
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

            {/* 切換顯示：幣別選擇列表 vs 分析圖表 */}
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
                    <div className="bg-gray-100 p-1 rounded-xl flex mb-6 relative">
                        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${tab === 'analysis' ? 'left-1' : 'left-[calc(50%+4px)]'}`} />
                        <button onClick={() => setTab('analysis')} className={`flex-1 relative z-10 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'analysis' ? 'text-[#1D1D1B]' : 'text-gray-400'}`}>
                            <BarChart3 className="w-3.5 h-3.5" /> 分析
                        </button>
                        <button onClick={() => setTab('settlement')} className={`flex-1 relative z-10 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'settlement' ? 'text-[#1D1D1B]' : 'text-gray-400'}`}>
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

const RouteVisualization: React.FC<{ day: TripDay; destination: string }> = ({ day, destination }) => {
    const { stops, mapUrl } = useMemo(() => {
        const _stops = day.activities.filter(a => a.type !== 'transport' && a.type !== 'note' && a.type !== 'expense' && a.type !== 'process').filter(a => a.title || a.location).map(a => a.location || a.title);
        let _mapUrl = '';
        if (_stops.length === 0) _mapUrl = `http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(destination)}`;
        else if (_stops.length === 1) _mapUrl = `http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(_stops[0])}`;
        else { 
            const origin = encodeURIComponent(_stops[0]); 
            const dest = encodeURIComponent(_stops[_stops.length - 1]); 
            const waypoints = _stops.slice(1, -1).map(s => encodeURIComponent(s)).join('|'); 
            _mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`; 
        }
        return { stops: _stops, mapUrl: _mapUrl };
    }, [day.activities, destination]);
    return (<div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mt-2"><div className="h-24 bg-[#45846D]/5 flex items-center justify-center relative"><Map className="w-8 h-8 text-[#45846D] opacity-50" /></div><div className="p-5">{stops.length===0?<div className="text-center text-gray-400 text-sm">暫無地點</div>:<><div className="space-y-0 mb-6 pl-2">{stops.map((s, i) => (<div key={i} className="flex gap-4"><div className="flex flex-col items-center w-4"><div className="w-3 h-3 rounded-full bg-[#45846D]"></div>{i!==stops.length-1&&<div className="w-[2px] flex-1 bg-gray-100"></div>}</div><p className="text-sm pb-5">{s}</p></div>))}</div><a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#45846D] text-white font-bold py-3.5 rounded-2xl">開啟導航</a></>}</div></div>);
};

// ============================================================================
// 8. Add Activity Modal
// ============================================================================

const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('09:00'); const [type, setType] = useState<string>('sightseeing');
    const handleSubmit = () => { if (!title) return;
    onAdd({ time, title, description: '', type, location: '' }); };
    
    // 只顯示非系統類型
    const validCategories = CATEGORIES.filter(c => !c.isSystem);

    return (<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10"><h3 className="text-xl font-bold mb-6">新增第 {day} 天</h3><div className="space-y-5"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold text-center" />
    <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold">
        {validCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select></div><button className="w-full py-4 rounded-2xl bg-[#45846D] text-white font-bold" onClick={handleSubmit}>確認</button></div></div></div>);
};

// ============================================================================
// 9. Modals: Trip Settings, Date Edit, Days Edit
// ============================================================================

// [新增] 1. 輕量級日期編輯器
const SimpleDateEditModal: React.FC<{ date: string, onClose: () => void, onSave: (newDate: string) => void }> = ({ date, onClose, onSave }) => {
    const [val, setVal] = useState(date);
    return (
        <LightweightModal title="修改開始日期" onClose={onClose} onSave={() => onSave(val)}>
            <input type="date" value={val} onChange={(e) => setVal(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-[#45846D]" />
        </LightweightModal>
    );
};

// [新增] 2. 輕量級天數編輯器
const SimpleDaysEditModal: React.FC<{ days: number, onClose: () => void, onSave: (newDays: number) => void }> = ({ days, onClose, onSave }) => {
    const [val, setVal] = useState(days);
    return (
        <LightweightModal title="修改天數" onClose={onClose} onSave={() => onSave(val)}>
            <div className="flex items-center justify-center gap-4">
                <button onClick={() => setVal(Math.max(1, val - 1))} className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">-</button>
                <span className="text-3xl font-black text-[#1D1D1B] w-12 text-center">{val}</span>
                <button onClick={() => setVal(val + 1)} className="w-10 h-10 rounded-full bg-[#1D1D1B] flex items-center justify-center font-bold text-white">+</button>
            </div>
        </LightweightModal>
    );
};

// [新增] 3. 全域行程設定 (Control Center)
const TripSettingsModal: React.FC<{ trip: Trip; onClose: () => void; onUpdate: (t: Trip) => void; onDelete: () => void }> = ({ trip, onClose, onUpdate, onDelete }) => {
    const [dest, setDest] = useState(trip.destination);
    const [members, setMembers] = useState<Member[]>(trip.members || []);
    const [newMemberName, setNewMemberName] = useState('');
    
    // Toggles (Mock state)
    const [alertEnabled, setAlertEnabled] = useState(true);
    const [notifyEnabled, setNotifyEnabled] = useState(false);

    const handleSave = () => { 
        onUpdate({ ...trip, destination: dest, members }); 
        onClose(); 
    };

    const addMember = () => {
        if (!newMemberName.trim()) return;
        setMembers([...members, { id: Date.now().toString(), name: newMemberName.trim() }]);
        setNewMemberName('');
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 relative z-10 animate-in zoom-in-95 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">行程設定</h3>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-6">
                    {/* 1. 目的地 */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">目的地名稱</label>
                        <IOSInput value={dest} onChange={e => setDest(e.target.value)} />
                    </div>

                    {/* 2. 旅伴 */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">旅伴成員</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {members.map(m => (
                                <div key={m.id} className="bg-gray-100 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2">
                                    <span className="text-xs font-bold">{m.name}</span>
                                    <button onClick={() => setMembers(members.filter(x => x.id !== m.id))} className="bg-white rounded-full p-0.5 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                placeholder="輸入名字..." 
                                className="flex-1 bg-[#F5F5F4] rounded-xl px-4 py-3 text-sm outline-none font-bold"
                                value={newMemberName}
                                onChange={e => setNewMemberName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addMember()}
                            />
                            <button onClick={addMember} className="bg-[#1D1D1B] text-white rounded-xl w-12 flex items-center justify-center"><Plus className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* 3. Toggles */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 text-green-600 rounded-full"><Bell className="w-4 h-4" /></div>
                                <span className="font-bold text-sm">出發提醒</span>
                            </div>
                            <button onClick={() => setAlertEnabled(!alertEnabled)} className={`w-12 h-7 rounded-full p-1 transition-colors ${alertEnabled ? 'bg-[#45846D]' : 'bg-gray-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${alertEnabled ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><Share className="w-4 h-4" /></div>
                                <span className="font-bold text-sm">行程通知</span>
                            </div>
                            <button onClick={() => setNotifyEnabled(!notifyEnabled)} className={`w-12 h-7 rounded-full p-1 transition-colors ${notifyEnabled ? 'bg-[#45846D]' : 'bg-gray-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${notifyEnabled ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* 4. Actions */}
                    <div className="space-y-3">
                        <button className="w-full py-3 rounded-xl border-2 border-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50">
                            <FileDown className="w-4 h-4" /> 匯出行程表
                        </button>
                        <button onClick={() => { if(confirm('確定刪除此行程？此動作無法復原。')) onDelete(); }} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100">
                            <LogOut className="w-4 h-4" /> 刪除行程
                        </button>
                    </div>

                    <button onClick={handleSave} className="w-full py-4 rounded-2xl bg-[#1D1D1B] text-white font-bold text-sm shadow-lg active:scale-95 transition-transform mt-4">
                        儲存設定
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 10. Main Itinerary View & Props
// ============================================================================

interface ItineraryViewProps { 
    trip: Trip;
    onBack: () => void;
    onDelete: () => void; 
    onUpdateTrip: (t: Trip) => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ trip, onBack, onDelete, onUpdateTrip }) => {
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // [Modals State]
    const [isDateEditOpen, setIsDateEditOpen] = useState(false);
    const [isDaysEditOpen, setIsDaysEditOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const [showExpenses, setShowExpenses] = useState(false);
    const [showVault, setShowVault] = useState(false);
    
    // Plus Menu State
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    const [menuTargetIndex, setMenuTargetIndex] = useState<{dayIdx: number, actIdx: number} | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    // Detail Modal State
    const [selectedActivity, setSelectedActivity] = useState<{ dayIdx: number, actIdx: number, activity: Activity, initialEdit: boolean } | null>(null);
    
    const [shareOpen, setShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode as CurrencyCode] || '$';
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic Header Info
    const flightDisplayOrigin = trip.origin || 'ORIGIN';
    const flightDisplayDest = trip.destination || 'DEST';
    const firstType = trip.days[0]?.activities[0]?.type || 'other';

    // 現在時刻的邏輯計算
    const today = new Date().toISOString().split('T')[0];
    const currentDayIndex = trip.days.findIndex(d => {
        const tripStart = new Date(trip.startDate);
        const currentTripDate = new Date(tripStart);
        currentTripDate.setDate(tripStart.getDate() + (d.day - 1));
        return currentTripDate.toISOString().split('T')[0] === today;
    });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Initialize default member (Me) if empty
    useEffect(() => {
        if (!trip.members || trip.members.length === 0) {
            onUpdateTrip({ 
                ...trip, 
                members: [{ id: 'me', name: '我', isHost: true }] 
            });
        }
    }, []);

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => onUpdateTrip({ ...trip, coverImage: reader.result as string }); reader.readAsDataURL(file); } };
    const handleCurrencyChange = (curr: string) => { onUpdateTrip({ ...trip, currency: curr }); }; // 簡化邏輯
    const handleShare = () => { const liteTrip = { ...trip, coverImage: '' }; setShareUrl(`${window.location.origin}${window.location.pathname}?import=${btoa(unescape(encodeURIComponent(JSON.stringify(liteTrip))))}`); setShareOpen(true); };
    
    // [Handlers for New Modals]
    const handleDateUpdate = (newDate: string) => {
        // 更新日期並重新計算每天的日期 (簡易邏輯：假設只需更新 startDate)
        onUpdateTrip({ ...trip, startDate: newDate });
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

    // 5-Button Menu Logic
    const handleQuickAdd = async (type: 'activity' | 'transport' | 'note' | 'expense' | 'ai') => {
        setIsPlusMenuOpen(false);
        if (!menuTargetIndex) return;
        const { dayIdx, actIdx } = menuTargetIndex;
        if (type === 'activity') {
            setActiveDayForAdd(dayIdx + 1);
            setIsAddModalOpen(true);
            return;
        }

        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const insertIdx = actIdx + 1; 
        
        const prevAct = newTrip.days[dayIdx].activities[actIdx];
        const nextTime = prevAct ? prevAct.time : '09:00';
        let newAct: Activity | null = null;

        if (type === 'ai') {
            setAiLoading(true);
            const spot = await suggestNextSpot(prevAct?.location || trip.destination, nextTime, 'food, sightseeing');
            setAiLoading(false);
            if (spot) newAct = spot;
            else { alert('AI 暫時無法提供靈感'); return; }
        } else if (type === 'transport') {
            newAct = { time: nextTime, title: '移動', type: 'transport', description: '', transportDetail: { mode: 'bus', duration: '30 min', instruction: '搭乘交通工具' } };
        } else if (type === 'note') {
            newAct = { time: nextTime, title: '新備註', type: 'note', description: '點擊編輯內容', cost: 0 };
        } else if (type === 'expense') {
            newAct = { 
                time: nextTime, 
                title: '新支出', 
                type: 'expense', 
                description: '', 
                cost: 0, 
                payer: trip.members?.[0]?.id,
                layout: 'polaroid' 
            }; 
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

    const openAddModal = (day: number) => { setActiveDayForAdd(day); setIsAddModalOpen(true); };
    
    // Header Background Logic
    const headerBgClass = firstType === 'flight' ? 'bg-[#2C5E4B]' : firstType === 'train' ? 'bg-[#ea580c]' : 'bg-transparent';

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full block overflow-y-auto relative no-scrollbar">
            
            {/* 1. Header Container */}
            <div className={`relative h-72 w-full ${headerBgClass}`}>
                
                {/* 1.1 Nav Buttons (極致簡化：只留左上返回) */}
                <div className="absolute top-0 left-0 right-0 z-30 p-5 flex justify-between items-start pointer-events-none">
                    <button onClick={onBack} className="w-10 h-10 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all pointer-events-auto shadow-sm border border-white/10"><ArrowLeft className="w-6 h-6" /></button>
                </div>

                {/* 1.2 Background Logic */}
                {(firstType !== 'flight' && firstType !== 'train') && (
                    <>
                        <img src={trip.coverImage} className="w-full h-full object-cover opacity-80" alt="Cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1B] via-transparent to-transparent" />
                    </>
                )}
                
                {/* 1.3 Header Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-20 pt-20">
                    <div className="absolute top-20 left-6 right-6 pointer-events-none">
                        <div className="flex justify-between items-end border-b border-white/20 pb-4 mb-4">
                            <div>
                                <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">FROM</span>
                                <span className="text-5xl font-black font-sans tracking-tight text-white uppercase">{flightDisplayOrigin}</span>
                            </div>
                            <div className="mb-2 opacity-80 animate-pulse">
                                {firstType === 'train' ? <Train className="w-8 h-8 text-white" /> : <Plane className="w-8 h-8 text-white" />}
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">TO</span>
                                <span className="text-5xl font-black font-sans tracking-tight text-white uppercase">{flightDisplayDest}</span>
                            </div>
                        </div>
                    </div>

                    {/* [修正] Travel Utility Bar: 膠囊工具列 */}
                    <div className="mt-auto relative z-30 flex items-center justify-between">
                        {/* 左側：編輯類 (點擊彈出輕量編輯) */}
                        <div className="flex gap-2">
                            <GlassCapsule onClick={() => setIsDateEditOpen(true)}>
                                <Calendar className="w-3.5 h-3.5" /> 
                                {trip.startDate}
                            </GlassCapsule>
                            <GlassCapsule onClick={() => setIsDaysEditOpen(true)}>
                                {trip.days.length} DAYS
                            </GlassCapsule>
                        </div>

                        {/* 右側：功能操作 (點擊變綠) */}
                        <div className="flex gap-2">
                            {/* 憑證按鈕 */}
                            <GlassCapsule 
                                isActive={showVault} 
                                onClick={() => { setShowVault(!showVault); setShowExpenses(false); }}
                            >
                                <Ticket className="w-3.5 h-3.5" /> 憑證
                            </GlassCapsule>

                            {/* 錢包按鈕 */}
                            <GlassCapsule 
                                isActive={showExpenses} 
                                onClick={() => { setShowExpenses(!showExpenses); setShowVault(false); }}
                            >
                                <Wallet className="w-3.5 h-3.5" /> {currencyCode}
                            </GlassCapsule>

                            {/* 設定按鈕 (控制中心) */}
                            <GlassCapsule onClick={() => setIsSettingsOpen(true)}>
                                <Settings className="w-3.5 h-3.5" />
                            </GlassCapsule>
                        </div>
                    </div>
                </div>
                
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-24 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all z-20"><Camera className="w-5 h-5" /></button>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />
            </div>

            {/* 3. Sticky Content Control Bar */}
            <div className="sticky top-0 z-40 bg-[#E4E2DD]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm px-5 pt-3 pb-3 transition-all">
                <div className="bg-white/50 p-1 rounded-2xl flex shadow-inner">
                    <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><List className="w-4 h-4" /> 列表</button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><Map className="w-4 h-4" /> 地圖</button>
                </div>
            </div>

            {/* 4. Scrollable Content Area */}
            <div className="px-5 pb-safe w-full">
                {/* [Dashboard Area] 切換顯示記帳或憑證 */}
                {showExpenses && <ExpenseDashboard trip={trip} onCurrencyChange={handleCurrencyChange} />}
                {showVault && (
                    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-6 text-center animate-in fade-in slide-in-from-top-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Ticket className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-800 mb-2">保管箱是空的</h3>
                        <p className="text-gray-500 text-xs">這裡將顯示您置頂的護照、訂房憑證或電子機票。</p>
                    </div>
                )}

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="py-4 space-y-10">
                        {trip.days.map((day: TripDay, dayIndex: number) => {
                            const isCurrentDay = dayIndex === currentDayIndex; // 判斷是否為今天
                            const activities = day.activities;
                            
                            return (
                                <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-[#45846D]/20">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#45846D] border-4 border-[#E4E2DD] shadow-sm" />
                                    <div className="flex justify-between items-center mb-4 -mt-1">
                                        <h2 className="text-xl font-bold text-[#1D1D1B]">第 {day.day} 天</h2>
                                        {/* Top Plus Button for Day Start */}
                                        <button 
                                            onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: -1 }); setIsPlusMenuOpen(true); }} 
                                            className="p-1.5 rounded-full text-[#45846D] bg-[#45846D]/10 hover:bg-[#45846D]/20"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {viewMode === 'list' ? (
                                        <Droppable droppableId={`day-${dayIndex + 1}`}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 min-h-[50px]">
                                                    {/* 空狀態插圖 */}
                                                    {activities.length === 0 && <EmptyDayPlaceholder provided={provided} />}

                                                    {/* 渲染活動列表 */}
                                                    {activities.map((act: Activity, index: number) => {
                                                        const isNextActivity = isCurrentDay && act.time > currentTime && (index === 0 || activities[index - 1].time <= currentTime);
                                                        
                                                        return (
                                                            <React.Fragment key={`${day.day}-${index}`}>
                                                                {/* 現在時刻線 */}
                                                                {isNextActivity && <CurrentTimeIndicator />}
                                                                
                                                                <Draggable draggableId={`${day.day}-${index}`} index={index}>
                                                                    {(provided, snapshot) => {
                                                                        // [版型分流]
                                                                        if (isSystemType(act.type)) {
                                                                            if (act.type === 'transport') return <TransportConnectorItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                            if (act.type === 'note') return <NoteItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                            return <ProcessItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} />;
                                                                        }
                                                                        
                                                                        // 2. 拍立得版型 (layout='polaroid')
                                                                        if (act.layout === 'polaroid') {
                                                                            return <ExpensePolaroid act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} currencySymbol={currencySymbol} members={trip.members} />;
                                                                        }
                                                                        
                                                                        // 3. 預設版型 (List)
                                                                        return <ActivityItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act, initialEdit: false })} provided={provided} snapshot={snapshot} currencySymbol={currencySymbol} />;
                                                                    }}
                                                                </Draggable>
                                                                {/* Ghost Insert Button (Between Items) */}
                                                                <GhostInsertButton onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: index }); setIsPlusMenuOpen(true); }} />
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    
                                                    {/* 如果是今天，且已經晚於所有活動時間，顯示紅線在最後 */}
                                                    {isCurrentDay && activities.length > 0 && currentTime >= activities[activities.length - 1].time && <CurrentTimeIndicator />}
                                                    
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    ) : (
                                        <RouteVisualization day={day} destination={trip.destination} />
                                    )}
                                </div>
                            );
                        })}
                        <div className="h-24"></div>
                    </div>
                </DragDropContext>
            </div>
            
            {/* --- Modals 區塊 --- */}

            {/* 1. 日期編輯 */}
            {isDateEditOpen && (
                <SimpleDateEditModal 
                    date={trip.startDate} 
                    onClose={() => setIsDateEditOpen(false)} 
                    onSave={handleDateUpdate} 
                />
            )}

            {/* 2. 天數編輯 */}
            {isDaysEditOpen && (
                <SimpleDaysEditModal 
                    days={trip.days.length} 
                    onClose={() => setIsDaysEditOpen(false)} 
                    onSave={handleDaysUpdate} 
                />
            )}

            {/* 3. 全域設定 (行程控制中心) */}
            {isSettingsOpen && (
                <TripSettingsModal 
                    trip={trip} 
                    onClose={() => setIsSettingsOpen(false)} 
                    onUpdate={(updatedTrip) => { onUpdateTrip(updatedTrip); setIsSettingsOpen(false); }}
                    onDelete={onDelete}
                />
            )}

            {isAddModalOpen && (
                <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />
            )}

            {selectedActivity && (
                <ActivityDetailModal 
                    act={selectedActivity.activity}
                    onClose={() => setSelectedActivity(null)}
                    onSave={handleUpdateActivity}
                    onDelete={() => handleDeleteActivity(selectedActivity.dayIdx, selectedActivity.actIdx)}
                    members={trip.members}
                    initialEdit={selectedActivity.initialEdit}
                    currencySymbol={currencySymbol}
                />
            )}

            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} />
            
            {/* Speed Dial Menu Overlay */}
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