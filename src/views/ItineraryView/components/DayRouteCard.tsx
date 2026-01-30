//地圖卡片
import React, { useMemo, useState } from 'react';
import { Map, Navigation, MapPin, Copy, Check, CloudSun } from 'lucide-react';
import type { TripDay } from '../../../types';
import { CATEGORIES } from '../shared';

export const DayRouteCard: React.FC<{ day: TripDay; startDate: string; destination: string }> = ({ day, startDate, destination }) => {
    // 計算該天的日期字串 (Format: 10/24)
    const dateStr = useMemo(() => {
        const dateObj = new Date(startDate);
        dateObj.setDate(dateObj.getDate() + (day.day - 1));
        return dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    }, [startDate, day.day]);

    // 單點操作按鈕元件 (Copy & Map)
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
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`, '_blank');
        };

        return (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                <button 
                    onClick={handleCopy} 
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#45846D] transition-colors"
                    title="複製名稱"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button 
                    onClick={handleMap} 
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#45846D] transition-colors"
                    title="開啟地圖"
                >
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
        if (_stops.length === 0) _mapUrl = `http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(destination)}`;
        else if (_stops.length === 1) _mapUrl = `http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(_stops[0].name)}`;
        else { 
            const origin = encodeURIComponent(_stops[0].name); 
            const dest = encodeURIComponent(_stops[_stops.length - 1].name); 
            const waypoints = _stops.slice(1, -1).map(s => encodeURIComponent(s.name)).join('|'); 
            _mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`; 
        }
        return { stops: _stops, mapUrl: _mapUrl };
    }, [day.activities, destination]);

    return (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mt-6">
            {/* Compact Header with Day & Weather */}
            <div className="h-12 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between px-5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[#1D1D1B]">
                        <Map className="w-4 h-4 text-[#45846D]" />
                        <span className="text-xs font-black tracking-wide">DAY {day.day.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-gray-400">• {dateStr}</span>
                    </div>
                    {/* Mock Weather Icon */}
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        <CloudSun className="w-3 h-3 text-blue-500" />
                        <span className="text-[9px] font-bold text-blue-600">24°C</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#45846D]" />
                    <span className="text-[10px] font-bold text-[#45846D]">{stops.length} Stops</span>
                </div>
            </div>

            {/* Metro Style Body */}
            <div className="p-5 py-6 relative">
                {stops.length === 0 ? (
                    <div className="text-center text-gray-300 text-xs py-4">暫無行程地點</div>
                ) : (
                    <div className="relative">
                        {/* Connecting Line */}
                        <div className="absolute top-3 bottom-3 left-[15px] w-[2px] bg-gray-100 rounded-full" />

                        <div className="space-y-5">
                            {stops.map((stop, i) => {
                                const cat = CATEGORIES.find(c => c.id === stop.type) || CATEGORIES.find(c => c.id === 'sightseeing');
                                const Icon = cat?.icon || MapPin;
                                
                                return (
                                    <div key={i} className="flex items-center gap-4 relative z-10 group min-h-[32px]">
                                        {/* Icon Node */}
                                        <div className="w-8 h-8 rounded-full border-[3px] border-white bg-white shadow-sm flex items-center justify-center shrink-0">
                                            <div className={`w-full h-full rounded-full flex items-center justify-center ${cat?.tagClass.replace('border-', '')} bg-opacity-20`}>
                                                <Icon className={`w-3.5 h-3.5`} />
                                            </div>
                                        </div>
                                        {/* Text */}
                                        <span className="text-sm font-bold text-gray-700 truncate flex-1">{stop.name}</span>
                                        {/* Hover Actions */}
                                        <ActionButtons name={stop.name} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Compact Footer Button */}
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