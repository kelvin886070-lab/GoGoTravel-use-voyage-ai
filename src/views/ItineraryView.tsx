import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Camera, List, Map, Plus, GripVertical, Wallet, ArrowLeftRight, Settings, X, Utensils, Bed, Bus, Plane, Tag as TagIcon, RefreshCw } from 'lucide-react';
import type { Trip, TripDay, Activity } from '../types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { IOSInput } from '../components/UI';
import { getCurrencyRate } from '../services/gemini';

// --- Helpers ---
const addMinutes = (timeStr: string, minutes: number): string => {
    try {
        if (!timeStr) return "09:00";
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h || 0, m || 0, 0, 0);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return timeStr; }
};
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
        default: { color: 'bg-gray-100 text-gray-600', label: '其他', icon: TagIcon }
    };
    const { color, label, icon: Icon } = config[type] || config.default;
    return (
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide transition-colors flex items-center gap-1 w-fit ${color}`}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
};

const EditableTag: React.FC<{ type: string, onChange: (newType: string) => void }> = ({ type, onChange }) => {
    return (
        <div className="relative group cursor-pointer w-fit">
            <Tag type={type} />
            <select value={type} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[0px]">
                <optgroup label="基本">
                    <option value="sightseeing">景點</option><option value="food">美食</option><option value="transport">交通</option><option value="flight">航班</option><option value="hotel">住宿</option>
                </optgroup>
                <optgroup label="休閒娛樂">
                    <option value="cafe">咖啡廳</option><option value="shopping">購物</option><option value="bar">酒吧</option><option value="relax">放鬆/SPA</option>
                </optgroup>
                <optgroup label="其他">
                    <option value="culture">文化/展覽</option><option value="activity">體驗活動</option>
                </optgroup>
            </select>
        </div>
    );
};

const AutoWidthInput: React.FC<{ value: string | number, onChange: (val: string) => void, placeholder?: string, className?: string }> = ({ value, onChange, placeholder = '', className }) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState(35);
    useEffect(() => { if (spanRef.current) setWidth(Math.max(35, spanRef.current.offsetWidth + 15)); }, [value]);
    const displayValue = (value === 0 || value === '0') ? '0' : (value || '');
    return (
        <div className="relative inline-block">
            <span ref={spanRef} className={`absolute opacity-0 pointer-events-none whitespace-pre ${className}`}>{displayValue || placeholder}</span>
            <input type="text" value={displayValue} placeholder={placeholder} onChange={(e) => { const val = e.target.value; if (/^\d*\.?\d*$/.test(val)) onChange(val); }} style={{ width }} className={`bg-transparent outline-none text-center min-w-[35px] ${className} placeholder:text-gray-300`} />
        </div>
    );
};

const EditableText: React.FC<{ value: string, onSave: (val: string) => void, className?: string }> = ({ value, onSave, className }) => {
    const [text, setText] = useState(value);
    useEffect(() => { setText(value); }, [value]);
    return <input type="text" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== value) onSave(text);
    }} className={`bg-transparent outline-none min-w-0 ${className}`} />;
};

// --- ExpenseDashboard ---
const ExpenseDashboard: React.FC<{ trip: Trip }> = ({ trip }) => {
    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    
    const [convertedTotal, setConvertedTotal] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const stats = trip.days.reduce((acc, day) => {
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
        { type: 'other', label: '其他', color: 'bg-gray-400' },
    ];
    const handleConvert = async () => {
        if (convertedTotal || stats.total === 0) {
             setConvertedTotal(null);
             return;
        }
        setIsConverting(true);
        const targetCurrency = currencyCode === 'TWD' ? 'USD' : 'TWD';
        const res = await getCurrencyRate(currencyCode, targetCurrency, stats.total);
        setConvertedTotal(res);
        setIsConverting(false);
    };
    return (
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">總花費 ({currencyCode})</p>
                    <h3 className="text-3xl font-black text-[#1D1D1B] mt-1 tracking-tight">
                        <span className="text-lg font-bold text-gray-400 mr-1">{currencySymbol}</span>
                        {stats.total.toLocaleString()}
                    </h3>
                    
                    <div className="h-5 mt-1"> 
                        {isConverting ? (
                            <span className="text-xs text-gray-400 flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> 計算即時匯率中...
                            </span>
                        ) : convertedTotal ? (
                            <span className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-lg">
                                {convertedTotal}
                            </span>
                        ) : null}
                    </div>
                </div>
                
                <button 
                    onClick={handleConvert}
                    className={`p-3 rounded-full transition-all active:scale-90 ${convertedTotal ? 'bg-[#45846D]/10 text-[#45846D]' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="換算匯率"
                >
                    {isConverting ?
                    <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowLeftRight className="w-5 h-5" />}
                </button>
            </div>

            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-gray-100">
                {categories.map(cat => {
                    const amount = stats.byCategory[cat.type] || 0;
                    const percent = stats.total > 0 ? (amount / stats.total) * 100 : 0;
                    if (percent === 0) return null;
                    return <div key={cat.type} style={{ width: `${percent}%` }} className={cat.color} title={cat.label} />;
                })}
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {categories.map(cat => {
                    const amount = stats.byCategory[cat.type] || 0;
                    if (amount === 0) return null;
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

// 修正 Google Maps 路徑連結格式 & 綠色配色
const RouteVisualization: React.FC<{ day: TripDay;
    destination: string }> = ({ day, destination }) => {
    const stops = day.activities
        .filter(a => a.title || a.location)
        .map(a => a.location || a.title);
    let mapUrl = '';

    if (stops.length === 0) {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    } else if (stops.length === 1) {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
    } else {
        const origin = encodeURIComponent(stops[0]);
        const dest = encodeURIComponent(stops[stops.length - 1]);
        const waypoints = stops.slice(1, -1).map(s => encodeURIComponent(s)).join('|');
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`;
    }

    return (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mt-2">
            {/* 修正：地圖背景改為綠色系 */}
            <div className="h-24 bg-[#45846D]/5 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#45846D_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <Map className="w-8 h-8 text-[#45846D] opacity-50" />
                {stops.length > 1 && (
                    <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[10px] text-[#45846D] font-bold uppercase tracking-widest z-10">
                        <span className="bg-white/80 backdrop-blur px-1.5 rounded">START</span>
                        <div className="h-[2px] flex-1 bg-[#45846D]/20 mx-2 relative flex items-center">
                            <div className="w-1 h-1 rounded-full bg-[#45846D]/40 ml-1"></div>
                            <div className="w-1 h-1 rounded-full bg-[#45846D]/40 ml-2"></div>
                            <div className="absolute right-0 -top-[3px] w-2 h-2 rounded-full bg-[#45846D]"></div>
                        </div>
                        <span className="bg-white/80 backdrop-blur px-1.5 rounded">END</span>
                    </div>
                )}
            </div>
            
            <div className="p-5">
                {stops.length === 0 ?
                (
                    <div className="text-center text-gray-400 text-sm py-4">
                        今天還沒有安排行程地點<br/>點擊上方「+」開始規劃
                    </div>
                ) : (
                    <>
                        <div className="space-y-0 mb-6 pl-2">
                            {stops.map((stop, index) => (
                                <div key={index} className="flex gap-4 relative">
                                    <div className="flex flex-col items-center w-4">
                                        <div className={`w-3 h-3 rounded-full border-2 z-10 box-content ${index === 0 ? 'bg-[#45846D] border-white shadow-sm' : index === stops.length - 1 
                                        ? 'bg-red-500 border-white shadow-sm' : 'bg-gray-200 border-white'}`}></div>
                                        {index !== stops.length - 1 && <div className="w-[2px] flex-1 bg-gray-100 my-0.5"></div>}
                                    </div>
                                    <div className="pb-5 -mt-1 flex-1">
                                        <p className={`text-sm ${index === 0 ||
                                        index === stops.length - 1 ? 'font-bold text-[#1D1D1B]' : 'font-medium text-gray-600'}`}>{stop}</p>
                                        {index === 0 && <span className="inline-block mt-1 text-[10px] text-[#45846D] bg-[#45846D]/10 px-1.5 py-0.5 rounded font-medium">起點</span>}
                                        {index === stops.length - 1 && <span className="inline-block mt-1 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">終點</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <a 
                            href={mapUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center justify-center gap-2 w-full bg-[#45846D] text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-[#45846D]/20 hover:bg-[#3A705C]"
                        >
                            <Map className="w-5 h-5" /> 開啟 Google Maps 導航
                        </a>
                        <p className="text-center text-[10px] text-gray-400 mt-3">將自動帶入所有途經點規劃最佳路線</p>
                    </>
                )}
            </div>
        </div>
    );
};

const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void;
}> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('09:00'); 
    const [type, setType] = useState<string>('sightseeing'); 
    const [description, setDescription] = useState(''); 
    const [location, setLocation] = useState('');
    const handleSubmit = () => { if (!title) return; onAdd({ time, title, description, type, location }); };
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-[#1D1D1B]">新增第 {day} 天</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="space-y-4"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 outline-none font-bold text-center" /><select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 outline-none font-bold"><optgroup label="基本"><option value="sightseeing">景點</option><option value="food">美食</option><option value="transport">交通</option><option value="flight">航班</option><option value="hotel">住宿</option></optgroup><optgroup label="休閒娛樂"><option value="cafe">咖啡廳</option><option value="shopping">購物</option><option value="bar">酒吧</option><option value="relax">放鬆/SPA</option></optgroup><optgroup label="其他"><option value="culture">文化/展覽</option><option value="activity">體驗活動</option></optgroup></select></div><button className="w-full py-4 rounded-2xl bg-[#45846D] text-white font-bold active:scale-95 
        transition-transform shadow-lg shadow-[#45846D]/20" onClick={handleSubmit}>確認</button></div></div></div>
    );
};

// --- Main View Component ---

interface ItineraryViewProps { 
    trip: Trip;
    onBack: () => void;
    onDelete: () => void; 
    onUpdateTrip: (t: Trip) => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ trip, onBack, onDelete, onUpdateTrip }) => {
    const [viewMode, setViewMode] = useState<'list' |
    'map'>('list');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const [editingTitle, setEditingTitle] = useState(trip.destination);
    const [showExpenses, setShowExpenses] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const currencyCode = trip.currency || 'TWD';
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setEditingTitle(trip.destination); }, [trip.destination]);
    const handleTitleBlur = () => {
        if (editingTitle !== trip.destination && editingTitle.trim() !== "") {
            onUpdateTrip({ ...trip, destination: editingTitle });
        } else if (editingTitle.trim() === "") {
             setEditingTitle(trip.destination);
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImage = reader.result as string;
                onUpdateTrip({ ...trip, coverImage: newImage });
            };
            reader.readAsDataURL(file);
        }
    };
    const handleCurrencyChange = (newCurrency: string) => {
        onUpdateTrip({ ...trip, currency: newCurrency });
        setShowSettings(false);
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const sourceDayIndex = parseInt(result.source.droppableId.replace('day-', '')) - 1;
        const destDayIndex = parseInt(result.destination.droppableId.replace('day-', '')) - 1;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const [movedActivity] = newTrip.days[sourceDayIndex].activities.splice(result.source.index, 1);
        newTrip.days[destDayIndex].activities.splice(result.destination.index, 0, movedActivity);
        const dayActivities = newTrip.days[destDayIndex].activities;
        if (dayActivities.length > 0) {
            let currentTime = dayActivities[0].time;
            for (let i = 1; i < dayActivities.length; i++) {
                currentTime = addMinutes(currentTime, 90);
                dayActivities[i].time = currentTime;
            }
        }
        onUpdateTrip(newTrip);
    };

    const handleActivityUpdate = (dayIndex: number, actIndex: number, field: keyof Activity, value: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        (newTrip.days[dayIndex].activities[actIndex] as any)[field] = value;
        onUpdateTrip(newTrip);
    };

    const handleAddActivity = (newActivity: Activity) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[activeDayForAdd - 1].activities.push(newActivity);
        newTrip.days[activeDayForAdd - 1].activities.sort((a: any, b: any) => a.time.localeCompare(b.time));
        onUpdateTrip(newTrip);
        setIsAddModalOpen(false);
    };
    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        if(!confirm("確定要刪除？")) return;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[dayIndex].activities.splice(activityIndex, 1);
        onUpdateTrip(newTrip);
    }

    const openAddModal = (day: number) => { setActiveDayForAdd(day);
    setIsAddModalOpen(true); };

    return (
        <div className="bg-[#E4E2DD] h-[100dvh] w-full flex flex-col relative animate-in slide-in-from-right duration-300">
            {/* Header Image */}
            <div className="flex-shrink-0 h-64 relative group z-10 shadow-sm">
                <img src={trip.coverImage} className="w-full h-full object-cover" alt="Cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
                
                <button onClick={onBack} className="absolute top-12 left-5 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10"><ArrowLeft className="w-6 h-6" /></button>
                <button onClick={onDelete} className="absolute top-12 right-5 w-10 h-10 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10"><Trash2 className="w-5 h-5" /></button>
                
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-6 right-5 w-9 h-9 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-20 shadow-sm"><Camera className="w-5 h-5" /></button>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />

                <div className="absolute bottom-6 left-5 text-white pr-14 w-full">
                    <input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onBlur={handleTitleBlur} className="text-3xl font-bold drop-shadow-md bg-transparent border-none outline-none 
                    text-white placeholder-white/70 w-full p-0 m-0 focus:ring-0 font-serif" />
                    <div className="flex items-center gap-3 mt-2 relative">
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium">{trip.days.length} 天行程</span>
                        {/* 修正：切換按鈕顏色改為綠色 */}
                        <button onClick={() => setShowExpenses(!showExpenses)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors 
                        ${showExpenses ? 'bg-[#45846D] text-white' : 'bg-white/20 backdrop-blur-md text-white'}`}><Wallet className="w-3 h-3" />{currencyCode} {showExpenses ?
                        '隱藏' : '統計'}</button>
                        <button onClick={() => setShowSettings(!showSettings)} className="bg-white/20 backdrop-blur-md p-1 rounded-full text-white hover:bg-white/30 transition-colors"><Settings className="w-3 h-3" /></button>
                        
                        {showSettings && (
                            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in">
                                <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
                                <div 
                                className="bg-white w-full max-w-xs rounded-2xl p-4 relative z-10 shadow-2xl animate-in zoom-in-95">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-[#1D1D1B]">選擇幣別</h3>
                                        <button onClick={() => setShowSettings(false)} className="p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1">
                                        {Object.keys(CURRENCY_SYMBOLS).map(cur => (
                                            <button key={cur} onClick={() => handleCurrencyChange(cur)} className={`w-full flex justify-between items-center px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 ${currencyCode === cur ?
                                            'bg-[#45846D] text-white shadow-md' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'}`}>
                                                <span>{CURRENCY_LABELS[cur] ||
                                                cur}</span><span className={`font-mono ${currencyCode === cur ? 'text-white/80' : 'text-gray-400'}`}>{CURRENCY_SYMBOLS[cur]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            {!showSettings && (
                <>
                    <div className="flex-shrink-0 px-5 pt-4 pb-2 bg-[#E4E2DD] z-10 border-b border-gray-200/50">
                        <div className="bg-white/50 p-1 rounded-2xl flex">
                            <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm 
                            font-bold rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><List className="w-4 h-4" /> 列表</button>
                            <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${viewMode === 'map' ?
                            'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-500'}`}><Map className="w-4 h-4" /> 地圖</button>
                        </div>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 
                    pb-safe w-full scroll-smooth no-scrollbar">
                        {showExpenses && <ExpenseDashboard trip={trip} />}
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="py-4 space-y-10">
                                {trip.days.map((day, dayIndex) => (
                                    <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-[#45846D]/20">
                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#45846D] border-4 border-[#E4E2DD] shadow-sm" />
                                        <div className="flex justify-between items-center mb-4 -mt-1">
                                            <h2 className="text-xl font-bold text-[#1D1D1B]">第 {day.day} 天</h2>
                                            {viewMode === 'list' && (<button onClick={() => openAddModal(day.day)} className="text-[#45846D] bg-[#45846D]/10 hover:bg-[#45846D]/20 p-1.5 rounded-full transition-colors active:scale-90"><Plus className="w-5 h-5" /></button>)}
                                        </div>
                                        {viewMode === 'list' ?
                                        (
                                            <Droppable droppableId={`day-${dayIndex + 1}`}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 min-h-[50px]">
                                                        {day.activities.map((act, index) => (
                                                            <Draggable key={`${day.day}-${index}`} draggableId={`${day.day}-${index}`} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div 
                                                                        ref={provided.innerRef} 
                                                                        {...provided.draggableProps} 
                                                                        style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} 
                                                                        className={`bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col gap-2 group relative ${snapshot.isDragging ?
                                                                        'shadow-lg z-50' : ''}`}
                                                                    >
                                                                        <div className="flex gap-3">
                                                                            <div className="flex flex-col items-center pt-1 min-w-[55px]">
                                                                                <input type="time" value={act.time} onChange={(e) => handleActivityUpdate(dayIndex, index, 'time', e.target.value)} className="text-xs font-bold text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#45846D] focus:text-[#45846D] outline-none w-full text-center cursor-pointer transition-colors" />
                                                                                <button onClick={() => handleDeleteActivity(dayIndex, index)} className="mt-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0 border-l border-gray-100 pl-4">
                                                                                <EditableText value={act.title} onSave={(val) => handleActivityUpdate(dayIndex, index, 'title', val)} className="font-bold text-[#1D1D1B] truncate w-full hover:bg-gray-50 rounded px-1 -ml-1 text-base" />
                                                                                <div className="flex items-center justify-between mt-2">
                                                                                    <EditableTag type={act.type} onChange={(val) => handleActivityUpdate(dayIndex, index, 'type', val)} />
                                                                                    <div className="flex items-center gap-0.5 text-xs text-gray-400 bg-[#F5F5F4] px-2 py-1 rounded-md hover:bg-gray-100 transition-colors cursor-text min-h-[24px]">
                                                                                        <span className="text-gray-400">{currencySymbol}</span>
                                                                                        <AutoWidthInput value={parseCost(act.cost)} onChange={(val) => handleActivityUpdate(dayIndex, index, 'cost', val)} className="text-gray-600 font-bold text-right" />
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-xs text-gray-500 line-clamp-1 mt-2 font-medium">{act.description}</p>
                                                                            </div>
                                                                            <div 
                                                                                {...provided.dragHandleProps} 
                                                                                style={{ touchAction: 'none' 
                                                                                }}
                                                                                className="flex items-center text-gray-300 px-1 cursor-grab active:cursor-grabbing hover:text-gray-500 transition-colors"
                                                                            >
                                                                                <GripVertical className="w-5 h-5" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        ) : (<RouteVisualization day={day} destination={trip.destination} />)}
                                    </div>
                                ))}
                                <div className="h-10"></div>
                            </div>
                        </DragDropContext>
                    </div>
                </>
            )}
            
            {isAddModalOpen && <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />}
        </div>
    );
};