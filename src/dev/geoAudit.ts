// src/dev/geoAudit.ts
// 🔬 一次性稽核：量測現有 place 心願「舊座標（Geocoding API）」的品質。
//   權威來源＝新的 Places API (New) findplace。比對距離差 → 算誤植率。
//   用法（登入後、瀏覽器 Console）：await __geoAudit()
//   ⚠️ 開發用，量測完可移除。會消耗當日 geocode/findplace 額度（每筆新查詢 +1）。
import type { WishItem } from '../types';
import { findPlaces, type PlaceHit } from '../services/geo';
import { haversineKm } from '../hooks/useNearby';

const MISPLACED_KM = 2; // 新舊座標差 > 此值 → 視為誤植

export interface AuditRow {
    id: string;
    title: string;
    context: string;
    storedLat?: number;
    storedLng?: number;
    newLat?: number;
    newLng?: number;
    deltaKm: number | null;   // 新舊距離差（null=無法比對）
    verdict: '✅ 一致' | '⚠️ 誤植' | '🔵 低信心' | '🟠 舊無座標' | '⛔ 找不到';
    placeName?: string;
    placeAddress?: string;
}

export interface AuditReport {
    total: number;
    noStoredCoord: number;   // 舊資料本來就沒座標
    noPlaceResult: number;   // Places 也找不到
    misplaced: number;       // 新舊差 > MISPLACED_KM
    lowConfidence: number;   // Places 回低信心
    consistent: number;      // 一致
    misplacedRatePct: number;
    rows: AuditRow[];
}

const ctxOf = (w: WishItem) => [w.area, w.city, w.country].filter(Boolean).join(' ');

async function chunkFindPlaces(items: { location: string; context?: string }[]) {
    const out: Record<string, PlaceHit | null> = {};
    for (let i = 0; i < items.length; i += 50) {
        const slice = items.slice(i, i + 50);
        const r = await findPlaces(slice);
        Object.assign(out, r);
    }
    return out;
}

export async function runGeoAudit(wishItems: WishItem[]): Promise<AuditReport> {
    const places = wishItems.filter(w => w.type === 'place');
    console.log(`🔬 稽核 ${places.length} 筆 place 心願…（權威來源：Places API New）`);

    const items = places.map(w => ({ location: w.title, context: ctxOf(w) || undefined }));
    const hits = await chunkFindPlaces(items);

    const rows: AuditRow[] = places.map(w => {
        const hit = hits[w.title] ?? null;
        const stored = (w.lat != null && w.lng != null) ? { lat: w.lat, lng: w.lng } : null;
        const row: AuditRow = {
            id: w.id, title: w.title, context: ctxOf(w),
            storedLat: w.lat, storedLng: w.lng,
            newLat: hit?.lat, newLng: hit?.lng,
            deltaKm: null, verdict: '✅ 一致',
            placeName: hit?.name, placeAddress: hit?.formattedAddress,
        };
        if (!hit) { row.verdict = '⛔ 找不到'; return row; }
        if (hit.lowConfidence) { row.verdict = '🔵 低信心'; }
        if (!stored) { if (row.verdict === '✅ 一致') row.verdict = '🟠 舊無座標'; return row; }
        const d = haversineKm(stored, { lat: hit.lat, lng: hit.lng });
        row.deltaKm = Math.round(d * 100) / 100;
        if (d > MISPLACED_KM && row.verdict !== '🔵 低信心') row.verdict = '⚠️ 誤植';
        else if (d > MISPLACED_KM) row.verdict = '⚠️ 誤植';
        return row;
    });

    const report: AuditReport = {
        total: places.length,
        noStoredCoord: rows.filter(r => r.verdict === '🟠 舊無座標').length,
        noPlaceResult: rows.filter(r => r.verdict === '⛔ 找不到').length,
        misplaced: rows.filter(r => r.verdict === '⚠️ 誤植').length,
        lowConfidence: rows.filter(r => r.verdict === '🔵 低信心').length,
        consistent: rows.filter(r => r.verdict === '✅ 一致').length,
        misplacedRatePct: 0,
        rows,
    };
    const comparable = report.total - report.noStoredCoord - report.noPlaceResult;
    report.misplacedRatePct = comparable > 0
        ? Math.round((report.misplaced / comparable) * 1000) / 10 : 0;

    console.log('%c📊 稽核總結', 'font-weight:bold;font-size:14px', {
        總數: report.total,
        一致: report.consistent,
        '⚠️ 誤植': report.misplaced,
        '🔵 低信心': report.lowConfidence,
        '🟠 舊無座標': report.noStoredCoord,
        '⛔ 找不到': report.noPlaceResult,
        '誤植率%（可比對者）': report.misplacedRatePct,
    });
    console.table(
        rows.filter(r => r.verdict !== '✅ 一致')
            .sort((a, b) => (b.deltaKm ?? 0) - (a.deltaKm ?? 0))
            .map(r => ({ 標題: r.title, 判定: r.verdict, 距離差km: r.deltaKm, Places店名: r.placeName, 地址: r.placeAddress })),
    );
    return report;
}
