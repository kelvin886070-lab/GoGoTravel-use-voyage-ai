// src/views/TodayView.tsx
// 🧭 變臉首頁「今天/走」臉：旅程中（今天 ∈ 行程日期）時取代行程列表。
//   資訊層級（V1）：下一站大焦點（含 Google Maps 導航 deep-link）→ 今日時間軸（可展開全日）→ 在這裡要買 nudge。
//   幾乎零新邏輯：讀 trip.days 當日活動＋useNearby 算直線距離；導航把路徑計算外包給 Google（零 API 成本）。
import React, { useMemo, useState } from 'react';
import { Navigation, ChevronDown, ChevronUp, ShoppingBag, MapPin, LayoutList, Compass } from 'lucide-react';
import type { Trip, Activity, WishItem } from '../types';
import { useNearby, haversineKm, fmtDist } from '../hooks/useNearby';
import { isSystemType } from './ItineraryView/shared';

interface Props {
    trip: Trip;
    wishItems: WishItem[];
    onOpenTrip: () => void;
    onSeeAllTrips: () => void;
}

const parseHM = (t: string): number => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};

// 導航：把路徑計算外包給 Google Maps（有座標用座標、否則用名稱）
const openNav = (act: Activity) => {
    const dest = act.lat != null && act.lng != null ? `${act.lat},${act.lng}` : encodeURIComponent(act.title);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
};

export const TodayView: React.FC<Props> = ({ trip, wishItems, onOpenTrip, onSeeAllTrips }) => {
    const { pos, status, locate } = useNearby();
    const [expanded, setExpanded] = useState(false);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // 今天是本趟第幾天
    const dayIndex = useMemo(() => {
        const [y, m, d] = (trip.startDate || '').split('-').map(Number);
        if (!y) return 0;
        const start = new Date(y, m - 1, d); start.setHours(0, 0, 0, 0);
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const idx = Math.floor((t.getTime() - start.getTime()) / 86400000);
        return Math.max(0, Math.min(idx, (trip.days.length || 1) - 1));
    }, [trip.startDate, trip.days.length]);

    const activities = useMemo(() => trip.days[dayIndex]?.activities || [], [trip.days, dayIndex]);
    const stops = useMemo(() => activities.filter(a => !isSystemType(a.type)), [activities]);

    // 下一站＝時間 >= 現在的第一個「地點」活動；都過了＝今天走完
    const nextStop = useMemo(() => stops.find(a => parseHM(a.time) >= nowMin) || null, [stops, nowMin]);
    const minsUntil = nextStop ? parseHM(nextStop.time) - nowMin : 0;

    const distLabel = useMemo(() => {
        if (!nextStop || pos == null || nextStop.lat == null || nextStop.lng == null) return null;
        return fmtDist(haversineKm(pos, { lat: nextStop.lat, lng: nextStop.lng }));
    }, [nextStop, pos]);

    // 今天要買：綁到今日各站、且未買的購物項
    const todayStopIds = useMemo(() => new Set(activities.map(a => a.id).filter(Boolean) as string[]), [activities]);
    const buyToday = useMemo(
        () => wishItems.filter(w => w.type === 'item' && w.tripId === trip.id && !w.isPurchased && w.stopId && todayStopIds.has(w.stopId)),
        [wishItems, trip.id, todayStopIds],
    );

    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;   // lint 清理：便宜字串不需 memo（compiler 也拒絕保留空 deps）

    return (
        <div className="h-full flex flex-col w-full bg-transparent">
            {/* on-trip 標頭 */}
            <div className="flex-shrink-0 pt-14 pb-4 px-5 bg-[#2C2C2A] z-40 w-full sticky top-0">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
                            </span>
                            <span className="text-[10px] font-bold tracking-widest text-white/80">旅途中</span>
                        </div>
                        <h1 className="text-3xl font-black font-serif tracking-wide text-white mt-1 uppercase">{trip.destination}</h1>
                        <p className="text-[11px] font-mono tracking-widest text-white/70 mt-1">DAY {dayIndex + 1} · {dateStr}</p>
                    </div>
                    <button onClick={onSeeAllTrips} className="flex items-center gap-1 text-[11px] font-bold text-white/80 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                        <LayoutList className="w-3.5 h-3.5" /> 所有行程
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto w-full no-scrollbar px-5 pt-4 pb-24">
                {stops.length === 0 ? (
                    <div className="mt-8 text-center py-14 border-2 border-dashed border-gray-300/60 rounded-[28px] bg-white/40">
                        <Compass className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">今天還沒排行程</p>
                        <button onClick={onOpenTrip} className="mt-3 text-xs font-bold text-[#45846D]">去排今天 →</button>
                    </div>
                ) : (
                    <>
                        {/* 下一站大焦點 */}
                        {nextStop ? (
                            <div className="bg-[#E1F5EE] rounded-[24px] p-5">
                                <p className="text-[11px] font-bold text-[#0F6E56]">
                                    下一站 · {minsUntil <= 0 ? '現在' : `${minsUntil} 分後`}
                                </p>
                                <h2 className="text-2xl font-black text-[#04342C] mt-1 leading-tight">{nextStop.title}</h2>
                                <p className="text-xs font-medium text-[#0F6E56] mt-1.5 flex items-center gap-2">
                                    <span className="font-mono">{nextStop.time}</span>
                                    {distLabel && <><span className="w-1 h-1 rounded-full bg-[#0F6E56]/40" /><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{distLabel}</span></>}
                                </p>
                                <div className="flex gap-2.5 mt-4">
                                    <button onClick={() => openNav(nextStop)} className="flex-1 py-2.5 rounded-xl bg-[#45846D] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                                        <Navigation className="w-4 h-4" /> 導航
                                    </button>
                                    <button onClick={onOpenTrip} className="flex-1 py-2.5 rounded-xl bg-white text-[#0F6E56] border border-[#9FE1CB] text-[13px] font-bold active:scale-[0.98] transition-transform">看詳情</button>
                                </div>
                                {!pos && status !== 'denied' && (
                                    <button onClick={locate} className="w-full text-center text-[11px] text-[#0F6E56]/80 mt-2.5 font-medium">
                                        {status === 'loading' ? '定位中…' : '開啟定位以顯示距離'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-[#F1EFE8] rounded-[24px] p-5 text-center">
                                <p className="text-sm font-bold text-[#57534E]">今天的行程都走完了 🎉</p>
                                <button onClick={onOpenTrip} className="mt-2 text-xs font-bold text-[#45846D]">看完整行程 →</button>
                            </div>
                        )}

                        {/* 今日時間軸：收合＝chips，展開＝全日 */}
                        <div className="mt-4">
                            <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-1 mb-2">
                                <span className="text-[13px] font-black font-serif text-[#1D1D1B]">今日行程 · {stops.length}</span>
                                <span className="text-[11px] text-gray-400 flex items-center gap-1">{expanded ? '收合' : '看全日'}{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                            </button>

                            {!expanded ? (
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {stops.map((a, i) => {
                                        const past = parseHM(a.time) < nowMin && a !== nextStop;
                                        const isNext = a === nextStop;
                                        return (
                                            <span key={a.id || i} className={`flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-xl font-medium ${isNext ? 'bg-[#45846D] text-white' : past ? 'bg-[#F1EFE8] text-gray-400 line-through' : 'bg-white text-gray-600 border border-gray-200'}`}>
                                                <span className="font-mono mr-1">{a.time}</span>{a.title.length > 6 ? a.title.slice(0, 6) + '…' : a.title}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                                    {activities.map((a, i) => {
                                        const past = parseHM(a.time) < nowMin && a !== nextStop;
                                        const isNext = a === nextStop;
                                        return (
                                            <div key={a.id || i} onClick={onOpenTrip} className={`flex items-center gap-3 px-3.5 py-2.5 ${isNext ? 'bg-[#E1F5EE]/50' : ''}`}>
                                                <span className={`font-mono text-[11px] w-11 flex-shrink-0 ${isNext ? 'text-[#0F6E56] font-bold' : 'text-gray-400'}`}>{a.time}</span>
                                                <span className={`flex-1 text-[13px] truncate ${past ? 'text-gray-400 line-through' : 'text-[#1D1D1B]'}`}>{a.title}</span>
                                                {isNext && <span className="text-[10px] text-[#0F6E56] bg-[#E1F5EE] px-2 py-0.5 rounded-full flex-shrink-0">下一站</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 在這裡要買 nudge */}
                        {buyToday.length > 0 && (
                            <button onClick={onOpenTrip} className="w-full mt-4 bg-[#FAEEDA] rounded-2xl px-4 py-3 flex items-center gap-2.5 active:scale-[0.99] transition-transform">
                                <ShoppingBag className="w-4 h-4 text-[#854F0B] flex-shrink-0" />
                                <span className="flex-1 text-left text-[12.5px] font-bold text-[#854F0B]">今天有 {buyToday.length} 樣要買</span>
                                <ChevronDown className="w-4 h-4 text-[#854F0B] -rotate-90" />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
