// src/views/TripsView/components/cards/OnTripHeroCard.tsx
// 🧭 批4臉1：旅途中 hero 卡——與 TripHeroCard 同一套卡片骨架（封面照＋serif 標題＋狀態條），
//   只換狀態條語意：DAY N/總數｜時段感知文案（onTripStatus）｜綠「開啟今天」/墨「看明天」。
//   封面乾淨（LIVE 呼吸點在區塊標題層級，不貼膠囊）；右上僅天氣膠囊（資訊非狀態）：
//   Open-Meteo，拿不到靜默消失；降雨機率 ≥60% 轉琥珀「N% · 帶傘」（照顧>資訊）。
//   雙入口（整卡＋按鈕都進走模式）為 Kelvin 指定保留，之後旅途臉改結構時再分工。
import React, { useEffect, useState } from 'react';
import { Navigation, Sun, Moon, Cloud, CloudRain } from 'lucide-react';
import type { Trip, Activity } from '../../../../types';
import { onTripToday } from './onTripStatus';
import { fetchWeather, type TripWeather } from '../../../../services/weather';

// 天氣座標：優先「今天第一個有座標的站」（天氣要報人所在的城市），否則整趟找一個。都沒有＝不顯示。
const findCoord = (trip: Trip, dayIdx: number): { lat: number; lng: number } | null => {
    const has = (a: Activity) => typeof a.lat === 'number' && typeof a.lng === 'number';
    const today = (trip.days?.[dayIdx]?.activities || []).find(has);
    if (today) return { lat: today.lat as number, lng: today.lng as number };
    for (const d of trip.days || []) {
        const hit = (d.activities || []).find(has);
        if (hit) return { lat: hit.lat as number, lng: hit.lng as number };
    }
    return null;
};

export const OnTripHeroCard: React.FC<{ trip: Trip; onOpen?: () => void }> = ({ trip, onOpen }) => {
    const st = onTripToday(trip);
    const [wx, setWx] = useState<TripWeather | null>(null);

    useEffect(() => {
        let alive = true;
        const c = findCoord(trip, st.dayN - 1);
        if (!c) return;
        fetchWeather(c.lat, c.lng).then(d => { if (alive) setWx(d); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trip.id, st.dayN]);

    const rainAlert = wx !== null && wx.rainProb !== null && wx.rainProb >= 60;
    const WxIcon = wx === null ? null
        : rainAlert || wx.kind === 'rain' ? CloudRain
        : wx.kind === 'cloud' ? Cloud
        : wx.isDay ? Sun : Moon;

    const formattedRange = `${(trip.startDate || '').slice(5).replace(/-/g, '.')}–${(trip.endDate || '').slice(5).replace(/-/g, '.')}`;

    return (
        <div className="rounded-[22px] overflow-hidden bg-white border border-black/5 shadow-sm select-none">
            {/* 封面：整卡點擊＝進走模式；h-52 與「下一趟」主卡同高（旅途中＝當下最主要的卡） */}
            <button onClick={onOpen} className="relative block w-full h-52 text-left" aria-label={`開啟 ${trip.destination}`}>
                {trip.coverImage ? (
                    <img src={trip.coverImage} alt={trip.destination}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }} />
                ) : (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
                )}
                <div className="absolute inset-x-0 top-0 h-12 pointer-events-none" style={{ background: 'linear-gradient(rgba(0,0,0,0.28), transparent)' }} />
                <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(transparent, rgba(24,28,32,0.72))' }} />

                {/* 天氣：右下、去底色（與左下標題同基線，壓在 scrim 上）；雨天警示保留琥珀底（醒目是義務） */}
                {wx !== null && WxIcon !== null && (
                    <span className={`absolute bottom-4 right-3 inline-flex items-center gap-1 font-mono text-[12px] font-bold text-white ${rainAlert ? 'px-2.5 py-1 rounded-[7px]' : ''}`}
                        style={rainAlert ? { background: '#BA7517' } : { opacity: 0.92 }}>
                        <WxIcon className="w-3.5 h-3.5" />
                        {rainAlert ? `${wx.rainProb}% · 帶傘` : `${Math.round(wx.temp)}°`}
                    </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-4 pr-20">
                    <h2 className="font-serif text-[26px] font-bold text-white leading-[1.12]" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
                        {trip.destination}
                    </h2>
                    <div className="font-mono text-[12px] mt-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.78)' }}>
                        {formattedRange} · {trip.days.length} 天
                    </div>
                </div>
            </button>

            {/* 狀態條（時間欄式定稿 · V1 網格對齊）：兩行嚴格同基線（行1＝12px/18、行2＝17px/24），
                時間欄 46px 置中、時間 mono 17（數字＝mono 簽名保留）；分隔線隨內容等高；鈕垂直置中。 */}
            <div className="flex items-center px-4 py-3.5">
                {st.blockTime && (
                    <>
                        <div className="text-center shrink-0" style={{ minWidth: 46 }}>
                            <div className="font-mono text-[12px] mb-0.5" style={{ lineHeight: '18px', color: st.blockTone === 'last' ? '#BA7517' : '#8A8266' }}>{st.blockLabel}</div>
                            <div className="font-mono text-[17px] font-bold"
                                style={{ lineHeight: '24px', color: st.blockTone === 'today' ? '#3F6B52' : st.blockTone === 'last' ? '#BA7517' : '#8A8266' }}>
                                {st.blockTime}
                            </div>
                        </div>
                        <div className="w-px self-stretch bg-[#EAE7DE] shrink-0" style={{ margin: '2px 12px 2px 10px' }} />
                    </>
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-mono text-[12px] text-[#8A8266] mb-0.5" style={{ lineHeight: '18px' }}>{st.label}</div>
                    {/* 主文：站名 serif 17 單字體單色整行（統一不雜），可折兩行 */}
                    <div className="font-serif text-[17px] font-bold text-[#232320]"
                        style={{ lineHeight: '24px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {st.title}
                    </div>
                </div>
                <button
                    onClick={onOpen}
                    className="h-[34px] px-3.5 ml-2.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform bg-transparent"
                    style={{ border: `1.5px solid ${st.button === 'today' ? '#3F6B52' : '#232320'}`, color: st.button === 'today' ? '#3F6B52' : '#232320' }}
                >
                    <Navigation className="w-3.5 h-3.5" />
                    {st.button === 'today' ? '開啟今天' : '看明天'}
                </button>
            </div>
        </div>
    );
};
