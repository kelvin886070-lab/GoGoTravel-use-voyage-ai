// src/components/wish/LocationPinSheet.tsx
// 🧭 T3：拖地圖、釘固定在中心，確認即寫回座標。用於「位置待確認」修正與任何地點的手動校正。
//   設計取捨：釘固定在畫面中心、使用者拖地圖（比拖 marker 穩、tap 目標大），確認時讀地圖中心。
import React, { useEffect, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { MapPin, Check, X } from 'lucide-react';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string;
// 沒有初始座標時的預設中心（台南；使用者會自己拖到對的位置）
const FALLBACK = { lat: 22.9908, lng: 120.2133 };

interface Props {
    open: boolean;
    title: string;
    area?: string;
    initial?: { lat?: number; lng?: number };
    onConfirm: (lat: number, lng: number) => void;
    onClose: () => void;
}

export const LocationPinSheet: React.FC<Props> = ({ open, title, area, initial, onConfirm, onClose }) => {
    const start = (initial?.lat != null && initial?.lng != null)
        ? { lat: initial.lat as number, lng: initial.lng as number } : FALLBACK;
    const [center, setCenter] = useState(start);

    // 每次開啟都以最新初始座標重置中心（避免沿用上一個心願的殘留狀態）
    useEffect(() => {
        if (open) setCenter((initial?.lat != null && initial?.lng != null)
            ? { lat: initial.lat as number, lng: initial.lng as number } : FALLBACK);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial?.lat, initial?.lng]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-md bg-[#F2F2F2] rounded-t-[24px] sm:rounded-[24px] relative z-10 p-4 animate-in slide-in-from-bottom duration-300">
                <div className="w-9 h-1 rounded-full bg-[#D6D3CB] mx-auto mb-3 sm:hidden" />
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-serif text-lg font-bold text-[#1D1D1B]">確認位置</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-xs text-[#6B6863] mb-3 leading-relaxed">
                    拖曳地圖，讓圖釘對準「{title}」的正確位置。沒有明確地標（像小餐車）？放在你記得的大概位置就好。
                </p>

                <div className="relative h-[260px] rounded-2xl overflow-hidden border border-[#DCD9D0]">
                    {(!MAPS_KEY) ? (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">地圖金鑰未設定</div>
                    ) : (
                        <APIProvider apiKey={MAPS_KEY}>
                            <Map
                                mapId={MAP_ID || undefined}
                                defaultCenter={start}
                                defaultZoom={16}
                                gestureHandling="greedy"
                                disableDefaultUI
                                className="w-full h-full"
                                onCenterChanged={(e) => setCenter(e.detail.center)}
                            />
                        </APIProvider>
                    )}
                    {/* 固定在中心的圖釘（HTML 疊層，不隨拖曳移動） */}
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                        <MapPin className="w-9 h-9 text-[#45846D]" fill="#45846D" strokeWidth={1.5} stroke="#fff" />
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#1D1D1B]/25" />
                    {area && (
                        <div className="pointer-events-none absolute left-2.5 bottom-2.5 bg-white/90 rounded-lg px-2.5 py-1 text-[11px] text-[#57534E] flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {area}
                        </div>
                    )}
                </div>

                <div className="flex gap-2.5 mt-3.5">
                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white border border-[#E2DED5] text-sm font-bold text-[#57534E] active:scale-[0.98] transition-transform">取消</button>
                    <button onClick={() => onConfirm(center.lat, center.lng)}
                            className="flex-[2] py-3 rounded-2xl bg-[#45846D] text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                        <Check className="w-4 h-4" /> 就是這裡
                    </button>
                </div>
            </div>
        </div>
    );
};
