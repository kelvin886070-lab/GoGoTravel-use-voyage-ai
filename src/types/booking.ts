// src/types/booking.ts
// 訂位資料模型 — 匯入合約（單一真相：bookings 表）。
//
// 兩層設計，中間靠「確認步驟」轉換，切勿混成一份：
//   RawExtraction（LLM 吐；寬鬆、未驗證、未對應成員/未解時區）
//        └─[確認步驟：解時區 + 對應成員 + 遮罩剩餘 PII]─▶ StoredBooking（嚴格、入庫）
//
// 為什麼分層：LLM 的合約要「盡量抽到、抽不到給 null」才穩健跨航空；
// 儲存的合約要「型別嚴格、可運算」。把驗證/時區/成員對應留在 App 端做，
// 不要交給 LLM（它會幻覺時區偏移）。

// 🧑‍🤝‍🧑 我的旅伴（使用者層級、跨行程重用）。legalName＝票面名；nickname＝顯示暱稱。
export type PaxType = 'adult' | 'infant' | 'child' | 'senior';   // 大人／嬰兒／小朋友／長輩（預設 adult）
export interface Traveler {
    id: string;
    userId: string;
    legalName: string;
    nickname?: string;
    paxType?: PaxType;
    aliases?: string[];       // 其他票面名（記住「我」在不同票上的名字）
    isSelf?: boolean;
    createdAt: string;
}

export type BookingKind = 'flight' | 'hotel';
export type ISODateTime = string;   // ISO 8601 instant（UTC），e.g. 2027-01-09T01:45:00Z
export type LocalDateTime = string; // 機場/飯店當地牆上時間（票面時間），e.g. 2027-01-09 09:45
export type IATA = string;          // 機場代碼 KHH / OKA

// ── 費用（各家明細格式不同，用彈性陣列，不寫死欄位）────────────
export interface Fare {
    total: number;
    currency: string;                                   // TWD
    breakdown?: { label: string; amount: number }[];    // 票價/稅金/加值…
    paidBy?: { method: string; last4?: string; status?: string }; // 卡號只留末四碼
}

// ==========================================================
// A. 抽取層 RawExtraction — LLM 直接輸出，寬鬆、best-effort
//    合約規則（同時是給 LLM 的指令）：
//    1) 時間只吐「當地牆上時間 + 機場代碼」；不要算 UTC/時區。
//    2) 卡號只吐末四碼；不要輸出完整卡號或其他多餘 PII。
//    3) 抽不到的欄位一律 null，嚴禁編造。
//    4) 任何不確定（日期格式、缺回程…）寫進 warnings。
// ==========================================================
export interface RawSegment {
    flightNo: string | null;
    fromIata: IATA | null;
    toIata: IATA | null;
    depLocal: LocalDateTime | null;   // 出發機場當地時間
    arrLocal: LocalDateTime | null;   // 抵達機場當地時間
}
export interface RawPassenger {
    fullName: string;                 // 票面姓名（常全大寫、姓在前）
    title?: string | null;            // MR/MS/MISS/MSTR…（MISS/MSTR 常＝兒童）
    perSegment: { segIndex: number; checkedKg: number | null; seat: string | null }[];
}
export interface RawHotel {
    property: string | null;
    checkInLocal: LocalDateTime | null;
    checkOutLocal: LocalDateTime | null;
    rooms: number | null;
    guests: number | null;
    address: string | null;
    fare?: Fare | null;        // 各間自己的金額（多間時不合併）
}
export interface RawExtraction {
    kind: BookingKind | null;
    provider: string | null;          // 台灣虎航 / tigerair
    pnr: string | null;
    segments: RawSegment[];           // flight 用；hotel 給空陣列
    passengers: RawPassenger[];       // flight 用；hotel 給空陣列
    hotels: RawHotel[];               // hotel 用（多間各一筆，不合併）
    fare: Fare | null;                // flight 的總費用；hotel 用各自的 hotel.fare
    warnings: string[];               // e.g.「去程日期格式不明確」「未偵測到回程」
}

// ==========================================================
// B. 儲存層 StoredBooking — 已驗證，寫入 bookings 表（判別聯合 by kind）
//    確認步驟產出：時區已解（IATA→TZ，App 端決定性計算）、成員已對應、PII 已遮罩。
// ==========================================================
export interface FlightSegment {
    flightNo: string;
    fromIata: IATA;
    toIata: IATA;
    depLocal: LocalDateTime;  // 顯示用（票面永遠是當地時間）
    depAtUtc: ISODateTime;    // 排序/缺口偵測/跨時區運算用
    arrLocal: LocalDateTime;
    arrAtUtc: ISODateTime;
}
export interface PaxTicket {
    memberId: string | null;  // 對應 trip.members；轉寄含非同團者時可為 null（仍存姓名）
    fullName: string;
    isChild?: boolean;        // 由 title(MISS/MSTR)/無託運等推定 → 觸發兒童證件、監護規則
    perSegment: { segIndex: number; checkedKg: number | null; seat: string | null }[];
}

interface BaseBooking {
    id: string;
    userId: string;
    tripId: string | null;    // 可 null：訂位優先流（先訂未建行程）／變更通知反查
    provider: string;
    pnr?: string;
    fare: Fare;
    fileUrl?: string;         // 原始信件（真相的憑證）
    source: 'paste' | 'upload';
    createdAt: ISODateTime;
}
export interface FlightBooking extends BaseBooking {
    kind: 'flight';
    segments: FlightSegment[];
    passengers: PaxTicket[];
}
export interface HotelBooking extends BaseBooking {
    kind: 'hotel';
    property: string;
    checkInLocal: LocalDateTime;
    checkOutLocal: LocalDateTime;
    rooms: number;
    guests: number;
    address?: string;
    lat?: number;
    lng?: number;
}
// 消費端一律用這個聯合型別；以 booking.kind 收窄，編譯器保證欄位存在，無 optional 雜物袋。
export type StoredBooking = FlightBooking | HotelBooking;

// ── 確認步驟的轉換介面（把 A 變 B 的那一步）──────────────────
// resolveTz：由 IATA 查時區、把 depLocal→depAtUtc（決定性，不經 LLM）。
// mapMembers：使用者把每位 RawPassenger 對應到 trip member 或標記非同團。
export interface ConfirmDraft {
    raw: RawExtraction;
    tripId: string | null;
    memberMap: Record<number, string | null>; // passenger index → memberId | null
}
