// src/services/reconcile/applyReconcile.ts
// 🎟️ Phase 4a：把「投影錨 → 對帳」串成一次呼叫，供 onImported / 改日期使用。純函式、無 LLM。
//
// 保守策略：只對「有 booking 錨的那幾天」跑對帳，其餘天原封不動——只動被匯入影響到的日子，
//   不驚動使用者在別天精心排好的行程。
// 另回傳 changes（給收據顯示「幫你調整了什麼」）：anchor 新增、moved 順延、parked 溢位。
import type { TripDay, Activity } from '../../types';
import type { StoredBooking, FlightBooking } from '../../types/booking';
import type { Conflict } from './reconcile';
import { reconcileDay, paceBuffer } from './reconcile';
import { projectFlightAnchors } from './projectAnchors';

export interface ReconcileChange {
  kind: 'anchor' | 'moved' | 'parked';
  title: string;
  time?: string;   // anchor：錨時間；moved：新時間
  from?: string;   // moved / parked：原本時間
}

export interface ApplyResult {
  days: TripDay[];
  parked: Activity[];        // 這次對帳新溢位的（呼叫端負責併進 trip.parked）
  conflicts: Conflict[];     // 投影 out-of-range ＋ 對帳 anchor-collision / parked-must
  changes: ReconcileChange[];
}

export function applyBookingsToTrip(
  trip: { startDate: string; days: TripDay[]; pace?: string },
  bookings: StoredBooking[],
): ApplyResult {
  const flights = bookings.filter((b): b is FlightBooking => b.kind === 'flight');

  // 對帳前的原始時間表（by id），用來算「順延了哪些」。
  const originalTime = new Map<string, string>();
  for (const d of trip.days) for (const a of d.activities ?? []) if (a.id) originalTime.set(a.id, a.time);

  const proj = projectFlightAnchors(trip, flights);
  const buffer = paceBuffer(trip.pace);

  const outDays: TripDay[] = [];
  const parked: Activity[] = [];
  const conflicts: Conflict[] = [...proj.notices];

  for (const d of proj.days) {
    const hasAnchor = (d.activities ?? []).some(a => a.source === 'booking');
    if (!hasAnchor) { outDays.push(d); continue; }   // 沒被影響的天：原封不動
    const r = reconcileDay(d, { bufferMin: buffer });
    outDays.push(r.day);
    parked.push(...r.parked);
    conflicts.push(...r.conflicts);
  }

  const changes: ReconcileChange[] = [];
  for (const d of outDays) for (const a of d.activities) {
    if (a.source === 'booking') changes.push({ kind: 'anchor', title: a.title, time: a.time });
  }
  for (const d of outDays) for (const a of d.activities) {
    if (a.source === 'booking' || !a.id) continue;
    const orig = originalTime.get(a.id);
    if (orig && orig !== a.time) changes.push({ kind: 'moved', title: a.title, from: orig, time: a.time });
  }
  for (const p of parked) changes.push({ kind: 'parked', title: p.title, from: p.id ? originalTime.get(p.id) : undefined });

  return { days: outDays, parked, conflicts, changes };
}

// 併進 trip.parked：保留既有、加入新溢位，依 id 去重（避免重匯累積重複）。
export function mergeParked(existing: Activity[] | undefined, added: Activity[]): Activity[] {
  const all = [...(existing ?? []), ...added];
  const seen = new Set<string>();
  return all.filter(a => {
    const key = a.id ?? `${a.title}|${a.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
