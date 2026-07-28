// src/services/booking/iataTz.ts
// IATA → IANA 時區查詢。資料由 scripts/genIataTz.mjs 生成（非手打）。
// 查不到回 null（呼叫端須報 warning、轉人工確認，絕不靜默猜）。
import table from './iataTz.json';

const IATA_TZ = table as Record<string, string>;

export function iataZone(iata?: string | null): string | null {
    if (!iata) return null;
    return IATA_TZ[iata.trim().toUpperCase()] ?? null;
}

export const IATA_TZ_COUNT = Object.keys(IATA_TZ).length;
