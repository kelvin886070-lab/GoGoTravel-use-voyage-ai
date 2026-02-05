import React, { useMemo, useState, useEffect } from 'react';
import { Map, Navigation, MapPin, Copy, Check, CloudSun, Hourglass, CalendarCheck, Cloud, Sun, CloudRain, Loader2 } from 'lucide-react';
import type { TripDay } from '../../../types';
import { CATEGORIES } from '../shared';
import { getWeatherForecast } from '../../../services/gemini';

// 簡單的天氣圖示對應
const getWeatherIcon = (condition: string = '') => {
    if (condition.includes('雨')) return <CloudRain className="w-3 h-3 text-blue-500" />;
    if (condition.includes('雲') || condition.includes('陰')) return <Cloud className="w-3 h-3 text-gray-400" />;
    if (condition.includes('晴')) return <Sun className="w-3 h-3 text-orange-400" />;
    return <CloudSun className="w-3 h-3 text-blue-400" />;
};

type WeatherStatus = 
    | { type: 'loading' }
    | { type: 'past' }
    | { type: 'current'; temp: string; condition: string }
    | { type: 'countdown'; days: number };

// --- 子元件: 天氣/倒數膠囊 ---
const WeatherPill: React.FC<{ status: WeatherStatus }> = ({ status }) => {
    if (status.type === 'loading') {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-full border border-gray-100 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            </div>
        );
    }

    if (status.type === 'past') {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-full border border-gray-100 opacity-50">
                <CalendarCheck className="w-3 h-3 text-gray-400" />
                <span className="text-[9px] font-bold text-gray-500">已結束</span>
            </div>
        );
    }

    if (status.type === 'countdown') {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 rounded-full border border-orange-100">
                <Hourglass className="w-3 h-3 text-orange-500" />
                <span className="text-[9px] font-bold text-orange-600">
                    {status.days === 0 ? '就是今天' : `倒數 ${status.days} 天`}
                </span>
            </div>
        );
    }

    if (status.type === 'current') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                {getWeatherIcon(status.condition)}
                <span className="text-[9px] font-bold text-blue-600">
                    {status.temp}
                </span>
            </div>
        );
    }

    return null;
};

// --- 主元件 ---
export const DayRouteCard: React.FC<{ day: TripDay; startDate: string; destination: string }> = ({ day, startDate, destination }) => {
    
    // 1. 計算該天的日期
    const currentDayDate = useMemo(() => {
        const dateObj = new Date(startDate);
        dateObj.setDate(dateObj.getDate() + (day.day - 1));
        return dateObj;
    }, [startDate, day.day]);

    const dateStr = useMemo(() => {
        return currentDayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    }, [currentDayDate]);

    // 2. 天氣狀態管理
    const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>({ type: 'loading' });

    useEffect(() => {
        let isMounted = true;

        const fetchW = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(currentDayDate);
            targetDate.setHours(0, 0, 0, 0);

            const diffTime = targetDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // A. 過去行程
            if (diffDays < 0) {
                if (isMounted) setWeatherStatus({ type: 'past' });
                return;
            }

            // B. 未來行程 (超過 3 天)：顯示倒數
            if (diffDays > 3) {
                if (isMounted) setWeatherStatus({ type: 'countdown', days: diffDays });
                return;
            }

            // C. 近期行程 (0 ~ 3 天)：嘗試抓取 API
            try {
                if (isMounted) setWeatherStatus({ type: 'loading' });
                
                // 呼叫您原本的 API
                const res = await getWeatherForecast(destination);
                
                if (isMounted) {
                    if (res && res.temperature) {
                        setWeatherStatus({ 
                            type: 'current', 
                            temp: res.temperature,
                            condition: res.condition || '晴'
                        });
                    } else {
                        // 如果 API 沒資料，回退顯示倒數
                        setWeatherStatus({ type: 'countdown', days: diffDays });
                    }
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
                if (isMounted) setWeatherStatus({ type: 'countdown', days: diffDays });
            }
        };

        fetchW();
        return () => { isMounted = false; };
    }, [destination, currentDayDate]);

    // 單點操作按鈕
    const ActionButtons = ({ name }: { name: string }) => {
        const [copied, setCopied] = useState(false);
        const handleCopy = (e: React.MouseEvent) => {
            e.stopPropagation();
            navigator.clipboard.writeText(name);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };
        const handleMap = (e: React.MouseEvent) => {
            e.stopPropagation();
            window.open(`http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(name)}`, '_blank');
        };

        return (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                <button onClick={handleCopy} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#45846D] transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={handleMap} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#45846D] transition-colors">
                    <MapPin className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    };

    const { stops, mapUrl } = useMemo(() => {
        const _stops = day.activities
            .filter(a => a.type !== 'transport' && a.type !== 'note' && a.type !== 'expense' && a.type !== 'process')
            .filter(a => a.title || a.location)
            .map(a => ({ name: a.location || a.title || 'Unknown Spot', type: a.type }));
        
        let _mapUrl = '';
        if (_stops.length === 0) {
            _mapUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(destination)}`;
        } else if (_stops.length === 1) {
            _mapUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(_stops[0].name)}`;
        } else { 
            const origin = encodeURIComponent(_stops[0].name); 
            const dest = encodeURIComponent(_stops[_stops.length - 1].name); 
            const middleStops = _stops.slice(1, -1);
            if (middleStops.length > 0) {
                const waypoints = middleStops.map(s => encodeURIComponent(s.name)).join('|');
                _mapUrl = `http://googleusercontent.com/maps.google.com/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
            } else {
                _mapUrl = `http://googleusercontent.com/maps.google.com/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
            }
        }
        return { stops: _stops, mapUrl: _mapUrl };
    }, [day.activities, destination]);

    return (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mt-6">
            {/* Header */}
            <div className="h-12 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between px-5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[#1D1D1B]">
                        <Map className="w-4 h-4 text-[#45846D]" />
                        <span className="text-xs font-black tracking-wide">DAY {day.day.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-gray-400">• {dateStr}</span>
                    </div>
                    {/* 天氣/倒數顯示區 */}
                    <WeatherPill status={weatherStatus} />
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#45846D]" />
                    <span className="text-[10px] font-bold text-[#45846D]">{stops.length} Stops</span>
                </div>
            </div>

            {/* Body */}
            <div className="p-5 py-6 relative">
                {stops.length === 0 ? (
                    <div className="text-center text-gray-300 text-xs py-4">暫無行程地點</div>
                ) : (
                    <div className="relative">
                        <div className="absolute top-3 bottom-3 left-[15px] w-[2px] bg-gray-100 rounded-full" />
                        <div className="space-y-5">
                            {stops.map((stop, i) => {
                                const cat = CATEGORIES.find(c => c.id === stop.type) || CATEGORIES.find(c => c.id === 'sightseeing');
                                const Icon = cat?.icon || MapPin;
                                
                                return (
                                    <div key={i} className="flex items-center gap-4 relative z-10 group min-h-[32px]">
                                        <div className="w-8 h-8 rounded-full border-[3px] border-white bg-white shadow-sm flex items-center justify-center shrink-0">
                                            <div className={`w-full h-full rounded-full flex items-center justify-center ${cat?.tagClass.replace('border-', '')} bg-opacity-20`}>
                                                <Icon className={`w-3.5 h-3.5`} />
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 truncate flex-1">{stop.name}</span>
                                        <ActionButtons name={stop.name} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-0">
                <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#1D1D1B] text-white font-bold py-3 rounded-xl text-xs hover:bg-[#45846D] transition-colors shadow-lg active:scale-[0.98]"
                >
                    <Navigation className="w-3.5 h-3.5" />
                    開啟導航
                </a>
            </div>
        </div>
    );
};