import React, { useState, useMemo, useEffect } from 'react';
// 1. 補齊所有圖示：加入 Search, Scale
import { 
    Plus, MapPin, Calendar, Download, Share, GripVertical, X, Trash2, 
    PenTool, Image as ImageIcon, Clock, History, Loader2, CloudRain, 
    Cloud, Sun, CloudSun, Lock, CheckCircle, Camera, LogOut, 
    ChevronLeft, ChevronRight, Sparkles,
    User as UserIcon, Heart, Baby, Users, Armchair, Coffee, Footprints, Zap,
    Utensils, ShoppingBag, Landmark, Trees, Palette, FerrisWheel, Shrub,
    Coins, Plane, Train, Search, Scale 
} from 'lucide-react';

import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { Trip, TripDay, User, WeatherInfo } from '../types';
import { IOSButton, IOSInput, IOSShareSheet, MadeByFooter } from '../components/UI';
import { generateItinerary, getWeatherForecast, getTimezone } from '../services/gemini';
import { supabase } from '../services/supabase';

// ============================================================================
// 1. 介面定義
// ============================================================================

interface TripsViewProps {
  trips: Trip[];
  user: User;
  onLogout: () => void;
  onAddTrip: (trip: Trip) => void;
  onImportTrip: (trip: Trip) => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onReorderTrips: (trips: Trip[]) => void;
  onUpdateTrip?: (trip: Trip) => void;
}

// ============================================================================
// 2. 小工具元件 (WeatherWidget, TimeWidget)
// ============================================================================

const WeatherWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('Kelvin Trip_weather_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [data, setData] = useState<WeatherInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');

    useEffect(() => { localStorage.setItem('Kelvin Trip_weather_locs', JSON.stringify(locations)); }, [locations]);
    
    const fetchWeather = async () => {
        const currentLocation = locations[idx];
        const cacheKey = `Kelvin Trip_weather_cache_${currentLocation}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) { 
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 30 * 60 * 1000) { setData(data); setLoading(false); return; } 
            }
        } catch(e) {}
        
        setLoading(true);
        setError(false);
        try { 
            const res = await getWeatherForecast(currentLocation);
            if(res) { 
                setData(res);
                localStorage.setItem(cacheKey, JSON.stringify({ data: res, timestamp: Date.now() }));
            } else { setError(true); } 
        } catch (e) { setError(true); } finally { setLoading(false); }
    };

    useEffect(() => { fetchWeather(); }, [idx, locations]);
    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    
    const getWeatherIcon = (condition: string = '') => { 
        if(condition.includes('雨')) return <CloudRain className="w-8 h-8 text-blue-200" />;
        if(condition.includes('雲') || condition.includes('陰')) return <Cloud className="w-8 h-8 text-gray-200" />; 
        if(condition.includes('晴')) return <Sun className="w-8 h-8 text-yellow-300" />;
        return <CloudSun className="w-8 h-8 text-white" />; 
    };
    
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-ios-blue text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    
    return <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-4 h-40 shadow-lg shadow-blue-200 text-white relative overflow-hidden group">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-white/50 hover:text-white z-20"><Plus className="w-4 h-4" /></button>{loading ? (<div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6 opacity-50" /><span className="text-xs mt-2 opacity-50">{locations[idx]}</span></div>) : error || !data ? (<div className="flex flex-col items-center justify-center h-full"><span className="text-sm opacity-70">無法取得天氣</span><button onClick={fetchWeather} className="text-xs mt-2 underline bg-white/20 px-2 py-1 rounded">重試</button></div>) : (<div className="flex flex-col justify-between h-full relative z-0"><div><div className="flex items-start justify-between"><span className="font-bold text-lg truncate max-w-[80%]">{data.location.split(' ')[0]}</span></div><span className="text-xs font-medium opacity-80 bg-white/20 px-2 py-0.5 rounded-full inline-block mt-1">{data.condition}</span></div><div className="flex items-end justify-between"><span className="text-5xl font-extralight tracking-tighter">{data.temperature.replace(/[^0-9.-]/g, '')}</span><div className="mb-2">{getWeatherIcon(data.condition)}</div></div></div>)}<div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-white' : 'bg-white/30'}`} />))}</div></div>;
};

const TimeWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('Kelvin Trip_time_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [timezone, setTimezone] = useState<string | null>(null);
    const [timeStr, setTimeStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => { localStorage.setItem('Kelvin Trip_time_locs', JSON.stringify(locations)); }, [locations]);
    
    useEffect(() => { 
        setTimezone(null); setTimeStr('--:--'); setDateStr('載入中...'); setError(false); 
        const fetchTz = async () => { 
            const currentLocation = locations[idx]; 
            const cacheKey = `Kelvin Trip_timezone_cache_${currentLocation}`; 
            const cachedTz = localStorage.getItem(cacheKey); 
            if (cachedTz) { setTimezone(cachedTz); return; } 
            const tz = await getTimezone(currentLocation); 
            if (tz) { setTimezone(tz); localStorage.setItem(cacheKey, tz); } else { setError(true); setDateStr('時區錯誤'); } 
        }; 
        fetchTz(); 
    }, [idx, locations]);

    useEffect(() => { 
        if (!timezone) return; 
        const update = () => { 
            try { 
                const now = new Date(); 
                const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: timezone, hour12: false }; 
                const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short', timeZone: timezone }; 
                setTimeStr(new Intl.DateTimeFormat('en-US', timeOpts).format(now)); 
                setDateStr(new Intl.DateTimeFormat('zh-TW', dateOpts).format(now)); 
                setError(false); 
            } catch (e) { setTimeStr('--:--'); setDateStr('格式錯誤'); setError(true); } 
        }; 
        update(); 
        const timer = setInterval(update, 1000); 
        return () => clearInterval(timer); 
    }, [timezone]);

    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-gray-900 text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    
    return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 shadow-sm border border-white/60 relative overflow-hidden group flex flex-col justify-between">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-900 z-20"><Plus className="w-4 h-4" /></button><div className="relative z-0 h-full flex flex-col justify-between"><div><span className="font-bold text-lg text-gray-900 block truncate max-w-[80%]">{locations[idx]}</span><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">當地時間</span></div><div className="flex items-end justify-between"><span className="text-5xl font-mono tracking-tighter text-gray-900">{timeStr}</span></div><div className="text-xs font-medium text-gray-400 border-t border-gray-100 pt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</div></div><div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-gray-800' : 'bg-gray-300'}`} />))}</div></div>;
};

const DashboardWidgets: React.FC = () => <div className="grid grid-cols-2 gap-3 mb-2"><WeatherWidget /><TimeWidget /></div>;

// ============================================================================
// 3. 輔助元件：TripCard, FlightCard, Modals
// ============================================================================

const TripCard: React.FC<{ 
    trip: Trip, 
    onSelect: () => void, 
    onDelete: () => void,
    onEdit: () => void, 
    dragHandleProps?: DraggableProvidedDragHandleProps | null,
    isPast?: boolean
}> = ({ trip, onSelect, onDelete, onEdit, dragHandleProps, isPast }) => {
    const [shareOpen, setShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState('');

    const prepareShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const liteTrip = { ...trip, coverImage: '' };
        const jsonString = JSON.stringify(liteTrip);
        const encoded = btoa(unescape(encodeURIComponent(jsonString)));
        const baseUrl = window.location.origin + window.location.pathname;
        const realLink = `${baseUrl}?import=${encoded}`;
        setShareUrl(realLink);
        setShareOpen(true);
    };

    return (
        <>
            <div className={`relative w-full h-48 rounded-3xl overflow-hidden shadow-sm group select-none transition-shadow hover:shadow-md bg-white ${isPast ? 'grayscale-[0.5] opacity-90' : ''}`} onClick={onSelect}>
                <div className="h-full w-full relative">
                    <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-5 text-white pl-8">
                        <h2 className="text-3xl font-bold shadow-sm drop-shadow-md">{trip.destination}</h2>
                        <div className="flex items-center gap-2 text-sm font-medium opacity-90 shadow-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{trip.startDate}  {trip.days.length} 天</span>
                            {isPast && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">已完成</span>}
                        </div>
                    </div>
                     
                    {!isPast && (
                        <div 
                            {...dragHandleProps}
                            style={{ touchAction: 'none' }}
                            className="absolute top-1/2 left-3 -translate-y-1/2 p-2 touch-none cursor-grab active:cursor-grabbing z-30 text-white/70 hover:text-white bg-black/20 backdrop-blur-sm rounded-full transition-colors"
                            onClick={(e) => e.stopPropagation()} 
                        >
                                <GripVertical className="w-5 h-5 drop-shadow-md" />
                        </div>
                    )}

                    <div className="absolute top-3 right-3 flex gap-2 z-20">
                         <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-90 transition-all shadow-sm">
                            <PenTool className="w-5 h-5" />
                        </button>
                        <button onClick={prepareShare} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-90 transition-all shadow-sm"><Share className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600 active:scale-90 transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} />
        </>
    );
};

const FlightCard = ({ type, code, setCode, destination }: any) => (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
        <div className="absolute -left-2 top-1/2 w-4 h-4 bg-gray-50 rounded-full border border-gray-200" />
        <div className="absolute -right-2 top-1/2 w-4 h-4 bg-gray-50 rounded-full border border-gray-200" />
        
        <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{type === 'in' ? 'DEPARTURE' : 'RETURN'}</span>
            <Plane className="w-4 h-4 text-gray-400 rotate-45" />
        </div>
        
        <div className="flex items-end justify-between">
            <div className="flex-1">
                <input 
                    type="text" 
                    placeholder="輸入航班 (如 JX800)" 
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="text-2xl font-black text-gray-900 bg-transparent outline-none w-full placeholder-gray-200 uppercase font-mono tracking-tight" 
                />
                <div className="text-[10px] text-gray-400 font-medium mt-1 pl-1">
                    {code ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 已輸入</span>
                    ) : '航班編號'}
                </div>
            </div>
            <div className="text-right pl-4 border-l border-dashed border-gray-200">
               <div className="text-xs font-bold text-gray-400">TPE</div>
               <div className="text-xs font-bold text-gray-900">{destination || 'DEST'}</div>
            </div>
        </div>
    </div>
);

// ============================================================================
// 4. Modals (Create, Edit, Import, Profile)
// ============================================================================

const EditTripModal: React.FC<{ trip: Trip, onClose: () => void, onUpdate: (t: Trip) => void }> = ({ trip, onClose, onUpdate }) => {
    const [dest, setDest] = useState(trip.destination);
    const [start, setStart] = useState(trip.startDate);
    const [daysCount, setDaysCount] = useState(trip.days.length);

    const handleSave = () => {
        const startDateObj = new Date(start);
        const finalEndDateObj = new Date(startDateObj);
        finalEndDateObj.setDate(startDateObj.getDate() + (daysCount - 1));

        let newDays = [...trip.days];
        if (daysCount > trip.days.length) {
            for (let i = trip.days.length + 1; i <= daysCount; i++) {
                newDays.push({ day: i, activities: [] });
            }
        } else if (daysCount < trip.days.length) {
            newDays = newDays.slice(0, daysCount);
        }

        onUpdate({
            ...trip,
            destination: dest,
            startDate: start,
            endDate: finalEndDateObj.toISOString().split('T')[0],
            days: newDays
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm sm:rounded-3xl rounded-t-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">編輯行程資訊</h3>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">目的地</label>
                        <IOSInput value={dest} onChange={e => setDest(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">開始日期</label>
                        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-gray-100 p-4 rounded-xl outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">總天數</label>
                        <IOSInput type="number" min={1} max={30} value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} />
                        {daysCount < trip.days.length && <p className="text-red-500 text-xs mt-1 ml-1">注意：減少天數將會刪除末尾的行程安排。</p>}
                    </div>
                    <IOSButton fullWidth onClick={handleSave}>儲存變更</IOSButton>
                </div>
            </div>
        </div>
    );
};

const CreateTripModal: React.FC<{ onClose: () => void, onAddTrip: (t: Trip) => void }> = ({ onClose, onAddTrip }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // --- Step 1: 基礎 ---
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [days, setDays] = useState<number | string>('');

    // --- Step 2: 交通樞紐 ---
    const [transportMode, setTransportMode] = useState<'flight' | 'train' | 'time'>('flight');
    const [flightIn, setFlightIn] = useState(''); 
    const [flightOut, setFlightOut] = useState(''); 

    // --- Step 3: 風格 ---
    const [companion, setCompanion] = useState('couple');
    const [pace, setPace] = useState('standard');
    const [transport, setTransport] = useState('public');
    const [vibe, setVibe] = useState('balanced');

    // --- Step 4: 預算與細節 ---
    const [budgetLevel, setBudgetLevel] = useState('standard');
    const [customBudget, setCustomBudget] = useState('');
    const [currency, setCurrency] = useState('TWD');
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [specificRequests, setSpecificRequests] = useState('');
    const [coverImage, setCoverImage] = useState('');

    const INTEREST_OPTIONS = [{ id: 'photo', label: '攝影美拍', icon: <Camera className="w-4 h-4" /> }, { id: 'food', label: '美食巡禮', icon: <Utensils className="w-4 h-4" /> }, { id: 'shopping', label: '逛街購物', icon: <ShoppingBag className="w-4 h-4" /> }, { id: 'history', label: '歷史文化', icon: <Landmark className="w-4 h-4" /> }, { id: 'nature', label: '自然戶外', icon: <Trees className="w-4 h-4" /> }, { id: 'cafe', label: '咖啡廳', icon: <Coffee className="w-4 h-4" /> }, { id: 'art', label: '藝術展覽', icon: <Palette className="w-4 h-4" /> }, { id: 'spa', label: '放鬆 SPA', icon: <Sparkles className="w-4 h-4" /> }, { id: 'theme_park', label: '主題樂園', icon: <FerrisWheel className="w-4 h-4" /> }, { id: 'temple', label: '寺廟神社', icon: <Shrub className="w-4 h-4" /> }];
    const CURRENCIES = [{ code: 'TWD', label: '新台幣' }, { code: 'JPY', label: '日圓' }, { code: 'USD', label: '美元' }, { code: 'KRW', label: '韓元' }, { code: 'CNY', label: '人民幣' }, { code: 'EUR', label: '歐元' }];

    const toggleInterest = (label: string) => { if (selectedInterests.includes(label)) { setSelectedInterests(prev => prev.filter(i => i !== label)); } else { setSelectedInterests(prev => [...prev, label]); } };
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setCoverImage(reader.result as string); }; reader.readAsDataURL(file); } };
    const SelectionCard = ({ selected, onClick, icon, label, sub }: any) => ( <button onClick={onClick} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${selected ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}><div className={`mb-2 ${selected ? 'text-white' : 'text-gray-400'}`}>{icon}</div><span className="text-xs font-bold">{label}</span>{sub && <span className={`text-[10px] mt-0.5 ${selected ? 'text-gray-400' : 'text-gray-300'}`}>{sub}</span>}</button> );

    const buildPrompt = () => {
        const companionMap: any = { solo: '獨旅', couple: '情侶/夫妻', family: '親子家庭(有小孩)', friends: '一群朋友', elderly: '帶長輩' };
        const paceMap: any = { relaxed: '悠閒慢活(一天1-2點)', standard: '標準觀光(一天3-4點)', packed: '特種兵打卡(一天5+點)' };
        const transportMap: any = { public: '大眾運輸', car: '自駕/包車', taxi: '計程車/Uber' };
        const vibeMap: any = { popular: '經典熱門必去', balanced: '熱門與冷門均衡', hidden: '在地私房冷門' };
        const budgetMap: any = { cheap: '經濟實惠', standard: '標準預算', luxury: '豪華享受' };
        
        return `[旅遊條件詳情] - 旅伴：${companionMap[companion]} - 步調：${paceMap[pace]} - 交通：${transportMap[transport]} - 風格：${vibeMap[vibe]} - 預算：${budgetMap[budgetLevel]} ${customBudget ? `(${customBudget})` : ''} - 興趣：${selectedInterests.join(', ') || '無特別指定'} - 特殊需求/許願：${specificRequests || '無'}`;
    };

    const handleCreate = async () => {
        const tripDays = Number(days);
        if (!tripDays || tripDays <= 0) { alert("請輸入有效的天數"); return; }
        setLoading(true);
        try {
            const fullPrompt = buildPrompt();
            const transportInfo = {
                inbound: flightIn ? `Flight ${flightIn}` : undefined,
                outbound: flightOut ? `Flight ${flightOut}` : undefined
            };

            const generatedDays = await generateItinerary(destination, tripDays, fullPrompt, currency, transportInfo);
            
            const processGeneratedItinerary = (days: TripDay[]): TripDay[] => {
                return days.map(day => {
                    let nextStartTime = "09:00";
                    const activities = day.activities.map(act => {
                        if (!act.time || !/^\d{2}:\d{2}$/.test(act.time)) act.time = nextStartTime;
                        else nextStartTime = act.time;
                        
                        const rawCategory = (act.category || 'other').toLowerCase();
                        let mappedType = 'other';
                        if (['sightseeing', 'landmark', 'museum', 'park'].some(k => rawCategory.includes(k))) mappedType = 'sightseeing';
                        else if (['food', 'restaurant', 'snack'].some(k => rawCategory.includes(k))) mappedType = 'food';
                        else if (['cafe', 'coffee'].some(k => rawCategory.includes(k))) mappedType = 'cafe';
                        else if (['shopping', 'mall', 'market'].some(k => rawCategory.includes(k))) mappedType = 'shopping';
                        else if (['transport', 'bus', 'train', 'flight'].some(k => rawCategory.includes(k))) mappedType = 'transport';
                        else if (['hotel', 'accommodation'].some(k => rawCategory.includes(k))) mappedType = 'hotel';
                        else if (['relax', 'spa', 'onsen'].some(k => rawCategory.includes(k))) mappedType = 'relax';
                        else if (['bar', 'club', 'nightlife'].some(k => rawCategory.includes(k))) mappedType = 'bar';
                        else if (['culture', 'temple', 'art'].some(k => rawCategory.includes(k))) mappedType = 'culture';
                        else if (['activity', 'theme park', 'workshop'].some(k => rawCategory.includes(k))) mappedType = 'activity';

                        try {
                            const [h, m] = nextStartTime.split(':').map(Number);
                            const d = new Date();
                            d.setHours(h || 9, m || 0, 0, 0);
                            d.setMinutes(d.getMinutes() + 120);
                            nextStartTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {}
                        
                        return { ...act, type: mappedType };
                    });
                    return { ...day, activities };
                });
            };

            const daysWithTime = processGeneratedItinerary(generatedDays);
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(startDateObj);
            endDateObj.setDate(startDateObj.getDate() + (tripDays - 1));
            
            const newTrip: Trip = {
                id: Date.now().toString(),
                destination,
                startDate: startDate,
                endDate: endDateObj.toISOString().split('T')[0],
                coverImage: coverImage || `https://picsum.photos/800/600?random=${Date.now()}`,
                days: daysWithTime,
                isDeleted: false,
                currency: currency
            };

            onAddTrip(newTrip);
            onClose();

        } catch (e) {
            alert("無法生成行程，請檢查網路或稍後再試。");
        } finally {
            setLoading(false);
        }
    };

    const handleManualCreate = () => {
        const tripDays = Number(days);
        if (!tripDays || tripDays <= 0) { alert("請輸入有效的天數"); return; }
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + (tripDays - 1));
        const emptyDays: TripDay[] = Array.from({length: tripDays}, (_, i) => ({ day: i + 1, activities: [] }));
        const newTrip: Trip = { id: Date.now().toString(), destination: destination || '未命名行程', startDate: startDate, endDate: endDateObj.toISOString().split('T')[0], coverImage: coverImage || `https://picsum.photos/800/600?random=${Date.now()}`, days: emptyDays, isDeleted: false, currency: currency };
        onAddTrip(newTrip); onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onClose} />
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
                <div className="pt-6 px-6 pb-2 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} className="text-gray-400 hover:text-gray-600">
                            {step === 1 ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                        </button>
                        <h2 className="font-bold text-lg text-gray-900">
                            {step === 1 && '行程設定'}
                            {step === 2 && '交通安排'}
                            {step === 3 && '風格偏好'}
                            {step === 4 && '預算與細節'}
                        </h2>
                        <div className="w-6"></div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        {[1, 2, 3, 4].map(i => (<div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-gray-900' : 'bg-gray-100'}`} />))}
                    </div>
                </div>

                <div className="p-6 overflow-y-auto min-h-0 flex-1 scroll-smooth">
                    {/* Step 1: 基礎 */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 group">
                                {coverImage ? (<img src={coverImage} alt="Cover" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><ImageIcon className="w-8 h-8 mb-2 opacity-50" /><span className="text-xs font-medium">設定封面 (選填)</span></div>)}
                                <label className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-black/5 transition-colors"><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
                            </div>

                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">目的地</label><IOSInput autoFocus placeholder="例如：京都、紐約" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">出發日期</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-medium" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">天數</label><IOSInput type="number" min={1} max={14} value={days} placeholder="輸入天數" onChange={(e) => { const val = e.target.value; setDays(val === '' ? '' : parseInt(val, 10)); }} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: 交通 (獨立頁面) */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-gray-100 p-1 rounded-xl flex mb-6">
                                <button onClick={() => setTransportMode('flight')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'flight' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Plane className="w-4 h-4"/> 航班</button>
                                <button onClick={() => setTransportMode('train')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'train' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Train className="w-4 h-4"/> 鐵路</button>
                                <button onClick={() => setTransportMode('time')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'time' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Clock className="w-4 h-4"/> 手動</button>
                            </div>

                            {transportMode === 'flight' && (
                                <div className="space-y-4">
                                    <FlightCard type="in" code={flightIn} setCode={setFlightIn} destination={destination} />
                                    <FlightCard type="out" code={flightOut} setCode={setFlightOut} destination={destination} />
                                    <p className="text-xs text-center text-gray-400 mt-4">AI 將自動查詢航班時間並安排接送機行程</p>
                                </div>
                            )}

                            {transportMode === 'train' && (
                                <div className="space-y-4">
                                    <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-4">
                                        <Train className="w-8 h-8 text-gray-300 mx-auto" />
                                        <p className="text-sm text-gray-500">鐵路班次查詢功能開發中...<br/>目前請使用手動時間設定。</p>
                                        <button onClick={() => setTransportMode('time')} className="text-ios-blue text-xs font-bold">切換至手動模式</button>
                                    </div>
                                </div>
                            )}

                            {transportMode === 'time' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">去程抵達時間</label>
                                        <input type="time" className="w-full bg-gray-50 p-4 rounded-xl text-lg font-bold outline-none text-center" defaultValue="10:00" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">回程出發時間</label>
                                        <input type="time" className="w-full bg-gray-50 p-4 rounded-xl text-lg font-bold outline-none text-center" defaultValue="16:00" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: 風格 */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">旅伴</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <SelectionCard selected={companion === 'solo'} onClick={() => setCompanion('solo')} icon={<UserIcon className="w-5 h-5"/>} label="獨旅" />
                                    <SelectionCard selected={companion === 'couple'} onClick={() => setCompanion('couple')} icon={<Heart className="w-5 h-5"/>} label="情侶" />
                                    <SelectionCard selected={companion === 'family'} onClick={() => setCompanion('family')} icon={<Baby className="w-5 h-5"/>} label="親子" />
                                    <SelectionCard selected={companion === 'friends'} onClick={() => setCompanion('friends')} icon={<Users className="w-5 h-5"/>} label="朋友" />
                                    <SelectionCard selected={companion === 'elderly'} onClick={() => setCompanion('elderly')} icon={<Armchair className="w-5 h-5"/>} label="長輩" />
                                </div>
                            </div>
                            
                            <div className="h-px bg-gray-100 my-2" />

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">步調</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <SelectionCard selected={pace === 'relaxed'} onClick={() => setPace('relaxed')} icon={<Coffee className="w-5 h-5"/>} label="悠閒" />
                                    <SelectionCard selected={pace === 'standard'} onClick={() => setPace('standard')} icon={<Footprints className="w-5 h-5"/>} label="標準" />
                                    <SelectionCard selected={pace === 'packed'} onClick={() => setPace('packed')} icon={<Zap className="w-5 h-5"/>} label="緊湊" />
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 my-2" />

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">偏好</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <SelectionCard selected={vibe === 'popular'} onClick={() => setVibe('popular')} icon={<MapPin className="w-5 h-5"/>} label="熱門" />
                                    <SelectionCard selected={vibe === 'balanced'} onClick={() => setVibe('balanced')} icon={<Scale className="w-5 h-5"/>} label="均衡" />
                                    <SelectionCard selected={vibe === 'hidden'} onClick={() => setVibe('hidden')} icon={<Search className="w-5 h-5"/>} label="秘境" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: 細節 */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">預算等級</label>
                                <div className="flex gap-2 mb-3">
                                    {[{id:'cheap',l:'經濟'}, {id:'standard',l:'標準'}, {id:'luxury',l:'豪華'}].map(opt => (
                                        <button key={opt.id} onClick={() => setBudgetLevel(opt.id)} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${budgetLevel === opt.id ? 'bg-green-50 text-green-700 border-green-200 ring-1 ring-green-500' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>{opt.l}</button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative w-1/3">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Coins className="h-4 w-4 text-gray-400" /></div>
                                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-2 text-sm outline-none focus:border-ios-blue appearance-none font-medium">{CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} {c.label}</option>))}</select>
                                    </div>
                                    <input type="text" placeholder="或輸入具體預算..." className="w-2/3 bg-gray-50 border-b-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500 transition-colors bg-transparent" value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">興趣 (可多選)</label>
                                <div className="flex flex-wrap gap-2">
                                    {INTEREST_OPTIONS.map((item) => (
                                        <button key={item.id} onClick={() => toggleInterest(item.label)} className={`px-3 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedInterests.includes(item.label) ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{item.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">許願池 / 特殊需求</label>
                                <textarea className="w-full bg-gray-50 rounded-xl p-3 text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-ios-blue/50 h-24 resize-none" placeholder="例如：不想吃生食、想住有浴缸的飯店..." value={specificRequests} onChange={e => setSpecificRequests(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 backdrop-blur-xl">
                    {step < 4 ? (
                        <div className="flex flex-col gap-3">
                            <IOSButton fullWidth onClick={() => { 
                                if (step===1 && !destination) return alert('請輸入目的地');
                                if (step===1 && (!days || Number(days) <= 0)) return alert('請輸入有效天數');
                                setStep(s => s + 1); 
                            }}>
                                下一步
                            </IOSButton>
                            {step === 1 && <button onClick={handleManualCreate} className="text-gray-400 text-xs font-medium py-2 hover:text-gray-600 transition-colors">跳過 AI，手動建立空白行程</button>}
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={handleManualCreate} className="flex-1 py-3 text-gray-500 font-bold text-sm bg-white border border-gray-200 rounded-xl">手動建立</button>
                            <IOSButton fullWidth onClick={handleCreate} isLoading={loading} className="flex-[2]"><Sparkles className="w-4 h-4 mr-1" /> 生成夢幻行程</IOSButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Import Trip Modal
const ImportTripModal: React.FC<{ onClose: () => void, onImportTrip: (t: Trip) => void }> = ({ onClose, onImportTrip }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const handleImport = () => { try { if (!code.trim()) return; const jsonString = decodeURIComponent(escape(atob(code.trim()))); const tripData = JSON.parse(jsonString); if (tripData && tripData.destination && tripData.days) { onImportTrip(tripData); onClose(); } else { setError('無效的行程代碼'); } } catch (e) { setError('代碼解析失敗，請確認代碼是否完整'); } };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white rounded-3xl w-full max-w-sm p-6 relative z-10 shadow-xl animate-in zoom-in-95"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button><h3 className="text-xl font-bold mb-1">匯入行程</h3><p className="text-sm text-gray-500 mb-4">貼上家人分享的行程代碼</p><textarea className="w-full h-32 bg-gray-50 rounded-xl p-3 text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-ios-blue/50 mb-2 resize-none" placeholder="在此貼上代碼..." value={code} onChange={e => { setCode(e.target.value); setError(''); }} />{error && <p className="text-red-500 text-xs font-medium mb-3">{error}</p>}<IOSButton fullWidth onClick={handleImport}>匯入</IOSButton></div></div>);
};

// Profile Modal
const ProfileModal: React.FC<{ user: User, tripCount: number, onClose: () => void, onLogout: () => void }> = ({ user, tripCount, onClose, onLogout }) => {
    const [newPassword, setNewPassword] = useState('');
    const [isChanging, setIsChanging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { try { setUploading(true); if (!e.target.files || e.target.files.length === 0) return; const file = e.target.files[0]; if (file.size > 2 * 1024 * 1024) { alert('圖片太大了！請上傳小於 2MB 的照片。'); return; } const fileExt = file.name.split('.').pop(); const fileName = `avatar_${Date.now()}.${fileExt}`; const filePath = `${user.id}/${fileName}`; const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true }); if (uploadError) throw uploadError; const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath); const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } }); if (updateError) throw updateError; alert('頭貼更新成功！'); window.location.reload(); } catch (error: any) { console.error(error); alert('上傳失敗：' + error.message); } finally { setUploading(false); } };
    const handleChangePassword = async () => { if (newPassword.length < 6) { alert("密碼長度至少需要 6 碼"); return; } setLoading(true); const { error } = await supabase.auth.updateUser({ password: newPassword }); setLoading(false); if (error) { alert("修改失敗：" + error.message); } else { setMsg("密碼修改成功！"); setNewPassword(''); setTimeout(() => { setIsChanging(false); setMsg(''); }, 1500); } };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} /><div className="bg-white/90 backdrop-blur-xl rounded-[32px] w-full max-w-sm p-6 relative z-10 shadow-2xl animate-in zoom-in-95 border border-white/50"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"><X className="w-5 h-5" /></button><div className="flex flex-col items-center mb-6 pt-2"><div className="relative group cursor-pointer"><div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white mb-4 relative bg-gray-200"><img src={user.avatar} alt={user.name} className="w-full h-full object-cover transition-opacity group-hover:opacity-80" /><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">{uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white drop-shadow-md" />}</div></div><input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full" /><div className="absolute bottom-4 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-100 pointer-events-none text-gray-500"><PenTool className="w-3 h-3" /></div></div><h2 className="text-2xl font-bold text-gray-900">{user.name}</h2><p className="text-sm text-gray-500 font-medium">Kelvin 會員  {user.joinedDate} 加入</p></div><div className="bg-white/60 rounded-2xl p-4 mb-4 flex justify-around border border-gray-100 shadow-sm"><div className="text-center"><span className="block text-xl font-bold text-gray-900">{tripCount}</span><span className="text-xs text-gray-500 uppercase tracking-wide">規劃行程</span></div><div className="w-px bg-gray-200"></div><div className="text-center opacity-50"><span className="block text-xl font-bold text-gray-900">0</span><span className="text-xs text-gray-500 uppercase tracking-wide">分享次數</span></div></div><div className="mb-4">{!isChanging ? (<button onClick={() => setIsChanging(true)} className="w-full py-3 rounded-xl bg-white text-gray-600 text-sm font-bold shadow-sm border border-gray-100 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><Lock className="w-4 h-4" /> 修改密碼</button>) : (<div className="bg-white/80 rounded-2xl p-3 border border-gray-200 animate-in slide-in-from-top-2">{msg ? (<div className="text-green-600 text-center text-sm font-bold flex items-center justify-center gap-2 py-2"><CheckCircle className="w-5 h-5" /> {msg}</div>) : (<div className="flex gap-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="輸入新密碼" className="flex-1 bg-gray-100 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/50" autoFocus /><button onClick={handleChangePassword} disabled={loading || !newPassword} className="bg-ios-blue text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">{loading ? '...' : '儲存'}</button></div>)}</div>)}</div><button onClick={onLogout} className="w-full py-3.5 rounded-xl bg-red-50 text-red-500 font-bold text-base hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-2"><LogOut className="w-5 h-5" /> 登出帳號</button></div></div>);
};

// ============================================================================
// 5. Main View Component (TripsView) - 放在檔案最後，確保所有依賴都已宣告
// ============================================================================

export const TripsView: React.FC<TripsViewProps> = ({ trips, user, onLogout, onAddTrip, onImportTrip, onSelectTrip, onDeleteTrip, onReorderTrips, onUpdateTrip }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { upcomingTrips, pastTrips } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = trips.filter(t => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const past = trips.filter(t => t.endDate < today).sort((a, b) => b.startDate.localeCompare(a.startDate)); 
    return { upcomingTrips: upcoming, pastTrips: past };
  }, [trips]);

  const displayTrips = activeTab === 'upcoming' ? upcomingTrips : pastTrips;

  const onDragEnd = (result: DropResult) => {
      if (!result.destination || activeTab === 'past') return; 
      const newTrips = Array.from(trips);
      onReorderTrips(newTrips);
  };

  return (
    <div className="h-full flex flex-col w-full bg-transparent">
      
      {/* Header */}
      <div className="flex-shrink-0 pt-20 pb-2 px-5 bg-ios-bg/95 backdrop-blur-xl z-40 border-b border-gray-200/50 w-full transition-all sticky top-0">
        <div className="flex justify-between items-center mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">行程</h1>
            <div className="flex gap-3">
                <button onClick={() => setIsImporting(true)} className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"><Download className="text-gray-700 w-5 h-5" /></button>
                <button onClick={() => setIsCreating(true)} className="w-9 h-9 bg-ios-blue rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"><Plus className="text-white w-6 h-6" /></button>
                <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 shadow-sm active:scale-90 transition-transform"><img src={user.avatar} alt="Profile" className="w-full h-full object-cover" /></button>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 space-y-6 pb-24 w-full scroll-smooth no-scrollbar">
        
        {/* 1. 小工具 */}
        {activeTab === 'upcoming' && <DashboardWidgets />}

        {/* 2. 分段控制器 */}
        <div className="bg-gray-200/60 p-1 rounded-xl flex relative mb-2">
             <button 
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 py-1.5 text-sm font-bold rounded-[8px] transition-all duration-200 ease-out flex items-center justify-center ${activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
             >
                即將出發
             </button>
             <button 
                onClick={() => setActiveTab('past')}
                className={`flex-1 py-1.5 text-sm font-bold rounded-[8px] transition-all duration-200 ease-out flex items-center justify-center ${activeTab === 'past' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
             >
                精彩回憶
             </button>
        </div>

        {/* 3. 行程列表 */}
        <div className="mt-2">
            <DragDropContext onDragEnd={onDragEnd}>
                {displayTrips.length === 0 ? (
                    <div className="text-center py-12 opacity-40 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 mx-1">
                        {activeTab === 'upcoming' ? (
                             <><MapPin className="w-10 h-10 mx-auto mb-3 text-gray-400" /><p className="text-sm font-medium">尚無計畫，點擊右上角 + 開始規劃</p></>
                        ) : (
                             <><History className="w-10 h-10 mx-auto mb-3 text-gray-400" /><p className="text-sm font-medium">還沒有結束的旅程，趕快出發吧！</p></>
                        )}
                    </div>
                ) : (
                    <Droppable droppableId="trips-list">
                        {(provided) => (
                            <div className="space-y-4 pb-4" ref={provided.innerRef} {...provided.droppableProps}>
                                {displayTrips.map((trip, index) => (
                                    <Draggable key={trip.id} draggableId={trip.id} index={index} isDragDisabled={activeTab === 'past'}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
                                                className={`transition-all duration-200 ${snapshot.isDragging ? 'z-50 shadow-2xl scale-[1.02] opacity-90' : ''}`}
                                            >
                                                <TripCard 
                                                   trip={trip} 
                                                   onSelect={() => onSelectTrip(trip)} 
                                                   onDelete={() => onDeleteTrip(trip.id)}
                                                   onEdit={() => setEditingTrip(trip)}
                                                   dragHandleProps={provided.dragHandleProps} 
                                                   isPast={activeTab === 'past'}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                )}
            </DragDropContext>
        </div>
        <MadeByFooter />
      </div>

      {/* Modals */}
      {isCreating && <CreateTripModal onClose={() => setIsCreating(false)} onAddTrip={onAddTrip} />}
      {isImporting && <ImportTripModal onClose={() => setIsImporting(false)} onImportTrip={onImportTrip} />}
      {showProfile && <ProfileModal user={user} tripCount={trips.length} onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      
      {editingTrip && onUpdateTrip && (
          <EditTripModal 
            trip={editingTrip} 
            onClose={() => setEditingTrip(null)} 
            onUpdate={(updated) => {
                onUpdateTrip(updated);
                setEditingTrip(null);
            }} 
          />
      )}
    </div>
  );
};