import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Plus, MapPin, Calendar, Download, Share, GripVertical, X, Trash2, 
    PenTool, Image as ImageIcon, Clock, History, Loader2, CloudRain, 
    Cloud, Sun, CloudSun, Lock, CheckCircle, Camera, LogOut, 
    ChevronLeft, ChevronRight, Sparkles,
    User as UserIcon, Heart, Baby, Users, Armchair, Coffee, Footprints, Zap,
    Utensils, ShoppingBag, Landmark, Trees, Palette, FerrisWheel, Shrub,
    Coins, Plane, Train, Scale, Search, ArrowRight, Ticket, Map, Mountain, Store,
    Briefcase, Shirt, Smartphone, Package, Bath, ArrowLeftRight, Music, Book, Wine, Beer,
    Dog, GraduationCap
} from 'lucide-react';

import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { Trip, TripDay, User, WeatherInfo } from '../types';
import { IOSButton, IOSInput, IOSShareSheet, MadeByFooter } from '../components/UI';
import { generateItinerary, getWeatherForecast, getTimezone, lookupFlightInfo } from '../services/gemini';
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
// 2. 小工具元件 (WeatherWidget, TimeWidget) - 保持不變
// ============================================================================

const WeatherWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('Kelvin Trip_weather_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [data, setData] = useState<WeatherInfo | null>(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => { localStorage.setItem('Kelvin Trip_weather_locs', JSON.stringify(locations)); }, [locations]);
    const fetchWeather = async () => { const currentLocation = locations[idx]; const cacheKey = `Kelvin Trip_weather_cache_${currentLocation}`; try { const cached = localStorage.getItem(cacheKey); if (cached) { const { data, timestamp } = JSON.parse(cached); if (Date.now() - timestamp < 30 * 60 * 1000) { setData(data); setLoading(false); return; } } } catch(e) {} setLoading(true); try { const res = await getWeatherForecast(currentLocation); if(res) { setData(res); localStorage.setItem(cacheKey, JSON.stringify({ data: res, timestamp: Date.now() })); } } catch (e) { } finally { setLoading(false); } };
    useEffect(() => { fetchWeather(); }, [idx, locations]);
    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    const getWeatherIcon = (condition: string = '') => { if(condition.includes('雨')) return <CloudRain className="w-8 h-8 text-blue-200" />; if(condition.includes('雲') || condition.includes('陰')) return <Cloud className="w-8 h-8 text-gray-200" />; if(condition.includes('晴')) return <Sun className="w-8 h-8 text-yellow-300" />; return <CloudSun className="w-8 h-8 text-white" />; };
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-ios-blue text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    return <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-4 h-40 shadow-lg shadow-blue-200 text-white relative overflow-hidden group">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-white/50 hover:text-white z-20"><Plus className="w-4 h-4" /></button>{loading ? (<div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6 opacity-50" /><span className="text-xs mt-2 opacity-50">{locations[idx]}</span></div>) : !data ? (<div className="flex flex-col items-center justify-center h-full"><span className="text-sm opacity-70">無法取得天氣</span><button onClick={fetchWeather} className="text-xs mt-2 underline bg-white/20 px-2 py-1 rounded">重試</button></div>) : (<div className="flex flex-col justify-between h-full relative z-0"><div><div className="flex items-start justify-between"><span className="font-bold text-lg truncate max-w-[80%]">{data.location.split(' ')[0]}</span></div><span className="text-xs font-medium opacity-80 bg-white/20 px-2 py-0.5 rounded-full inline-block mt-1">{data.condition}</span></div><div className="flex items-end justify-between"><span className="text-5xl font-extralight tracking-tighter">{data.temperature.replace(/[^0-9.-]/g, '')}</span><div className="mb-2">{getWeatherIcon(data.condition)}</div></div></div>)}<div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-white' : 'bg-white/30'}`} />))}</div></div>;
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
    useEffect(() => { setTimezone(null); setTimeStr('--:--'); setDateStr('載入中...'); const fetchTz = async () => { const currentLocation = locations[idx]; const cacheKey = `Kelvin Trip_timezone_cache_${currentLocation}`; const cachedTz = localStorage.getItem(cacheKey); if (cachedTz) { setTimezone(cachedTz); return; } const tz = await getTimezone(currentLocation); if (tz) { setTimezone(tz); localStorage.setItem(cacheKey, tz); } else { setDateStr('時區錯誤'); } }; fetchTz(); }, [idx, locations]);
    useEffect(() => { if (!timezone) return; const update = () => { try { const now = new Date(); const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: timezone, hour12: false }; const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short', timeZone: timezone }; setTimeStr(new Intl.DateTimeFormat('en-US', timeOpts).format(now)); setDateStr(new Intl.DateTimeFormat('zh-TW', dateOpts).format(now)); } catch (e) { setTimeStr('--:--'); } }; update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [timezone]);
    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-gray-900 text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 shadow-sm border border-white/60 relative overflow-hidden group flex flex-col justify-between">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-900 z-20"><Plus className="w-4 h-4" /></button><div className="relative z-0 h-full flex flex-col justify-between"><div><span className="font-bold text-lg text-gray-900 block truncate max-w-[80%]">{locations[idx]}</span><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">當地時間</span></div><div className="flex items-end justify-between"><span className="text-5xl font-mono tracking-tighter text-gray-900">{timeStr}</span></div><div className="text-xs font-medium text-gray-400 border-t border-gray-100 pt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</div></div><div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-gray-800' : 'bg-gray-300'}`} />))}</div></div>;
};

const DashboardWidgets: React.FC = () => <div className="grid grid-cols-2 gap-3 mb-2"><WeatherWidget /><TimeWidget /></div>;

// ============================================================================
// 3. 輔助元件：TripCard, FlightCard, TrainCard, Modals
// ============================================================================

const TripCard: React.FC<{ trip: Trip, onSelect: () => void, onDelete: () => void, onEdit: () => void, dragHandleProps?: DraggableProvidedDragHandleProps | null, isPast?: boolean }> = ({ trip, onSelect, onDelete, onEdit, dragHandleProps, isPast }) => { const [shareOpen, setShareOpen] = useState(false); const [shareUrl, setShareUrl] = useState(''); const prepareShare = (e: React.MouseEvent) => { e.stopPropagation(); const liteTrip = { ...trip, coverImage: '' }; const jsonString = JSON.stringify(liteTrip); const encoded = btoa(unescape(encodeURIComponent(jsonString))); const baseUrl = window.location.origin + window.location.pathname; setShareUrl(`${baseUrl}?import=${encoded}`); setShareOpen(true); }; return (<><div className={`relative w-full h-48 rounded-3xl overflow-hidden shadow-sm group select-none transition-shadow hover:shadow-md bg-white ${isPast ? 'grayscale-[0.5] opacity-90' : ''}`} onClick={onSelect}><div className="h-full w-full relative"><img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover pointer-events-none" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><div className="absolute bottom-4 left-5 text-white pl-8"><h2 className="text-3xl font-bold shadow-sm drop-shadow-md">{trip.destination}</h2><div className="flex items-center gap-2 text-sm font-medium opacity-90 shadow-sm"><Calendar className="w-4 h-4" /><span>{trip.startDate}  {trip.days.length} 天</span>{isPast && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">已完成</span>}</div></div>{!isPast && (<div {...dragHandleProps} style={{ touchAction: 'none' }} className="absolute top-1/2 left-3 -translate-y-1/2 p-2 touch-none cursor-grab active:cursor-grabbing z-30 text-white/70 hover:text-white bg-black/20 backdrop-blur-sm rounded-full transition-colors" onClick={(e) => e.stopPropagation()}><GripVertical className="w-5 h-5 drop-shadow-md" /></div>)}<div className="absolute top-3 right-3 flex gap-2 z-20"><button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-90 transition-all shadow-sm"><PenTool className="w-5 h-5" /></button><button onClick={prepareShare} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-90 transition-all shadow-sm"><Share className="w-5 h-5" /></button><button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600 active:scale-90 transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button></div></div></div><IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin Trip 規劃的 ${trip.destination} 之旅！`} /></>); };

// ✅ 新版擬真機票 (支援 Loading 狀態)
const FlightCard = ({ type, code, setCode, destination, origin = 'TPE', flightInfo, loading }: any) => {
    const isDeparture = type === 'in';
    const label = isDeparture ? 'DEPARTURE (去程)' : 'RETURN (回程)';
    const bgColor = isDeparture ? 'bg-[#3982c2]' : 'bg-[#20293a]'; 
    
    const displayOrigin = isDeparture ? origin : (flightInfo?.origin || destination || 'DEST');
    const displayDest = isDeparture ? (flightInfo?.dest || destination || 'DEST') : origin;
    const displayTime = flightInfo?.depTime;
    const terminal = flightInfo?.originTerm;

    return (
        <div className={`${bgColor} rounded-2xl p-5 shadow-lg relative overflow-hidden text-white group transition-transform active:scale-[0.98]`}>
            <div className="absolute -left-3 top-1/2 w-6 h-6 bg-white rounded-full z-10" />
            <div className="absolute -right-3 top-1/2 w-6 h-6 bg-white rounded-full z-10" />
            <div className="absolute left-5 right-5 top-1/2 border-t-2 border-dashed border-white/20" />

            <div className="flex justify-between items-start mb-8">
                <div>
                    <span className="text-[10px] font-bold text-white/60 tracking-widest block mb-1">{label}</span>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-black tracking-wider font-mono">{displayOrigin}</span>
                        <Plane className={`w-5 h-5 text-white/80 ${isDeparture ? 'rotate-45' : '-rotate-135'}`} />
                        <span className="text-3xl font-black tracking-wider font-mono">{displayDest}</span>
                    </div>
                </div>
                <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-md border border-white/10 text-center min-w-[60px]">
                    <span className="text-[10px] font-bold tracking-tight block">TIME</span>
                    {loading ? (
                         <div className="flex justify-center mt-1"><Loader2 className="w-3 h-3 animate-spin text-white" /></div>
                    ) : (
                         <span className="text-sm font-bold">{displayTime || '--:--'}</span>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-end mt-2">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-white/50 uppercase block mb-1">FLIGHT NO.</label>
                    <input 
                        type="text" 
                        placeholder="JX800" 
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="text-4xl font-black bg-transparent outline-none w-full placeholder-white/20 uppercase font-mono tracking-tight text-white" 
                    />
                </div>
                <div className="flex flex-col items-end">
                     {loading ? <Loader2 className="w-6 h-6 animate-spin text-white mb-1" /> : (code ? <CheckCircle className="w-6 h-6 text-green-400 mb-1" /> : <div className="w-6 h-6 rounded-full border-2 border-white/30" />)}
                     <span className="text-[10px] text-white/50">
                         {terminal ? `Term ${terminal}` : 'Terminal: --'}
                     </span>
                </div>
            </div>
        </div>
    );
};

// 唯讀版機票
const ItineraryFlightCard = ({ title, description, time }: { title: string, description: string, time: string }) => (
    <div className="bg-[#3982c2] rounded-xl p-4 shadow-md relative overflow-hidden text-white mb-2">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <Plane className="w-5 h-5 text-white" />
                <span className="font-bold text-lg">{title}</span>
            </div>
            <span className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded">{time}</span>
        </div>
        <div className="text-xs text-blue-100 font-medium">
            {description}
        </div>
    </div>
);

// 優化版：列車卡片
const TrainCard = ({ label, info, setInfo }: { label: string, info: any, setInfo: (i: any) => void }) => (
    <div className="bg-white border-l-[6px] border-l-orange-500 border-y border-r border-gray-200 rounded-r-xl rounded-l-md p-4 shadow-sm relative group hover:shadow-md transition-all">
        <div className="flex justify-between items-center mb-3"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Train className="w-3 h-3" /> {label}</span><span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded">RAIL PASS</span></div>
        <div className="grid grid-cols-2 gap-3 mb-3">
             <div>
                 <label className="text-[10px] font-bold text-gray-400 block mb-1">上車站 (Origin)</label>
                 <input type="text" placeholder="如：東京" value={info.origin} onChange={(e) => setInfo({...info, origin: e.target.value})} className="w-full bg-gray-50 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-orange-200"/>
             </div>
             <div>
                 <label className="text-[10px] font-bold text-gray-400 block mb-1">下車站 (Dest)</label>
                 <input type="text" placeholder="如：京都" value={info.dest} onChange={(e) => setInfo({...info, dest: e.target.value})} className="w-full bg-gray-50 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-orange-200"/>
             </div>
        </div>
        <div className="flex gap-2"><div className="flex-[2]"><input type="text" placeholder="車種 (新幹線/高鐵)" value={info.type} onChange={(e) => setInfo({...info, type: e.target.value})} className="w-full bg-gray-50 rounded-lg px-2 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-1 focus:ring-orange-200"/></div><div className="flex-[1]"><input type="text" placeholder="車次" value={info.number} onChange={(e) => setInfo({...info, number: e.target.value})} className="w-full bg-gray-50 rounded-lg px-2 py-2 text-xs font-bold text-gray-700 outline-none text-center focus:ring-1 focus:ring-orange-200 font-mono"/></div></div>
    </div>
);

// ✅ 統一的方塊選項卡 (iOS Control Center Style - 高度統一)
const OptionCard = ({ selected, onClick, icon, label, sub }: any) => ( 
    <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all duration-200 h-20 w-full ${selected ? 'bg-gray-900 text-white shadow-md scale-[1.02]' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
    >
        <div className={`mb-1.5 ${selected ? 'text-white' : 'text-gray-400'}`}>
            {React.cloneElement(icon, { size: 22, strokeWidth: 1.5 })}
        </div>
        <span className="text-[11px] font-bold">{label}</span>
        {sub && <span className={`text-[9px] mt-0.5 ${selected ? 'text-gray-400' : 'text-gray-300'}`}>{sub}</span>}
    </button> 
);

const INTEREST_DATA: Record<string, { label: string, icon: any, tags: string[] }> = {
    shopping: { label: '購物', icon: ShoppingBag, tags: ['藥妝/美妝', '精品/百貨', 'Outlet', '伴手禮', '文創/雜貨', '古著/二手', '電器/3C'] },
    food: { label: '美食', icon: Utensils, tags: ['拉麵/沾麵', '燒肉/烤肉', '壽司/海鮮', '甜點/咖啡', '居酒屋', '路邊攤', '米其林'] },
    sightseeing: { label: '景點', icon: Camera, tags: ['IG打卡點', '歷史古蹟', '自然風景', '主題樂園', '美術館', '展望台', '動物園'] },
    relax: { label: '放鬆', icon: Sparkles, tags: ['溫泉/SPA', '按摩', '公園漫步', '遊船', '夜景', '海邊'] },
    culture: { label: '文化', icon: Landmark, tags: ['神社/寺廟', '傳統體驗', '祭典活動', '在地市集', '博物館'] },
};

// ... (EditTripModal, ProfileModal, ImportTripModal 保持不變，省略以節省篇幅) ...

const EditTripModal: React.FC<{ trip: Trip, onClose: () => void, onUpdate: (t: Trip) => void }> = ({ trip, onClose, onUpdate }) => {
    const [dest, setDest] = useState(trip.destination);
    const [start, setStart] = useState(trip.startDate);
    const [daysCount, setDaysCount] = useState(trip.days.length);
    const handleSave = () => { const startDateObj = new Date(start); const finalEndDateObj = new Date(startDateObj); finalEndDateObj.setDate(startDateObj.getDate() + (daysCount - 1)); let newDays = [...trip.days]; if (daysCount > trip.days.length) { for (let i = trip.days.length + 1; i <= daysCount; i++) { newDays.push({ day: i, activities: [] }); } } else if (daysCount < trip.days.length) { newDays = newDays.slice(0, daysCount); } onUpdate({ ...trip, destination: dest, startDate: start, endDate: finalEndDateObj.toISOString().split('T')[0], days: newDays }); };
    return (<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-3xl rounded-t-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">編輯行程資訊</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">目的地</label><IOSInput value={dest} onChange={e => setDest(e.target.value)} /></div><div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">開始日期</label><input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-gray-100 p-4 rounded-xl outline-none" /></div><div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">總天數</label><IOSInput type="number" min={1} max={30} value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} />{daysCount < trip.days.length && <p className="text-red-500 text-xs mt-1 ml-1">注意：減少天數將會刪除末尾的行程安排。</p>}</div><IOSButton fullWidth onClick={handleSave}>儲存變更</IOSButton></div></div></div>);
};

const CreateTripModal: React.FC<{ onClose: () => void, onAddTrip: (t: Trip) => void }> = ({ onClose, onAddTrip }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [days, setDays] = useState<number | string>('');

    // Step 2
    const [transportMode, setTransportMode] = useState<'flight' | 'train' | 'time'>('flight');
    const [flightIn, setFlightIn] = useState(''); 
    const [flightOut, setFlightOut] = useState(''); 
    // Loading States for Flights
    const [flightInLoading, setFlightInLoading] = useState(false);
    const [flightOutLoading, setFlightOutLoading] = useState(false);
    const [flightInInfo, setFlightInInfo] = useState<any>(null);
    const [flightOutInfo, setFlightOutInfo] = useState<any>(null);
    
    // Train Info
    const [trainIn, setTrainIn] = useState({ country: '', origin: '', dest: '', type: '', number: '' });
    const [trainOut, setTrainOut] = useState({ country: '', origin: '', dest: '', type: '', number: '' });

    // Step 3
    const [companion, setCompanion] = useState('couple');
    const [pace, setPace] = useState('standard');
    const [vibe, setVibe] = useState('balanced');
    const [budgetLevel, setBudgetLevel] = useState('standard');
    const [customBudget, setCustomBudget] = useState('');
    const [currency, setCurrency] = useState('TWD');

    // Step 4 (Deep Dive)
    const [activeInterestTab, setActiveInterestTab] = useState('shopping');
    const [interestDetails, setInterestDetails] = useState<Record<string, string>>({});
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [specificRequests, setSpecificRequests] = useState('');
    const [coverImage, setCoverImage] = useState('');

    const CURRENCIES = [{ code: 'TWD', label: '新台幣' }, { code: 'JPY', label: '日圓' }, { code: 'USD', label: '美元' }, { code: 'KRW', label: '韓元' }, { code: 'CNY', label: '人民幣' }, { code: 'EUR', label: '歐元' }];

    const toggleInterest = (tag: string) => { 
        if (selectedInterests.includes(tag)) { 
            setSelectedInterests(prev => prev.filter(i => i !== tag));
            const newDetails = { ...interestDetails };
            delete newDetails[tag];
            setInterestDetails(newDetails);
        } else { 
            setSelectedInterests(prev => [...prev, tag]); 
        } 
    };

    const handleInterestDetailChange = (tag: string, value: string) => {
        setInterestDetails(prev => ({ ...prev, [tag]: value }));
    };
    
    // 自動查詢航班 (帶有 Loading)
    const checkFlight = async (code: string, type: 'in' | 'out') => {
        if (!code || code.length < 4) return;
        
        if (type === 'in') setFlightInLoading(true);
        else setFlightOutLoading(true);

        try {
            const info = await lookupFlightInfo(code);
            if (info) {
                if (type === 'in') setFlightInInfo(info);
                else setFlightOutInfo(info);
            }
        } finally {
            if (type === 'in') setFlightInLoading(false);
            else setFlightOutLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setCoverImage(reader.result as string); }; reader.readAsDataURL(file); } };

    const buildPrompt = () => {
        const companionMap: any = { solo: '獨旅', couple: '情侶/夫妻', family: '親子家庭', friends: '一群朋友', elderly: '帶長輩', pet: '帶寵物', colleague: '同事', classmate: '同學' };
        const paceMap: any = { relaxed: '悠閒慢活', standard: '標準觀光', packed: '特種兵打卡' };
        const vibeMap: any = { popular: '經典地標', balanced: '在地與熱門均衡', hidden: '大自然與秘境' };
        const budgetMap: any = { cheap: '經濟實惠', standard: '標準預算', luxury: '豪華享受' };
        
        const interestsWithDetails = selectedInterests.map(tag => {
            const detail = interestDetails[tag];
            return detail ? `${tag} (想去: ${detail})` : tag;
        }).join(', ');

        return `[旅遊條件] 
        - 旅伴：${companionMap[companion]}
        - 步調：${paceMap[pace]}
        - 風格：${vibeMap[vibe]}
        - 預算：${budgetMap[budgetLevel]} ${customBudget ? `(${customBudget})` : ''}
        - 興趣細項：${interestsWithDetails || '無特別指定'}
        - 特別需求：${specificRequests || '無'}
        `;
    };

    const handleCreate = async () => {
        const tripDays = Number(days);
        if (!tripDays || tripDays <= 0) { alert("請輸入有效的天數"); return; }
        setLoading(true);
        try {
            const fullPrompt = buildPrompt();
            let transportInfo = undefined;
            if (transportMode === 'flight') {
                transportInfo = { 
                    inbound: flightIn ? `Flight ${flightIn} (${flightInInfo?.depTime || 'TBA'} - ${flightInInfo?.arrTime || 'TBA'})` : undefined, 
                    outbound: flightOut ? `Flight ${flightOut} (${flightOutInfo?.depTime || 'TBA'})` : undefined 
                };
            } else if (transportMode === 'train') {
                transportInfo = { inbound: trainIn.number ? `${trainIn.type} ${trainIn.number} from ${trainIn.origin} to ${trainIn.dest}` : undefined, outbound: trainOut.number ? `${trainOut.type} ${trainOut.number}` : undefined };
            }

            const generatedDays = await generateItinerary(destination, tripDays, fullPrompt, currency, transportInfo);
            
            const processGeneratedItinerary = (days: TripDay[]): TripDay[] => {
                return days.map(day => {
                    let nextStartTime = "09:00";
                    const activities = day.activities.map(act => {
                        if (!act.time || !/^\d{2}:\d{2}$/.test(act.time)) act.time = nextStartTime;
                        else nextStartTime = act.time;
                        const rawCategory = (act.category || 'other').toLowerCase();
                        let mappedType = 'other';
                        if (rawCategory === 'flight') mappedType = 'flight'; // 保留 flight
                        else if (rawCategory === 'transport') mappedType = 'transport';
                        else if (['sightseeing', 'landmark'].some(k => rawCategory.includes(k))) mappedType = 'sightseeing';
                        else if (['food', 'restaurant', 'snack'].some(k => rawCategory.includes(k))) mappedType = 'food';
                        else if (['cafe', 'coffee'].some(k => rawCategory.includes(k))) mappedType = 'cafe';
                        else if (['shopping', 'mall', 'market'].some(k => rawCategory.includes(k))) mappedType = 'shopping';
                        else if (['hotel', 'accommodation'].some(k => rawCategory.includes(k))) mappedType = 'hotel';
                        else if (['relax', 'spa', 'onsen'].some(k => rawCategory.includes(k))) mappedType = 'relax';
                        else if (['bar', 'club'].some(k => rawCategory.includes(k))) mappedType = 'bar';
                        else if (['culture', 'temple'].some(k => rawCategory.includes(k))) mappedType = 'culture';
                        else if (['activity', 'theme park'].some(k => rawCategory.includes(k))) mappedType = 'activity';
                        try {
                            const [h, m] = nextStartTime.split(':').map(Number);
                            const d = new Date(); d.setHours(h || 9, m || 0, 0, 0); d.setMinutes(d.getMinutes() + 120);
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

        } catch (e) { alert("無法生成行程，請檢查網路或稍後再試。"); } finally { setLoading(false); }
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
                {/* Header */}
                <div className="pt-6 px-6 pb-2 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} className="text-gray-400 hover:text-gray-600">
                            {step === 1 ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                        </button>
                        <h2 className="font-bold text-lg text-gray-900">
                            {step === 1 && '行程設定'}
                            {step === 2 && '交通安排'}
                            {step === 3 && '風格與預算'}
                            {step === 4 && '興趣深度'}
                        </h2>
                        <div className="w-6"></div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        {[1, 2, 3, 4].map(i => (<div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-gray-900' : 'bg-gray-100'}`} />))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto min-h-0 flex-1 scroll-smooth">
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
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-gray-100 p-1 rounded-xl flex mb-6">
                                <button onClick={() => setTransportMode('flight')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'flight' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Plane className="w-4 h-4"/> 航班</button>
                                <button onClick={() => setTransportMode('train')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'train' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Train className="w-4 h-4"/> 列車</button>
                                <button onClick={() => setTransportMode('time')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${transportMode === 'time' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Clock className="w-4 h-4"/> 手動</button>
                            </div>
                            {transportMode === 'flight' && (
                                <div className="space-y-4">
                                    <div onBlur={() => checkFlight(flightIn, 'in')}>
                                        <FlightCard type="in" code={flightIn} setCode={setFlightIn} destination={destination} flightInfo={flightInInfo} loading={flightInLoading} />
                                    </div>
                                    <div onBlur={() => checkFlight(flightOut, 'out')}>
                                        <FlightCard type="out" code={flightOut} setCode={setFlightOut} destination={destination} flightInfo={flightOutInfo} loading={flightOutLoading} />
                                    </div>
                                    <p className="text-xs text-center text-gray-400 mt-4">AI 將自動查詢航班時間並安排接送機行程</p>
                                </div>
                            )}
                            {transportMode === 'train' && (
                                <div className="space-y-4">
                                    <TrainCard label="去程資訊" info={trainIn} setInfo={setTrainIn} />
                                    <TrainCard label="回程資訊" info={trainOut} setInfo={setTrainOut} />
                                    <p className="text-xs text-center text-gray-400 mt-4">AI 將依據車種與車次估算時間</p>
                                </div>
                            )}
                            {transportMode === 'time' && (
                                <div className="space-y-6">
                                    <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">去程抵達時間</label><input type="time" className="w-full bg-gray-50 p-4 rounded-xl text-lg font-bold outline-none text-center" defaultValue="10:00" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">回程出發時間</label><input type="time" className="w-full bg-gray-50 p-4 rounded-xl text-lg font-bold outline-none text-center" defaultValue="16:00" /></div>
                                </div>
                            )}
                        </div>
                    )}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">旅伴</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <OptionCard selected={companion === 'solo'} onClick={() => setCompanion('solo')} icon={<UserIcon />} label="獨旅" />
                                    <OptionCard selected={companion === 'couple'} onClick={() => setCompanion('couple')} icon={<Heart />} label="情侶" />
                                    <OptionCard selected={companion === 'family'} onClick={() => setCompanion('family')} icon={<Baby />} label="親子" />
                                    <OptionCard selected={companion === 'friends'} onClick={() => setCompanion('friends')} icon={<Users />} label="朋友" />
                                    <OptionCard selected={companion === 'elderly'} onClick={() => setCompanion('elderly')} icon={<Armchair />} label="長輩" />
                                    <OptionCard selected={companion === 'pet'} onClick={() => setCompanion('pet')} icon={<Dog />} label="寵物" />
                                    <OptionCard selected={companion === 'colleague'} onClick={() => setCompanion('colleague')} icon={<Briefcase />} label="同事" />
                                    <OptionCard selected={companion === 'classmate'} onClick={() => setCompanion('classmate')} icon={<GraduationCap />} label="同學" />
                                </div>
                            </div>
                            <div className="h-px bg-gray-100 my-2" />
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">步調與風格</label>
                                <div className="grid grid-cols-3 gap-2"> {/* ✅ 步調改為 3 欄 */}
                                    <OptionCard selected={pace === 'relaxed'} onClick={() => setPace('relaxed')} icon={<Coffee />} label="悠閒" />
                                    <OptionCard selected={pace === 'standard'} onClick={() => setPace('standard')} icon={<Footprints />} label="標準" />
                                    <OptionCard selected={pace === 'packed'} onClick={() => setPace('packed')} icon={<Zap />} label="緊湊" />
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-2"> {/* ✅ 風格改為 3 欄，與步調對齊 */}
                                    <OptionCard selected={vibe === 'popular'} onClick={() => setVibe('popular')} icon={<MapPin />} label="經典" sub="首次必訪" />
                                    <OptionCard selected={vibe === 'balanced'} onClick={() => setVibe('balanced')} icon={<Scale />} label="均衡" sub="在地生活" />
                                    <OptionCard selected={vibe === 'hidden'} onClick={() => setVibe('hidden')} icon={<Mountain />} label="秘境" sub="遠離塵囂" />
                                </div>
                            </div>
                            <div className="h-px bg-gray-100 my-2" />
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">預算等級</label>
                                <div className="flex gap-2 mb-3">
                                    {[{id:'cheap',l:'經濟 $'}, {id:'standard',l:'標準 $$'}, {id:'luxury',l:'豪華 $$$'}].map(opt => (
                                        <button key={opt.id} onClick={() => setBudgetLevel(opt.id)} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${budgetLevel === opt.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>{opt.l}</button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative min-w-fit">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Coins className="h-4 w-4 text-gray-400" /></div>
                                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-8 text-sm outline-none focus:border-ios-blue appearance-none font-medium">{CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} {c.label}</option>))}</select>
                                    </div>
                                    <input type="text" placeholder="或輸入具體預算..." className="w-full bg-gray-50 border-b-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500 transition-colors bg-transparent" value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 ml-1 uppercase">您想怎麼玩？(深度興趣)</label>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {Object.entries(INTEREST_DATA).map(([key, data]) => (
                                        <button key={key} onClick={() => setActiveInterestTab(key)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border transition-all ${activeInterestTab === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{React.createElement(data.icon, { size: 16 })}{data.label}</button>
                                    ))}
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-4 min-h-[120px] transition-all border border-gray-100">
                                    <div className="flex flex-wrap gap-2 animate-in fade-in mb-4">
                                        {INTEREST_DATA[activeInterestTab].tags.map(tag => (
                                            <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${selectedInterests.includes(tag) ? 'bg-ios-blue text-white border-ios-blue shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{tag}</button>
                                        ))}
                                    </div>
                                    {selectedInterests.length > 0 && (
                                        <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-gray-200 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] font-bold text-gray-400 block mb-2">指定詳細需求 (選填)</label>
                                            {selectedInterests.map(tag => (
                                                <div key={tag} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100">
                                                    <span className="text-xs font-bold text-ios-blue px-2">{tag}</span>
                                                    <input 
                                                        type="text" 
                                                        placeholder={`想去的 ${tag} 品牌或地點...`}
                                                        value={interestDetails[tag] || ''}
                                                        onChange={(e) => handleInterestDetailChange(tag, e.target.value)}
                                                        className="flex-1 text-xs bg-transparent outline-none placeholder-gray-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">許願池 / 特殊需求</label>
                                <textarea className="w-full bg-gray-50 rounded-xl p-3 text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-ios-blue/50 h-24 resize-none" placeholder="例如：不想吃生食、一定要去環球影城..." value={specificRequests} onChange={e => setSpecificRequests(e.target.value)} />
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
// 5. Main View Component (TripsView)
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
                                                {/* 判斷是否為機票行程 (第一天) */}
                                                {trip.days[0]?.activities[0]?.category === 'flight' ? (
                                                    <div className="bg-[#3982c2] rounded-3xl overflow-hidden shadow-sm relative h-48 p-6 text-white group" onClick={() => onSelectTrip(trip)}>
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <span className="text-xs font-bold text-blue-200 tracking-widest block mb-1">UPCOMING FLIGHT</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-3xl font-black font-mono">TPE</span>
                                                                    <Plane className="w-6 h-6 rotate-45 text-white/80" />
                                                                    <span className="text-3xl font-black font-mono">NRT</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
                                                                {trip.days.length} DAYS
                                                            </div>
                                                        </div>
                                                        <div className="mt-auto">
                                                            <div className="text-xs font-bold text-blue-200 mb-1">DESTINATION</div>
                                                            <div className="text-2xl font-bold">{trip.destination}</div>
                                                            <div className="flex items-center gap-2 mt-2 text-sm opacity-80">
                                                                <Calendar className="w-4 h-4" /> {trip.startDate}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={(e) => { e.stopPropagation(); onDeleteTrip(trip.id); }} className="p-2 bg-white/20 backdrop-blur rounded-full hover:bg-red-500 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <TripCard 
                                                       trip={trip} 
                                                       onSelect={() => onSelectTrip(trip)} 
                                                       onDelete={() => onDeleteTrip(trip.id)}
                                                       onEdit={() => setEditingTrip(trip)}
                                                       dragHandleProps={provided.dragHandleProps} 
                                                       isPast={activeTab === 'past'}
                                                    />
                                                )}
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