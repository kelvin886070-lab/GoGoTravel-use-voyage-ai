// src/utils/activityId.ts
// 🧱 F1：活動穩定身分。所有活動一律有 id，編輯/刪除/拖拉/對帳/去重都 key by id（退休陣列索引）。
//   單一產生點，避免各處各寫一份；載入既有資料時 backfill 補上（舊資料無 id）。
import type { Activity, TripDay, Trip } from '../types';

export const newActivityId = (): string =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const ensureActivityId = (a: Activity): Activity => (a.id ? a : { ...a, id: newActivityId() });

export const ensureDayIds = (day: TripDay): TripDay => ({
  ...day,
  activities: (day.activities ?? []).map(ensureActivityId),
});

// 載入時 backfill：days 內活動 ＋ 待安排托盤都補齊 id。
export const ensureTripActivityIds = (trip: Trip): Trip => ({
  ...trip,
  days: (trip.days ?? []).map(ensureDayIds),
  parked: trip.parked ? trip.parked.map(ensureActivityId) : trip.parked,
});
