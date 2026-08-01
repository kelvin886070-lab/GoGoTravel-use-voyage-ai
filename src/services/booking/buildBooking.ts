// src/services/booking/buildBooking.ts
// 確認步驟的收尾：ConfirmDraft（RawExtraction + 使用者對應）→ 可入庫的 StoredBooking。
// 聚合 resolveSegments + buildPaxTickets + fare，並把所有 warning 匯總給確認表顯示。
import type { ConfirmDraft, FlightBooking, HotelBooking } from '../../types/booking';
import { resolveSegments } from './resolveTz';
import { buildPaxTickets } from './mapMembers';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export interface BuildContext {
    id: string;
    userId: string;
    source: 'paste' | 'upload';
    fileUrl?: string;
}
export interface BuildResult {
    booking?: FlightBooking;
    warnings: string[];
    errors: string[];   // 有 errors 代表不可入庫，須先在確認表補齊
}

export function buildFlightBooking(draft: ConfirmDraft, ctx: BuildContext): BuildResult {
    const { raw, tripId, memberMap } = draft;
    const warnings = [...raw.warnings];
    const errors: string[] = [];

    if (raw.kind !== 'flight') {
        return { warnings, errors: [`kind 非 flight（${raw.kind ?? 'null'}），無法建機票訂位`] };
    }
    if (!raw.fare) errors.push('缺少費用資訊');

    const { segments, warnings: segWarn } = resolveSegments(raw);
    warnings.push(...segWarn);
    if (segments.length === 0) errors.push('沒有可用的航段（時間或機場未解出）');

    const passengers = buildPaxTickets(raw.passengers, memberMap);
    if (passengers.length === 0) warnings.push('未偵測到乘客');
    if (passengers.some(p => p.memberId === null)) {
        warnings.push('有乘客尚未對應到成員（轉寄含非同團者時屬正常，可維持未對應）');
    }

    if (errors.length > 0 || !raw.fare) return { warnings, errors };

    const booking: FlightBooking = {
        id: ctx.id,
        userId: ctx.userId,
        tripId: tripId ?? null,
        provider: raw.provider ?? '未知航空',
        pnr: raw.pnr ?? undefined,
        fare: raw.fare,
        fileUrl: ctx.fileUrl,
        source: ctx.source,
        createdAt: nowIso(),
        kind: 'flight',
        segments,
        passengers,
    };
    return { booking, warnings, errors };
}

export interface HotelBuildResult {
    bookings: HotelBooking[];
    warnings: string[];
    errors: string[];
}

// 一次產出 N 筆訂房（多間各一筆，各自金額/日期）。ctx.id 當前綴，逐間補索引。
export function buildHotelBookings(draft: ConfirmDraft, ctx: BuildContext): HotelBuildResult {
    const { raw, tripId } = draft;
    const warnings = [...raw.warnings];
    const errors: string[] = [];

    if (raw.kind !== 'hotel') return { bookings: [], warnings, errors: [`kind 非 hotel（${raw.kind ?? 'null'}），無法建訂房`] };
    const hotels = raw.hotels.filter(h => h.property);
    if (hotels.length === 0) { errors.push('缺少飯店資訊'); return { bookings: [], warnings, errors }; }
    if (hotels.some(h => !h.checkInLocal || !h.checkOutLocal)) warnings.push('有訂房的入住/退房日期不完整');

    const newId = (i: number) => ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${ctx.id}-${i}`);
    const bookings: HotelBooking[] = hotels.map((h, i) => ({
        id: newId(i),
        userId: ctx.userId,
        tripId: tripId ?? null,
        provider: h.property ?? raw.provider ?? '飯店',
        pnr: raw.pnr ?? undefined,
        fare: h.fare ?? raw.fare ?? { total: 0, currency: '' },
        fileUrl: ctx.fileUrl,
        source: ctx.source,
        createdAt: nowIso(),
        kind: 'hotel',
        property: h.property ?? '',
        checkInLocal: h.checkInLocal ?? '',
        checkOutLocal: h.checkOutLocal ?? '',
        rooms: h.rooms ?? 1,
        guests: h.guests ?? 1,
        address: h.address ?? undefined,
    }));
    return { bookings, warnings, errors };
}
