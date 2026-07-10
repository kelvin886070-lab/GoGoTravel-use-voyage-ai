// src/dev/geoBenchmark.ts
// 🔬 對抗式稽核：把乾淨標題「弄髒」，量 Geocoding vs Places 在髒輸入下誰撐得住。
//   核心問題：免費 Geocoding 打錯時，會不會自己承認（location_type/partial_match）？
//   用法（登入後、Console）：await __geoBench()
//   ⚠️ 診斷用、直接花 Google 費用（不走快取）。量完可移除本區塊。
import type { WishItem } from '../types';
import { geoBenchmark, type GeoAuditHit } from '../services/geo';
import type { PlaceHit } from '../services/geo';
import { haversineKm } from '../hooks/useNearby';
import { messyCases } from './messyCases';

const HIT_KM = 2; // 離真值 ≤ 此值 → 視為命中

type Degrade = '抽context' | '去英文' | '口語' | '連鎖';

interface Case {
    key: string;
    degrade: Degrade;
    query: string;
    context?: string;
    original: string;       // 原標題 / 說明
    truth: { lat: number; lng: number } | null;
}

// 去掉英文/數字 token，模擬「只留中日文的半個店名」
const stripLatin = (s: string) =>
    s.replace(/[a-zA-Z0-9.&'()]+/g, ' ').replace(/\s+/g, ' ').trim();

const normTitle = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function buildCases(wishItems: WishItem[]): Case[] {
    const places = wishItems.filter(w => w.type === 'place' && w.lat != null && w.lng != null);
    if (places.length === 0) {
        throw new Error('⚠️ wishItems 尚無帶座標的地點——多半是剛熱重載、資料還沒載回。請重整頁面、等首頁心願載入後再跑 __geoBench()。');
    }
    // 比對忽略空白（truthTitle 手誤多打空格也對得上）
    const byTitle = new Map(places.map(w => [normTitle(w.title), w]));
    const cases: Case[] = [];

    places.forEach((w, i) => {
        const truth = { lat: w.lat as number, lng: w.lng as number };
        // D1 抽 context：只留店名、不給城市
        cases.push({ key: `d1-${i}`, degrade: '抽context', query: w.title, context: undefined, original: w.title, truth });
        // D2 去英文：只留中日文核心
        const core = stripLatin(w.title);
        if (core && core !== w.title && core.length >= 2) {
            cases.push({ key: `d2-${i}`, degrade: '去英文', query: core, context: undefined, original: w.title, truth });
        }
    });

    // D3/D4 手寫案例
    messyCases.forEach((m, i) => {
        const truth = m.truthTitle
            ? (() => { const w = byTitle.get(normTitle(m.truthTitle!)); return w ? { lat: w.lat as number, lng: w.lng as number } : null; })()
            : null;
        if (m.kind === '口語' && !truth) {
            console.warn(`⚠️ 口語案例「${m.query}」的 truthTitle「${m.truthTitle}」找不到對應心願，將無真值可比。`);
        }
        cases.push({
            key: `m${m.kind === '口語' ? 3 : 4}-${i}`,
            degrade: m.kind, query: m.query, context: m.context,
            original: m.truthTitle || '(連鎖·無真值)', truth,
        });
    });

    return cases;
}

const distOf = (truth: Case['truth'], hit: { lat: number; lng: number } | null) =>
    truth && hit ? Math.round(haversineKm(truth, hit) * 100) / 100 : null;

export async function runGeoBenchmark(wishItems: WishItem[]) {
    const cases = buildCases(wishItems);
    console.log(`🔬 對抗式稽核：${cases.length} 個髒輸入案例（同時打 Geocoding + Places，不走快取）…`);

    const res = await geoBenchmark(cases.map(c => ({ key: c.key, location: c.query, context: c.context })));

    const rows = cases.map(c => {
        const r = res[c.key] || { geocoding: null, places: null };
        const g = r.geocoding as GeoAuditHit | null;
        const p = r.places as PlaceHit | null;
        const geoDist = distOf(c.truth, g);
        const placeDist = distOf(c.truth, p);
        const geoHit = geoDist != null && geoDist <= HIT_KM;
        const placeHit = placeDist != null && placeDist <= HIT_KM;
        const geoFlagged = !!g && (g.locationType === 'APPROXIMATE' || g.partialMatch === true);
        const geoSilentFail = !!c.truth && !!g && !geoHit && !geoFlagged; // 自信卻錯 ← 最危險
        return {
            c, g, p, geoDist, placeDist, geoHit, placeHit, geoFlagged, geoSilentFail,
            placeLowConf: p?.lowConfidence ?? null,
        };
    });

    // 分組總結
    const types: Degrade[] = ['抽context', '去英文', '口語', '連鎖'];
    const summary = types.map(t => {
        const g = rows.filter(r => r.c.degrade === t);
        const withTruth = g.filter(r => r.c.truth);
        const geoHits = withTruth.filter(r => r.geoHit).length;
        const placeHits = withTruth.filter(r => r.placeHit).length;
        return {
            弄髒方式: t,
            案例數: g.length,
            可比對: withTruth.length,
            Geo命中率: withTruth.length ? `${Math.round(geoHits / withTruth.length * 100)}%` : '—',
            Places命中率: withTruth.length ? `${Math.round(placeHits / withTruth.length * 100)}%` : '—',
            '🔴Geo靜默失敗': g.filter(r => r.geoSilentFail).length,   // 打錯又不承認
            'Places低信心數': g.filter(r => r.placeLowConf).length,
        };
    });

    console.log('%c📊 對抗式稽核總結', 'font-weight:bold;font-size:14px');
    console.table(summary);
    console.log('%c下面是逐筆明細（geoDist/placeDist 單位 km；🔴=Geo 靜默失敗）', 'color:#888');
    console.table(rows.map(r => ({
        弄髒: r.c.degrade,
        輸入: r.c.query,
        原點: r.c.original,
        Geo距: r.geoDist,
        Geo信心: r.g ? (r.g.locationType || '') + (r.g.partialMatch ? '/partial' : '') : 'null',
        靜默失敗: r.geoSilentFail ? '🔴' : '',
        Places距: r.placeDist,
        Places低信心: r.placeLowConf ? '🔵' : '',
        Places店名: r.p?.name || '',
    })));

    return { summary, rows };
}
