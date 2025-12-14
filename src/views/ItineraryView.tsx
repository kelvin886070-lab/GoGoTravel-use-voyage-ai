import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, Trash2, Camera, List, Map, Plus, GripVertical, Wallet, 
    ArrowLeftRight, Settings, X, Utensils, Bed, Bus, Plane, Tag as TagIcon, 
    RefreshCw, PenTool, Share, Train, Calendar, AlertTriangle, 
    Car, Footprints, TramFront, Clock, MapPin, ChevronRight, Edit3, Save, ExternalLink,
    StickyNote, Banknote, Sparkles, UserCheck, PlaneTakeoff, PlaneLanding, PlusCircle
} from 'lucide-react';
import type { Trip, TripDay, Activity } from '../types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { IOSInput, IOSShareSheet, IOSButton } from '../components/UI';
import { getCurrencyRate, suggestNextSpot } from '../services/gemini';
import { recalculateTimeline } from '../services/timeline';

// --- Constants ---
const CURRENCY_SYMBOLS: Record<string, string> = {
    'TWD': 'NT$', 'USD': '$', 'JPY': '¥', 'KRW': '₩', 'EUR': '€', 'CNY': '¥', 'HKD': 'HK$'
};

const CURRENCY_LABELS: Record<string, string> = {
    'TWD': '新台幣', 'USD': '美金', 'JPY': '日圓', 'KRW': '韓元', 'EUR': '歐元', 'CNY': '人民幣', 'HKD': '港幣'
};

const parseCost = (costStr?: string | number): number => {
    if (!costStr) return 0;
    if (typeof costStr === 'number') return costStr;
    const cleanStr = costStr.toString().replace(/,/g, '');
    const match = cleanStr.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
    return 0;
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

// --- Ghost Button (Insert Helper) ---
const GhostInsertButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="h-6 -my-3 relative group z-10 flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* 感應區 */}
        <div className="absolute inset-0 bg-transparent" />
        {/* 視覺線條 (hover時顯示) */}
        <div className="w-[2px] h-full bg-[#45846D] opacity-0 group-hover:opacity-100 transition-opacity absolute left-[26px]" />
        {/* 按鈕本體 */}
        <div className="w-6 h-6 rounded-full bg-[#45846D] text-white flex items-center justify-center shadow-md transform scale-0 group-hover:scale-100 transition-all absolute left-[15px]">
            <Plus className="w-4 h-4" />
        </div>
    </div>
);

// --- Process Item (Immigration/Check-in Pill) ---
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
            {/* 左側連接線 */}
            <div className="flex flex-col items-center w-[55px] self-stretch relative">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div>
            </div>

            {/* 中間膠囊 */}
            <div className="flex-1 flex items-center">
                <div className="bg-slate-100 border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer hover:bg-slate-200">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{act.title}</span>
                    <div className="w-px h-3 bg-slate-300 mx-1"></div>
                    <span className="text-xs font-mono text-slate-500">{detail?.duration || '60 min'}</span>
                </div>
                {/* 拖曳手把 (隱藏式) */}
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
            <div className="flex-1 bg-gray-50/80 rounded-xl p-3 border border-gray-200/50 flex items-center justify-between gap-3 backdrop-blur-sm active:scale-[0.98] transition-transform cursor-pointer hover:bg-gray-100/80">
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
                        <div className="text-xs text-gray-800 font-bold flex items-center gap-1 truncate">
                            <span>{detail.fromStation || '起點'}</span>
                            <ArrowLeftRight className="w-3 h-3 text-gray-400" />
                            <span>{detail.toStation || '終點'}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-800 font-medium truncate">
                            {detail?.instruction || act.description || '移動至下個地點'}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
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

// --- Expense Item ---
const ExpenseItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    const displayCost = act.cost !== undefined ? Number(act.cost).toLocaleString() : '0';
    return (
        <div 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`flex gap-3 py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col items-center w-[55px] pt-2">
                <Banknote className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex-1 bg-green-50 rounded-xl p-3 border border-green-100 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                <div className="min-w-0 flex items-center gap-2">
                    <h4 className="font-bold text-green-800 text-sm truncate">{act.title || '支出'}</h4>
                    <span className="text-xs font-bold bg-white text-green-600 px-2 py-0.5 rounded-full shadow-sm border border-green-100">
                        {currencySymbol} {displayCost}
                    </span>
                </div>
                <div {...provided.dragHandleProps} className="text-green-300 p-1" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

// --- Activity Item (Read-Only) ---
const ActivityItem: React.FC<{ act: Activity, onClick: () => void, provided: any, snapshot: any, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    // 修正：0元顯示邏輯
    const displayCost = act.cost !== undefined ? Number(act.cost).toLocaleString() : null;

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

// --- Activity Detail Modal ---
const ActivityDetailModal: React.FC<{ 
    act: Activity; 
    onClose: () => void; 
    onSave: (updatedAct: Activity) => void; 
    onDelete: () => void; 
}> = ({ act, onClose, onSave, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [edited, setEdited] = useState<Activity>({ ...act });
    
    useEffect(() => {
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
                    {/* Time & Title */}
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
                                            <option value="bus">🚌 公車</option><option value="train">🚄 火車</option><option value="car">🚗 汽車</option><option value="walk">🚶 步行</option><option value="flight">✈️ 飛機</option>
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

                    {!isTransport && !isNote && !isProcess && (
                        <>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">類型</label>
                                    {isEditing ? (
                                        <select value={edited.type} onChange={e => handleChange('type', e.target.value)} className="w-full bg-[#F5F5F4] p-3 rounded-xl font-bold outline-none appearance-none text-sm">
                                            <option value="sightseeing">📷 景點</option><option value="food">🍴 美食</option><option value="shopping">🛍️ 購物</option><option value="expense">💸 記帳</option><option value="other">📦 其他</option>
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
                            {!isExpense && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">地點</label>
                                    {isEditing ? (
                                        <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="w-full bg-[#F5F5F4] rounded-xl py-3 pl-9 pr-3 text-sm outline-none" value={edited.location || ''} onChange={e => handleChange('location', e.target.value)} /></div>
                                    ) : (
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((edited.location || '') + ' ' + edited.title)}`} target="_blank" rel="noreferrer" className="w-full bg-[#F5F5F4] p-3 rounded-xl font-medium text-sm flex items-center gap-2 text-[#45846D]">{edited.location || '未指定'}<ExternalLink className="w-3 h-3 ml-auto opacity-50" /></a>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">備註</label>
                                {isEditing ? <textarea className="w-full bg-[#F5F5F4] rounded-xl p-3 h-32" value={edited.description || ''} onChange={e => handleChange('description', e.target.value)} /> : <div className="w-full bg-white border border-gray-100 rounded-xl p-4 text-sm text-gray-700 min-h-[100px]">{edited.description || '無'}</div>}
                            </div>
                        </>
                    )}

                    {/* Footer Actions: Save Button */}
                    {isEditing ? (
                        <div className="pt-4 mt-2">
                            <button onClick={() => { onSave(edited); setIsEditing(false); }} className="w-full py-3.5 rounded-xl bg-[#45846D] text-white font-bold text-sm shadow-lg shadow-[#45846D]/20 active:scale-95 transition-transform flex items-center justify-center gap-2"><Save className="w-4 h-4" /> 儲存變更</button>
                        </div>
                    ) : (
                        <div className="pt-2">
                             {/* Non-editing mode close/confirm button (requested feature) */}
                             <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm active:scale-95 transition-transform">確認</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ExpenseDashboard ---
const ExpenseDashboard: React.FC<{ trip: Trip }> = ({ trip }) => {
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    const [convertedTotal, setConvertedTotal] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const stats = useMemo(() => {
        return trip.days.reduce((acc, day) => {
            day.activities.forEach(act => {
                const cost = parseCost(act.cost);
                if (cost > 0) {
                    acc.total += cost;
                    const type = act.type || 'other'; 
                    acc.byCategory[type] = (acc.byCategory[type] || 0) + cost;
                }
            });
            return acc;
        }, { total: 0, byCategory: {} as Record<string, number> });
    }, [trip.days]);
    const categories = [{ type: 'flight', label: '機票', color: 'bg-purple-500' }, { type: 'hotel', label: '住宿', color: 'bg-indigo-500' }, { type: 'transport', label: '交通', color: 'bg-gray-500' }, { type: 'food', label: '美食', color: 'bg-orange-500' }, { type: 'cafe', label: '咖啡', color: 'bg-amber-500' }, { type: 'sightseeing', label: '景點', color: 'bg-blue-500' }, { type: 'shopping', label: '購物', color: 'bg-pink-500' }, { type: 'relax', label: '放鬆', color: 'bg-emerald-500' }, { type: 'expense', label: '其他', color: 'bg-green-500' }];
    const handleConvert = async () => { if (convertedTotal || stats.total === 0) { setConvertedTotal(null); return; } setIsConverting(true); const target = currencyCode === 'TWD' ? 'USD' : 'TWD'; const res = await getCurrencyRate(currencyCode, target, stats.total); setConvertedTotal(res); setIsConverting(false); };
    return (<div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-6"><div className="flex justify-between mb-4"><div><p className="text-xs text-gray-500 font-bold uppercase">總花費 ({currencyCode})</p><h3 className="text-3xl font-black text-[#1D1D1B] mt-1"><span className="text-lg font-bold text-gray-400 mr-1">{currencySymbol}</span>{stats.total.toLocaleString()}</h3><div className="h-5 mt-1">{isConverting ? <span className="text-xs text-gray-400 animate-pulse">計算中...</span> : convertedTotal && <span className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-lg">{convertedTotal}</span>}</div></div><button onClick={handleConvert} className="p-3 rounded-full bg-gray-100 text-gray-400"><RefreshCw className="w-5 h-5" /></button></div><div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-gray-100">{categories.map(c => { const p = stats.total > 0 ? (stats.byCategory[c.type] || 0) / stats.total * 100 : 0; return p > 0 ? <div key={c.type} style={{width:`${p}%`}} className={c.color} /> : null; })}</div></div>);
};

const RouteVisualization: React.FC<{ day: TripDay; destination: string }> = ({ day, destination }) => {
    const { stops, mapUrl } = useMemo(() => {
        const _stops = day.activities.filter(a => a.type !== 'transport' && a.type !== 'note' && a.type !== 'expense' && a.type !== 'process').filter(a => a.title || a.location).map(a => a.location || a.title);
        let _mapUrl = '';
        if (_stops.length === 0) _mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
        else if (_stops.length === 1) _mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(_stops[0])}`;
        else { const origin = encodeURIComponent(_stops[0]); const dest = encodeURIComponent(_stops[_stops.length - 1]); const waypoints = _stops.slice(1, -1).map(s => encodeURIComponent(s)).join('|'); _mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`; }
        return { stops: _stops, mapUrl: _mapUrl };
    }, [day.activities, destination]);
    return (<div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mt-2"><div className="h-24 bg-[#45846D]/5 flex items-center justify-center relative"><Map className="w-8 h-8 text-[#45846D] opacity-50" /></div><div className="p-5">{stops.length===0?<div className="text-center text-gray-400 text-sm">暫無地點</div>:<><div className="space-y-0 mb-6 pl-2">{stops.map((s, i) => (<div key={i} className="flex gap-4"><div className="flex flex-col items-center w-4"><div className="w-3 h-3 rounded-full bg-[#45846D]"></div>{i!==stops.length-1&&<div className="w-[2px] flex-1 bg-gray-100"></div>}</div><p className="text-sm pb-5">{s}</p></div>))}</div><a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#45846D] text-white font-bold py-3.5 rounded-2xl">開啟導航</a></>}</div></div>);
};

const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState(''); const [time, setTime] = useState('09:00'); const [type, setType] = useState<string>('sightseeing');
    const handleSubmit = () => { if (!title) return; onAdd({ time, title, description: '', type, location: '' }); };
    return (<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10"><h3 className="text-xl font-bold mb-6">新增第 {day} 天</h3><div className="space-y-4"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold text-center" /><select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold"><option value="sightseeing">景點</option><option value="food">美食</option><option value="shopping">購物</option></select></div><button className="w-full py-4 rounded-2xl bg-[#45846D] text-white font-bold" onClick={handleSubmit}>確認</button></div></div></div>);
};

// --- EditTripSettingsModal ---
const EditTripSettingsModal: React.FC<{ trip: Trip; onClose: () => void; onUpdate: (t: Trip) => void }> = ({ trip, onClose, onUpdate }) => {
    const [dest, setDest] = useState(trip.destination);
    const [start, setStart] = useState(trip.startDate);
    const [daysCount, setDaysCount] = useState(trip.days.length);
    const handleSave = () => { const s = new Date(start); const e = new Date(s); e.setDate(s.getDate() + (daysCount - 1)); let newDays = [...trip.days]; if (daysCount > trip.days.length) { for (let i = trip.days.length + 1; i <= daysCount; i++) newDays.push({ day: i, activities: [] }); } else newDays = newDays.slice(0, daysCount); onUpdate({ ...trip, destination: dest, startDate: start, endDate: e.toISOString().split('T')[0], days: newDays }); onClose(); };
    return (<div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-[#1D1D1B]">編輯行程資訊</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="space-y-4"><div><label className="text-xs font-bold text-gray-400">目的地</label><IOSInput value={dest} onChange={e => setDest(e.target.value)} /></div><div><label className="text-xs font-bold text-gray-400">開始日期</label><input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-[#F5F5F4] p-4 rounded-2xl font-bold" /></div><div><label className="text-xs font-bold text-gray-400">天數</label><IOSInput type="number" value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} /></div><IOSButton fullWidth onClick={handleSave}>儲存變更</IOSButton></div></div></div>);
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

    // 5-Button Menu Logic (INSERT AT SPECIFIC INDEX)
    const handleQuickAdd = async (type: 'activity' | 'transport' | 'note' | 'expense' | 'ai') => {
        setIsPlusMenuOpen(false);
        if (!menuTargetIndex) return;
        const { dayIdx, actIdx } = menuTargetIndex;
        
        // 如果是 'activity'，開啟舊的 Modal (暫時解法，理想應可插入指定位置)
        if (type === 'activity') {
            setActiveDayForAdd(dayIdx + 1);
            setIsAddModalOpen(true);
            return;
        }

        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const insertIdx = actIdx + 1; // 插入在點擊的按鈕之後
        
        // Get previous activity time to set default
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
            newAct = { time: nextTime, title: '新支出', type: 'expense', description: '', cost: 0 };
        }

        if (newAct) {
            newTrip.days[dayIdx].activities.splice(insertIdx, 0, newAct);
            newTrip.days[dayIdx] = recalculateTimeline(newTrip.days[dayIdx]);
            onUpdateTrip(newTrip);
            
            // Auto open modal for editing
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

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full flex flex-col relative animate-in slide-in-from-right duration-300">
            {/* Header: Boarding Pass Style (Enhanced) */}
            <div className="flex-shrink-0 h-72 relative group z-10 shadow-lg overflow-hidden bg-[#1D1D1B]">
                <button onClick={onBack} className="absolute top-6 left-5 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white z-50 hover:bg-white/20"><ArrowLeft className="w-6 h-6" /></button>
                <div className="absolute top-6 right-5 flex gap-3 z-50">
                    <button onClick={() => setIsEditSettingsOpen(true)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20"><PenTool className="w-5 h-5" /></button>
                    <button onClick={handleShare} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20"><Share className="w-5 h-5" /></button>
                    <button onClick={onDelete} className="w-10 h-10 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-600"><Trash2 className="w-5 h-5" /></button>
                </div>
                
                {/* Background with Gradient Overlay */}
                <img src={trip.coverImage} className="w-full h-full object-cover opacity-60" alt="Cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1B] via-[#1D1D1B]/40 to-transparent" />
                
                {/* Boarding Pass Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-20 pt-20">
                    <div className="absolute top-20 left-6 right-6">
                        <div className="flex justify-between items-end border-b border-white/20 pb-4 mb-4">
                            <div>
                                <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">FROM</span>
                                <span className="text-5xl font-black font-sans tracking-tight text-white">{flightDisplayOrigin}</span>
                            </div>
                            <div className="mb-2 opacity-80 animate-pulse">
                                <Plane className="w-8 h-8 text-white rotate-90" />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] block mb-1 uppercase">TO</span>
                                <span className="text-5xl font-black font-sans tracking-tight text-white">{flightDisplayDest}</span>
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
                                        {viewMode === 'list' ?
                                        (
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
                                                                            <ExpenseItem act={act} onClick={() => setSelectedActivity({ dayIdx: dayIndex, actIdx: index, activity: act })} provided={provided} snapshot={snapshot} currencySymbol={currencySymbol} />
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