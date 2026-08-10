// src/services/destinationIntel.ts
// 🌍 目的地情報（生成表單重設計・資料管線；docs E3）
//
// ⏱️ 兩層架構（2026-08-04 延遲批的核心修正）：
//   **輕層 destination-intel**（本檔 `fetchDestinationIntel`）：顆粒度／正規名／國碼／cityEn／幣別／
//     順遊城市／打錯猜測——約 200 token，**入口頁只等這一層**（秒級）。
//   **重層 destination-deep**（`fetchDestinationDeep`）：地帶卡組／玩法標籤／12 個月季節註記——
//     輸出大得多，改在使用者填後面幾頁時**背景預取**，走到縮圈／什麼時候／講究頁時早就到了。
//   為什麼要拆：舊版一顆呼叫要模型一次生出地帶＋標籤＋12 個月註記（maxOutputTokens 8192），
//     **輸出長度＝等待時間**，實測入口頁要等兩分鐘——等的是三頁之後才用得到的資料。
//   總 token 沒有變多，反而變少：城市級目的地根本不需要地帶卡，舊版每次照生。
//
//   成本：兩層各自在 ai-proxy 端**全域快取 35 天**（同一查詢字串全體使用者共用一筆）；
//        本檔另有**前端兩層快取**（記憶體＋localStorage 7 天）與**同查詢併發去重**。
//   失敗策略：任何情況回 null——呼叫端一律要有退位（通用標籤、不擋輸入、幣別保底）。
//   防呆（亂填批）：①本地啟發式先篩（placeSanity）：明顯亂打**不打 API**
//        ②資料衛生：unknown 一律清掉 country/currency/cityEn/nearby，避免用錯幣別、抓錯封面照。
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

/** 輕層：入口頁的驗證與交棒所需（**入口頁只等這個**） */
export interface DestinationIntel {
    granularity: Granularity;
    name?: string;
    nameEn?: string;
    country?: string;    // ISO 3166-1 alpha-2（國內外推斷用）
    cityEn?: string;     // 封面照片查詢詞
    currency?: string;   // 幣別旁註
    nearby?: string[];   // 順遊城市（同國）
    suggestions?: string[];   // unknown 時的猜測
}

/** 預算三級的粗估區間（⑥想怎麼玩頁的錨點）。
 *  ⚠️ 三條規矩（docs E3-0「預算三條規矩」）：
 *    ①**不含機票與住宿**——那兩樣波動極大（飯店淡旺季差三倍）且使用者通常已自己訂好；
 *      拿掉之後只剩吃／玩／車資，這個數字才從「不可能估準」變成「可以估個大概」。
 *    ②**永遠不進 prompt**——不是因為不準，是因為它**冗餘**：行為描述（「好好吃一餐、
 *      累了就搭車」）已完整表達約束；再給一個金額，LLM 要嘛忽略、要嘛拿去**湊數**
 *      （為了湊到 ¥12,000 硬塞一個景點）。進 prompt 的永遠是 lean/mid/rich 這個**等級**。
 *    ③這是**給人看的**：只要相對排序（lean < mid < rich）正確，絕對值差兩成無妨。 */
export interface DestinationBudget {
    lean: string;   // 「約 ¥4,000–8,000」
    mid: string;
    rich: string;   // 「¥20,000 起」
}

/** 重層：後面三頁才用得到（背景預取，永不擋畫面） */
export interface DestinationDeep {
    zones?: IntelZone[];               // 縮圈頁（country/region 才有）
    tags?: string[];                   // 講究頁標籤雲
    seasons?: Record<string, string>;     // '1'..'12' → 一句話（8–14 字）
    seasonKeys?: Record<string, string>;  // '1'..'12' → 2–6 字關鍵詞（「楓紅・百岳」）
    budget?: DestinationBudget;           // 想怎麼玩頁（不含機加酒；缺就不顯示錨點那一行）
}

// ── 前端快取（記憶體＋localStorage；兩層各自一份）────────────────────
const TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 前端 7 天（伺服器端 35 天；前端短一點以便早日拿到修正）

interface Entry<T> { d: T; e: number }

/** 一個有 TTL 的小型持久快取（私密模式下自動退化為純記憶體）。 */
const makeStore = <T>(storageKey: string) => {
    let mem: Record<string, Entry<T>> | null = null;
    const load = (): Record<string, Entry<T>> => {
        if (mem) return mem;
        try {
            const raw = localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) as Record<string, Entry<T>> : {};
            const now = Date.now();
            for (const k of Object.keys(parsed)) if (!parsed[k]?.d || parsed[k].e <= now) delete parsed[k];
            mem = parsed;
        } catch {
            mem = {};
        }
        return mem;
    };
    return {
        get(key: string): T | null {
            const hit = load()[key];
            return hit && hit.e > Date.now() ? hit.d : null;
        },
        set(key: string, value: T): void {
            const store = load();
            store[key] = { d: value, e: Date.now() + TTL_MS };
            try { localStorage.setItem(storageKey, JSON.stringify(store)); } catch { /* 私密模式＝退化為記憶體快取 */ }
        },
        clear(): void {
            mem = {};
            try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
        },
    };
};

// v4：拆成輕／重兩層，形狀改變 → 舊快取一律失效
const intelStore = makeStore<DestinationIntel>('kt_dest_intel_v4');
const deepStore = makeStore<DestinationDeep>('kt_dest_deep_v4');   // v4：加了 budget（v3＝seasonKeys 上線）

const intelInflight = new Map<string, Promise<DestinationIntel | null>>();
const deepInflight = new Map<string, Promise<DestinationDeep | null>>();

const normalize = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, '');

/** 清除前端快取（登出時呼叫；避免帶著上一位使用者的查詢紀錄）。 */
export const clearIntelCache = (): void => {
    intelStore.clear();
    deepStore.clear();
    intelInflight.clear();
    deepInflight.clear();
};

const ISO2 = /^[A-Za-z]{2}$/;

/**
 * 資料衛生：把 LLM 回來的東西修剪成「可安全給下游用」的形狀。
 * - unknown：只留 granularity 與 suggestions——**不留** country/currency/cityEn/nearby，
 *   否則會用錯幣別、抓錯封面照、把幻覺順遊帶進下游。
 * - 非 unknown：country 統一大寫；不是合法 ISO2 就刪掉（寧可沒有，也不要錯的）。
 */
const sanitize = (raw: DestinationIntel): DestinationIntel => {
    if (raw.granularity === 'unknown') {
        return {
            granularity: 'unknown',
            name: (raw.name || '').trim() || undefined,
            suggestions: (raw.suggestions || []).filter(s => typeof s === 'string' && !!s.trim()).slice(0, 3),
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

/** 兩層共用的呼叫骨架：本地篩 → 前端快取 → 併發去重 → Edge Function。 */
async function fetchLayer<T>(
    action: 'destination-intel' | 'destination-deep',
    query: string,
    store: { get(k: string): T | null; set(k: string, v: T): void },
    inflight: Map<string, Promise<T | null>>,
    pick: (data: Record<string, unknown>) => T | null,
): Promise<T | null> {
    const key = normalize(query);
    if (key.length < 2) return null;
    if (localPlaceVerdict(query) === 'junk') return null;   // 零成本第一道篩：亂碼不值得一次 LLM 呼叫

    const hit = store.get(key);
    if (hit) return hit;

    const running = inflight.get(key);
    if (running) return running;

    const task = (async (): Promise<T | null> => {
        try {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: { action, payload: { query: query.trim() } },
            });
            if (error || !data || (data as { error?: unknown }).error) return null;
            const value = pick(data as Record<string, unknown>);
            if (!value) return null;
            store.set(key, value);
            return value;
        } catch {
            return null;
        } finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, task);
    return task;
}

/**
 * 輕層：這是不是一個真的地方？（入口頁只等這個，約 200 token）
 * - 本地判定亂填、或少於 2 字元：直接回 null，**不打 API**。
 */
export const fetchDestinationIntel = (query: string): Promise<DestinationIntel | null> =>
    fetchLayer('destination-intel', query, intelStore, intelInflight, data => {
        const raw = data.intel as DestinationIntel | null;
        return raw?.granularity ? sanitize(raw) : null;   // 先修剪再入快取：髒資料一次都不要留下
    });

/**
 * 重層：地帶卡組／玩法標籤／季節註記（縮圈、什麼時候、講究三頁用）。
 * 呼叫端一律要能在它還沒到的時候正常顯示（退位）。
 */
export const fetchDestinationDeep = (query: string): Promise<DestinationDeep | null> =>
    fetchLayer('destination-deep', query, deepStore, deepInflight, data => {
        const raw = data.deep as DestinationDeep | null;
        if (!raw) return null;
        const ok = (raw.zones?.length || raw.tags?.length || raw.seasons);
        return ok ? raw : null;
    });

/**
 * 背景預取重層（fire-and-forget）：目的地一驗證通過就先熱起來，
 * 使用者填完「什麼時候／想怎麼玩」走到縮圈頁時，資料通常已經在快取裡了。
 * 永不 throw、永不阻塞畫面。
 */
export const prefetchDestinationDeep = (query: string): void => {
    void fetchDestinationDeep(query).catch(() => null);
};

// ── 呼叫端的便利函式（全部對 null 安全，各自帶退位）──────────────────

/** 是否需要「縮圈」這一步：國家／區域級才要（城市級＝已回答，直接跳過）。 */
export const needsZoneStep = (intel: DestinationIntel | null): boolean =>
    intel?.granularity === 'country' || intel?.granularity === 'region';

/** 打錯字的猜測（unknown 時給；其餘回空陣列——提醒但不擋輸入）。 */
export const misspellSuggestions = (intel: DestinationIntel | null): string[] =>
    intel?.granularity === 'unknown' ? (intel.suggestions || []).slice(0, 3) : [];

/**
 * 玩法標籤（⑦講究頁；重層還沒到或查不到＝通用組退位，畫面不會空）。
 *
 * **上限 10 個**（原本 12）：這裡是「10 選 N 的複選、而且有圈／劃兩種動作」，
 * 選擇負擔遠高於單選題。⚠️ 但真正的解法是**排序不是數量**——
 * 排對了使用者掃到第三個就能決定，排錯了給 8 個他也要全部讀完。
 *
 * `lastWanted`＝上一份 brief 圈過的標籤（回頭客）。**穩定排序**把它們往前提，
 * 同分的維持原順序——不打亂重層 prompt 已經做好的「主題群分組」（吃→看→買→慢）。
 * ⚠️ 刻意先做這個最簡版的個人化（而不是心願盒／旅風向量比對）：不需要新的資料管線，
 *    而回頭客正是最能感受到「為你縮小世界」的人。
 */
const FALLBACK_TAGS = ['市場與小吃', '在地咖啡', '老街散策', '經典地標', '自然風景', '博物館與展覽', '選物與工藝', '溫泉與放鬆'];
const MAX_TAGS = 10;
export const intelTags = (deep: DestinationDeep | null, lastWanted?: string[]): string[] => {
    const raw = (deep?.tags || []).filter(Boolean);
    const list = (raw.length >= 4 ? raw : FALLBACK_TAGS).slice(0, MAX_TAGS);
    if (!lastWanted?.length) return list;
    const seen = new Set(lastWanted);
    return list
        .map((t, i) => ({ t, i, hit: seen.has(t) ? 0 : 1 }))
        .sort((a, b) => a.hit - b.hit || a.i - b.i)
        .map(x => x.t);
};

/** 某月的季節註記（「十月的金澤，楓正紅」的素材）；沒有回 null（該行不顯示）。 */
export const seasonNote = (deep: DestinationDeep | null, month: number): string | null =>
    (deep?.seasons?.[String(month)] || '').trim() || null;

/**
 * ⑦「整理一下」：把手寫欄的口語整理成條列。
 *
 * 🔴 **零快取的純個人呼叫**——內容因人而異，快取不可能命中，**每按一次就是一次真實花費**。
 *    這是整條管線裡唯一一個這樣的呼叫；成本模型與目的地情報完全不同（見成本記錄 §3.10）。
 * 失敗一律回 null＝畫面上什麼都不做（原文完好無損，使用者再按一次就好）。
 */
export const refineNotes = async (text: string, destination?: string): Promise<string | null> => {
    const raw = text.trim();
    if (raw.length < 4) return null;
    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { action: 'refine-notes', payload: { text: raw, destination } },
        });
        if (error || !data) return null;
        const out = (data as { text?: string }).text;
        return typeof out === 'string' && out.trim() ? out.trim() : null;
    } catch {
        return null;
    }
};

/** 某月的關鍵詞（2–6 字，「楓紅・百岳」）；沒有就回 null——呼叫端退位成整句。 */
export const seasonKey = (deep: DestinationDeep | null, month: number): string | null =>
    (deep?.seasonKeys?.[String(month)] || '').trim() || null;

/**
 * 預算三級的粗估區間；**任何一級缺字串就整組回 null**（呼叫端整行不顯示）。
 *
 * 為什麼是「整組全有或全無」而不是逐級退位：三個數字的價值在**互相比較**——
 * 只顯示其中一兩級，使用者無從判斷貴或便宜，那比完全不顯示更糟。
 *
 * ⚠️ 這是**唯一**取得預算錨點的入口；伺服器端 35 天快取裡的舊資料沒有 `budget`
 *    （2026-08-09 上線前寫入的），此時回 null＝畫面自動退位，不需要清快取也不會出錯。
 */
export const budgetAnchors = (deep: DestinationDeep | null): DestinationBudget | null => {
    const b = deep?.budget;
    if (!b) return null;
    const lean = (b.lean || '').trim(), mid = (b.mid || '').trim(), rich = (b.rich || '').trim();
    return lean && mid && rich ? { lean, mid, rich } : null;
};

