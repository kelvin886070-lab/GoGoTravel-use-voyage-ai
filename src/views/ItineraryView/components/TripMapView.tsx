// src/views/ItineraryView/components/TripMapView.tsx
// 🗺️ Phase D：當日景點地圖（品牌編號圖釘 + 路線 + 天數切換 + 點釘出小卡）
import React, { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, Navigation } from 'lucide-react';
import type { Trip, Activity, WeatherInfo } from '../../../types';
import { ensureTripGeocoded, isMappable, getRoutePolyline } from '../../../services/geo';
import { CATEGORIES } from '../shared';
import { getWeatherForecast } from '../../../services/gemini';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string;

interface Props { trip: Trip; onUpdateTrip: (t: Trip) => void; }

export const TripMapView: React.FC<Props> = ({ trip, onUpdateTrip }) => {
    const [dayIdx, setDayIdx] = useState(0);
    const [geocoding, setGeocoding] = useState(false);
    const [selected, setSelected] = useState<Activity | null>(null);

    // 開啟地圖時補座標（只在切換行程時跑一次）
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setGeocoding(true);
                const { trip: updated, changed } = await ensureTripGeocoded(trip);
                if (!cancelled && changed) onUpdateTrip(updated);
            } catch (e) {
                console.error('地圖定位失敗', e);
            } finally {
                if (!cancelled) setGeocoding(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trip.id]);

    const day = trip.days[dayIdx];
    const stops = useMemo(
        () => (day?.activities || []).filter(a => isMappable(a) && a.lat != null && a.lng != null),
        [day],
    );
    const points = useMemo(() => stops.map(a => ({ lat: a.lat as number, lng: a.lng as number })), [stops]);
    const center = points[0] || { lat: 25.033, lng: 121.565 };

    // #5 近期/旅途中才顯示天氣，遠期顯示倒數天數
    const [weather, setWeather] = useState<WeatherInfo | null>(null);
    const daysUntilStart = useMemo(
        () => Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000),
        [trip.startDate],
    );
    const showWeather = daysUntilStart <= 10;
    useEffect(() => {
        if (!showWeather) { setWeather(null); return; }
        let cancelled = false;
        getWeatherForecast(trip.destination).then(w => { if (!cancelled) setWeather(w); }).catch(() => {});
        return () => { cancelled = true; };
    }, [showWeather, trip.destination]);

    const dayDate = new Date(new Date(trip.startDate).getTime() + dayIdx * 86400000);
    const dayMD = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;

    // 一鍵導航整天路線（用座標當 origin/destination/waypoints）
    const navUrl = (() => {
        const c = stops.map(s => `${s.lat},${s.lng}`);
        if (c.length === 0) return '';
        if (c.length === 1) return `https://www.google.com/maps/search/?api=1&query=${c[0]}`;
        const waypoints = c.slice(1, -1).join('|');
        return `https://www.google.com/maps/dir/?api=1&origin=${c[0]}&destination=${c[c.length - 1]}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
    })();

    if (!MAPS_KEY || !MAP_ID) {
        return <div className="p-8 text-center text-gray-400 text-sm">地圖金鑰未設定（VITE_GOOGLE_MAPS_KEY / VITE_GOOGLE_MAP_ID）</div>;
    }

    return (
        <div className="pb-6">
            {/* 天數切換 */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
                {trip.days.map((d, i) => (
                    <button
                        key={d.day}
                        onClick={() => { setDayIdx(i); setSelected(null); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${i === dayIdx ? 'bg-[#45846D] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}
                    >
                        DAY {d.day}
                    </button>
                ))}
            </div>

            <div className="relative mx-4 rounded-2xl overflow-hidden h-[70vh] bg-gray-100 shadow-sm">
                {geocoding && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> 定位中…
                    </div>
                )}

                {stops.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm px-6 text-center">
                        {geocoding ? '正在為這一天的地點定位…' : '這一天還沒有可定位的地點'}
                    </div>
                ) : (
                    <APIProvider apiKey={MAPS_KEY}>
                        <Map
                            mapId={MAP_ID}
                            defaultCenter={center}
                            defaultZoom={12}
                            gestureHandling="cooperative"
                            disableDefaultUI
                            className="w-full h-full"
                        >
                            {stops.map((a, i) => (
                                <AdvancedMarker
                                    key={i}
                                    position={{ lat: a.lat as number, lng: a.lng as number }}
                                    onClick={() => setSelected(a)}
                                >
                                    <div className="w-7 h-7 rounded-full bg-[#45846D] text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-md">
                                        {i + 1}
                                    </div>
                                </AdvancedMarker>
                            ))}
                            <RouteLine points={points} />
                            <FitBounds points={points} />
                        </Map>
                    </APIProvider>
                )}

                {/* 點圖釘出現的小卡 */}
                {selected && (
                    <div className="absolute bottom-4 left-4 right-4 z-20 bg-white rounded-2xl shadow-lg p-4 animate-in slide-in-from-bottom-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs text-gray-400 font-mono">{selected.time}</div>
                                <div className="font-bold text-[#1D1D1B] truncate">{selected.title}</div>
                                {selected.location && (
                                    <div className="text-xs text-gray-500 truncate mt-0.5">{selected.location}</div>
                                )}
                            </div>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.location || selected.title)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-shrink-0 flex items-center gap-1 bg-[#45846D] text-white text-xs font-bold px-3 py-2 rounded-full active:scale-95 transition-transform"
                            >
                                <Navigation className="w-3 h-3" /> 導航
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* #2+#5 日卡：標頭(DAY·日期·倒數/天氣·地點數) + 編號景點清單 + 一鍵導航 */}
            {stops.length > 0 && (
                <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-black text-[#1D1D1B]">DAY {day.day}</span>
                            <span className="text-xs text-gray-400 font-mono">{dayMD}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {showWeather && weather ? (
                                <span className="text-xs font-bold text-[#45846D] bg-[#45846D]/10 px-2.5 py-1 rounded-full">
                                    {weather.temperature} {weather.condition}
                                </span>
                            ) : daysUntilStart > 0 ? (
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                                    倒數 {daysUntilStart} 天
                                </span>
                            ) : null}
                            <span className="text-xs text-gray-400">{stops.length} 個地點</span>
                        </div>
                    </div>

                    <div className="px-2 pb-1">
                        {stops.map((a, i) => {
                            const cat = CATEGORIES.find(c => c.id === (a.type || '').toLowerCase());
                            const Icon = cat?.icon;
                            // 取該類別的品牌色（與類別選單一致）；沒有就用中性灰
                            const iconColor = cat?.tagClass.split(' ').find(c => c.startsWith('text-')) || 'text-gray-400';
                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelected(a)}
                                    className={`w-full flex items-center gap-3 text-left rounded-xl px-2.5 py-2.5 transition-all active:scale-[0.99] ${selected === a ? 'bg-[#45846D]/10' : 'hover:bg-gray-50'}`}
                                >
                                    <span className="w-6 h-6 rounded-full bg-[#45846D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                    <span className="text-xs text-gray-400 font-mono w-10 flex-shrink-0">{a.time}</span>
                                    {/* 固定寬度的 icon 槽：沒 icon 時也占位，讓標題上下對齊 */}
                                    <span className="w-4 flex-shrink-0 flex justify-center">
                                        {Icon ? <Icon className={`w-4 h-4 ${iconColor}`} /> : null}
                                    </span>
                                    <span className="text-sm font-bold text-[#1D1D1B] truncate flex-1">{a.title}</span>
                                </button>
                            );
                        })}
                    </div>

                    {navUrl && (
                        <a
                            href={navUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 bg-[#1D1D1B] text-white font-bold text-sm py-3.5 active:scale-[0.99] transition-transform"
                        >
                            <Navigation className="w-4 h-4" /> 開啟導航
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

// 依序連接景點的路線：優先畫「沿道路」的品牌綠折線，失敗退回直線
const RouteLine: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
    const map = useMap();
    const mapsLib = useMapsLibrary('maps');
    const geometryLib = useMapsLibrary('geometry');
    const [path, setPath] = useState<{ lat: number; lng: number }[] | null>(null);

    // 取沿道路的路線（需 geometry 函式庫解碼；未就緒前先用直線）
    useEffect(() => {
        let cancelled = false;
        if (points.length < 2) { setPath(null); return; }
        if (!geometryLib) { setPath(points); return; }
        getRoutePolyline(points).then(encoded => {
            if (cancelled) return;
            if (encoded) {
                const raw = geometryLib.encoding.decodePath(encoded) as Array<{ lat(): number; lng(): number }>;
                setPath(raw.map(p => ({ lat: p.lat(), lng: p.lng() })));
            } else {
                setPath(points); // 直線退回
            }
        }).catch(() => { if (!cancelled) setPath(points); });
        return () => { cancelled = true; };
    }, [points, geometryLib]);

    useEffect(() => {
        if (!map || !mapsLib || !path || path.length < 2) return;
        const line = new mapsLib.Polyline({
            path,
            geodesic: true,
            strokeColor: '#45846D',
            strokeOpacity: 0.9,
            strokeWeight: 4,
        });
        line.setMap(map);
        return () => line.setMap(null);
    }, [map, mapsLib, path]);
    return null;
};

// 自動框住當天所有景點
const FitBounds: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
    const map = useMap();
    const coreLib = useMapsLibrary('core'); // LatLngBounds 在 core 函式庫，不是 maps
    useEffect(() => {
        if (!map || !coreLib || points.length === 0) return;
        if (points.length === 1) {
            map.setCenter(points[0]);
            map.setZoom(14);
            return;
        }
        const bounds = new coreLib.LatLngBounds();
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, 60);
    }, [map, coreLib, points]);
    return null;
};
