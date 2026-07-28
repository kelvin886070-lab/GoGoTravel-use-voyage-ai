// src/services/booking/coerceRaw.ts
// LLM 輸出是「不可信輸入」。這裡把它強制塑形成合法 RawExtraction：
//   補預設、確保陣列、數字化、遮罩卡號末四碼、把不確定寫進 warnings。
// 純函式、無網路、可單測。gemini.ts 呼叫完 LLM 後一律先過這關再往下。
import type { RawExtraction, RawSegment, RawPassenger, RawHotel, Fare, BookingKind } from '../../types/booking';

// booking 是「物件」（且內含 segments 陣列），不能用陣列優先的 parseJSON。取最外層 {...}。
export function parseBookingJSON(text?: string | null): unknown | null {
    if (!text) return null;
    try {
        const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const first = clean.indexOf('{'), last = clean.lastIndexOf('}');
        if (first === -1 || last === -1 || last <= first) return null;
        return JSON.parse(clean.slice(first, last + 1));
    } catch {
        return null;
    }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v.replace(/[, ]/g, '')); return isFinite(n) ? n : null; }
    return null;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// 只留末四碼數字，杜絕完整卡號流入儲存。
function maskLast4(v: unknown): string | undefined {
    const s = str(v); if (!s) return undefined;
    const digits = s.replace(/\D/g, '');
    return digits ? digits.slice(-4) : undefined;
}

function coerceFare(v: unknown): Fare | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const total = num(o.total);
    const currency = str(o.currency);
    if (total == null || !currency) return null;
    const breakdown = arr(o.breakdown)
        .map(b => { const x = b as Record<string, unknown>; const label = str(x?.label); const amount = num(x?.amount); return label && amount != null ? { label, amount } : null; })
        .filter((b): b is { label: string; amount: number } => b !== null);
    let paidBy: Fare['paidBy'];
    if (o.paidBy && typeof o.paidBy === 'object') {
        const p = o.paidBy as Record<string, unknown>;
        const method = str(p.method);
        if (method) paidBy = { method, last4: maskLast4(p.last4), status: str(p.status) ?? undefined };
    }
    return { total, currency, breakdown: breakdown.length ? breakdown : undefined, paidBy };
}

function coerceSegment(v: unknown): RawSegment {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
        flightNo: str(o.flightNo),
        fromIata: str(o.fromIata)?.toUpperCase() ?? null,
        toIata: str(o.toIata)?.toUpperCase() ?? null,
        depLocal: str(o.depLocal),
        arrLocal: str(o.arrLocal),
    };
}

function coercePassenger(v: unknown): RawPassenger | null {
    const o = (v ?? {}) as Record<string, unknown>;
    const fullName = str(o.fullName);
    if (!fullName) return null;
    const perSegment = arr(o.perSegment).map(ps => {
        const x = (ps ?? {}) as Record<string, unknown>;
        return { segIndex: num(x.segIndex) ?? 0, checkedKg: num(x.checkedKg), seat: str(x.seat) };
    });
    return { fullName, title: str(o.title), perSegment };
}

function coerceHotel(v: unknown): RawHotel | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    if (!str(o.property) && !str(o.checkInLocal)) return null;
    return {
        property: str(o.property), checkInLocal: str(o.checkInLocal), checkOutLocal: str(o.checkOutLocal),
        rooms: num(o.rooms), guests: num(o.guests), address: str(o.address), fare: coerceFare(o.fare),
    };
}

export function coerceRawExtraction(input: unknown): RawExtraction {
    const o = (input ?? {}) as Record<string, unknown>;
    const warnings = arr(o.warnings).map(w => str(w)).filter((w): w is string => !!w);

    const kRaw = str(o.kind)?.toLowerCase();
    const kind: BookingKind | null = kRaw === 'flight' || kRaw === 'hotel' ? kRaw : null;

    const segments = arr(o.segments).map(coerceSegment);
    const passengers = arr(o.passengers).map(coercePassenger).filter((p): p is RawPassenger => p !== null);
    // hotels 陣列（多間各一筆）；向下相容舊的單一 hotel 欄
    const rawHotels = arr(o.hotels).length > 0 ? arr(o.hotels) : (o.hotel ? [o.hotel] : []);
    const hotels = rawHotels.map(coerceHotel).filter((h): h is RawHotel => h !== null);
    const fare = coerceFare(o.fare);

    if (!kind) warnings.push('無法判定是機票或訂房，請手動指定');
    if (kind === 'flight' && segments.length === 0) warnings.push('未抽到任何航段');
    if (kind === 'flight' && passengers.length === 0) warnings.push('未抽到乘客');
    if (kind === 'hotel' && hotels.length === 0) warnings.push('未抽到住宿');
    if (kind === 'flight' && !fare) warnings.push('未抽到費用');

    return { kind, provider: str(o.provider), pnr: str(o.pnr), segments, passengers, hotels, fare, warnings };
}
