// src/views/TripsView/components/cards/onTripStatus.ts
// 🧭 批4臉1：旅途中 hero 狀態條（純函式）——「時間欄式」定稿（與 Kelvin 定案）：
//   左欄＝時間塊（上語意小字 首站/下一站/明天/返程 ＋ 下大時間；孤立數字塊可上語意色，文句不行）；
//   主文＝站名 serif 單字體單色整行（統一不雜）；小字行＝狀態＋相對時間＋今日剩餘站數（補回進度感）。
//   DAY N 不在卡上（走模式頁本來就顯示，不重複）。無時間態（自由日/旅程圓滿）→ 時間塊整欄退場、文字滿版。
//   邊界態全覆蓋：早上／白天／晚上（明天預告）／自由日／最後一天（準備返程）／走完（一路順風）。
//   ⚠️ 時間比較用「裝置當地時間」：旅途中的人幾乎都在目的地時區（合理假設，記錄之）。
import type { Trip, Activity } from '../../../../types';

export interface OnTripStatus {
    dayN: number;                           // 今天是第幾天（1-based，夾在 1..total；內部邏輯用）
    total: number;                          // 總天數
    blockLabel: string | null;              // 時間塊上小字（首站/下一站/明天/返程）；null＝塊退場
    blockTime: string | null;               // 時間塊大字 'HH:MM'；null＝塊退場
    blockTone: 'today' | 'relax' | 'last';  // 塊語意色：綠（今天行動）/灰（明天放鬆）/琥珀（返程）
    label: string;                          // 小字行：狀態/語氣（mono 12 灰）
    title: string;                          // 主文站名（serif 17 單色，可折兩行）
    button: 'today' | 'tomorrow';           // 綠框「開啟今天」／墨框「看明天」
}

const localTs = (s?: string): number | null => {
    const [y, m, d] = (s || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
};

const hmNow = (): string => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 「HH:MM」→ 當日分鐘數；相對時間文案（白天態小字用）
const toMin = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const relLabel = (fromHM: string, toHM: string): string => {
    const diff = toMin(toHM) - toMin(fromHM);
    if (diff <= 5) return '馬上';
    if (diff < 60) return `約 ${diff} 分鐘後`;
    return `約 ${Math.round(diff / 60)} 小時後`;
};

// 這一天「可走的站」：非交通、有可比較的 HH:MM 時間；依時間排序（防資料未排序）。
const dayStops = (acts?: Activity[]): Activity[] =>
    (acts || [])
        .filter(a => (a.type || '').toLowerCase() !== 'transport' && /^\d{2}:\d{2}/.test(a.time || ''))
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

export function onTripToday(trip: Trip): OnTripStatus {
    const total = Math.max(1, (trip.days || []).length);
    const start = localTs(trip.startDate);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const rawN = start == null ? 1 : Math.floor((t.getTime() - start) / 86400000) + 1;
    const dayN = Math.min(Math.max(rawN, 1), total);
    const lastDay = dayN === total;

    const today = dayStops(trip.days?.[dayN - 1]?.activities);
    const now = hmNow();

    // 自由日：今天沒有任何可走的站 → 時間塊退場
    if (today.length === 0) {
        return {
            dayN, total, blockLabel: null, blockTime: null, blockTone: lastDay ? 'last' : 'today',
            label: lastDay ? '最後一天 · 準備返程' : '今天自由日',
            title: '想去哪就去哪', button: 'today',
        };
    }

    const upcoming = today.filter(a => (a.time || '') >= now);
    if (upcoming.length > 0) {
        const next = upcoming[0];
        const hm = (next.time || '').slice(0, 5);
        // 最後一天：返程語氣、琥珀塊
        if (lastDay) return { dayN, total, blockLabel: '返程', blockTime: hm, blockTone: 'last', label: '最後一天 · 準備返程', title: next.title, button: 'today' };
        // 早上（一站都還沒走）：首站＋今天全貌
        if (upcoming.length === today.length) return { dayN, total, blockLabel: '首站', blockTime: hm, blockTone: 'today', label: `今天 ${today.length} 個站`, title: next.title, button: 'today' };
        // 白天進行中：下一站＋相對時間＋今日剩餘站數（補回進度感）
        return { dayN, total, blockLabel: '下一站', blockTime: hm, blockTone: 'today', label: `${relLabel(now, hm)} · 今天還有 ${upcoming.length} 站`, title: next.title, button: 'today' };
    }

    // 晚上：今天走完了 → 明天塊（灰）
    if (lastDay) return { dayN, total, blockLabel: null, blockTime: null, blockTone: 'relax', label: '今天走完了 · 一路順風', title: '旅程圓滿 · 收好回憶', button: 'today' };
    const tomorrow = dayStops(trip.days?.[dayN]?.activities)[0];
    if (tomorrow) {
        return {
            dayN, total, blockLabel: '明天', blockTime: (tomorrow.time || '').slice(0, 5), blockTone: 'relax',
            label: '今天走完了 · 早點休息', title: tomorrow.title, button: 'tomorrow',
        };
    }
    return { dayN, total, blockLabel: null, blockTime: null, blockTone: 'relax', label: '今天走完了 · 早點休息', title: '明天自由日', button: 'tomorrow' };
}
