// src/views/TripsView/components/cards/TripCard.tsx
// 🎟️ 首頁「即將出發」卡（定稿模型）：一張卡只做三個工作 —— 認出哪一趟、還有幾天、有事才提醒。
//   刪掉：交通徽章、常亮「已就緒」（非行動＝雜訊）。乾淨＝就緒；名字完整不截斷；全面去玻璃。
//   倒數＝小標記，靠近才「升溫」變色變字。狀態只在「有待辦」時冒出可行動提示，處理完消失。
//   過去的「精彩回憶」卡是另一份工作（懷念，非期待）→ 之後單獨設計；此卡 isPast 時只顯示名字＋日期。
import React from 'react';
import { MoreHorizontal, AlertTriangle } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { Trip } from '../../../../types';
import { tripCountdown } from './countdown';

interface TripCardProps {
    trip: Trip;
    onSelect: () => void;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
    isPast?: boolean;
    hero?: boolean;   // 首頁「下一趟」的主角卡：更高、標題更大；預設 false，不影響列表卡／回憶卡
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, dragHandleProps, isPast, hero }) => {
    const formattedDate = (trip.startDate || '').replace(/-/g, '.');
    // 🎟️ 倒數升溫：共用 tripCountdown（與 hero 卡同源，字色不漂移）。
    const countdown = tripCountdown(trip);

    // 🎟️ 可行動提示：未排入行程的「待安排」項目數；沒有就完全不顯示（沉默＝就緒）。
    const todoCount = isPast ? 0 : (trip.stagedWishes || []).filter(w => w.assignedDay === undefined).length;

    return (
        <div
            className={`relative w-full ${hero ? 'h-72' : 'h-56'} rounded-[24px] overflow-hidden group select-none transition-all duration-500 bg-[#1D1D1B] ${isPast ? 'scale-[0.98]' : 'hover:scale-[1.01] hover:shadow-2xl'}`}
            onClick={onSelect}
        >
            {/* 背景：封面圖，或深色 fallback（與封面 A 一致，不再破圖/套巴黎） */}
            {trip.coverImage ? (
                <img
                    src={trip.coverImage}
                    alt={trip.destination}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }}
                />
            ) : (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
            )}
            {/* 上下漸層（去玻璃；保證圖示/標題對比） */}
            <div className="absolute inset-x-0 top-0 h-14 pointer-events-none" style={{ background: 'linear-gradient(rgba(0,0,0,0.28), transparent)' }} />
            <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(transparent, rgba(35,35,32,0.9))' }} />

            <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                {/* 頂部：左＝倒數小標記（＋有待辦才出現的提示）；右＝拖曳/選單（裸圖示、無玻璃） */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1.5 items-start">
                        {!isPast && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-white px-2.5 py-1 rounded-[7px]" style={{ background: countdown.bg }}>
                                {countdown.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#8FE0AD' }} />}
                                {countdown.label}
                            </span>
                        )}
                        {todoCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-[7px]" style={{ background: '#BA7517' }}>
                                <AlertTriangle className="w-3 h-3" /> {todoCount} 個待安排
                            </span>
                        )}
                    </div>
                    <div
                        {...dragHandleProps}
                        style={{ touchAction: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
                        className="w-8 h-8 flex items-center justify-center text-white/90 cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </div>
                </div>

                {/* 底部：完整名字（serif 主角、不截斷）＋ mono 日期·天數 */}
                <div>
                    <h2 className={`font-serif ${hero ? 'text-[34px]' : 'text-[30px]'} font-bold text-white leading-[1.12]`} style={{ textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
                        {trip.destination}
                    </h2>
                    <div className="font-mono text-[12px] mt-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.74)' }}>
                        {formattedDate} · {trip.days.length} 天
                    </div>
                </div>
            </div>
        </div>
    );
};
