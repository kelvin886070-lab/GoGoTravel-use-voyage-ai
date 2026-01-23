import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, Trash2, Camera, List, Map, Plus, GripVertical, Wallet, 
    ArrowLeftRight, Settings, X, Utensils, Bed, Bus, Plane, Tag as TagIcon, 
    RefreshCw, PenTool, Share, Train, Calendar, AlertTriangle, 
    Car, Footprints, TramFront, Clock, MapPin, ChevronRight, Edit3, Save, ExternalLink,
    StickyNote, Banknote, Sparkles, UserCheck, PlaneTakeoff, PlaneLanding,
    Users, UserPlus, Check, Image as ImageIcon, Loader2, ZoomIn, Receipt
} from 'lucide-react';
import type { Trip, TripDay, Activity, Member, ExpenseItem } from '../types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { IOSInput, IOSShareSheet, IOSButton } from '../components/UI';
import { getCurrencyRate, suggestNextSpot, analyzeReceiptImage } from '../services/gemini';
import { recalculateTimeline } from '../services/timeline';

// --- Constants ---
const CURRENCY_SYMBOLS: Record<string, string> = {
    'TWD': 'NT$', 'USD': '$', 'JPY': '¥', 'KRW': '₩', 'EUR': '€', 'CNY': '¥', 'HKD': 'HK$'
};

const CURRENCY_LABELS: Record<string, string> = {
    'TWD': '新台幣', 'USD': '美金', 'JPY': '日圓', 'KRW': '韓元', 'EUR': '歐元', 'CNY': '人民幣', 'HKD': '港幣'
};

const parseCost = (costStr?: string | number): number => {
    if (costStr === undefined || costStr === null || costStr === '') return 0;
    if (typeof costStr === 'number') return costStr;
    const cleanStr = costStr.toString().replace(/,/g, '');
    const match = cleanStr.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
    return 0;
};

// --- Helper: Get Member Name by ID ---
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

// --- Sub Components ---

const Tag: React.FC<{ type: string }> = ({ type }) => {
    const config: Record<string, { color: string, label: string, icon: any }> = {
        sightseeing: { color: 'bg-blue-100 text-blue-700', label: '景點', icon: Camera },
        food: { color: 'bg-orange-100 text-orange-700', label: '美食', icon: Utensils },
        transport: { color: 'bg-gray-100 text-gray-700', label: '交通', icon: Bus },
        flight: { color: 'bg-[#45846D]/10 text-[#45846D]', label: '航班', icon: Plane },
        hotel: { color: 'bg-indigo-100 text-indigo-700', label: '住宿', icon: Bed },
        cafe: { color: 'bg-amber-100 text-amber-700', label: '咖啡廳', icon: Utensils },
        shopping: { color: 'bg-pink-100 text-pink-700', label: '購物', icon: TagIcon },
        relax: { color: 'bg-emerald-100 text-emerald-700', label: '放鬆', icon: TagIcon },
        bar: { color: 'bg-violet-100 text-violet-700', label: '酒吧', icon: TagIcon },
        culture: { color: 'bg-rose-100 text-rose-700', label: '文化', icon: TagIcon },
        activity: { color: 'bg-cyan-100 text-cyan-700', label: '體驗', icon: TagIcon },
        note: { color: 'bg-yellow-100 text-yellow-700', label: '備註', icon: StickyNote },
        expense: { color: 'bg-green-100 text-green-700', label: '記帳', icon: Banknote },
        process: { color: 'bg-slate-100 text-slate-700', label: '程序', icon: UserCheck },
        default: { color: 'bg-gray-100 text-gray-600', label: '其他', icon: TagIcon }
    };
    const { color, label, icon: Icon } = config[type] || config.default;
    return (
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1 w-fit ${color}`}>
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

// --- Process Item ---
const ProcessItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    return (
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`relative flex items-center py-2 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col items-center w-[55px] self-stretch relative">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div>
            </div>
            <div className="flex-1 flex items-center">
                <div className="bg-slate-100 border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer hover:bg-slate-200">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{act.title}</span>
                    <div className="w-px h-3 bg-slate-300 mx-1"></div>
                    <span className="text-xs font-mono text-slate-500">{detail?.duration || '60 min'}</span>
                </div>
                <div {...provided.dragHandleProps} className="text-transparent group-hover:text-gray-300 p-2 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

// --- Transport Connector Item ---
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
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`relative flex items-center gap-3 py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col items-center w-[55px] self-stretch relative">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div>
                <div className="relative z-10 bg-gray-100 border-2 border-white text-gray-500 rounded-full p-1.5 shadow-sm mt-2">
                    {getIcon()}
                </div>
            </div>
            <div className="flex-1 bg-gray-50/80 rounded-xl p-3 border border-gray-200/50 flex items-center justify-between gap-3 backdrop-blur-sm active:scale-[0.98] transition-transform cursor-pointer hover:bg-gray-100/80 overflow-hidden">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {detail?.mode || 'Transport'}
                        </span>
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {detail?.duration || '15 min'}
                        </span>
                    </div>
                    {(detail?.fromStation || detail?.toStation) ? (
                        <div className="text-xs text-gray-800 font-bold flex flex-wrap items-center gap-1 min-w-0">
                            <span className="truncate max-w-[40%]">{detail.fromStation || '起點'}</span>
                            <ArrowLeftRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[40%]">{detail.toStation || '終點'}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-800 font-medium truncate">
                            {detail?.instruction || act.description || '移動至下個地點'}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                    <div {...provided.dragHandleProps} className="text-gray-300 p-1" onClick={(e) => e.stopPropagation()}>
                        <GripVertical className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Note Item ---
const NoteItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any }> = ({ act, onClick, provided, snapshot }) => {
    return (
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`flex gap-3 py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col items-center w-[55px] pt-2">
                <StickyNote className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-100 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                <div className="min-w-0">
                    <h4 className="font-bold text-yellow-800 text-sm truncate">{act.title || '備註'}</h4>
                    <p className="text-xs text-yellow-600/80 truncate">{act.description || '點擊編輯內容...'}</p>
                </div>
                <div {...provided.dragHandleProps} className="text-yellow-300 p-1" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

// --- [新] Expense Polaroid Card (拍立得風格) ---
const ExpensePolaroid: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string, members?: Member[] }> = ({ act, onClick, provided, snapshot, currencySymbol, members }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : '0';
    const payerName = getMemberName(members, act.payer);
    const avatarColor = getMemberAvatarColor(payerName);

    return (
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`flex gap-3 py-2 group ${snapshot.isDragging ? 'z-50 scale-[1.02]' : ''}`}
            onClick={onClick}
        >
            {/* Timeline & Icon */}
            <div className="flex flex-col items-center w-[55px] self-stretch relative pt-2">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-200 left-1/2 -ml-[1px] -z-10"></div>
                <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm z-10 text-xs font-bold text-gray-400">
                    <Banknote className="w-4 h-4 text-green-500" />
                </div>
            </div>

            {/* Polaroid Body */}
            <div className="flex-1 bg-white p-3 pb-4 rounded-sm shadow-md border border-gray-100 rotate-1 transition-transform hover:rotate-0 active:scale-[0.98] cursor-pointer relative overflow-hidden group/card">
                
                {/* Drag Handle (Hover Visible) */}
                <div {...provided.dragHandleProps} className="absolute top-2 left-2 z-20 text-white/80 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 bg-black/20 backdrop-blur-sm rounded-full" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Photo Area */}
                <div className="aspect-video bg-gray-100 mb-3 rounded-sm overflow-hidden relative border border-gray-100">
                    {act.expenseImage ? (
                        <img src={act.expenseImage} alt="Receipt" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 pattern-dots">
                            <Camera className="w-8 h-8 opacity-30 mb-1" />
                            <span className="text-[10px] font-bold opacity-30">無照片</span>
                        </div>
                    )}
                    
                    {/* Payer Sticker */}
                    <div className={`absolute top-2 right-2 ${avatarColor} text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border border-white transform rotate-6`}>
                        {payerName} 付款
                    </div>
                </div>

                {/* Info Area */}
                <div className="flex justify-between items-end px-1">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="font-handwriting font-bold text-gray-800 text-lg leading-none mb-1 truncate">{act.title || '未命名支出'}</div>
                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                            {act.time} 
                            {act.items && act.items.length > 0 && <span className="bg-gray-100 px-1 rounded text-gray-500">{act.items.length} 筆明細</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono font-bold text-xl text-green-600">{currencySymbol}{displayCost}</div>
                    </div>
                </div>

                {/* Split Dots */}
                {(act.items && act.items.length > 0) || (act.splitWith && act.splitWith.length > 0) ? (
                    <div className="absolute bottom-2 left-4 flex -space-x-1">
                        {/* Logic to show dots for involved members could be complex, simplifying to show "items exist" or splitWith */}
                        <div className="w-2 h-2 rounded-full bg-gray-300 border border-white" />
                        <div className="w-2 h-2 rounded-full bg-gray-400 border border-white" />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

// --- Activity Item ---
const ActivityItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : null;

    return (
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} 
            className={`bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col gap-2 group relative cursor-pointer active:scale-[0.98] transition-all hover:shadow-md ${snapshot.isDragging ? 'shadow-lg z-50 scale-[1.02]' : ''}`}
            onClick={onClick}
        >
            <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1 min-w-[55px]">
                    <span className="text-xs font-bold text-[#1D1D1B] bg-gray-100 px-2 py-1 rounded-md">{act.time}</span>
                </div>
                
                <div className="flex-1 min-w-0 border-l border-gray-100 pl-4">
                    <h4 className="font-bold text-[#1D1D1B] truncate text-base leading-tight">{act.title}</h4>
                    
                    <div className="flex items-center justify-between mt-2">
                        <Tag type={act.type} />
                        {displayCost !== null && (
                            <span className="text-xs text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded-md">
                                {currencySymbol} {displayCost}
                            </span>
                        )}
                    </div>
                    
                    {act.description && (
                        <p className="text-xs text-gray-500 mt-2 font-medium line-clamp-2 leading-relaxed">
                            {act.description}
                        </p>
                    )}
                </div>

                <div {...provided.dragHandleProps} className="flex flex-col justify-between items-end pl-1" onClick={(e) => e.stopPropagation()}>
                    <div className="text-gray-300 p-1">
                        <GripVertical className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Activity Detail Modal (Enhanced with Breakdown & Lightbox) ---
const ActivityDetailModal: React.FC<{ 
    act: Activity; 
    onClose: () => void;
    onSave: (updatedAct: Activity) => void; 
    onDelete: () => void; 
    members?: Member[]; 
}> = ({ act, onClose, onSave, onDelete, members = [] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [edited, setEdited] = useState<Activity>({ ...act });
    const [aiProcessing, setAiProcessing] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    
    // Default Payer
    useEffect(() => {
        if (!edited.payer && members.length > 0) {
            setEdited(prev => ({ ...prev, payer: members[0].id }));
        }
        if ((edited.type === 'note' && edited.title === '新備註') || 
            (edited.type === 'expense' && edited.title === '新支出') ||
            (edited.type === 'transport' && edited.title === '移動')) {
            setIsEditing(true);
        }
    }, []);

    const isTransport = edited.type === 'transport';
    const isNote = edited.type === 'note';
    const isExpense = edited.type === 'expense';
    const isProcess = edited.type === 'process';

    const handleChange = (field: keyof Activity, value: any) => {
        setEdited(prev => ({ ...prev, [field]: value }));
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

    // AI Receipt Analysis
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setEdited(prev => ({ ...prev, expenseImage: base64 }));
            
            // Trigger AI
            setAiProcessing(true);
            const result = await analyzeReceiptImage(base64);
            setAiProcessing(false);

            if (result) {
                // Generate Expense Items from AI
                // [修改點] 這裡加上 (result.items || []) 確保就算 AI 沒傳回 items 也不會報錯
                const newItems: ExpenseItem[] = (result.items || []).map((item, idx) => ({
                    id: Date.now().toString() + idx,
                    name: item.name,
                    amount: item.amount,
                    assignedTo: [] // Default shared
                }));

                setEdited(prev => ({ 
                    ...prev, 
                    title: result.merchant || prev.title, 
                    cost: result.total || prev.cost,
                    expenseImage: base64,
                    items: newItems
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    // Item Management
    const addItem = () => {
        const newItem: ExpenseItem = { id: Date.now().toString(), name: '', amount: 0, assignedTo: [] };
        setEdited(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const updateItem = (id: string, field: keyof ExpenseItem, value: any) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => item.id === id ? { ...item, [field]: value } : item);
            // Auto-sum if items exist
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

    const toggleItemMember = (itemId: string, memberId: string) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id !== itemId) return item;
                const current = item.assignedTo || [];
                const newAssigned = current.includes(memberId) 
                    ? current.filter(id => id !== memberId) 
                    : [...current, memberId];
                return { ...item, assignedTo: newAssigned };
            });
            return { ...prev, items: newItems };
        });
    };

    // Toggle logic for Whole Bill Split (if no items)
    const toggleSplitMember = (mid: string) => {
        const currentSplits = edited.splitWith || [];
        if (currentSplits.includes(mid)) {
            setEdited(prev => ({ ...prev, splitWith: currentSplits.filter(id => id !== mid) }));
        } else {
            setEdited(prev => ({ ...prev, splitWith: [...currentSplits, mid] }));
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto">
                
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-20 pb-2 border-b border-gray-50">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">
                        {isEditing ? '編輯內容' : (isTransport ? '交通詳情' : isNote ? '備註內容' : isExpense ? '記帳詳情' : '行程資訊')}
                    </h3>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <button onClick={() => { if(confirm('確定刪除此行程？')) onDelete(); }} className="bg-red-50 p-2 rounded-full text-red-500 hover:bg-red-100 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsEditing(true)} className="bg-[#1D1D1B] p-2 rounded-full text-white hover:bg-gray-800 transition-colors shadow-md">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 text-sm font-bold px-2">取消</button>
                        )}
                        <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="space-y-5 pb-6">
                    {!isNote && (
                        <div className="flex gap-3">
                            <div className="w-1/3">
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">時間</label>
                                {isEditing ? (
                                    <input type="time" value={edited.time} onChange={e => handleChange('time', e.target.value)} className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold text-center outline-none" />
                                ) : (
                                    <div className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold text-center text-[#1D1D1B] text-lg font-mono">{edited.time}</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">{isTransport ? '標題' : '名稱'}</label>
                                {isEditing ? (
                                    <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} />
                                ) : (
                                    <div className="w-full bg-white border border-gray-100 p-3 rounded-xl font-bold text-[#1D1D1B] text-lg shadow-sm">{edited.title}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- Expense Special UI --- */}
                    {isExpense && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
                            {/* 1. Photo Upload Area */}
                            <div className="relative w-full aspect-video bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden group hover:border-[#45846D] transition-colors">
                                {edited.expenseImage ? (
                                    <>
                                        <img src={edited.expenseImage} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white cursor-pointer hover:bg-black/70" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}>
                                            <ZoomIn className="w-4 h-4" />
                                        </div>
                                        {isEditing && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold cursor-pointer">更換/掃描</div>}
                                    </>
                                ) : (
                                    <div className="text-gray-400 flex flex-col items-center">
                                        <Camera className="w-8 h-8 mb-2" />
                                        <span className="text-xs font-bold">上傳收據 / 照片</span>
                                        <span className="text-[10px] opacity-70 mt-1">AI 自動辨識品項與金額</span>
                                    </div>
                                )}
                                {isEditing && <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />}
                                {aiProcessing && (
                                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20">
                                        <Loader2 className="w-8 h-8 text-[#45846D] animate-spin mb-2" />
                                        <span className="text-xs font-bold text-[#45846D] animate-pulse">AI 正在讀取收據...</span>
                                    </div>
                                )}
                            </div>

                            {/* 2. Amount Input */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">總金額 (Total)</label>
                                {isEditing ? (
                                    <IOSInput type="number" value={edited.cost || ''} onChange={e => handleChange('cost', e.target.value)} placeholder="0" className="text-2xl font-mono text-center" disabled={edited.items && edited.items.length > 0} />
                                ) : (
                                    <div className="text-3xl font-black text-center text-[#1D1D1B] font-mono">{edited.cost}</div>
                                )}
                            </div>

                            {/* 3. Payer Selector */}
                            {members.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase">誰先付錢 (Payer)</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                        {members.map(m => (
                                            <button 
                                                key={m.id} 
                                                onClick={() => isEditing && handleChange('payer', m.id)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${edited.payer === m.id ? 'bg-[#1D1D1B] text-white border-[#1D1D1B] shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}
                                                disabled={!isEditing}
                                            >
                                                <div className={`w-4 h-4 rounded-full ${getMemberAvatarColor(m.name)} border border-white`} />
                                                <span className="text-xs font-bold">{m.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="h-px bg-gray-200 my-2" />

                            {/* 4. Item Breakdown & Allocation */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase flex items-center gap-1"><Receipt className="w-3 h-3" /> 消費明細</label>
                                    {isEditing && <button onClick={addItem} className="text-xs font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-1 rounded hover:bg-[#45846D]/20">+ 新增品項</button>}
                                </div>
                                
                                {edited.items && edited.items.length > 0 ? (
                                    <div className="space-y-2">
                                        {edited.items.map((item) => (
                                            <div key={item.id} className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex gap-2 mb-2">
                                                    <input 
                                                        className="flex-1 bg-gray-50 rounded px-2 py-1 text-sm font-bold outline-none" 
                                                        value={item.name} 
                                                        placeholder="品項"
                                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                        disabled={!isEditing}
                                                    />
                                                    <input 
                                                        type="number"
                                                        className="w-20 bg-gray-50 rounded px-2 py-1 text-sm font-mono text-right outline-none" 
                                                        value={item.amount} 
                                                        placeholder="0"
                                                        onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                                                        disabled={!isEditing}
                                                    />
                                                    {isEditing && <button onClick={() => deleteItem(item.id)} className="text-red-400 p-1"><X className="w-4 h-4" /></button>}
                                                </div>
                                                {/* Member Allocation for this item */}
                                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                                                    <span className="text-[9px] text-gray-400 mr-1 flex-shrink-0">分給:</span>
                                                    {members.map(m => {
                                                        const isAssigned = (item.assignedTo || []).includes(m.id);
                                                        return (
                                                            <button 
                                                                key={m.id}
                                                                onClick={() => isEditing && toggleItemMember(item.id, m.id)}
                                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${isAssigned ? `${getMemberAvatarColor(m.name)} text-white border-transparent` : 'bg-gray-100 text-gray-400 border-transparent opacity-50'}`}
                                                                disabled={!isEditing}
                                                            >
                                                                {m.name[0]}
                                                            </button>
                                                        )
                                                    })}
                                                    {(!item.assignedTo || item.assignedTo.length === 0) && <span className="text-[9px] text-gray-300 ml-1">全員平分</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-xs text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                                        {isEditing ? '點擊上方 + 新增，或上傳照片由 AI 自動填寫' : '無明細'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isNote && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">備註標題</label>
                            {isEditing ? (
                                <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} />
                            ) : (
                                <div className="text-lg font-bold text-yellow-800 mb-2">{edited.title}</div>
                            )}
                            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase mt-4">內容</label>
                            {isEditing ? (
                                <textarea className="w-full bg-yellow-50 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-yellow-400/50 h-40 resize-none" value={edited.description} onChange={e => handleChange('description', e.target.value)} />
                            ) : (
                                <div className="w-full bg-yellow-50 rounded-xl p-4 text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">{edited.description || '無內容'}</div>
                            )}
                        </div>
                    )}

                    {(isTransport || isProcess) && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">工具/模式</label>
                                    {isEditing ? (
                                        <select value={edited.transportDetail?.mode || 'bus'} onChange={e => handleTransportDetailChange('mode', e.target.value)} className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold outline-none appearance-none">
                                            <option value="bus"> 公車</option><option value="train"> 火車</option><option value="car"> 汽車</option><option value="walk"> 步行</option><option value="flight"> 飛機</option>
                                        </select>
                                    ) : (
                                        <div className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold capitalize">{edited.transportDetail?.mode || 'Bus'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">耗時</label>
                                    {isEditing ? (
                                        <IOSInput value={edited.transportDetail?.duration || ''} onChange={e => handleTransportDetailChange('duration', e.target.value)} placeholder="例: 30 min" />
                                    ) : (
                                        <div className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold">{edited.transportDetail?.duration || '--'}</div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">起點</label>{isEditing ? <IOSInput value={edited.transportDetail?.fromStation || ''} onChange={e => handleTransportDetailChange('fromStation', e.target.value)} /> : <div className="w-full bg-[#F5F5F4] p-3 rounded-xl text-sm">{edited.transportDetail?.fromStation || '-'}</div>}</div>
                                <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">終點</label>{isEditing ? <IOSInput value={edited.transportDetail?.toStation || ''} onChange={e => handleTransportDetailChange('toStation', e.target.value)} /> : <div className="w-full bg-[#F5F5F4] p-3 rounded-xl text-sm">{edited.transportDetail?.toStation || '-'}</div>}</div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">指引/說明</label>{isEditing ? <textarea className="w-full bg-[#F5F5F4] rounded-xl p-3 h-24" value={edited.transportDetail?.instruction || ''} onChange={e => handleTransportDetailChange('instruction', e.target.value)} /> : <div className="w-full bg-[#F5F5F4] rounded-xl p-4 text-sm">{edited.transportDetail?.instruction || '無'}</div>}</div>
                        </>
                    )}

                    {!isTransport && !isNote && !isProcess && !isExpense && (
                        <>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">類型</label>
                                    {isEditing ? (
                                        <select value={edited.type} onChange={e => handleChange('type', e.target.value)} className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold outline-none appearance-none text-sm">
                                            <option value="sightseeing"> 景點</option><option value="food"> 美食</option><option value="shopping"> 購物</option><option value="expense"> 記帳</option><option value="other"> 其他</option>
                                        </select>
                                     ) : (
                                        <div className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold flex items-center gap-2"><Tag type={edited.type} /></div>
                                    )}
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">花費</label>
                                    {isEditing ? (
                                        <IOSInput type="number" value={edited.cost || ''} onChange={e => handleChange('cost', e.target.value)} />
                                    ) : (
                                        <div className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold text-right">{edited.cost !== undefined ? edited.cost : 0}</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">地點</label>
                                {isEditing ? (
                                    <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="w-full bg-[#F5F5F4] rounded-xl py-3 pl-9 pr-3 text-sm outline-none" value={edited.location || ''} onChange={e => handleChange('location', e.target.value)} /></div>
                                ) : (
                                    <a href={`http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent((edited.location || '') + ' ' + edited.title)}`} target="_blank" rel="noreferrer" className="w-full bg-[#F5F5F4] p-3 rounded-xl font-medium text-sm flex items-center gap-2 text-[#45846D]">{edited.location || '未指定'}<ExternalLink className="w-3 h-3 ml-auto opacity-50" /></a>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">備註</label>
                                {isEditing ? <textarea className="w-full bg-[#F5F5F4] rounded-xl p-3 h-32" value={edited.description || ''} onChange={e => handleChange('description', e.target.value)} /> : <div className="w-full bg-white border border-gray-100 rounded-xl p-4 text-sm text-gray-700 min-h-[100px]">{edited.description || '無'}</div>}
                            </div>
                        </>
                    )}

                    {isEditing ? (
                        <div className="pt-4 mt-2">
                            <button onClick={() => { onSave(edited); setIsEditing(false); }} className="w-full py-3.5 rounded-xl bg-[#45846D] text-white font-bold text-sm shadow-lg shadow-[#45846D]/20 active:scale-95 transition-transform flex items-center justify-center gap-2"><Save className="w-4 h-4" /> 儲存變更</button>
                        </div>
                    ) : (
                        <div className="pt-2">
                             <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm active:scale-95 transition-transform">確認</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxOpen && edited.expenseImage && (
                <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxOpen(false)}>
                    <img src={edited.expenseImage} className="max-w-full max-h-full object-contain" />
                    <button className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white"><X className="w-6 h-6" /></button>
                </div>
            )}
        </div>
    );
};

// --- ExpenseDashboard (Enhanced to show all present categories) ---
const ExpenseDashboard: React.FC<{ trip: Trip }> = ({ trip }) => {
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    const [convertedTotal, setConvertedTotal] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    
    // Memoized stats calculation: Now tracks existence separate from cost
    const stats = useMemo(() => {
        return trip.days.reduce((acc, day) => {
            day.activities.forEach(act => {
                const cost = parseCost(act.cost);
                const type = act.type || 'other';
                
                // Mark category as present even if cost is 0
                acc.presentCategories.add(type);
                
                if (cost > 0) {
                    acc.total += cost;
                    acc.byCategory[type] = (acc.byCategory[type] || 0) + cost;
                }
            });
            return acc;
        }, { total: 0, byCategory: {} as Record<string, number>, presentCategories: new Set<string>() });
    }, [trip.days]);

    const categories = [
        { type: 'flight', label: '機票', color: 'bg-purple-500' },
        { type: 'hotel', label: '住宿', color: 'bg-indigo-500' },
        { type: 'transport', label: '交通', color: 'bg-gray-500' },
        { type: 'food', label: '美食', color: 'bg-orange-500' },
        { type: 'cafe', label: '咖啡', color: 'bg-amber-500' },
        { type: 'sightseeing', label: '景點', color: 'bg-blue-500' },
        { type: 'shopping', label: '購物', color: 'bg-pink-500' },
        { type: 'relax', label: '放鬆', color: 'bg-emerald-500' },
        { type: 'bar', label: '酒吧', color: 'bg-violet-500' },
        { type: 'culture', label: '文化', color: 'bg-rose-500' },
        { type: 'activity', label: '體驗', color: 'bg-cyan-500' },
        { type: 'expense', label: '其他', color: 'bg-green-500' },
        { type: 'other', label: '雜項', color: 'bg-gray-400' }
    ];
    
    const handleConvert = async () => { if (convertedTotal || stats.total === 0) { setConvertedTotal(null); return; } setIsConverting(true); const target = currencyCode === 'TWD' ? 'USD' : 'TWD'; const res = await getCurrencyRate(currencyCode, target, stats.total); setConvertedTotal(res); setIsConverting(false); };
    
    return (
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between mb-4">
                <div>
                    <p className="text-xs text-gray-600 font-bold uppercase">總花費 ({currencyCode})</p>
                    <h3 className="text-3xl font-black text-[#1D1D1B] mt-1"><span className="text-lg font-bold text-gray-400 mr-1">{currencySymbol}</span>{stats.total.toLocaleString()}</h3>
                    <div className="h-5 mt-1">{isConverting ? <span className="text-xs text-gray-400 animate-pulse">計算中...</span> : convertedTotal && <span className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-lg">{convertedTotal}</span>}</div>
                </div>
                <button onClick={handleConvert} className="p-3 rounded-full bg-gray-100 text-gray-400"><RefreshCw className="w-5 h-5" /></button>
            </div>
            
            {/* Progress Bar */}
            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-gray-100">{categories.map(c => { const p = stats.total > 0 ? (stats.byCategory[c.type] || 0) / stats.total * 100 : 0; return p > 0 ? <div key={c.type} style={{width:`${p}%`}} className={c.color} /> : null; })}</div>
            
            {/* Detailed Grid - Shows ALL used categories even if cost is 0 */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-4">
                {categories.map(cat => {
                    // Check existence instead of amount
                    if (!stats.presentCategories.has(cat.type)) return null;
                    const amount = stats.byCategory[cat.type] || 0;
                    return (
                        <div key={cat.type} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                                <span className="text-gray-600 font-medium">{cat.label}</span>
                            </div>
                            <span className="font-bold text-[#1D1D1B]">{currencySymbol}{amount.toLocaleString()}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Route Visualization (Google Maps Fix)
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

const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('09:00'); const [type, setType] = useState<string>('sightseeing');
    const handleSubmit = () => { if (!title) return;
    onAdd({ time, title, description: '', type, location: '' }); };
    return (<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10"><h3 className="text-xl font-bold mb-6">新增第 {day} 天</h3><div className="space-y-5"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold text-center" /><select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold"><option value="sightseeing">景點</option><option value="food">美食</option><option value="shopping">購物</option></select></div><button className="w-full py-4 rounded-2xl bg-[#45846D] text-white font-bold" onClick={handleSubmit}>確認</button></div></div></div>);
};

// --- EditTripSettingsModal (with Members) ---
const EditTripSettingsModal: React.FC<{ trip: Trip; onClose: () => void; onUpdate: (t: Trip) => void }> = ({ trip, onClose, onUpdate }) => {
    const [dest, setDest] = useState(trip.destination);
    const [start, setStart] = useState(trip.startDate);
    const [daysCount, setDaysCount] = useState(trip.days.length);
    const [members, setMembers] = useState<Member[]>(trip.members || []);
    const [newMemberName, setNewMemberName] = useState('');

    const handleSave = () => { 
        const s = new Date(start); 
        const e = new Date(s);
        e.setDate(s.getDate() + (daysCount - 1)); 
        let newDays = [...trip.days]; 
        if (daysCount > trip.days.length) { 
            for (let i = trip.days.length + 1; i <= daysCount; i++) newDays.push({ day: i, activities: [] });
        } else {
            newDays = newDays.slice(0, daysCount); 
        }
        onUpdate({ 
            ...trip, 
            destination: dest, 
            startDate: start, 
            endDate: e.toISOString().split('T')[0], 
            days: newDays,
            members: members
        }); 
        onClose(); 
    };

    const addMember = () => {
        if (!newMemberName.trim()) return;
        const newMember: Member = {
            id: Date.now().toString(),
            name: newMemberName.trim()
        };
        setMembers([...members, newMember]);
        setNewMemberName('');
    };

    const removeMember = (id: string) => {
        setMembers(members.filter(m => m.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10 animate-in slide-in-from-bottom">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">編輯行程設定</h3>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-5 overflow-y-auto max-h-[70vh]">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-gray-400">目的地</label><IOSInput value={dest} onChange={e => setDest(e.target.value)} /></div>
                        <div><label className="text-xs font-bold text-gray-400">開始日期</label><input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-[#F5F5F4] p-4 rounded-2xl font-bold" /></div>
                        <div><label className="text-xs font-bold text-gray-400">天數</label><IOSInput type="number" value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} /></div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Members Section */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">旅伴成員</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {members.map(m => (
                                <div key={m.id} className="bg-gray-100 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2">
                                    <span className="text-xs font-bold">{m.name}</span>
                                    <button onClick={() => removeMember(m.id)} className="bg-white rounded-full p-0.5 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                placeholder="輸入名字 (如: Kelvin)" 
                                className="flex-1 bg-[#F5F5F4] rounded-xl px-4 py-3 text-sm outline-none font-bold"
                                value={newMemberName}
                                onChange={e => setNewMemberName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addMember()}
                            />
                            <button onClick={addMember} className="bg-[#1D1D1B] text-white rounded-xl w-12 flex items-center justify-center"><Plus className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <IOSButton fullWidth onClick={handleSave}>儲存變更</IOSButton>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Main View Component
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
    const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false); 
    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const [editingTitle, setEditingTitle] = useState(trip.destination);
    const [showExpenses, setShowExpenses] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    // Plus Menu State
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    const [menuTargetIndex, setMenuTargetIndex] = useState<{dayIdx: number, actIdx: number} | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    // Detail Modal State
    const [selectedActivity, setSelectedActivity] = useState<{ dayIdx: number, actIdx: number, activity: Activity } | null>(null);
    
    const [shareOpen, setShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize default member (Me) if empty
    useEffect(() => {
        if (!trip.members || trip.members.length === 0) {
            onUpdateTrip({ 
                ...trip, 
                members: [{ id: 'me', name: '我', isHost: true }] 
            });
        }
    }, []);

    useEffect(() => { setEditingTitle(trip.destination); }, [trip.destination]);
    const handleTitleBlur = () => { if (editingTitle !== trip.destination) onUpdateTrip({ ...trip, destination: editingTitle }); };
    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => onUpdateTrip({ ...trip, coverImage: reader.result as string }); reader.readAsDataURL(file); } };
    const handleCurrencyChange = (curr: string) => { onUpdateTrip({ ...trip, currency: curr }); setShowSettings(false); };
    const handleShare = () => { const liteTrip = { ...trip, coverImage: '' }; setShareUrl(`${window.location.origin}${window.location.pathname}?import=${btoa(unescape(encodeURIComponent(JSON.stringify(liteTrip))))}`); setShareOpen(true); };
    
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
            newAct = { time: nextTime, title: '新支出', type: 'expense', description: '', cost: 0, payer: trip.members?.[0]?.id }; // Default payer
        }

        if (newAct) {
            newTrip.days[dayIdx].activities.splice(insertIdx, 0, newAct);
            newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
            onUpdateTrip(newTrip);
            
            if (['note', 'expense', 'transport'].includes(type)) {
                setSelectedActivity({ dayIdx, actIdx: insertIdx, activity: newAct });
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
    
    // Dynamic Header Info
    const flightDisplayOrigin = trip.origin || 'ORIGIN';
    const flightDisplayDest = trip.destination || 'DEST';
    const firstType = trip.days[0]?.activities[0]?.type || 'other';

    // Header Background Logic
    const headerBgClass = firstType === 'flight' ? 'bg-[#2C5E4B]' : firstType === 'train' ? 'bg-[#ea580c]' : 'bg-transparent';

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full flex flex-col relative animate-in slide-in-from-right duration-300">
            {/* Header: Boarding Pass Style (Enhanced) */}
            <div className={`flex-shrink-0 h-72 relative group z-10 shadow-lg overflow-hidden ${headerBgClass}`}>
                <button onClick={onBack} className="absolute top-6 left-5 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white z-50 hover:bg-white/20"><ArrowLeft className="w-6 h-6" /></button>
                <div className="absolute top-6 right-5 flex gap-3 z-50">
                    <button onClick={() => setIsEditSettingsOpen(true)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20"><PenTool className="w-5 h-5" /></button>
                    <button onClick={handleShare} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20"><Share className="w-5 h-5" /></button>
                    <button onClick={onDelete} className="w-10 h-10 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-600"><Trash2 className="w-5 h-5" /></button>
                </div>
                
                {/* Background Logic */}
                {(firstType !== 'flight' && firstType !== 'train') && (
                    <>
                        <img src={trip.coverImage} className="w-full h-full object-cover opacity-60" alt="Cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1B] via-[#1D1D1B]/40 to-transparent" />
                    </>
                )}
                
                {/* Boarding Pass Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-20 pt-20">
                    <div className="absolute top-20 left-6 right-6">
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

                    <div className="mt-auto">
                        <div className="mb-3">
                            <input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onBlur={handleTitleBlur} className="text-4xl font-bold bg-transparent border-none outline-none text-white placeholder-white/50 w-full p-0 m-0 focus:ring-0 font-serif tracking-wide" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-white/80">
                            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">
                                <Calendar className="w-4 h-4" /> 
                                <span className="text-sm font-mono font-bold tracking-wide">{trip.startDate}</span>
                            </div>
                            <div className="text-sm font-bold bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">{trip.days.length} DAYS</div>
                            <button onClick={() => setShowExpenses(!showExpenses)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-[#45846D] text-white ml-auto hover:bg-[#3A705C] transition-colors"><Wallet className="w-4 h-4" /> {currencyCode}</button>
                            <button onClick={() => setShowSettings(!showSettings)} className="bg-white/20 backdrop-blur-md p-1 rounded-full text-white border border-white/10"><Settings className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
                
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-24 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all z-20"><Camera className="w-5 h-5" /></button>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />
                
                {showSettings && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in">
                        <div className="absolute inset-0 bg-[#1D1D1B]/80 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
                        <div className="bg-white w-full max-w-xs rounded-2xl p-4 relative z-10 shadow-2xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-[#1D1D1B]">選擇幣別</h3><button onClick={() => setShowSettings(false)} className="p-1 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1">{Object.keys(CURRENCY_SYMBOLS).map(cur => (<button key={cur} onClick={() => handleCurrencyChange(cur)} className={`w-full flex justify-between items-center px-4 py-3 rounded-xl text-sm font-medium ${currencyCode === cur ? 'bg-[#45846D] text-white' : 'bg-gray-50'}`}><span>{CURRENCY_LABELS[cur] || cur}</span><span className="font-mono">{CURRENCY_SYMBOLS[cur]}</span></button>))}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* List / Map Toggle */}
            {!showSettings && (
                <>
                    <div className="flex-shrink-0 px-5 pt-4 pb-2 bg-[#E4E2DD] z-10 border-b border-gray-200/50">
                        <div className="bg-white/50 p-1 rounded-2xl flex shadow-inner">
                            <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><List className="w-4 h-4" /> 列表</button>
                            <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><Map className="w-4 h-4" /> 地圖</button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-safe w-full scroll-smooth no-scrollbar">
                        {showExpenses && <ExpenseDashboard trip={trip} />}
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="py-4 space-y-10">
                                {trip.days.map((day, dayIndex) => (
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
                                                        {day.activities.map((act, index) => (
                                                            <div key={`${day.day}-${index}`}>
                                                                <Draggable draggableId={`${day.day}-${index}`} index={index}>
                                                                    {(provided, snapshot) => (
                                                                        act.type === 'process' ? (
                                                                            <ProcessItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} />
                                                                        ) : act.type === 'transport' ? (
                                                                            <TransportConnectorItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} />
                                                                        ) : act.type === 'note' ? (
                                                                            <NoteItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} />
                                                                        ) : act.type === 'expense' ? (
                                                                            <ExpensePolaroid act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} currencySymbol={currencySymbol} members={trip.members} />
                                                                        ) : (
                                                                            <ActivityItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} currencySymbol={currencySymbol} />
                                                                        )
                                                                    )}
                                                                </Draggable>
                                                                {/* Ghost Insert Button (Between Items) */}
                                                                <GhostInsertButton onClick={() => { setMenuTargetIndex({ dayIdx: dayIndex, actIdx: index }); setIsPlusMenuOpen(true); }} />
                                                            </div>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        ) : (
                                            <RouteVisualization day={day} destination={trip.destination} />
                                        )}
                                    </div>
                                ))}
                                <div className="h-24"></div>
                            </div>
                        </DragDropContext>
                    </div>
                </>
            )}
            
            {isAddModalOpen && (
                <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />
            )}

            {isEditSettingsOpen && (
                <EditTripSettingsModal 
                    trip={trip} 
                    onClose={() => setIsEditSettingsOpen(false)} 
                    onUpdate={(t) => { onUpdateTrip(t); setIsEditSettingsOpen(false); }} 
                />
            )}

            {selectedActivity && (
                <ActivityDetailModal 
                    act={selectedActivity.activity}
                    onClose={() => setSelectedActivity(null)}
                    onSave={handleUpdateActivity}
                    onDelete={() => handleDeleteActivity(selectedActivity.dayIdx, selectedActivity.actIdx)}
                    members={trip.members}
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