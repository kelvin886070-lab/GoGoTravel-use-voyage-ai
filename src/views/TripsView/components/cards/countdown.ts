// src/views/TripsView/components/cards/countdown.ts
// 🎟️ 倒數膠囊的共用判定：hero 卡與列表卡共用同一套，避免兩邊字色漂移。
//   >7 天灰（安靜）→ ≤7 天琥珀 → ≤2 天/今明後天紅（用字比數字戳）→ 旅途中綠。
import type { Trip } from '../../../../types';

export interface Countdown {
    label: string;
    bg: string;
    dot?: boolean;   // 旅途中的小綠點
}

const ts = (s: string): number => {
    const [y, m, d] = (s || '').split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1).getTime();
};

export function tripCountdown(trip: Trip): Countdown {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = today.getTime();
    const startTs = ts(trip.startDate);
    const endTs = ts(trip.endDate);
    const isOnTrip = now >= startTs && now <= endTs;
    const daysUntil = Math.ceil((startTs - now) / 86400000);

    if (isOnTrip) return { label: '旅途中', bg: '#3F6B52', dot: true };
    if (daysUntil <= 0) return { label: '今天出發', bg: '#A23B2E' };
    if (daysUntil === 1) return { label: '明天出發', bg: '#A23B2E' };
    if (daysUntil === 2) return { label: '後天出發', bg: '#A23B2E' };
    if (daysUntil <= 7) return { label: `剩 ${daysUntil} 天`, bg: '#BA7517' };
    return { label: `還有 ${daysUntil} 天`, bg: 'rgba(35,35,32,0.45)' };
}

// 🎟️ V1 大數字倒數（hero 狀態條用）：數字＋單位分離、顏色隨時間升溫。
//   顏色分界與 computeStage 一致：>21 灰（安靜）、≤21 琥珀、≤3 紅、旅途中綠。
export interface CountdownV1 {
    onTrip: boolean;
    days: number;      // 距出發天數（旅途中為 0）
    color: string;     // 數字顏色（時間升溫）
}

export function countdownV1(trip: Trip): CountdownV1 {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = today.getTime();
    const startTs = ts(trip.startDate);
    const endTs = ts(trip.endDate);
    const onTrip = now >= startTs && now <= endTs;
    const days = Math.max(0, Math.ceil((startTs - now) / 86400000));
    const color = onTrip ? '#3F6B52' : days <= 3 ? '#A23B2E' : days <= 21 ? '#BA7517' : '#8A8266';
    return { onTrip, days, color };
}
