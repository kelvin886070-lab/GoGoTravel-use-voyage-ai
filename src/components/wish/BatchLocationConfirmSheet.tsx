// src/components/wish/BatchLocationConfirmSheet.tsx
// 🧭 Round2b：把整批「位置待確認」集中一張地圖批次審。
//   ─ 重心＝同區已確認點的中位座標；離群（>300km）標紅、其餘標琥珀，原因當場幾何算、不存欄位。
//   ─ 可信點不打擾使用者（此處只列待確認）；每列可「地圖上修」單點微調，或一鍵「全部確認」。
//   ─ 非阻擋：使用者可「稍後」，待確認徽章續掛。
import React, { useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { X, Check, MapPin, Clock } from 'lucide-react';
import type { WishItem } from '../../types';
import { haversineKm } from '../../hooks/useNearby';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string;
const FALLBACK = { lat: 22.9908, lng: 120.2133 };   // 台南
const FAR_KM = 300;   // 超過視為「落點過遠、疑似同名」

interface Props {
    open: boolean;
    items: WishItem[];        // 待確認（needsLocationConfirm）且有座標
    reference: WishItem[];    // 同區已確認、有座標者（算重心）
    onConfirmAll: (ids: string[]) => void;
    onFixOne: (item: WishItem) => void;
    onClose: () => void;
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const hasGeo = (w: WishItem) => w.lat != null && w.lng != null;

export const BatchLocationConfirmSheet: React.FC<Props> = ({ open, items, reference, onConfirmAll, onFixOne, onClose }) => {
    const pins = useMemo(() => items.filter(hasGeo), [items]);

    // 重心：優先用已確認點；不足 3 點退回用待確認點自己；再不行台南
    const center = useMemo(() => {
        const base = reference.filter(hasGeo);
        const src = base.length >= 3 ? base : pins;
        if (src.length === 0) return FALLBACK;
        return { lat: median(src.map(w => w.lat!)), lng: median(src.map(w => w.lng!)) };
    }, [reference, pins]);

    // 每點的原因分級（紅＝落點過遠疑似同名；琥珀＝定位不夠精準）
    const graded = useMemo(() => pins.map(w => {
        const km = haversineKm(center, { lat: w.lat!, lng: w.lng! });
        const far = km > FAR_KM;
        return { w, far, km, reason: far ? '落點過遠，疑似同名' : '定位不夠精準，建議確認' };
    }).sort((a, b) => Number(b.far) - Number(a.far)), [pins, center]);

    const farCount = graded.filter(g => g.far).length;

    // 讓所有待確認點都入鏡
    const bounds = useMemo(() => {
        if (pins.length === 0) return undefined;
        const lats = pins.map(w => w.lat!), lngs = pins.map(w => w.lng!);
        const pad = 0.05;
        return {
            south: Math.min(...lats) - pad, north: Math.max(...lats) + pad,
            west: Math.min(...lngs) - pad, east: Math.max(...lngs) + pad,
        };
    }, [pins]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[190] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-md bg-[#F2F2F2] rounded-t-[24px] sm:rounded-[24px] relative z-10 flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-300">
                <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
                    <div>
                        <h3 className="font-serif text-lg font-bold text-[#1D1D1B]">位置待確認 · {graded.length}</h3>
                        <p className="text-[11px] text-[#8A857A] mt-0.5">可信的已直接收進；只有這幾個要你瞄一眼</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                </div>

                <div className="relative h-[190px] mx-4 rounded-2xl overflow-hidden border border-[#DCD9D0]">
                    {!MAPS_KEY ? (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">地圖金鑰未設定</div>
                    ) : (
                        <APIProvider apiKey={MAPS_KEY}>
                            <Map
                                mapId={MAP_ID || undefined}
                                defaultCenter={center}
                                defaultZoom={11}
                                defaultBounds={bounds}
                                gestureHandling="greedy"
                                disableDefaultUI
                                className="w-full h-full"
                            >
                                {graded.map(g => (
                                    <AdvancedMarker key={g.w.id} position={{ lat: g.w.lat!, lng: g.w.lng! }} onClick={() => onFixOne(g.w)}>
                                        <Pin background={g.far ? '#A32D2D' : '#BA7517'} borderColor="#fff" glyphColor="#fff" />
                                    </AdvancedMarker>
                                ))}
                            </Map>
                        </APIProvider>
                    )}
                    <div className="pointer-events-none absolute right-2 bottom-2 bg-white/90 rounded-lg px-2 py-1 text-[10px] text-[#57534E]">
                        <span style={{ color: '#A32D2D' }}>●</span> 過遠 {farCount} · <span style={{ color: '#BA7517' }}>●</span> 待確認 {graded.length - farCount}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-1.5">
                    {graded.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-10 px-6">沒有待確認的位置了 ✓</div>
                    ) : graded.map(({ w, far, reason }) => (
                        <div key={w.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5">
                            <MapPin className="w-4 h-4 shrink-0" style={{ color: far ? '#A32D2D' : '#BA7517' }} />
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-[#1D1D1B] truncate">{w.title}</div>
                                <div className="text-[11px] truncate" style={{ color: far ? '#A32D2D' : '#854F0B' }}>{reason}</div>
                            </div>
                            <button onClick={() => onFixOne(w)}
                                    className="text-[11px] font-bold text-[#57534E] border border-[#E2DED5] rounded-lg px-2.5 py-1 active:scale-95 transition-transform shrink-0">
                                地圖上修
                            </button>
                        </div>
                    ))}
                </div>

                {graded.length > 0 && (
                    <div className="shrink-0 px-4 pb-safe pt-2 pb-4 flex gap-2.5 border-t border-black/5 bg-white/70">
                        <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white border border-[#E2DED5] text-sm font-bold text-[#57534E] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                            <Clock className="w-4 h-4" /> 稍後再說
                        </button>
                        <button onClick={() => onConfirmAll(graded.map(g => g.w.id))}
                                className="flex-[1.4] py-3 rounded-2xl bg-[#45846D] text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                            <Check className="w-4 h-4" /> 全部確認
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
