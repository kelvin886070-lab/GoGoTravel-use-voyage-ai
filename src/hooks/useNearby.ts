// src/hooks/useNearby.ts
// 🧭 C2-1：在途鄰近雷達的共用定位。一次性取得 GPS（省電、顧隱私），並提供距離工具。
import { useCallback, useState } from 'react';

export interface Coords { lat: number; lng: number; }
export type GeoStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

// 兩點距離（公里，haversine）
export const haversineKm = (a: Coords, b: Coords): number => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

export const fmtDist = (km: number): string => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export function useNearby() {
    const [pos, setPos] = useState<Coords | null>(null);
    const [status, setStatus] = useState<GeoStatus>('idle');

    const locate = useCallback(() => {
        if (!('geolocation' in navigator)) { setStatus('error'); return; }
        setStatus('loading');
        navigator.geolocation.getCurrentPosition(
            p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setStatus('ready'); },
            err => { setStatus(err.code === 1 ? 'denied' : 'error'); },
            // 🧭 雷達重精準：在途使用者會移動，不吃快取、開高精度（GPS）。
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    }, []);

    return { pos, status, locate };
}
