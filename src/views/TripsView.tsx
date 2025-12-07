import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Calendar, Download, Share, GripVertical, X, Trash2, LogOut, ChevronLeft, ChevronRight, Loader2, CloudRain, Cloud, Sun, CloudSun, PenTool, Sparkles, Image as ImageIcon, Lock, CheckCircle, Camera } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { Trip, TripDay, WeatherInfo, User } from '../types';
import { IOSButton, IOSInput, IOSShareSheet, MadeByFooter } from '../components/UI';
import { generateItinerary, getWeatherForecast, getTimezone } from '../services/gemini';
import { supabase } from '../services/supabase';

interface TripsViewProps {
  trips: Trip[];
  user: User;
  onLogout: () => void;
  onAddTrip: (trip: Trip) => void;
  onImportTrip: (trip: Trip) => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onReorderTrips: (trips: Trip[]) => void;
}

export const TripsView: React.FC<TripsViewProps> = ({ trips, user, onLogout, onAddTrip, onImportTrip, onSelectTrip, onDeleteTrip, onReorderTrips }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const onDragEnd = (result: DropResult) => {
      if (!result.destination) return;
      const newTrips = Array.from(trips);
      const [reorderedItem] = newTrips.splice(result.source.index, 1);
      newTrips.splice(result.destination.index, 0, reorderedItem);
      onReorderTrips(newTrips);
  };

  return (
    <div className="h-full flex flex-col w-full bg-transparent">
      
      {/* Header */}
      <div className="flex-shrink-0 pt-20 pb-6 px-5 bg-ios-bg/95 backdrop-blur-xl z-40 border-b border-gray-200/50 w-full transition-all sticky top-0">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">行程</h1>
        <div className="flex gap-3 items-center absolute right-5 bottom-4">
            <button onClick={() => setIsImporting(true)} className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"><Download className="text-gray-700 w-5 h-5" /></button>
            <button onClick={() => setIsCreating(true)} className="w-9 h-9 bg-ios-blue rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"><Plus className="text-white w-6 h-6" /></button>
            <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 shadow-sm active:scale-90 transition-transform"><img src={user.avatar} alt="Profile" className="w-full h-full object-cover" /></button>
        </div>
      </div>

      {/* Content */}
      {/* 修正重點：補回 overflow-y-auto 與 no-scrollbar，這讓此區塊可以捲動 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 space-y-6 mt-4 pb-24 w-full scroll-smooth no-scrollbar">
        <DashboardWidgets />

        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 ml-1">我的旅程</h2>
            
            <DragDropContext onDragEnd={onDragEnd}>
                {trips.length === 0 ? (
                    <div className="text-center py-10 opacity-50 bg-white/50 rounded-3xl border border-gray-200/50">
                        <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>尚無行程，點擊右上角 + 開始規劃</p>
                    </div>
                ) : (
                    <Droppable droppableId="trips-list">
                        {(provided) => (
                            <div className="space-y-4 pb-4" ref={provided.innerRef} {...provided.droppableProps}>
                                {trips.map((trip, index) => (
                                    <Draggable key={trip.id} draggableId={trip.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                // 確保卡片區域可以捲動 (pan-y)
                                                style={{ 
                                                    ...provided.draggableProps.style, 
                                                    touchAction: 'pan-y' 
                                                }}
                                                className={`transition-all duration-200 ${snapshot.isDragging ? 'z-50 shadow-2xl scale-[1.02] opacity-90' : ''}`}
                                            >
                                                <TripCard 
                                                   trip={trip} 
                                                   onSelect={() => onSelectTrip(trip)} 
                                                   onDelete={() => onDeleteTrip(trip.id)}
                                                   dragHandleProps={provided.dragHandleProps} 
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
    </div>
  );
};

// --- Trip Card Component ---
const TripCard: React.FC<{ 
    trip: Trip, 
    onSelect: () => void, 
    onDelete: () => void,
    dragHandleProps?: DraggableProvidedDragHandleProps | null
}> = ({ trip, onSelect, onDelete, dragHandleProps }) => {
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
            <div className="relative w-full h-48 rounded-3xl overflow-hidden shadow-sm group select-none transition-shadow hover:shadow-md bg-white" onClick={onSelect}>
                <div className="h-full w-full relative">
                    <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-5 text-white pl-8">
                        <h2 className="text-3xl font-bold shadow-sm drop-shadow-md">{trip.destination}</h2>
                        <div className="flex items-center gap-2 text-sm font-medium opacity-90 shadow-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{trip.startDate}  {trip.days.length} 天</span>
                        </div>
                    </div>
                     
                    {/* 拖曳手把：禁止捲動，專門用於拖曳 */}
                    <div 
                        {...dragHandleProps}
                        style={{ touchAction: 'none' }}
                        className="absolute top-1/2 left-3 -translate-y-1/2 p-2 touch-none cursor-grab active:cursor-grabbing z-30 text-white/70 hover:text-white bg-black/20 backdrop-blur-sm rounded-full transition-colors"
                        onClick={(e) => e.stopPropagation()} 
                    >
                            <GripVertical className="w-5 h-5 drop-shadow-md" />
                    </div>

                    <div className="absolute top-3 right-3 flex gap-2 z-20">
                        <button onClick={prepareShare} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-90 transition-all shadow-sm"><Share className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600 active:scale-90 transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            <IOSShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`看看我在 Kelvin 規劃的 ${trip.destination} 之旅！`} />
        </>
    );
};

// --- Profile Modal ---
const ProfileModal: React.FC<{ user: User, tripCount: number, onClose: () => void, onLogout: () => void }> = ({ user, tripCount, onClose, onLogout }) => {
    const [newPassword, setNewPassword] = useState('');
    const [isChanging, setIsChanging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) return;

            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('圖片太大了！請上傳小於 2MB 的照片。');
                return;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `avatar_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            });
            if (updateError) throw updateError;

            alert('頭貼更新成功！');
            window.location.reload(); 

        } catch (error: any) {
            console.error(error);
            alert('上傳失敗：' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            alert("密碼長度至少需要 6 碼");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setLoading(false);
        if (error) {
            alert("修改失敗：" + error.message);
        } else {
            setMsg("密碼修改成功！");
            setNewPassword('');
            setTimeout(() => {
                setIsChanging(false);
                setMsg('');
            }, 1500);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white/90 backdrop-blur-xl rounded-[32px] w-full max-w-sm p-6 relative z-10 shadow-2xl animate-in zoom-in-95 border border-white/50">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1">
                    <X className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center mb-6 pt-2">
                    <div className="relative group cursor-pointer">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white mb-4 relative bg-gray-200">
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover transition-opacity group-hover:opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                {uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white drop-shadow-md" />}
                            </div>
                        </div>
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full" />
                        <div className="absolute bottom-4 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-100 pointer-events-none text-gray-500">
                            <PenTool className="w-3 h-3" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                    <p className="text-sm text-gray-500 font-medium">Kelvin 會員  {user.joinedDate} 加入</p>
                </div>

                <div className="bg-white/60 rounded-2xl p-4 mb-4 flex justify-around border border-gray-100 shadow-sm">
                    <div className="text-center">
                        <span className="block text-xl font-bold text-gray-900">{tripCount}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">規劃行程</span>
                    </div>
                    <div className="w-px bg-gray-200"></div>
                    <div className="text-center opacity-50">
                        <span className="block text-xl font-bold text-gray-900">0</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">分享次數</span>
                    </div>
                </div>

                <div className="mb-4">
                    {!isChanging ? (
                        <button onClick={() => setIsChanging(true)} className="w-full py-3 rounded-xl bg-white text-gray-600 text-sm font-bold shadow-sm border border-gray-100 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                            <Lock className="w-4 h-4" /> 修改密碼
                        </button>
                    ) : (
                        <div className="bg-white/80 rounded-2xl p-3 border border-gray-200 animate-in slide-in-from-top-2">
                            {msg ? (
                                <div className="text-green-600 text-center text-sm font-bold flex items-center justify-center gap-2 py-2">
                                    <CheckCircle className="w-5 h-5" /> {msg}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="輸入新密碼" className="flex-1 bg-gray-100 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/50" autoFocus />
                                    <button onClick={handleChangePassword} disabled={loading || !newPassword} className="bg-ios-blue text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">
                                        {loading ? '...' : '儲存'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={onLogout} className="w-full py-3.5 rounded-xl bg-red-50 text-red-500 font-bold text-base hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <LogOut className="w-5 h-5" /> 登出帳號
                </button>
            </div>
        </div>
    );
};

const DashboardWidgets: React.FC = () => <div className="grid grid-cols-2 gap-3 mb-2"><WeatherWidget /><TimeWidget /></div>;

const WeatherWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('voyage_weather_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [data, setData] = useState<WeatherInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');

    useEffect(() => { localStorage.setItem('voyage_weather_locs', JSON.stringify(locations)); }, [locations]);
    
    const fetchWeather = async () => {
        const currentLocation = locations[idx];
        const cacheKey = `voyage_weather_cache_${currentLocation}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) { const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 30 * 60 * 1000) { setData(data); setLoading(false); return; } }
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
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('voyage_time_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [timezone, setTimezone] = useState<string | null>(null);
    const [timeStr, setTimeStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => { localStorage.setItem('voyage_time_locs', JSON.stringify(locations)); }, [locations]);
    
    useEffect(() => { 
        setTimezone(null); setTimeStr('--:--'); setDateStr('載入中...'); setError(false); 
        const fetchTz = async () => { 
            const currentLocation = locations[idx]; 
            const cacheKey = `voyage_timezone_cache_${currentLocation}`; 
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
    
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-ios-blue text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    
    return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 shadow-sm border border-white/60 relative overflow-hidden group flex flex-col justify-between">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-900 z-20"><Plus className="w-4 h-4" /></button><div className="relative z-0 h-full flex flex-col justify-between"><div><span className="font-bold text-lg text-gray-900 block truncate max-w-[80%]">{locations[idx]}</span><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">當地時間</span></div><div className="flex items-end justify-between"><span className="text-5xl font-mono tracking-tighter text-gray-900">{timeStr}</span></div><div className="text-xs font-medium text-gray-400 border-t border-gray-100 pt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</div></div><div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-gray-800' : 'bg-gray-300'}`} />))}</div></div>;
};

const CreateTripModal: React.FC<{ onClose: () => void, onAddTrip: (t: Trip) => void }> = ({ onClose, onAddTrip }) => {
    const [loading, setLoading] = useState(false);
    const [destination, setDestination] = useState('');
    const [days, setDays] = useState(3);
    const [interests, setInterests] = useState('');
    const [coverImage, setCoverImage] = useState('');

    const handleCreate = async () => {
        if (!destination) return;
        setLoading(true);
        try {
          const generatedDays = await generateItinerary(destination, days, interests || 'general sightseeing');
          // 智慧時間填補
          const processGeneratedItinerary = (days: TripDay[]): TripDay[] => {
              return days.map(day => {
                  let nextStartTime = "09:00";
                  const activities = day.activities.map(act => {
                      if (!act.time || !/^\d{2}:\d{2}$/.test(act.time)) {
                          act.time = nextStartTime;
                      } else {
                          nextStartTime = act.time;
                      }
                      try {
                          const [h, m] = nextStartTime.split(':').map(Number);
                          const d = new Date();
                          d.setHours(h || 9, m || 0, 0, 0);
                          d.setMinutes(d.getMinutes() + 120);
                          nextStartTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      } catch (e) {}
                      return act;
                  });
                  return { ...day, activities };
              });
          };
          const daysWithTime = processGeneratedItinerary(generatedDays);
          createTrip(daysWithTime);
        } catch (e) {
          alert("無法生成行程，請檢查您的網路連線或 API 金鑰。");
        } finally {
          setLoading(false);
        }
    };

    const handleManualCreate = () => {
        if(!destination) return;
        const emptyDays: TripDay[] = Array.from({length: days}, (_, i) => ({ day: i + 1, activities: [] }));
        createTrip(emptyDays);
    };

    const createTrip = (daysData: TripDay[]) => {
        const finalImage = coverImage || `https://picsum.photos/800/600?random=${Date.now()}`;
        const newTrip: Trip = {
            id: Date.now().toString(), 
            destination,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
            coverImage: finalImage,
            days: daysData,
            isDeleted: false
        };
        onAddTrip(newTrip);
        onClose();
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setCoverImage(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="min-h-screen bg-white/95 backdrop-blur-md pb-24 animate-in slide-in-from-bottom-10 duration-300 fixed inset-0 z-50 overflow-y-auto">
        <div className="pt-6 px-5 flex justify-between items-center mb-2"><button onClick={onClose} className="text-ios-blue text-lg">取消</button><h2 className="font-semibold text-lg">新行程</h2><div className="w-12"></div></div>
        <div className="px-5 space-y-6">
          <div className="text-center mb-2"><h3 className="text-2xl font-bold">規劃旅程</h3><p className="text-gray-500">輸入基本資訊以開始</p></div>
          <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 group">
              {coverImage ? (<img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><ImageIcon className="w-10 h-10 mb-2 opacity-50" /><span className="text-sm font-medium">設定封面照片</span></div>)}
              <label className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center cursor-pointer"><div className="bg-white/90 backdrop-blur-sm text-gray-700 font-semibold py-2 px-4 rounded-full shadow-sm flex items-center gap-2 active:scale-95 transition-transform">{coverImage ? <PenTool className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{coverImage ? '更換圖片' : '上傳圖片'}</div><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
              {coverImage && (<button onClick={() => setCoverImage('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-md active:scale-90"><X className="w-4 h-4" /></button>)}
          </div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-500 mb-1 ml-1">目的地</label><IOSInput placeholder="例如：京都" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-gray-500 mb-1 ml-1">天數</label><IOSInput type="number" min={1} max={14} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
            <div><label className="block text-sm font-medium text-gray-500 mb-1 ml-1">興趣偏好 (僅 AI 模式需要)</label><IOSInput placeholder="例如：美食、歷史、登山" value={interests} onChange={(e) => setInterests(e.target.value)} /></div>
          </div>
          <div className="pt-6 space-y-3 pb-10">
            <IOSButton fullWidth onClick={handleCreate} isLoading={loading}><Sparkles className="w-5 h-5" />AI 智慧生成行程</IOSButton>
            <IOSButton fullWidth variant="secondary" onClick={handleManualCreate} disabled={loading}><PenTool className="w-4 h-4" />手動建立空白行程</IOSButton>
          </div>
        </div>
      </div>
    );
};

// --- Import Trip Modal ---
const ImportTripModal: React.FC<{ onClose: () => void, onImportTrip: (t: Trip) => void }> = ({ onClose, onImportTrip }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const handleImport = () => {
        try {
            if (!code.trim()) return;
            const jsonString = decodeURIComponent(escape(atob(code.trim())));
            const tripData = JSON.parse(jsonString);
            if (tripData && tripData.destination && tripData.days) { onImportTrip(tripData); onClose(); } else { setError('無效的行程代碼'); }
        } catch (e) { setError('代碼解析失敗，請確認代碼是否完整'); }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white rounded-3xl w-full max-w-sm p-6 relative z-10 shadow-xl animate-in zoom-in-95"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button><h3 className="text-xl font-bold mb-1">匯入行程</h3><p className="text-sm text-gray-500 mb-4">貼上家人分享的行程代碼</p><textarea className="w-full h-32 bg-gray-50 rounded-xl p-3 text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-ios-blue/50 mb-2 resize-none" placeholder="在此貼上代碼..." value={code} onChange={e => { setCode(e.target.value); setError(''); }} />{error && <p className="text-red-500 text-xs font-medium mb-3">{error}</p>}<IOSButton fullWidth onClick={handleImport}>匯入</IOSButton></div></div>
    );
};