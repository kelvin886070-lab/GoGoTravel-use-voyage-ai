// src/services/reconcile/projectAnchors.ts
// 🎟️ Phase 4a：把「事實層」的訂位投影成行程裡的釘死錨（pinned anchor）——純函式、無 LLM、無網路。
//
// 職責：讀 bookings（先只做航班）→ 依日期對到相對天數 Day N → 生成 pinned 錨活動插進 trip.days：
//   抵達錨插「當天最前」（還沒落地，之前不可能有活動）、離開錨插「當天最後」（走了之後不可能）。
//   之後由 reconcileDay 接手把 floating 活動骨牌順開。
//
// 鐵律：
//   1) 幂等 —— 每次投影先清掉所有 source==='booking' 舊錨再重建；錨 id＝`${bookingId}-arr/-dep` 穩定，重投影不長重複、不亂跳 key。
//   2) 單向投影 —— 只從 booking→trip.days 寫，使用者不直接改錨。
//   3) 日期落在行程範圍外 → 不插錨，改回報 booking-out-of-range（順手解「11 月機票 vs 1 月行程」與改日期觸發）。
//
// 已知限制（4a）：多段去程（TPE→NRT→OKA）抵達暫取第一段 arr；單段廉航（測試資料）正確。往返單筆（[去,回]）正確。
import type { Activity, TripDay } from '../../types';
import type { FlightBooking } from '../../types/booking';
import type { Conflict } from './reconcile';

export interface ProjectResult {
  days: TripDay[];
  notices: Conflict[];   // 目前只有 booking-out-of-range；共用 reconcile 的 Conflict 詞彙給收據顯示
}

const localDate = (s?: string | null): string | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const localHHMM = (s?: string | null): string | null => {
  if (!s) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
// 兩個 YYYY-MM-DD 相差幾天（用 UTC 純日期算，避開時區/DST）。
const dayIndex = (start: string, target: string): number | null => {
  const ps = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  const pt = /^(\d{4})-(\d{2})-(\d{2})/.exec(target);
  if (!ps || !pt) return null;
  const a = Date.UTC(+ps[1], +ps[2] - 1, +ps[3]);
  const b = Date.UTC(+pt[1], +pt[2] - 1, +pt[3]);
  return Math.round((b - a) / 86400000);
};

/**
 * 把航班訂位投影成 trip.days 上的釘死錨。純函式：不改動輸入。
 */
// 同一班機的去重鍵：pnr 優先，其次首段航班號，最後才 id（重複測試/重匯的 id 會不同，不能只靠 id）。
const flightKey = (b: FlightBooking): string => b.pnr || b.segments?.[0]?.flightNo || b.id;

// 🎟️ 抵達錨帶「落地後緩衝」（出關、提行李、出機場）——取代被砍掉的假入境卡，讓第一站不會緊貼落地時間。
//   reconcile 讓錨佔用 [抵達, 抵達+此緩衝]，之後的活動自然排在緩衝後。60 分為國際線常見保守值。
const ARRIVAL_BUFFER_MIN = 60;

export function projectFlightAnchors(
  trip: { startDate: string; days: TripDay[] },
  flights: FlightBooking[],
): ProjectResult {
  const N = trip.days.length;
  // 幂等 ＋ precedence「訂位 ＞ 生成」：
  //   先剝掉所有既有 booking 錨（重建），並清掉「生成的假 flight 卡」（source==='generated' && type==='flight'）——
  //   真訂位要取代 LLM 捏造的抵達/離開卡，否則兩個抵達會並存、互撞。保留 generated 的非 flight 卡（入境審查等緩衝）。
  const days: TripDay[] = trip.days.map(d => ({
    ...d,
    activities: (d.activities ?? []).filter(
      a => a.source !== 'booking' && !(a.source === 'generated' && a.type === 'flight'),
    ),
  }));
  const notices: Conflict[] = [];

  // 同一班機去重（濾掉重複測試/重匯留下的舊訂位）；Map 後者覆蓋前者 → 保留最新一筆。
  flights = Array.from(new Map(flights.map(f => [flightKey(f), f])).values());

  const place = (idx: number | null, anchor: Activity, atFront: boolean): boolean => {
    if (idx == null || idx < 0 || idx >= N) return false;
    if (atFront) days[idx].activities.unshift(anchor);
    else days[idx].activities.push(anchor);
    return true;
  };

  for (const b of flights) {
    if (b.kind !== 'flight' || !b.segments?.length) continue;
    const seg0 = b.segments[0];
    const segN = b.segments[b.segments.length - 1];

    // 抵達錨 → 當天最前
    const arrDate = localDate(seg0.arrLocal);
    const arrIdx = arrDate ? dayIndex(trip.startDate, arrDate) : null;
    const arrAnchor: Activity = {
      id: `${b.id}-arr`,
      title: `抵達 ${seg0.toIata ?? ''}`.trim(),
      description: '',
      type: 'flight',
      time: localHHMM(seg0.arrLocal) ?? '',
      movable: 'pinned',
      priority: 'must',
      source: 'booking',
      bookingId: b.id,
      durationMin: ARRIVAL_BUFFER_MIN,   // 落地後緩衝：第一站排在此之後
    };
    if (!place(arrIdx, arrAnchor, true)) {
      notices.push({
        kind: 'booking-out-of-range',
        activityId: b.id,
        title: `${b.provider} 機票`,
        message: '這張機票的日期不在行程範圍內，先沒有加進行程。確認一下行程日期或機票日期。',
      });
    }

    // 離開錨（往返/多段單筆）→ 當天最後
    if (segN !== seg0) {
      const depDate = localDate(segN.depLocal);
      const depIdx = depDate ? dayIndex(trip.startDate, depDate) : null;
      const depAnchor: Activity = {
        id: `${b.id}-dep`,
        title: `從 ${segN.fromIata ?? ''} 出發`.trim(),
        description: '',
        type: 'flight',
        time: localHHMM(segN.depLocal) ?? '',
        movable: 'pinned',
        priority: 'must',
        source: 'booking',
        bookingId: b.id,
        durationMin: 0,
      };
      if (!place(depIdx, depAnchor, false)) {
        notices.push({
          kind: 'booking-out-of-range',
          activityId: b.id,
          title: `${b.provider} 回程`,
          message: '回程的日期不在行程範圍內，先沒有加進行程。',
        });
      }
    }
  }

  return { days, notices };
}
