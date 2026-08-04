// src/services/destinationIntel.ts
// 🌍 目的地情報（生成表單重設計・資料管線；docs E3）
//   一次呼叫餵飽四頁：入口（顆粒度判定／打錯猜測）、縮圈（地帶卡組）、什麼時候（季節註記）、
//   講究（玩法標籤）、以及幣別旁註與 cityEn（封面照片管線沿用）。
//   成本：ai-proxy 端**全域快取 90 天**（同一查詢全體使用者共用）＋未命中才計每日限額；
//        本檔另有**前端兩層快取**（記憶體＋localStorage 7 天）與**同查詢併發去重**，
//        使用者在表單裡來回上一步/下一步不會重打。
//   失敗策略：任何情況回 null——呼叫端一律要有退位（通用標籤、不擋輸入、幣別保底）。
//   防呆（2026-08 亂填批）：
//     ①本地啟發式先篩（placeSanity）：明顯亂打**不打 API**（省錢，且畫面立刻能標未確認）
//     ②資料衛生：granularity=unknown 一律清掉 country/currency/cityEn/zones/nearby，
//       避免用錯幣別、抓錯封面照、把幻覺地帶帶進下游；country 非合法 ISO2 也視為未驗證。
import { supabase } from './supabase';
import { localPlaceVerdict } from './placeSanity';

export type Granularity = 'country' | 'region' | 'city' | 'unknown';

export interface IntelZone {
    name: string;        // 「關西 · 大阪與京都」
    en?: string;
    cities?: string[];
    reason?: string;     // 一句話特色（正面措辭）
    tags?: string[];
}

export interface DestinationIntel {
    granularity: Granularity;
    name?: string;
    nameEn?: string;
    country?: string;    // ISO 3166-1 alpha-2（國內外推斷用）
    cityEn?: string;     // 封面照片查詢詞
    currency?: string;   // 幣別旁註
    zones?: IntelZone[]; // 縮圈頁（country/region 才有）
    tags?: string[];     // 講究頁標籤雲
    nearby?: string[];   // 順遊城市
    seasons?: Record<string, string>;  // '1'..'12' → 一句話
    suggestions?: string[];            // unknown 時的猜測
}

const CACHE_KEY = 'kt_dest_intel_v3';   // v3：加入資料衛生與嚴格 unknown 判定 → 舊快取（可能含亂填誤判）一律失效
const TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 前端 7 天（伺服器端 35 天；前端短一點以便早日拿到修正）

type CacheShape = Record<string, { d: DestinationIntel; e: number }>;
let mem: CacheShape | null = null;
const inflight = new Map<string, Promise<DestinationIntel | null>>();

const normalize = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, '');

const load = (): CacheShape => {
    if (mem) return mem;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) as CacheShape : {};
        const now = Date.now();
        for (const k of Object.keys(parsed)) if (!parsed[k]?.d || parsed[k].e <= now) delete parsed[k];
        mem = parsed;
    } catch {
        mem = {};
    }
    return mem;
};
const persist = (): void => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(load())); } catch { /* 私密模式＝退化為記憶體快取 */ }
};

/** 清除前端快取（登出時呼叫；避免帶著上一位使用者的查詢紀錄）。 */
export const clearIntelCache = (): void => {
    mem = {};
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
};

const ISO2 = /^[A-Za-z]{2}$/;

/**
 * 資料衛生：把 LLM 回來的東西修剪成「可安全給下游用」的形狀。
 * - unknown：只留 granularity 與 suggestions——**不留** country/currency/cityEn/zones/nearby/tags，
 *   否則會用錯幣別、抓錯封面照、把幻覺地帶帶進縮圈頁。
 * - 非 unknown：country 統一大寫；不是合法 ISO2 就刪掉（寧可沒有，也不要錯的）。
 */
const sanitize = (raw: DestinationIntel): DestinationIntel => {
    if (raw.granularity === 'unknown') {
        return {
            granularity: 'unknown',
            name: (raw.name || '').trim() || undefined,
            suggestions: (raw.suggestions || []).filter(s => !!s && typeof s === 'string').slice(0, 3),
        };
    }
    const country = (raw.country || '').trim().toUpperCase();
    return { ...raw, country: ISO2.test(country) ? country : undefined };
};

/**
 * 這筆情報是否**可信到能當作已驗證的地點**。
 * 條件：顆粒度不是 unknown，且拿得到合法的 ISO2 國碼（模型連國家都說不出來＝它其實不認識這裡）。
 * null（逾時／網路失敗／本地判定亂填）一律不算驗證通過——「不知道」永遠不能冒充「沒問題」。
 */
export const isVerifiedIntel = (intel: DestinationIntel | null): boolean =>
    !!intel && intel.granularity !== 'unknown' && ISO2.test(intel.country || '');

/**
 * 取得目的地情報。
 * - 本地判定明顯亂填、或少於 2 字元：直接回 null，**不打 API**（省錢第一道門，與後端同規）。
 * - 前端快取命中：同步回傳（零延遲）。
 * - 併發去重：同一查詢同時被呼叫多次只發一個請求。
 */
export async function fetchDestinationIntel(query: string): Promise<DestinationIntel | null> {
    const key = normalize(query);
    if (key.length < 2) return null;
    if (localPlaceVerdict(query) === 'junk') return null;   // 零成本第一道篩：亂碼不值得一次 LLM 呼叫

    const cache = load();
    const hit = cache[key];
    if (hit && hit.e > Date.now()) return hit.d;

    const running = inflight.get(key);
    if (running) return running;

    const task = (async (): Promise<DestinationIntel | null> => {
        try {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: { action: 'destination-intel', payload: { query: query.trim() } },
            });
            if (error || !data || data.error) return null;
            const rawIntel = data.intel as DestinationIntel | null;
            if (!rawIntel?.granularity) return null;
            const intel = sanitize(rawIntel);          // 先修剪再入快取：髒資料一次都不要留下
            cache[key] = { d: intel, e: Date.now() + TTL_MS };
            persist();
            return intel;
        } catch {
            return null;
        } finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, task);
    return task;
}

// ── 呼叫端的便利函式（全部對 null 安全，各自帶退位）──────────────────

/** 是否需要「縮圈」這一步：國家／區域級才要（城市級＝已回答，直接跳過）。 */
export const needsZoneStep = (intel: DestinationIntel | null): boolean =>
    intel?.granularity === 'country' || intel?.granularity === 'region';

/** 打錯字的猜測（unknown 時給；其餘回空陣列——提醒但不擋輸入）。 */
export const misspellSuggestions = (intel: DestinationIntel | null): string[] =>
    intel?.granularity === 'unknown' ? (intel.suggestions || []).slice(0, 3) : [];

/** 玩法標籤（講究頁；查不到＝通用組退位，畫面不會空）。 */
const FALLBACK_TAGS = ['市場與小吃', '在地咖啡', '博物館與展覽', '老街散策', '自然風景', '選物與工藝', '夜景', '溫泉與放鬆'];
export const intelTags = (intel: DestinationIntel | null): string[] => {
    const t = (intel?.tags || []).filter(Boolean);
    return t.length >= 4 ? t.slice(0, 12) : FALLBACK_TAGS;
};

/** 某月的季節註記（「十月的金澤，楓正紅」的素材）；查不到回 null（該行不顯示）。 */
export const seasonNote = (intel: DestinationIntel | null, month: number): string | null =>
    (intel?.seasons?.[String(month)] || '').trim() || null;

/** 最合適的季節（「還沒想法」時的專家時刻）：挑註記最像旺季的兩個月＝直接取 seasons 全表交給呼叫端顯示。 */
export const seasonTable = (intel: DestinationIntel | null): Array<{ month: number; note: string }> =>
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, note: seasonNote(intel, i + 1) || '' }))
        .filter(x => !!x.note);
