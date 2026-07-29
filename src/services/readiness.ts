// src/services/readiness.ts
// 🎟️ 行程「就緒」單一真相（純函式層）。
//
// 設計原則（本輪與 Kelvin 定案）：
//   1. 把關（完整性判斷）在準備臉做 → 結果寫進 `trip.readiness` 快照；
//      首頁沒有 bookings，只讀快照，不重算。→ 首頁與準備臉「永不打架」。
//   2. 五段里程碑：規劃 / 機票 / 住宿 / 文件 / 打包。
//      機票、住宿＝關鍵路徑（未完成 → 不准說「就緒」）；文件、打包＝次要。
//   3. 「有沒有匯入」≠「是否完整」：機票要去回程、住宿要覆蓋所有夜。
//
// 分兩層 API：
//   ● 寫快照（準備臉用，需要 live bookings）：computeBookingReadiness
//   ● 讀快照（首頁＋準備臉顯示，只需要 trip）：tripReadiness / readinessSummary
import type { Trip } from '../types';
import type { FlightBooking, HotelBooking } from '../types/booking';
import { nightsCoverage } from './booking/nights';
import { computeStage, daysUntilStart } from './tripPhase';

// ── 快照寫入層（需要 live bookings；由準備臉呼叫、結果存進 trip.readiness）──────────

const iata = (s?: string): string => (s || '').trim().toUpperCase();

/**
 * 機票是否「來回完整」。
 * 判定：彙整所有航段、依 UTC 起飛時間排序，若「首段起點 === 末段終點」＝形成回到原點的環＝來回完整。
 * - 不依賴 trip.origin 字串（可能是城市名或空），純看航段是否閉環，穩健。
 * - 單程（起點≠終點）→ false（＝缺回程，這正是要抓的不完整）。
 * - 多筆訂位（去程一張、回程一張）→ 併起來排序後仍閉環，判定為完整。
 * - 只要最終回到出發原點即算完整（含目的地內換機場的開口式移動）；唯有「沒回到原點」（如單程）才判不完整。
 *   目的：這道把關要抓的是「忘了訂回程」，不是管目的地內怎麼移動。
 */
export function isFlightRoundTrip(flights: FlightBooking[]): boolean {
    const segs = flights
        .flatMap(f => f.segments || [])
        .filter(s => s && s.fromIata && s.toIata);
    if (segs.length === 0) return false;
    const sorted = [...segs].sort((a, b) => (a.depAtUtc || '').localeCompare(b.depAtUtc || ''));
    return iata(sorted[0].fromIata) === iata(sorted[sorted.length - 1].toIata);
}

/**
 * 住宿是否「全覆蓋」所有需要的夜。
 * 需要 trip 有起訖日（才算得出需要幾晚）；無日期時無法驗證 → 回 false（保守，不假打勾）。
 */
export function isHotelFullyCovered(trip: Trip, hotels: HotelBooking[]): boolean {
    const cov = nightsCoverage(trip, hotels);
    return cov.needed.length > 0 && cov.missing.length === 0;
}

/**
 * 由 live bookings 算出關鍵路徑的就緒快照 { flight, hotel }。
 * 準備臉在 bookings 變動時呼叫此函式、把結果寫回 trip.readiness（見批 B 接線）。
 */
export function computeBookingReadiness(
    trip: Trip,
    flights: FlightBooking[],
    hotels: HotelBooking[],
): { flight: boolean; hotel: boolean } {
    return {
        flight: isFlightRoundTrip(flights),
        hotel: isHotelFullyCovered(trip, hotels),
    };
}

// ── 快照讀取層（首頁＋準備臉顯示，只需要 trip）────────────────────────────────────

export type ReadinessKey = 'plan' | 'flight' | 'hotel' | 'docs' | 'pack';

export interface ReadinessSegment {
    key: ReadinessKey;
    label: string;
    done: boolean;
    critical: boolean;   // 關鍵路徑（機票/住宿）：未完成 → 不准說「就緒」
}

/**
 * 規劃是否「已定案」。取以下最先成立：
 *   ① planningStatus==='ready' 或有 finalizedAt（使用者明確定案／匯出並標記）
 *   ② computeStage>=1（≤21 天準備期起，含前夕/旅途/回憶）→ 保底自動定案（補 solo 不匯出）
 * 可撤章＝清 finalizedAt 且 planningStatus≠'ready'（但 ≤21 天仍會被 ② 判為定案，符合現實）。
 */
export function isPlanFinalized(trip: Trip): boolean {
    if (trip.planningStatus === 'ready') return true;
    if (trip.finalizedAt) return true;
    return computeStage(trip) >= 1;
}

/**
 * 五段就緒里程碑（只讀 trip 快照）。首頁分段條與準備臉共用同一結果。
 */
export function tripReadiness(trip: Trip): ReadinessSegment[] {
    const r = trip.readiness || {};
    return [
        { key: 'plan', label: '規劃', done: isPlanFinalized(trip), critical: false },
        { key: 'flight', label: '機票', done: !!r.flight, critical: true },
        { key: 'hotel', label: '住宿', done: !!r.hotel, critical: true },
        { key: 'docs', label: '文件', done: !!r.docs, critical: false },
        { key: 'pack', label: '打包', done: !!r.pack, critical: false },
    ];
}

export type ReadinessTone = 'quiet' | 'active' | 'urgent' | 'ready';

export interface ReadinessSummary {
    segments: ReadinessSegment[];
    doneCount: number;
    total: number;
    allReady: boolean;         // 五段全亮 → 蓋章慶祝
    criticalReady: boolean;    // 規劃＋關鍵路徑都完成 → 允許說「就緒」
    daysToDep: number | null;
    tone: ReadinessTone;       // quiet(遠期安靜) / active(準備期升溫) / urgent(前夕轉紅) / ready
    nextLabel: string;         // 首頁摘要句
}

const PENDING_VERB: Record<ReadinessKey, string> = {
    plan: '還沒定案',
    flight: '還沒訂',
    hotel: '還沒訂',
    docs: '還沒備齊',
    pack: '還沒打包',
};

/**
 * 首頁合併卡摘要：分段狀態 + 時間感知的語氣與下一步文案。
 * 時間感知（吃 computeStage）：>21 天安靜(quiet)、≤21 準備升溫(active)、≤3 前夕轉紅(urgent)。
 * 規則：關鍵路徑（機票/住宿）未完成前，不說「就緒」；遠期(quiet)不催關鍵項，只給安靜狀態。
 */
export function readinessSummary(trip: Trip): ReadinessSummary {
    const segments = tripReadiness(trip);
    const doneCount = segments.filter(s => s.done).length;
    const total = segments.length;

    const planDone = segments[0].done;
    const criticalPending = segments.filter(s => s.critical && !s.done);
    const secondaryPending = segments.filter(s => !s.critical && s.key !== 'plan' && !s.done);

    const allReady = doneCount === total;
    const criticalReady = planDone && criticalPending.length === 0;

    const stage = computeStage(trip);
    const daysToDep = daysUntilStart(trip);

    // 語氣：遠期安靜；準備期起才升溫；前夕/旅途對未完成項轉紅。
    let tone: ReadinessTone;
    if (allReady) {
        tone = 'ready';
    } else if (stage >= 2) {
        tone = (criticalPending.length > 0 || secondaryPending.length > 0) ? 'urgent' : 'active';
    } else if (stage === 1) {
        tone = 'active';
    } else {
        tone = 'quiet';
    }

    // 下一步文案
    let nextLabel: string;
    if (allReady) {
        nextLabel = '全部就緒 · 可以出發了';
    } else if (tone === 'quiet') {
        // 未定案不宣稱「排好」（排點≠定案，避免文案自相矛盾）；已定案才說出發前再訂票。
        nextLabel = planDone ? '已定案 · 出發前再訂票' : '行程規劃中';
    } else {
        const next = criticalPending[0] || secondaryPending[0] || (!planDone ? segments[0] : undefined);
        nextLabel = next ? `${next.label}${PENDING_VERB[next.key]}` : '就快好了';
    }

    return { segments, doneCount, total, allReady, criticalReady, daysToDep, tone, nextLabel };
}
