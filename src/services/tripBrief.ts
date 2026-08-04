// src/services/tripBrief.ts
// 🎫 旅程券（TripBrief）核心邏輯——生成表單重設計的資料層（docs E3 定案）。
//   職責：建立/帶入預設、國內外推斷、天數與密度、prompt payload 物化、券面摘要。
//   鐵律：
//   - **表單零提問的都在這裡推斷**（國內外＝目的地國 vs 居住國；幣別＝目的地；天數＝城市數反哺）。
//   - **回頭客帶入分兩類**：跟人走＝品味（步調/風格/預算/移動傾向）；跟趟走＝事實（旅伴/時段/標籤/講究）。
//   - **答不出來一律合法**：日期未定、時段 unset 都是一級狀態，不是缺漏。
//   - 純函式為主（可測、無副作用）；DB 存取留在 profile.ts / App。
import type {
    Trip, TripBrief, PaceLevel, VibeLevel, BudgetLevel, LocalTransport, RearrangeMood,
} from '../types';

// ── 常數：度量衡（形容詞的契約——同一組數字同時進 UI 副標與 prompt 硬約束） ──
export const PACE_STOPS: Record<PaceLevel, { min: number; max: number; label: string }> = {
    relaxed: { min: 2, max: 3, label: '悠閒' },
    standard: { min: 4, max: 5, label: '標準' },
    packed: { min: 6, max: 8, label: '緊湊' },
    deep: { min: 2, max: 3, label: '深度' },   // 站數同悠閒，但每站停留時間長（prompt 另述）
};

export const VIBE_LABEL: Record<VibeLevel, string> = {
    classic: '經典', balanced: '均衡', culture: '人文', hidden: '秘境',
};
export const BUDGET_LABEL: Record<BudgetLevel, string> = {
    economy: '經濟', standard: '標準', luxury: '豪華',
};
export const TRANSPORT_LABEL: Record<LocalTransport, string> = {
    public: '大眾運輸', car: '租車自駕', charter: '包車接駁',
};
export const MOOD_LABEL: Record<RearrangeMood, string> = {
    lighter: '輕鬆一點', tighter: '緊湊一點', 'less-transit': '少一點移動時間', 'easy-first-day': '第一天輕鬆一點',
};

// 幣別對照（目的地國 ISO → 幣別）；查無＝USD 保底，使用者可點改（旁註）
const CURRENCY_BY_COUNTRY: Record<string, string> = {
    TW: 'TWD', JP: 'JPY', KR: 'KRW', US: 'USD', CN: 'CNY', HK: 'HKD', MO: 'MOP',
    TH: 'THB', VN: 'VND', SG: 'SGD', MY: 'MYR', PH: 'PHP', ID: 'IDR', IN: 'INR',
    GB: 'GBP', FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', AT: 'EUR', PT: 'EUR',
    CH: 'CHF', AU: 'AUD', NZ: 'NZD', CA: 'CAD', AE: 'AED', TR: 'TRY', EG: 'EGP',
};
export const currencyForCountry = (iso?: string | null): string =>
    CURRENCY_BY_COUNTRY[(iso || '').toUpperCase()] || 'USD';

/** 國內外推斷（批A 定案）：目的地國 === 居住國 ⇒ 國內。兩者任一未知 ⇒ 視為國外（保守：多問不如少假設）。 */
export const isDomesticTrip = (destinationCountry?: string | null, residenceCountry?: string | null): boolean => {
    const a = (destinationCountry || '').toUpperCase();
    const b = (residenceCountry || '').toUpperCase();
    return !!a && !!b && a === b;
};

/** 城市/地帶數 → 建議天數（縮圈反哺；一地 4 天、每多一地 +2，封頂 14）。 */
export const suggestedDays = (placeCount: number): number =>
    Math.min(14, 4 + Math.max(0, placeCount - 1) * 2);

/** 密度檢查（速覽階段的軟提醒；只陳述事實，永不擋路）。回傳 null＝不需提醒。 */
export const densityWarning = (placeCount: number, daysCount: number): string | null => {
    if (placeCount < 2 || daysCount <= 0) return null;
    const perPlace = daysCount / placeCount;
    if (perPlace >= 2) return null;
    const POOL = [
        '平均每城停留少於 2 天。建議調減城市或延長天數以深度旅遊。',
        '行程步調較緊湊，適合喜歡充實、高效排程的你。',
        '景點多、時間短。快節奏的旅行，也能飽覽更多風光。',
        '平均每城停留不到 2 天。完美旅程，由你自由掌握節奏。',
        '在城市間多留連一會吧？少去一個地方，就能多一分深度。',
        '這是一場與時間賽跑的探險！喜歡節奏明快的你，就這麼出發吧。',
        '用有限的天數，裝進最多的風景。衝刺，也是一種旅行的姿態。',
        '每座城市停留不到兩天。沒關係，旅行的節奏，本來就該由你決定。',
    ];
    // 以「城市數×天數」決定性挑句（同一組合每次同一句，不會閃爍；換組合才換句）
    return POOL[(placeCount * 31 + daysCount) % POOL.length];
};

/** 月份 → 年份（早於當前月＝次年；「什麼時候」頁的明年問題修正）。 */
export const yearForMonth = (month: number, now = new Date()): number => {
    const y = now.getFullYear();
    return month < now.getMonth() + 1 ? y + 1 : y;
};

/** 起訖日 → 天數（含頭尾）；無效回 0。 */
export const daysBetween = (start?: string, end?: string): number => {
    const ms = (s?: string) => {
        const [y, m, d] = (s || '').split('-').map(Number);
        return y && m && d ? new Date(y, m - 1, d).getTime() : NaN;
    };
    const a = ms(start), b = ms(end);
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
};

export interface BriefSeed {
    destinations?: string[];
    isDomestic?: boolean;
    destinationCountry?: string | null;
    /** 上一份 brief（回頭客帶入品味；沒有＝首次使用者用中性預設） */
    previous?: TripBrief | null;
}

/** 建立一份新的旅程券：首次＝中性預設；回頭客＝**只帶品味（跟人走）**，事實欄一律留白（跟趟走）。 */
export function createBrief(seed: BriefSeed = {}): TripBrief {
    const now = new Date().toISOString();
    const p = seed.previous || null;
    const places = seed.destinations || [];
    return {
        version: 1,
        destinations: places,
        zones: undefined,
        isDomestic: seed.isDomestic ?? isDomesticTrip(seed.destinationCountry, null),
        datesUndecided: true,
        daysCount: suggestedDays(places.length || 1),
        arrivalSlot: 'unset',        // 跟趟走：沒訂票零操作可過
        departureSlot: 'unset',
        companions: [],              // 跟趟走：這次跟誰是事實，不預選
        pace: p?.pace ?? 'standard', // 跟人走：品味帶入（首次＝中性預設）
        vibe: p?.vibe ?? 'balanced',
        budgetLevel: p?.budgetLevel ?? 'standard',
        localTransport: p?.localTransport ?? 'public',
        currency: currencyForCountry(seed.destinationCountry),
        tagsWanted: [],              // 跟趟走：情境性
        tagsAvoided: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
    };
}

/** 更新券（永遠回新物件、更新 updatedAt；供 UI 與規劃臉共用）。 */
export const patchBrief = (brief: TripBrief, patch: Partial<TripBrief>): TripBrief =>
    ({ ...brief, ...patch, updatedAt: new Date().toISOString() });

/** 券面摘要（旅程券顯示用；一行內講完這一趟的個性）。 */
export function briefSummary(b: TripBrief): string {
    const parts: string[] = [];
    if (b.companions.length) parts.push(b.companions.join('・'));
    parts.push(PACE_STOPS[b.pace].label, VIBE_LABEL[b.vibe], `${BUDGET_LABEL[b.budgetLevel]}預算`);
    return parts.join(' · ');
}

/** 日期顯示（精確＝區間；未定＝月份＋天數）。 */
export function briefDateLabel(b: TripBrief): string {
    if (!b.datesUndecided && b.startDate && b.endDate) {
        return `${b.startDate.slice(5).replace('-', '.')} – ${b.endDate.slice(5).replace('-', '.')} · ${b.daysCount} 天`;
    }
    if (b.month) return `${b.year || ''}年${b.month}月 · ${b.daysCount} 天（日期未定）`;
    return `${b.daysCount} 天（日期未定）`;
}

/** Prompt payload：把券物化成生成器讀得懂的約束集合。
 *  設計要點——**形容詞一律翻成數字或條列**，讓「緊湊」對三方（使用者/我們/LLM）是同一件事。 */
export function briefToPromptPayload(b: TripBrief, extra?: { wishSamples?: string[] }): Record<string, unknown> {
    const stops = PACE_STOPS[b.pace];
    return {
        destinations: b.destinations,
        zones: b.zones ?? [],
        isDomestic: b.isDomestic,
        dates: b.datesUndecided
            ? { undecided: true, month: b.month ?? null, year: b.year ?? null, days: b.daysCount }
            : { undecided: false, start: b.startDate, end: b.endDate, days: b.daysCount },
        // 硬約束：每日站數（deep 另加「每站停留更久、總站數偏少」）
        stopsPerDay: { min: stops.min, max: stops.max, deepStay: b.pace === 'deep' },
        arrival: b.arrivalSlot,           // 'unset' ＝ 生成器自行以下午抵達為假設
        departure: b.departureSlot,
        companions: b.companions,         // 影響：長輩→步行量少、寵物→寵物友善、親子→節奏緩
        vibe: b.vibe,
        budgetLevel: b.budgetLevel,
        currency: b.currency,
        localTransport: b.localTransport,
        mustInclude: b.tagsWanted,        // 圈起來＝必含
        mustAvoid: b.tagsAvoided,         // 劃掉＝負面約束（執行力最高）
        freeNotes: (b.notesRefined || b.notes || '').trim(),
        tasteExamples: extra?.wishSamples ?? [],   // 心願盒收藏＝few-shot「此人喜歡這種地方」
        rearrangeMoods: b.lastMoods ?? [],         // 重排方向（有方向的改進，不是盲目重骰）
    };
}

/** 從既有 Trip 取券（沒有＝從 trip 現況回推一份最小券，讓舊行程也能打開「當初選了什麼」）。 */
export function briefOfTrip(trip: Trip): TripBrief {
    if (trip.brief) return trip.brief;
    const now = new Date().toISOString();
    return {
        version: 1,
        destinations: [trip.destination].filter(Boolean),
        isDomestic: false,
        datesUndecided: !trip.startDate || !trip.endDate,
        startDate: trip.startDate || undefined,
        endDate: trip.endDate || undefined,
        daysCount: (trip.days || []).length || daysBetween(trip.startDate, trip.endDate),
        arrivalSlot: 'unset',
        departureSlot: 'unset',
        companions: [],
        pace: (trip.pace as PaceLevel) || 'standard',
        vibe: 'balanced',
        budgetLevel: 'standard',
        localTransport: (trip.localTransportMode === 'taxi' ? 'charter' : trip.localTransportMode) || 'public',
        currency: trip.currency || 'TWD',
        tagsWanted: [],
        tagsAvoided: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
    };
}
