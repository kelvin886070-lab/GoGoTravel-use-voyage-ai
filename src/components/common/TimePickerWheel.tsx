//這是時間選擇滾輪
import React, { useState, useEffect, useRef } from 'react';

export const TimePickerWheel: React.FC<{ value: string, onChange: (val: string) => void, onClose: () => void }> = ({ value, onChange, onClose }) => {
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