// src/views/ItineraryView/TripWalkView.tsx
// 🧭 走模式（行程頁的執行鏡頭）。簽名語言＝「編輯雜誌 × 旅行票券」。
//   焦點卡＝一張「往下一站的票」：departure board 頂條、大 serif 站名、mono 路線（交通標線上）、
//   撕票根＋輕量按鈕（導航＝「⇱ 站名」只留目的地；我到了＝虛線戳章圓「到！」）。
//   LIVE＝旅途中；PREVIEW＝行前彩排（選日、唯讀、不放我到了/記帳）。
import React, { useMemo, useState, useEffect } from 'react';
import { Navigation, ChevronDown, ChevronUp, ShoppingBag, Compass, Plus, Receipt, MapPinPlus, ArrowRight, Stamp, Car, Footprints, Bus, Train } from 'lucide-react';
import type { Trip, Activity, WishItem } from '../../types';
import { useNearby, haversineKm, fmtDist } from '../../hooks/useNearby';
import { isSystemType } from './shared';

// 🎟️ 簽名 palette
const INK = '#232320', PAPER = '#F6F1E7', BORDER = '#E0D8C6', GREEN = '#3F6B52', STAMP = '#A23B2E', MUTE = '#8A8266', PAGE = '#E4E2DD', DASH = '#C9BFA6';

interface Props {
    trip: Trip;
    wishItems: WishItem[];
    live: boolean;
    onOpenActivity: (dayIndex: number, actIndex: number) => void;
    onAddSpot?: (dayIndex: number) => void;
    onAddExpense?: (dayIndex: number) => void;
}

const parseHM = (t: string): number => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};
const openNav = (act: Activity) => {
    const dest = act.lat != null && act.lng != null ? `${act.lat},${act.lng}` : encodeURIComponent(act.title);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
};
const LegIcon: React.FC<{ mode?: string }> = ({ mode }) => {
    const m = (mode || '').toLowerCase();
    if (m.includes('walk')) return <Footprints className="w-3 h-3" />;
    if (m.includes('car') || m.includes('taxi')) return <Car className="w-3 h-3" />;
    if (m.includes('train') || m.includes('subway') || m.includes('tram')) return <Train className="w-3 h-3" />;
    return <Bus className="w-3 h-3" />;
};
const short = (s: string, n = 5) => (s.length > n ? s.slice(0, n) + '…' : s);

export const TripWalkView: React.FC<Props> = ({ trip, wishItems, live, onOpenActivity, onAddSpot, onAddExpense }) => {
    const { pos, status, locate } = useNearby();
    const [expanded, setExpanded] = useState(false);
    const [fabOpen, setFabOpen] = useState(false);

    const todayIndex = useMemo(() => {
        const [y, m, d] = (trip.startDate || '').split('-').map(Number);
        if (!y) return 0;
        const start = new Date(y, m - 1, d); start.setHours(0, 0, 0, 0);
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const idx = Math.floor((t.getTime() - start.getTime()) / 86400000);
        return Math.max(0, Math.min(idx, (trip.days.length || 1) - 1));
    }, [trip.startDate, trip.days.length]);

    const [previewDay, setPreviewDay] = useState(todayIndex);
    const dayIndex = live ? todayIndex : previewDay;

    const activities = useMemo(() => trip.days[dayIndex]?.activities || [], [trip.days, dayIndex]);
    const stops = useMemo(() => activities.filter(a => !isSystemType(a.type)), [activities]);
    const idxOf = (a: Activity) => activities.indexOf(a);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const [focusIdx, setFocusIdx] = useState(0);
    const [arrived, setArrived] = useState(false);
    useEffect(() => {
        const nm = new Date().getHours() * 60 + new Date().getMinutes();
        const i = live ? stops.findIndex(a => parseHM(a.time) >= nm) : 0;
        setFocusIdx(i < 0 ? Math.max(0, stops.length - 1) : i);
        setArrived(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayIndex]);

    const focusStop = stops[focusIdx] || null;
    const prevStop = focusIdx > 0 ? stops[focusIdx - 1] : null;
    const afterStop = focusIdx < stops.length - 1 ? stops[focusIdx + 1] : null;

    const inProgress = !!(live && focusStop && (arrived || parseHM(focusStop.time) <= nowMin));
    const minsUntil = focusStop ? parseHM(focusStop.time) - nowMin : 0;

    const focusActIdx = focusStop ? idxOf(focusStop) : -1;
    const leg = focusActIdx > 0 && activities[focusActIdx - 1]?.type === 'transport' ? activities[focusActIdx - 1].transportDetail : undefined;
    // 起點脈絡：第一站的「上一站」用前一個活動標題（機場/交通），否則「起點」
    const leftLabel = prevStop ? prevStop.title : (activities[focusActIdx - 1]?.title || '起點');

    const distLabel = useMemo(() => {
        if (!live || !focusStop || pos == null || focusStop.lat == null || focusStop.lng == null) return null;
        return fmtDist(haversineKm(pos, { lat: focusStop.lat, lng: focusStop.lng }));
    }, [live, focusStop, pos]);

    const todayStopIds = useMemo(() => new Set(activities.map(a => a.id).filter(Boolean) as string[]), [activities]);
    const buyToday = useMemo(
        () => wishItems.filter(w => w.type === 'item' && w.tripId === trip.id && !w.isPurchased && w.stopId && todayStopIds.has(w.stopId)),
        [wishItems, trip.id, todayStopIds],
    );
    const goNext = () => { setFocusIdx(i => Math.min(i + 1, stops.length - 1)); setArrived(false); };

    const monoLabel = "font-mono text-[10px] tracking-[2px]";

    return (
        <div className="py-4">
            {/* PREVIEW：選日彩排列 */}
            {!live && (
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono tracking-widest shrink-0 px-2 py-1 rounded" style={{ color: STAMP, background: '#F7E9E6' }}>REHEARSAL</span>
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                        {trip.days.map((d, i) => (
                            <button key={d.day} onClick={() => setPreviewDay(i)}
                                    className="shrink-0 text-[12px] font-bold px-3 py-1 rounded-full transition-colors"
                                    style={i === previewDay ? { background: INK, color: PAPER } : { background: PAPER, color: MUTE, border: `0.5px solid ${BORDER}` }}>
                                Day {d.day}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {stops.length === 0 || !focusStop ? (
                <div className="mt-4 text-center py-14 border-2 border-dashed rounded-[20px]" style={{ borderColor: DASH, background: PAPER }}>
                    <Compass className="w-8 h-8 mx-auto mb-3" style={{ color: MUTE }} />
                    <p className="text-sm font-bold" style={{ color: MUTE }}>{live ? '今天還沒排行程' : `Day ${dayIndex + 1} 還沒排行程`}</p>
                </div>
            ) : (
                <>
                    {/* 🎟️ 焦點卡＝往下一站的票 */}
                    <div className="rounded-2xl overflow-hidden" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                        {/* departure board 頂條 */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: INK }}>
                            <span className={monoLabel} style={{ color: '#C9B98F' }}>{!live ? 'REHEARSAL' : inProgress ? 'YOU ARE HERE' : 'NEXT STOP'}</span>
                            <span className={monoLabel} style={{ color: 'rgba(255,255,255,0.6)' }}>{!live ? `${focusIdx + 1} / ${stops.length}` : inProgress ? '現在' : `${minsUntil <= 0 ? '現在' : `${minsUntil} 分`}`}</span>
                        </div>

                        <div className="px-4 pt-4 pb-3">
                            <div className="flex items-end justify-between">
                                <button onClick={() => onOpenActivity(dayIndex, focusActIdx)} className="text-left font-serif font-medium leading-none" style={{ fontSize: 32, color: INK }}>{focusStop.title}</button>
                                <span className="font-mono text-[11px] pb-1" style={{ color: MUTE }}>{focusStop.time}</span>
                            </div>

                            {/* mono 路線（交通標線上） */}
                            <div className="mt-4 flex items-center font-mono text-[10px]" style={{ color: MUTE }}>
                                <span className="shrink-0">{short(leftLabel, 4)}</span>
                                <span className="flex-1 mx-2 relative" style={{ borderTop: `1px dashed ${DASH}`, height: 1 }}>
                                    {(leg || (!inProgress && distLabel)) && (
                                        <span className="absolute left-1/2 -translate-x-1/2 -top-[8px] px-1 flex items-center gap-1" style={{ background: PAPER, color: GREEN }}>
                                            {leg ? <><LegIcon mode={leg.mode} />{leg.duration}</> : distLabel}
                                        </span>
                                    )}
                                </span>
                                <span className="shrink-0 font-bold" style={{ color: INK }}>{short(focusStop.title, 4)}</span>
                                <span className="flex-1 mx-2" style={{ borderTop: `1px dashed ${DASH}`, height: 1 }} />
                                <span className="shrink-0">{afterStop ? short(afterStop.title, 4) : '尾聲'}</span>
                            </div>
                        </div>

                        {/* 撕票根 */}
                        <div className="relative" style={{ borderTop: `1.5px dashed ${DASH}` }}>
                            <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full" style={{ background: PAGE }} />
                            <span className="absolute -right-2 -top-2 w-4 h-4 rounded-full" style={{ background: PAGE }} />
                        </div>

                        {/* 票根：輕量按鈕 */}
                        <div className="px-4 py-3 flex items-center gap-3">
                            {!live ? (
                                <>
                                    <button onClick={() => onOpenActivity(dayIndex, focusActIdx)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: `1px solid ${INK}`, color: INK }}>看詳情</button>
                                    <button onClick={() => openNav(focusStop)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium tracking-wide flex items-center justify-center gap-2" style={{ background: INK, color: PAPER }}><Navigation className="w-4 h-4" />{short(focusStop.title, 4)}</button>
                                </>
                            ) : inProgress ? (
                                <>
                                    {onAddExpense && <button onClick={() => onAddExpense(dayIndex)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2" style={{ border: `1px solid ${INK}`, color: INK }}><Receipt className="w-4 h-4" />記一筆</button>}
                                    <button onClick={goNext} disabled={!afterStop} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium tracking-wide flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: INK, color: PAPER }}><ArrowRight className="w-4 h-4" />{afterStop ? '下一站' : '尾聲'}</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => openNav(focusStop)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium tracking-wide flex items-center justify-center gap-2" style={{ background: INK, color: PAPER }}><Navigation className="w-4 h-4" />{short(focusStop.title, 4)}</button>
                                    <button onClick={() => setArrived(true)} className="w-[52px] h-[52px] rounded-full flex flex-col items-center justify-center shrink-0 active:scale-95 transition-transform" style={{ border: `1.5px dashed ${STAMP}`, color: STAMP }}>
                                        <Stamp className="w-4 h-4" /><span className="text-[9px] font-bold">到！</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {live && !inProgress && !pos && status !== 'denied' && (
                        <button onClick={locate} className="w-full text-center text-[11px] mt-2 font-medium" style={{ color: MUTE }}>
                            {status === 'loading' ? '定位中…' : '開啟定位以顯示距離'}
                        </button>
                    )}

                    {/* 時間軸 */}
                    <div className="mt-4">
                        <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-1 mb-2">
                            <span className="text-[13px] font-black font-serif" style={{ color: INK }}>{live ? '今日行程' : `Day ${dayIndex + 1}`} · {stops.length}</span>
                            <span className="text-[11px] flex items-center gap-1" style={{ color: MUTE }}>{expanded ? '收合' : '看全日'}{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                        </button>

                        {!expanded ? (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {stops.map((a, i) => {
                                    const isFocus = a === focusStop;
                                    const past = live && !isFocus && i < focusIdx;
                                    return (
                                        <button key={a.id || i} onClick={() => setFocusIdx(i)} className={`flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${past ? 'line-through' : ''}`}
                                                style={isFocus ? { background: INK, color: PAPER } : { background: PAPER, color: past ? MUTE : '#5f5d52', border: `0.5px solid ${BORDER}` }}>
                                            <span className="font-mono mr-1">{a.time}</span>{short(a.title, 6)}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl divide-y" style={{ background: PAPER, border: `0.5px solid ${BORDER}`, borderColor: BORDER }}>
                                {activities.map((a, i) => {
                                    const isFocus = a === focusStop;
                                    return (
                                        <div key={a.id || i} onClick={() => onOpenActivity(dayIndex, i)} className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer" style={isFocus ? { background: '#EFE8D8' } : undefined}>
                                            <span className="font-mono text-[11px] w-11 flex-shrink-0" style={{ color: isFocus ? GREEN : MUTE }}>{a.time}</span>
                                            <span className="flex-1 text-[13px] truncate" style={{ color: !isSystemType(a.type) ? INK : MUTE }}>{a.title}</span>
                                            {isFocus && <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-mono" style={{ color: PAPER, background: INK }}>{inProgress ? '在這' : '焦點'}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 在這裡要買（僅 LIVE） */}
                    {live && buyToday.length > 0 && (
                        <button onClick={() => onOpenActivity(dayIndex, focusActIdx)} className="w-full mt-4 rounded-2xl px-4 py-3 flex items-center gap-2.5 active:scale-[0.99] transition-transform" style={{ background: '#F7E9E6', border: `0.5px solid #E7C9C3` }}>
                            <ShoppingBag className="w-4 h-4 flex-shrink-0" style={{ color: STAMP }} />
                            <span className="flex-1 text-left text-[12.5px] font-bold" style={{ color: STAMP }}>今天有 {buyToday.length} 樣要買</span>
                            <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: STAMP }} />
                        </button>
                    )}
                </>
            )}

            {/* FAB：旅途中隨手，僅 LIVE */}
            {live && (onAddSpot || onAddExpense) && (
                <>
                    {fabOpen && <div className="fixed inset-0 z-30" onClick={() => setFabOpen(false)} />}
                    <div className="fixed bottom-6 right-5 z-40 flex flex-col items-end gap-2.5">
                        {fabOpen && (
                            <>
                                {onAddExpense && (
                                    <button onClick={() => { setFabOpen(false); onAddExpense(dayIndex); }} className="flex items-center gap-2 shadow-lg rounded-full pl-3 pr-4 py-2.5 active:scale-95 transition-transform animate-in slide-in-from-bottom-2" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                                        <Receipt className="w-4 h-4" style={{ color: STAMP }} /><span className="text-[13px] font-bold" style={{ color: STAMP }}>記一筆</span>
                                    </button>
                                )}
                                {onAddSpot && (
                                    <button onClick={() => { setFabOpen(false); onAddSpot(dayIndex); }} className="flex items-center gap-2 shadow-lg rounded-full pl-3 pr-4 py-2.5 active:scale-95 transition-transform animate-in slide-in-from-bottom-2" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                                        <MapPinPlus className="w-4 h-4" style={{ color: GREEN }} /><span className="text-[13px] font-bold" style={{ color: GREEN }}>臨時加點</span>
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={() => setFabOpen(o => !o)} className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform ${fabOpen ? 'rotate-45' : ''}`} style={{ background: INK, color: PAPER }}>
                            <Plus className="w-7 h-7" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
