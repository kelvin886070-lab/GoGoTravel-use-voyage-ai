import React, { useState, useEffect } from 'react';
import { 
    CloudRain, Cloud, Sun, CloudSun, Loader2, X, ChevronLeft, ChevronRight, Plus, Calendar 
} from 'lucide-react';
import type { WeatherInfo } from '../../../../types';
import { getWeatherForecast, getTimezone } from '../../../../services/gemini';

const WeatherWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('Kelvin Trip_weather_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [data, setData] = useState<WeatherInfo | null>(null);
    const [loading, setLoading] = useState(false);
    
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
        try { 
            const res = await getWeatherForecast(currentLocation); 
            if(res) { 
                setData(res); 
                localStorage.setItem(cacheKey, JSON.stringify({ data: res, timestamp: Date.now() }));
            } 
        } catch (e) { } finally { setLoading(false); } 
    };
    
    useEffect(() => { fetchWeather(); }, [idx, locations]);
    
    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');
    
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    
    const getWeatherIcon = (condition: string = '') => { 
        if(condition.includes('雨')) return <CloudRain className="w-8 h-8 text-blue-200" />;
        if(condition.includes('雲') || condition.includes('陰')) return <Cloud className="w-8 h-8 text-gray-200" />; 
        if(condition.includes('晴')) return <Sun className="w-8 h-8 text-yellow-300" />;
        return <CloudSun className="w-8 h-8 text-white" />; 
    };

    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-[#45846D] text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    return <div className="bg-gradient-to-br from-[#45846D] to-[#2C5E4B] rounded-3xl p-4 h-40 shadow-lg shadow-[#45846D]/20 text-white relative overflow-hidden group">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-white/50 hover:text-white z-20"><Plus className="w-4 h-4" /></button>{loading ? (<div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6 opacity-50" /><span className="text-xs mt-2 opacity-50">{locations[idx]}</span></div>) : !data ? (<div className="flex flex-col items-center justify-center h-full"><span className="text-sm opacity-70">無法取得天氣</span><button onClick={fetchWeather} className="text-xs mt-2 underline bg-white/20 px-2 py-1 rounded">重試</button></div>) : (<div className="flex flex-col justify-between h-full relative z-0"><div><div className="flex items-start justify-between"><span className="font-bold text-lg truncate max-w-[80%]">{data.location.split(' ')[0]}</span></div><span className="text-xs font-medium opacity-80 bg-white/20 px-2 py-0.5 rounded-full inline-block mt-1">{data.condition}</span></div><div className="flex items-end justify-between"><span className="text-5xl font-extralight tracking-tighter">{data.temperature.replace(/[^0-9.-]/g, '')}</span><div className="mb-2">{getWeatherIcon(data.condition)}</div></div></div>)}<div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-white' : 'bg-white/30'}`} />))}</div></div>;
};

const TimeWidget: React.FC = () => {
    const [locations, setLocations] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('Kelvin Trip_time_locs') || '["台北"]'); } catch(e) { return ["台北"]; } });
    const [idx, setIdx] = useState(0);
    const [timezone, setTimezone] = useState<string | null>(null);
    const [timeStr, setTimeStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newLoc, setNewLoc] = useState('');
    
    useEffect(() => { localStorage.setItem('Kelvin Trip_time_locs', JSON.stringify(locations)); }, [locations]);
    useEffect(() => { setTimezone(null); setTimeStr('--:--'); setDateStr('載入中...'); const fetchTz = async () => { const currentLocation = locations[idx]; const cacheKey = `Kelvin Trip_timezone_cache_${currentLocation}`; const cachedTz = localStorage.getItem(cacheKey); if (cachedTz) { setTimezone(cachedTz); return; } const tz = await getTimezone(currentLocation); if (tz) { setTimezone(tz); localStorage.setItem(cacheKey, tz); } else { setDateStr('時區錯誤'); } }; fetchTz(); }, [idx, locations]);
    useEffect(() => { if (!timezone) return; const update = () => { try { const now = new Date(); const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: timezone, hour12: false }; const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short', timeZone: timezone }; setTimeStr(new Intl.DateTimeFormat('en-US', timeOpts).format(now)); setDateStr(new Intl.DateTimeFormat('zh-TW', dateOpts).format(now)); } catch (e) { setTimeStr('--:--'); } }; update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [timezone]);
    
    const next = () => setIdx((idx + 1) % locations.length);
    const prev = () => setIdx((idx - 1 + locations.length) % locations.length);
    const handleAdd = () => { if(newLoc.trim()) { setLocations([...locations, newLoc]); setIdx(locations.length); setNewLoc(''); setIsAdding(false); } };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if(locations.length > 1) { const newLocs = locations.filter((_, i) => i !== idx); setLocations(newLocs); setIdx(0); } };
    
    if(isAdding) { return <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 h-40 flex flex-col justify-center border border-white/50 shadow-sm relative"><button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 text-gray-400"><X className="w-4 h-4" /></button><p className="text-xs font-bold text-gray-400 mb-2 uppercase">新增城市</p><input autoFocus placeholder="例如：東京" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-2 outline-none" value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-[#1D1D1B] text-white rounded-lg py-1 text-xs font-bold">確認</button></div> }
    return <div className="bg-white rounded-3xl p-4 h-40 shadow-sm border border-white relative overflow-hidden group flex flex-col justify-between">{locations.length > 1 && (<><button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 z-10"><ChevronRight className="w-4 h-4" /></button></>)}{locations.length > 1 && (<button onClick={handleDelete} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"><X className="w-3 h-3" /></button>)}<button onClick={() => setIsAdding(true)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-900 z-20"><Plus className="w-4 h-4" /></button><div className="relative z-0 h-full flex flex-col justify-between"><div><span className="font-bold text-lg text-[#1D1D1B] block truncate max-w-[80%]">{locations[idx]}</span><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">當地時間</span></div><div className="flex items-end justify-between"><span className="text-5xl font-mono tracking-tighter text-[#1D1D1B]">{timeStr}</span></div><div className="text-xs font-medium text-gray-400 border-t border-gray-100 pt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</div></div><div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">{locations.map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-[#1D1D1B]' : 'bg-gray-200'}`} />))}</div></div>;
};

export const DashboardWidgets: React.FC = () => <div className="grid grid-cols-2 gap-3 mb-2"><WeatherWidget /><TimeWidget /></div>;