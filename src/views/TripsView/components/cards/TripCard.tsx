import React from 'react';
import { 
    Plane, Train, Car, Bus, MoreHorizontal, 
    AlertCircle, FileText, CheckCircle2, Map 
} from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { Trip } from '../../../../types';

// ============================================================================
// 1. 旅途中徽章 (On Trip Badge) - 帶有呼吸燈效果
// ============================================================================
const OnTripBadge: React.FC = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-sm">
        <div className="relative flex items-center justify-center">
            {/* 擴散光暈動畫 */}
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
            {/* 實心圓點 */}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981] shadow-[0_0_8px_#10B981]"></span>
        </div>
        <span className="text-[10px] font-bold tracking-widest">旅途中</span>
    </div>
);

// ============================================================================
// 2. 倒數徽章 (Countdown Badge) - 紅色警示
// ============================================================================
const CountdownBadge: React.FC<{ days: number }> = ({ days }) => (
    <div className="flex items-center gap-1.5 bg-red-500/80 backdrop-blur-md border border-red-500/20 px-2.5 py-1 rounded-full shadow-sm text-white">
        <AlertCircle className="w-3 h-3" />
        <span className="text-[10px] font-bold tracking-wide">
            {days === 0 ? 'TODAY' : `T-${days}`}
        </span>
    </div>
);

// ============================================================================
// 3. 規劃狀態徽章 (Planning Status Badge) - 未來行程用
// ============================================================================
const PlanningBadge: React.FC<{ status?: 'draft' | 'booked' | 'ready', hasDays: boolean }> = ({ status, hasDays }) => {
    // 如果沒有明確設定 status，則根據是否有行程天數來自動判斷
    const currentStatus = status || (hasDays ? 'ready' : 'draft');

    if (currentStatus === 'draft') {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 border-dashed text-white/80">
                <FileText className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-wide">規劃中</span>
            </div>
        );
    }

    // Default to Ready (已就緒)
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/30 backdrop-blur-md border border-white/10 text-white">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[10px] font-bold tracking-wide">已就緒</span>
        </div>
    );
};

// ============================================================================
// 4. 交通方式徽章 (Transport Badge)
// ============================================================================
const TransportBadge: React.FC<{ trip: Trip }> = ({ trip }) => {
    const icons = [];
    if (trip.transportMode === 'flight') icons.push(<Plane key="flight" className="w-3.5 h-3.5" />);
    else if (trip.transportMode === 'train') icons.push(<Train key="train" className="w-3.5 h-3.5" />);

    if (trip.localTransportMode === 'car' || trip.localTransportMode === 'taxi') icons.push(<Car key="car" className="w-3.5 h-3.5" />);
    else if (trip.localTransportMode === 'public') icons.push(<Bus key="bus" className="w-3.5 h-3.5" />);

    if (icons.length === 0) return null;

    return (
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full shadow-sm">
            <div className="flex gap-2 text-white">
                {icons.map((icon, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <span className="opacity-50 text-[10px] self-center">+</span>}
                        {icon}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// 主元件：TripCard (智慧整併邏輯)
// ============================================================================
interface TripCardProps { 
    trip: Trip;
    onSelect: () => void;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
    isPast?: boolean;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, dragHandleProps, isPast }) => { 
    const formattedDate = trip.startDate.replace(/-/g, '.');

    // --- 日期邏輯判定 (修復時區/時間問題) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 歸零時間，只比對日期
    const nowTs = today.getTime();

    // 解析 YYYY-MM-DD 為本地時間戳
    const getTs = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).getTime();
    };

    const startTs = getTs(trip.startDate);
    const endTs = getTs(trip.endDate);

    // 狀態判定
    const isOnTrip = nowTs >= startTs && nowTs <= endTs; // 今天在開始與結束之間 (含)
    const daysUntil = Math.ceil((startTs - nowTs) / (1000 * 60 * 60 * 24));
    const isCountdown = !isOnTrip && daysUntil > 0 && daysUntil <= 3; // 倒數 3 天內

    return (
        <div 
            className={`
                relative w-full h-56 rounded-[32px] overflow-hidden group select-none transition-all duration-500 hover:shadow-2xl bg-[#1D1D1B]
                ${isPast ? 'scale-[0.98]' : 'hover:scale-[1.01]'}
            `} 
            onClick={onSelect}
        >
            {/* 背景圖層 */}
            <div className="absolute inset-0">
                <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-60" />
            </div>

            {/* 內容圖層 */}
            <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                
                {/* Header: 智慧整併區 (Smart Merge Layout) */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-2 items-start">
                        
                        {/* 邏輯 1: 如果是過去行程，不顯示任何狀態標籤 */}
                        {!isPast && (
                            <>
                                {/* 邏輯 2: 旅途中 (最高優先級) - 只顯示這個，隱藏交通與其他 */}
                                {isOnTrip ? (
                                    <OnTripBadge />
                                ) : (
                                    /* 邏輯 3: 未來行程 (顯示 倒數/規劃 + 交通) */
                                    <>
                                        {/* Slot 1: 狀態 (倒數 或 規劃) */}
                                        {isCountdown ? (
                                            <CountdownBadge days={daysUntil} />
                                        ) : (
                                            <PlanningBadge status={trip.planningStatus} hasDays={trip.days.length > 0} />
                                        )}
                                        
                                        {/* Slot 2: 交通 (旅途中時隱藏，因為當下不重要) */}
                                        <TransportBadge trip={trip} />
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* 拖曳手把 */}
                    <div 
                        {...dragHandleProps} 
                        style={{ touchAction: 'none' }} 
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white/70 hover:bg-white/30 hover:text-white transition-colors cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </div>
                </div>

                {/* Footer: 標題與日期 */}
                <div className="transform transition-transform duration-500 group-hover:translate-x-1">
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-5xl font-black text-white tracking-wide leading-none mb-2 font-serif drop-shadow-lg uppercase truncate max-w-[280px]">
                                {trip.destination}
                            </h2>
                            <div className="flex items-center gap-3 text-white/80 font-mono text-xs font-medium tracking-widest">
                                <span>{formattedDate}</span>
                                <span className="w-8 h-[1px] bg-white/30" />
                                <span>{trip.days.length} DAYS</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};