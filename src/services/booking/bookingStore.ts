// src/services/booking/bookingStore.ts
// bookings 表的 CRUD（單一真相；行程頁只是它的視圖）。RLS 已把資料綁 user_id。
// segments/passengers/fare 存 jsonb；pnr/airline/flight_no/dep_at 反正規化成欄位供跨行程查詢與反查。
import { supabase } from '../supabase';
import type { StoredBooking, FlightBooking, HotelBooking, FlightSegment, PaxTicket, Fare } from '../../types/booking';

interface BookingRow {
    id: string;
    user_id?: string;
    kind: 'flight' | 'hotel';
    trip_id: string | null;
    provider: string | null;
    airline: string | null;
    pnr: string | null;
    flight_no: string | null;
    dep_at: string | null;
    arr_at: string | null;
    segments: FlightSegment[] | null;
    passengers: PaxTicket[] | null;
    hotel: { property?: string; checkInLocal?: string; checkOutLocal?: string; rooms?: number; guests?: number; address?: string } | null;
    fare: Fare | null;
    file_url: string | null;
    source: 'paste' | 'upload';
    created_at: string;
}

// ── 映射：物件 → row（含反正規化）─────────────────────────────
// hotel 的 checkIn 當日中午 UTC，供跨行程時間軸排序（不需精準時區）
const hotelDate = (local?: string): string | null => {
    const d = (local || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : null;
};

function bookingToRow(b: StoredBooking): Record<string, unknown> {
    const seg0 = b.kind === 'flight' ? b.segments[0] : undefined;
    const segN = b.kind === 'flight' ? b.segments[b.segments.length - 1] : undefined;
    return {
        id: b.id,
        user_id: b.userId,
        kind: b.kind,
        trip_id: b.tripId,
        provider: b.provider ?? null,
        airline: b.provider ?? null,               // 目前用 provider 當比對鍵；有代碼再細分
        pnr: b.pnr ?? null,
        flight_no: seg0?.flightNo ?? null,
        dep_at: b.kind === 'flight' ? (seg0?.depAtUtc ?? null) : hotelDate(b.checkInLocal),
        arr_at: b.kind === 'flight' ? (segN?.arrAtUtc ?? null) : hotelDate(b.checkOutLocal),
        segments: b.kind === 'flight' ? b.segments : [],
        passengers: b.kind === 'flight' ? b.passengers : [],
        hotel: b.kind === 'hotel'
            ? { property: b.property, checkInLocal: b.checkInLocal, checkOutLocal: b.checkOutLocal, rooms: b.rooms, guests: b.guests, address: b.address ?? null }
            : null,
        fare: b.fare,
        file_url: b.fileUrl ?? null,
        source: b.source,
        created_at: b.createdAt,
    };
}

// ── 映射：row → 物件 ─────────────────────────────────────────
function rowToBooking(r: BookingRow): StoredBooking {
    const base = {
        id: r.id,
        userId: r.user_id ?? '',
        tripId: r.trip_id,
        provider: r.provider ?? '未知',
        pnr: r.pnr ?? undefined,
        fare: r.fare ?? { total: 0, currency: '' },
        fileUrl: r.file_url ?? undefined,
        source: r.source,
        createdAt: r.created_at,
    };
    if (r.kind === 'hotel') {
        const h = r.hotel ?? {};
        return {
            ...base, kind: 'hotel',
            property: h.property ?? r.provider ?? '',
            checkInLocal: h.checkInLocal ?? '',
            checkOutLocal: h.checkOutLocal ?? '',
            rooms: h.rooms ?? 1,
            guests: h.guests ?? 1,
            address: h.address ?? undefined,
        } as HotelBooking;
    }
    return { ...base, kind: 'flight', segments: r.segments ?? [], passengers: r.passengers ?? [] } as FlightBooking;
}

// ── CRUD ─────────────────────────────────────────────────────
export async function upsertBooking(b: StoredBooking): Promise<void> {
    const { error } = await supabase.from('bookings').upsert(bookingToRow(b));
    if (error) throw new Error(`訂位儲存失敗：${error.message}`);
}

export async function deleteBooking(id: string): Promise<void> {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw new Error(`訂位刪除失敗：${error.message}`);
}

// 這趟的訂位（行程頁視圖）
export async function fetchBookingsByTrip(tripId: string): Promise<StoredBooking[]> {
    const { data, error } = await supabase.from('bookings').select('*').eq('trip_id', tripId).order('dep_at', { ascending: true });
    if (error) throw new Error(`讀取訂位失敗：${error.message}`);
    return (data as BookingRow[] ?? []).map(rowToBooking);
}

// 「我的所有訂位」跨行程時間軸
export async function fetchAllBookings(): Promise<StoredBooking[]> {
    const { data, error } = await supabase.from('bookings').select('*').order('dep_at', { ascending: true });
    if (error) throw new Error(`讀取訂位失敗：${error.message}`);
    return (data as BookingRow[] ?? []).map(rowToBooking);
}

// 外站變更通知反查：(airline, pnr) → 該筆訂位（可能不只一筆，回陣列）
export async function findBookingsByPnr(pnr: string, airline?: string): Promise<StoredBooking[]> {
    let q = supabase.from('bookings').select('*').eq('pnr', pnr);
    if (airline) q = q.eq('airline', airline);
    const { data, error } = await q;
    if (error) throw new Error(`反查訂位失敗：${error.message}`);
    return (data as BookingRow[] ?? []).map(rowToBooking);
}

// 認領 / 解除：訂位優先流指派行程，或刪行程時把 trip_id 設 null（booking 不刪）
export async function setBookingTrip(id: string, tripId: string | null): Promise<void> {
    const { error } = await supabase.from('bookings').update({ trip_id: tripId }).eq('id', id);
    if (error) throw new Error(`更新訂位所屬行程失敗：${error.message}`);
}

// 刪行程時呼叫：把該行程的訂位全部解除綁定（保留歷史）
export async function unlinkBookingsFromTrip(tripId: string): Promise<void> {
    const { error } = await supabase.from('bookings').update({ trip_id: null }).eq('trip_id', tripId);
    if (error) throw new Error(`解除訂位綁定失敗：${error.message}`);
}
