// src/utils/mapsUrl.ts
// 🧭 T0：從 Google Maps 連結抽座標（最高信心、免費、不打 API）。
//   完整網址內含座標可純前端 regex 解析；短網址（maps.app.goo.gl / goo.gl/maps）無座標，需後端還原轉址。

export interface LatLng { lat: number; lng: number; }

const inRange = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

// 從任意字串（URL 或網頁原始碼）抽座標，依準確度排序
export function extractCoordsFromString(s: string): LatLng | null {
    if (!s) return null;
    // 1) !3d<lat>!4d<lng>：地點真實座標（最準）
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    // 2) @<lat>,<lng>：視野中心（接近地點）
    if (!m) m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    // 3) q= / query= / ll= / center= / destination= <lat>,<lng>
    if (!m) m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return inRange(lat, lng) ? { lat, lng } : null;
}

// 純前端：完整 Google Maps 網址 → 座標（短網址會回 null，交給後端）
export const parseMapsUrl = (url: string): LatLng | null => extractCoordsFromString((url || '').trim());

export const looksLikeMapsUrl = (url: string): boolean =>
    /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test((url || '').trim());

export const isShortMapsUrl = (url: string): boolean =>
    /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test((url || '').trim());

// 從 Google Maps 網址抽地點名稱（/maps/place/<NAME>/…）。抽不到或名稱其實是座標則回 null。
export function extractPlaceNameFromMapsUrl(url: string): string | null {
    if (!url) return null;
    const m = url.match(/\/maps\/place\/([^/@?]+)/);
    if (!m) return null;
    try {
        const raw = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
        if (!raw || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(raw)) return null;   // 像 "35.0,135.7" 的座標不算名稱
        return raw;
    } catch {
        return null;
    }
}
