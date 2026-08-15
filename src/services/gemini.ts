// src/services/gemini.ts
import type { TripDay, WeatherInfo, VoltageInfo, Activity, TripConstraints } from "../types";
import type { RawExtraction } from "../types/booking";
import { parseBookingJSON, coerceRawExtraction } from "./booking/coerceRaw";
import { newActivityId } from "../utils/activityId";
import { supabase } from "./supabase";

// 🔐 所有外部 API 金鑰已移至 Supabase Edge Function (ai-proxy)。
// 前端不再持有任何金鑰，僅以「已登入使用者的 JWT」呼叫代理。
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- proxy 回傳依 action 而異，各呼叫端自行窄化
async function callProxy(action: string, payload: Record<string, unknown>): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action, payload },
    });
    if (error) throw new Error(error.message || 'AI 代理呼叫失敗');
    if (data?.error) throw new Error(data.error);
    return data;
}

// --- 快取設定 ---
const CACHE_PREFIX = 'kelvin_cache_';
const CACHE_TTL = {
    WEATHER: 30,
    TIMEZONE: 10080,
    CURRENCY: 60,
    STATIC_INFO: 1440,
    ITINERARY: 60, 
    FLIGHT: 1440 
};

// ==========================================================
// 核心：文字模式 (透過 ai-proxy)
// ==========================================================
async function callGeminiDirectly(prompt: string): Promise<string> {
    const data = await callProxy('gemini-text', { prompt });
    return data.text || "";
}

// ==========================================================
// 核心：視覺模式 (透過 ai-proxy，處理圖片)
// ==========================================================
async function callGeminiVision(prompt: string, base64Image: string): Promise<string> {
    const data = await callProxy('gemini-vision', { prompt, base64Image });
    return data.text || "";
}

// --- 快取邏輯 ---
async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ttlMinutes: number): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            if ((Date.now() - timestamp) / 1000 / 60 < ttlMinutes) return data as T;
        } catch { /* 快取解析失敗＝視同無快取 */ }
    }
    const data = await fetcher();
    if (data) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
}

const parseJSON = <T>(text: string | undefined): T | null => {
    if (!text) return null;
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // 🔧 2026-08-15 覆核 N-2：**先直接解析，猜括號只是退路**。
    //   jsonMode 回來的通常已是乾淨 JSON，根本不需要猜邊界——直接 parse 最穩。
    //   舊版「用字串位置猜邊界」對含前綴文字的回應（"Here is the [itinerary]: {...}"）會切錯。
    try {
        return JSON.parse(clean) as T;
    } catch { /* 落到括號掃描退路 */ }
    // 退路：回應含前後贅字時，取最外層 JSON。看**最先出現**的是 [ 還是 {（物件內字串含 [...] 不誤判）。
    try {
        const iArr = clean.indexOf('[');
        const iObj = clean.indexOf('{');
        const isArr = iArr !== -1 && (iObj === -1 || iArr < iObj);
        const start = isArr ? iArr : iObj;
        const end = clean.lastIndexOf(isArr ? ']' : '}');
        if (start !== -1 && end > start) {
            return JSON.parse(clean.substring(start, end + 1)) as T;
        }
    } catch (err) {
        console.error("JSON Parse Error:", err);
    }
    return null;
};

// ==========================================================
// 🧱 Phase C1-0：貼上匯入。把自由格式文字（LINE 記事本等）解析成結構化清單。
// ==========================================================
export interface ParsedWish {
    type: 'place' | 'item';
    title: string;
    address?: string;
    url?: string;
    note?: string;
    country?: string;
    city?: string;
    area?: string;
    budget?: number;
    currency?: string;
    tags?: string[];
    forWhom?: string;   // 🛍️ 代購對象（幫誰買）
    quantity?: number;  // 🛍️ 數量
}

export const parseWishesFromText = async (text: string, mode: 'place' | 'item' | 'auto'): Promise<ParsedWish[]> => {
    const isAuto = mode === 'auto';
    const modeHint = mode === 'place'
        ? 'These are PLACES to visit (cafes, shops, restaurants, attractions). Extract full address and any map URL.'
        : mode === 'item'
        ? 'These are SHOPPING items to buy. Extract product name, price/budget if any, and where-to-buy if mentioned.'
        : 'The notes MIX places-to-visit and shopping-items-to-buy. CLASSIFY EACH line independently into "place" or "item".';

    // auto 模式 type 由 AI 逐列決定；否則固定 mode
    const typeField = isAuto ? '"type": "place" | "item"' : `"type": "${mode}"`;

    const classifyRule = isAuto ? `
- "type": decide PER LINE:
    · "place" = somewhere you physically GO — restaurant, cafe, bar, attraction, landmark, or a shop you intend to VISIT. Usually has/implies an address, district, or map link.
    · "item" = a PRODUCT you buy and carry away — snack, cosmetic, medicine, drink, souvenir, goods. Often has a price, quantity, a "buy / 幫…買 / 要買" cue, or a brand+product.
    · A bare store name (Lawson, 唐吉訶德, 業務超市, 驚安殿堂) → "place". BUT if the line is really about buying a SPECIFIC product there, emit an "item" whose "area" is that store.
    · When genuinely ambiguous, prefer "place".` : '';

    const areaRule = isAuto
        ? '- "area": for a "place" → the district/neighbourhood (東區, 安平區, 中西區, 澀谷區); for an "item" → the store or category to buy from (Lawson, 唐吉訶德, 業務超市, 生鮮, 藥妝, 服飾, 伴手禮).'
        : `- "area": ${mode === 'place'
            ? 'the district (區) or neighbourhood within the city (e.g. 東區, 安平區, 中西區, 澀谷區).'
            : 'the store or category to buy from — where/what kind (e.g. Lawson, 唐吉訶德, 業務超市, 生鮮, 藥妝, 服飾, 伴手禮).'}`;

    const skipRule = isAuto
        ? '- Keep the original language of names and notes. Skip lines that are neither a real place nor a real item (pure chatter, dates, headers).'
        : `- Keep the original language of names and notes. Skip lines that are not a real ${mode}.`;

    const prompt = `
You extract a clean structured list from a user's pasted freeform notes (e.g. LINE memo).
${modeHint}

Output a JSON ARRAY only, no prose. Each element:
{ ${typeField}, "title": string, "address"?: string, "url"?: string, "note"?: string, "country"?: string, "city"?: string, "area"?: string, "budget"?: number, "currency"?: string, "tags"?: string[], "forWhom"?: string, "quantity"?: number }

Rules:
- "title": the place/item name; strip leading numbering like "3." and keep the rest.${classifyRule}
- "address": the full postal address if present (place only).
- "url": any http(s) link such as maps.app.goo.gl.
- "note": extra remarks, e.g. parenthetical text like "(只有外帶)" or "鹹蛋黃巴斯克好吃".
- "country": the NATION in Traditional Chinese (台灣, 日本, 韓國, 泰國, ...).
- "city": the CITY (臺南市 → 台南; 台北 → 台北; 東京/Tokyo → 東京; 大阪/Osaka → 大阪).
${areaRule}
- "tags": 1-2 short helpful tags in Traditional Chinese inferred from content (e.g. 咖啡, 甜點, 藥妝).
- "budget"/"currency": only for shopping items if a price is stated.
- "forWhom" (items only): who it is bought FOR (代購對象) — e.g. 媽媽, 姊姊, 同事. Extract from phrases like "幫媽媽買", "姊姊要的", "同事託買". Leave empty/omit if it is for the buyer themselves.
- "quantity" (items only): integer count from "×2", "兩個", "數量2", "3盒". Omit if not stated.
${skipRule}

Pasted notes:
"""
${text}
"""
`;
    const raw = await callGeminiDirectly(prompt);
    const data = parseJSON<ParsedWish[]>(raw);
    if (!Array.isArray(data)) return [];
    // 防禦：確保 type 與 title 合法。auto 保留 AI 逐列判斷（非 item 一律當 place），否則固定 mode。
    return data
        .filter(d => d && typeof d.title === 'string' && d.title.trim())
        .map(d => ({
            ...d,
            type: isAuto ? (d.type === 'item' ? 'item' : 'place') : mode,
            title: d.title.trim(),
        }));
};

// ==========================================================
// 🎟️ 訂位匯入：把機票/訂房確認信抽成 RawExtraction（合約見 types/booking.ts）。
//   關鍵分工：LLM 只吐「當地牆上時間 + IATA」與「卡號末四碼」；時區換算、成員對應由 App 端做。
//   輸出必過 coerceRawExtraction（防禦塑形 + 遮罩）後才回傳。
// ==========================================================
const bookingPrompt = (source: string) => `
You extract structured booking data from an airline/hotel confirmation (email text or its screenshot).
Output ONE JSON object ONLY — no prose, no markdown fences. Missing data → null. NEVER invent values.

Schema:
{
  "kind": "flight" | "hotel" | null,
  "provider": string | null,            // airline or hotel brand, keep original language e.g. 台灣虎航
  "pnr": string | null,                 // booking reference / 訂位代號
  "segments": [                         // flights only; hotel → []
    { "flightNo": string|null, "fromIata": string|null, "toIata": string|null,
      "depLocal": "YYYY-MM-DD HH:mm"|null, "arrLocal": "YYYY-MM-DD HH:mm"|null }
  ],
  "passengers": [                       // flights only; hotel → []
    { "fullName": string, "title": string|null,   // title = MR/MS/MISS/MSTR... as printed
      "perSegment": [ { "segIndex": number, "checkedKg": number|null, "seat": string|null } ] }
  ],
  "hotels": [                           // hotels only; flights → []
    { "property": string|null, "checkInLocal": "YYYY-MM-DD HH:mm"|null, "checkOutLocal": "YYYY-MM-DD HH:mm"|null,
      "rooms": number|null, "guests": number|null, "address": string|null,
      "fare": { "total": number, "currency": string } | null }   // 每間自己的金額
  ],
  "fare": { "total": number, "currency": string,
            "breakdown": [ { "label": string, "amount": number } ],
            "paidBy": { "method": string, "last4": string, "status": string } } | null,
  "warnings": string[]
}

Hard rules:
- TIME: emit the LOCAL wall-clock time exactly as printed on the ticket, 24-hour "YYYY-MM-DD HH:mm".
  DO NOT convert timezones. DO NOT compute UTC. DO NOT add or shift hours. (App resolves timezone itself.)
- AIRPORTS: use 3-letter IATA codes for fromIata/toIata (KHH, OKA, NRT...). If only a city/airport
  name is given and you are unsure of the IATA, set it null and add a warning — do not guess.
- ROUND TRIP: output one segment per flight leg, in travel order. segIndex in perSegment is the
  0-based index into "segments". "無託運行李" / no checked bag → checkedKg = null.
- CARD: put ONLY the last 4 digits in fare.paidBy.last4. NEVER output a full card number anywhere.
- CHILDREN: keep the printed title (MISS/MSTR often indicate a child) but do not infer age yourself.
- MULTIPLE HOTELS: if the source covers several hotel stays, output ONE element in "hotels" PER hotel —
  do NOT merge names, dates, rooms, addresses or fares into one. Each hotel keeps its own "fare".
- WARNINGS: write every warning in Traditional Chinese (繁體中文). Add a short note for anything ambiguous:
  unclear date format, missing return flight, unknown airport code, unreadable fare, etc.
- Keep names/provider in their original language and spelling.

Source:
"""
${source}
"""
`;

export const parseBookingFromText = async (text: string): Promise<RawExtraction> => {
    const raw = await callGeminiDirectly(bookingPrompt(text));
    return coerceRawExtraction(parseBookingJSON(raw));
};

export const parseBookingFromImage = async (base64Image: string): Promise<RawExtraction> => {
    const raw = await callGeminiVision(bookingPrompt('(confirmation is in the attached image)'), base64Image);
    return coerceRawExtraction(parseBookingJSON(raw));
};

// ==========================================================
// 1. 行程生成 (8.0 終極升級版：注入單日靈魂標籤 vibeTag)
// ==========================================================
// ── Phase 1：TripConstraints → prose 的對照表（原本散在 CreateTripModal.buildPrompt，收斂到生成層）──
const COMPANION_LABEL: Record<string, string> = { solo: '獨旅', couple: '情侶/夫妻', family: '親子家庭', friends: '一群朋友', elderly: '帶長輩', pet: '帶寵物', colleague: '同事', classmate: '同學' };
const PACE_LABEL: Record<string, string> = { relaxed: '悠閒慢活', standard: '標準觀光', packed: '特種兵打卡', deep: '深度慢遊' };
const VIBE_LABEL: Record<string, string> = { popular: '經典地標', balanced: '在地與熱門均衡', hidden: '大自然與秘境', cultural: '歷史人文藝術' };
const BUDGET_LABEL: Record<string, string> = { cheap: '經濟實惠', standard: '標準預算', luxury: '豪華享受' };
const TIME_SLOT_LABEL: Record<string, string> = { morning: '早上 (08:00 - 12:00)', afternoon: '下午 (12:00 - 18:00)', evening: '晚上 (18:00 以後)' };
const MOBILITY_LABEL: Record<string, string> = {
    public: '大眾運輸 (請集中景點於交通節點周邊)',
    car: '租車自駕 (可安排跨區、彈性較高的景點)',
    taxi: '計程車/包車 (點對點接駁，不需顧慮等車時間)',
};

/**
 * 🔴 **承諾＝交付**：⑥「想怎麼玩」的預算選項，圈選後會在畫面上寫出一句「我實際上會怎麼排」。
 * 這裡就是兌現那句話的地方——**文案改了，這裡也要跟著改**（對照 `views/create/HowPage.tsx` 的 `BUDGET.hint`）。
 *
 * 寫成**具體到可以驗證**的指令，而不是「請注意預算」這種模糊要求：模糊的要求 LLM 幾乎必然忽略，
 * 而使用者拿著我們寫在畫面上的句子去對照生成結果時，看到的就是有沒有做到。
 */
const BUDGET_DIRECTIVE: Record<string, string> = {
    // 對應畫面：「門票偏高的地方，會在行程上標示出來」
    //   ⚠️ 只承諾**標示**，不承諾「讓你決定是否保留」——那需要一個我們沒做的專門介面。
    cheap: '餐飲以在地小館、市場與便利商店為主；景點優先選擇免費或低價者。'
        + '若仍安排了門票明顯偏高的地方（因其為當地代表性景點），**必須在該活動的 description 開頭寫「門票偏高：」**再接原本的說明。',
    economy: '餐飲以在地小館、市場與便利商店為主；景點優先選擇免費或低價者。'
        + '若仍安排了門票明顯偏高的地方，**必須在該活動的 description 開頭寫「門票偏高：」**再接原本的說明。',
    // 對應畫面：「一天安排一餐正式的，其餘從簡」
    standard: '每一天安排**恰好一餐**坐下來好好吃的正式餐廳（午餐或晚餐擇一），其餘餐次從簡（小吃、市場、便利商店皆可）。',
    // 對應畫面：「需要預約的餐廳與體驗會優先排入行程」
    luxury: '**優先**安排需要事先預約的餐廳、體驗與導覽（例如需訂位的餐廳、限定場次的展演、包場或私人行程）；'
        + '這類活動請在 description 註明「建議提前預約」。',
};

// hard 錨的顯示值：confirmed 直接用真時間；hint 用時段標籤。
const anchorLabel = (a?: { confidence: 'confirmed' | 'hint'; value: string }): string | null =>
    !a ? null : a.confidence === 'confirmed' ? a.value : (TIME_SLOT_LABEL[a.value] ?? a.value);

/**
 * 🔴 **抵達／離開時段 → 第一站與最後一站的可用時間**（2026-08-09）。
 *
 * 為什麼需要這張表：使用者說的是**抵達時間**，不是**行程開始時間**。
 * 舊版只寫「arrives around 早上 (08:00–12:00)，不要排在這之前」——模型會理解成
 * 「08:00 之後就可以排」，於是生出「08:30 抵達淺草寺」這種**不可能發生**的第一站。
 * 早上八點落地，要出關、領行李、搭車進市區，**第一站最早也是十一點半**。
 *
 * 國際線與國內線的緩衝差一倍以上，所以要分兩套；離開那天更嚴格——
 * **國際線早上的飛機，那一天等於沒有行程**（要提早三小時到機場）。
 *
 * 這些數字是**保守的下限**：寧可讓第一天少排一站，也不要生出一個他趕不上的行程。
 */
const ARRIVAL_FIRST_START: Record<string, { intl: string | null; dom: string | null }> = {
    morning: { intl: '11:30', dom: '09:30' },
    afternoon: { intl: '16:30', dom: '14:30' },
    evening: { intl: null, dom: null },   // null＝當天不排完整行程
};
/** 最後一天：行程必須在這個時間之前結束（已扣掉往機場／車站的移動與報到） */
const DEPARTURE_LAST_END: Record<string, { intl: string | null; dom: string | null }> = {
    morning: { intl: null, dom: null },   // null＝當天不排行程
    afternoon: { intl: '10:30', dom: '11:30' },
    evening: { intl: '14:30', dom: '16:30' },
};

// TripConstraints → [旅遊條件] prose（純函式；生成/未來預覽共用）。
const buildUserPreferences = (c: TripConstraints): string => {
    const s = c.soft;
    const destinationsStr = c.legs.map(l => l.city).join('、');
    const arrival = anchorLabel(c.hard.arrival);
    const departure = anchorLabel(c.hard.departure);
    const interests = (s.interests ?? []).map(i => (i.detail ? `${i.tag} (想去: ${i.detail})` : i.tag)).join(', ');
    const mobility = s.localTransportMode ? MOBILITY_LABEL[s.localTransportMode] : '未指定';

    return `[旅遊條件]
        - 類型：${c.tripType === 'domestic' ? '國內旅遊' : '國外旅遊'}
        - 目的地：${destinationsStr}
        - 抵達時間：第一天 ${arrival ?? '未指定'} 抵達
        - 離開時間：最後一天 ${departure ?? '未指定'} 離開
        - 當地移動方式：以 ${mobility} 為主
        - 旅伴：${s.companions?.length
            // ⚠️ 有完整清單就用完整清單：「長輩同行、帶著孩子」與「長輩同行」對行程的意義完全不同，
            //    壓成單一代表值（舊的 companion 欄）會讓其中一個限制安靜地消失。
            ? s.companions.join('、')
            : s.companion ? (COMPANION_LABEL[s.companion] ?? s.companion) : '未指定'}
        - 步調：${s.pace ? (PACE_LABEL[s.pace] ?? s.pace) : '標準觀光'}
        - 風格：${s.vibe ? (VIBE_LABEL[s.vibe] ?? s.vibe) : '在地與熱門均衡'}
        - 預算：${s.budgetLevel ? (BUDGET_LABEL[s.budgetLevel] ?? s.budgetLevel) : '標準預算'} ${s.customBudget ? `(${s.customBudget})` : ''}${s.budgetCap
            // ⚠️ 措辭必須是**上限**不是目標：寫成目標，模型會為了湊到那個數字硬塞景點。
            //    也明講「略超要標出來」——旅行不是預算執行，一家超出一點的餐廳不該被自動排除。
            ? `\n        - 每人每天花費上限：約 ${s.budgetCap}（僅含餐飲、當地交通、門票；**不含機票與住宿**）。這是上限不是目標，不要為了用滿而增加行程；若某一項明顯超出，仍可安排但要在該項的 description 標註「超出預算」`
            : ''}${s.budgetLevel && BUDGET_DIRECTIVE[s.budgetLevel]
            // 兌現畫面上那句「我實際上會怎麼排」——見 BUDGET_DIRECTIVE 的說明
            ? `\n        - 預算的具體作法：${BUDGET_DIRECTIVE[s.budgetLevel]}`
            : ''}
        - 興趣細項：${interests || '無特別指定'}${s.tagsAvoided?.length
            // 🔴 負面約束是 prompt 裡**執行力最高的材料**——「不要什麼」比「想要什麼」明確得多。
            //    所以它獨立成一行、用最強的措辭，不與其他偏好混在一起。
            ? `\n        - 🚫 **絕對避開（使用者親手劃掉的，違反就是明確的錯誤）**：${s.tagsAvoided.join('、')}`
            : ''}
        - 特別需求：${s.specificRequests || '無'}

        [系統隱藏指令 - 行程美學與出片率校準]
        ⚠️ 最高優先級：行程安排請務必注重「視覺體驗與空間美感」。請優先挑選具備高知名度、出片率極高、設計感強烈、或在各大社群平台上備受推崇的優質景點、質感餐廳與風格選物店。即使使用者選擇「經濟實惠」或「歷史文化」，也請在該框架內尋找最具視覺張力與美學價值的地點，拒絕平庸或缺乏特色的冷門行程。`;
};

// 穩定快取鍵：把整份 constraints 納入（修掉舊版漏 userPrompt → 改選項不重生成的 bug）。v10 沖掉 v9 舊快取。
const constraintsCacheKey = (c: TripConstraints, days: number): string =>
    `itinerary_v10_${days}_${JSON.stringify(c)}`;

export const generateItinerary = async (
    constraints: TripConstraints,
    days: number,
): Promise<TripDay[]> => {

  const destination = constraints.legs.map(l => l.city).join(' + ') || '未指定目的地';
  const cacheKey = constraintsCacheKey(constraints, days);

  return fetchWithCache(cacheKey, async () => {
      let context = "";

      // 抵達／離開：**時段不等於行程可用時間**——中間隔著通關、行李、往返機場。
      //   hint（只知道時段）→ 套用 ARRIVAL_FIRST_START／DEPARTURE_LAST_END 的保守下限；
      //   confirmed（有真實航班時間）→ 用真時間，並要求模型自己扣掉緩衝。
      const intl = constraints.tripType !== 'domestic';
      const pickTime = (t: { intl: string | null; dom: string | null }) => (intl ? t.intl : t.dom);
      const bufferNote = intl
          ? 'immigration, baggage claim and the transfer into the city (allow ~2.5h)'
          : 'getting out of the station/airport and into the city (allow ~1h)';

      const arr = constraints.hard.arrival;
      if (arr) {
          const label = anchorLabel(arr);
          const gate = arr.confidence === 'hint' ? ARRIVAL_FIRST_START[arr.value] : undefined;
          const first = gate ? pickTime(gate) : undefined;
          context += `\n- **ARRIVAL TIMING (hard)**: On Day 1 the traveller ARRIVES around ${label}. `
              + `This is the arrival time, NOT the time sightseeing can begin — account for ${bufferNote}. `
              + (gate
                  ? (first
                      ? `**The first activity of Day 1 must start no earlier than ${first}.** `
                      : `**The traveller lands at night: Day 1 must contain AT MOST one light item (a dinner or a night view near the accommodation), or nothing at all. Do NOT plan a full day.** `)
                  : `**Derive the first activity time by adding that buffer to the actual arrival time.** `)
              + `Do NOT fabricate airport arrival / immigration / baggage / airport-to-city transport cards — the flight booking owns arrival. Day 1 starts from the first real destination.`;
      } else {
          // 🔴 **留白不等於沒有假設**（2026-08-09 修）：舊版沒有 arrival 就完全不給指令，
          //   模型於是把 Day 1 當成完整的一天、從早上排滿——使用者其實可能晚上才落地。
          //   `unset` 的定案語意是「生成器自行以**下午抵達**為假設」（tripBrief.ts）。
          //   ⚠️ 假設的**方向**要選對：不確定時往「少」的方向——
          //      **匯入真實航班後，加比刪容易**（多出的時間可以往裡塞；排太滿卻要刪掉他已經看過的東西，
          //      那是破壞性的，也會讓對帳器有一堆衝突要搬）。
          const first = intl ? ARRIVAL_FIRST_START.afternoon.intl : ARRIVAL_FIRST_START.afternoon.dom;
          context += `\n- **ARRIVAL TIMING (assumed)**: The traveller has NOT told us when they land. `
              + `Assume a conservative afternoon arrival: **the first activity of Day 1 must start no earlier than ${first}**, `
              + `and keep Day 1 deliberately light — it will be adjusted once the real flight is imported. `
              + `Do NOT fabricate airport / immigration / transport cards.`;
      }
      const dep = constraints.hard.departure;
      if (dep) {
          const label = anchorLabel(dep);
          const gate = dep.confidence === 'hint' ? DEPARTURE_LAST_END[dep.value] : undefined;
          const last = gate ? pickTime(gate) : undefined;
          context += `\n- **DEPARTURE TIMING (hard)**: On Day ${days} the traveller DEPARTS around ${label}. `
              + `Leave enough time to reach the airport/station and check in. `
              + (gate
                  ? (last
                      ? `**Everything on Day ${days} must finish before ${last}.** `
                      : `**The traveller leaves in the morning: Day ${days} must have NO sightseeing at all** (only breakfast or hotel check-out, if anything). `)
                  : `**Work backwards from the actual departure time and stop early enough.** `)
              + `Do NOT fabricate a departure / airport transport card — the booking owns it.`;
      } else {
          // 同上：沒說就假設下午離開，最後一天寧可留白（加比刪容易）
          const last = intl ? DEPARTURE_LAST_END.afternoon.intl : DEPARTURE_LAST_END.afternoon.dom;
          context += `\n- **DEPARTURE TIMING (assumed)**: The traveller has NOT told us when they leave. `
              + `Assume a conservative early-afternoon departure: **everything on Day ${days} must finish before ${last}**, `
              + `and keep that day light — it will be adjusted once the real flight is imported. `
              + `Do NOT fabricate a departure / airport transport card.`;
      }

      const localTransportMode = constraints.soft.localTransportMode;
      let transportInstruction = "";
      if (localTransportMode === 'public') {
          transportInstruction = `
            - **Transport Mode**: Public Transport (Subway, Bus, Train).
            - **CRITICAL RULE**: Whenever moving between two distinct locations (e.g. Airport to Hotel, Hotel to Spot A), you MUST INSERT a separate activity with type "transport".
            - For these transport items, "transportDetail" is MANDATORY.
          `;
      } else if (localTransportMode === 'car') {
          transportInstruction = `
            - **Transport Mode**: Rental Car / Driving.
            - Group locations logically to minimize driving time.
            - Insert "transport" items for drives > 30 mins.
            - Set "transportDetail" mode to "car".
          `;
      } else {
          transportInstruction = `
            - **Transport Mode**: Taxi / Uber.
            - Provide estimated taxi travel time in "transport" items.
          `;
      }

      const currency = constraints.currency ?? 'TWD';
      const prompt = `
        Role: Professional Travel Planner & Logistics Expert.
        Task: Create a ${days}-day itinerary for ${destination}.

        User Preferences: ${buildUserPreferences(constraints)}
        ${context}
        ${transportInstruction}

        **CRITICAL REQUIREMENTS (DO NOT IGNORE):**

        0. **NO REPEATED PLACES (ABSOLUTE)**: Each specific attraction, restaurant, cafe or shop may appear **AT MOST ONCE** across the ENTIRE itinerary. Never schedule the same place (or trivially-renamed variants of it) on multiple days or multiple times in one day. Every stop must be a distinct, different location.

        1. **Geographic Clustering (MOST IMPORTANT — no zig-zag across the map)**:
           - Divide ${destination} into distinct geographic zones/districts.
           - Assign each day to ONE primary zone (adjacent zones allowed). Every spot that day MUST be geographically close (short transit / walkable). Consecutive days should cover neighbouring zones to cut commuting.
           - Within a day, order the activities along an efficient one-way route (nearest-neighbour). NEVER bounce back and forth across the city.
           - Leave the day's zone only when unavoidable; if so, put that spot at the day's START or END, not the middle.
           - Respect any location constraint given above, and cluster WITHIN it.

        1b. **Multi-city allocation (CRITICAL when the destination lists more than one city, e.g. "京都 + 大阪")**:
           - Allocate the ${days} days across the cities in CONTIGUOUS blocks — each city's days MUST be consecutive. Minimise city changes: ideally visit each city exactly once and NEVER return to a city after leaving it (no zig-zag between cities).
           - For EACH day output a **"city"** field naming the single city that day is based in. EVERY activity that day must be located in that city.
           - For EACH day ALSO output a **"cityEn"** field: the English name of that day's city (e.g. 京都 → "Kyoto", 台南 → "Tainan", 曼谷 → "Bangkok"). Latin letters only.
           - On a day whose base city CHANGES from the previous day, the FIRST item must be an inter-city "transport" card representing the move (e.g. Shinkansen / domestic flight).

        2. **Arrival / Departure — DO NOT FABRICATE (single source of truth)**:
           - Do NOT create airport arrival, immigration, baggage-claim, or airport-to-city transport cards. The traveller's flight booking provides arrival & departure; fabricating them causes duplicate/clashing cards.
           - Day 1 begins at the FIRST real destination, respecting the arrival timing above. The last day ends before the departure timing.
        
        3. **Gap Connectors (Transport)**:
           - You MUST explicitly calculate travel time between spots.
           - Use 'type': 'transport' for these movements.
           - Fill 'transportDetail': { "mode": "bus"|"train"|"car"|"walk", "duration": "XX min" }.
           - Because each day is clustered in one zone, most gaps should be SHORT (walk / a few stops). A long transit in the middle of a day is a sign of bad clustering — fix the ordering instead.

        4. **Daily Vibe Tag (NEW & CRITICAL)**:
           - For EACH day, you MUST generate a "vibeTag" summarizing the day's theme, reflecting that day's zone/district.
           - Constraints: Maximum 15 characters. STRICTLY NO EMOJIS. Professional, high-end travel magazine tone.
           - MUST be uniquely tailored to the day's specific activities. DO NOT repeat the same tag across different days.

        5. **Data Integrity**:
           - **Currency**: Estimate costs in **${currency}** (Number only).
           - **Types**: Use strict types: "sightseeing", "food", "cafe", "shopping", "transport", "flight", "hotel", "relax", "bar", "culture", "activity".
        
        6. **Format**: Output valid JSON only.
        
        JSON Structure Example:
        [
          {
            "day": 1,
            "city": "京都",
            "cityEn": "Kyoto",
            "vibeTag": "城市初探與質感選物",
            "activities": [
              {
                "time": "14:00",
                "title": "上野公園散策",
                "description": "抵達後直接展開的第一站，綠意與美術館環繞。",
                "type": "sightseeing",
                "location": "上野",
                "cost": 0
              },
              {
                "time": "15:30",
                "title": "移動到谷中銀座",
                "description": "沿路散步前往下個地點",
                "type": "transport",
                "location": "Transit",
                "cost": 0,
                "transportDetail": {
                    "mode": "walk",
                    "duration": "15 min",
                    "instruction": "步行前往"
                }
              }
            ]
          }
        ]
        
        Language: Traditional Chinese (繁體中文).
      `;
        const text = await callGeminiDirectly(prompt);
        const data = parseJSON<TripDay[]>(text);
        if (!data) throw new Error("AI 生成格式錯誤");
        // 🧬 Phase 0/1：生成活動標血統 'generated' ＋ 穩定 id。
        const withMeta = data.map(day => ({
          ...day,
          activities: (day.activities ?? []).map(a => ({ ...a, id: a.id ?? newActivityId(), source: 'generated' as const })),
        }));
        // 🧹 生成去重（安全網，補 prompt 沒擋住的重複）：同一景點整趟最多一次；連接卡不去重。
        //   正規化：去括號內（英文/羅馬拼音）、去空白標點 → 抓近似重複（V&A ×4 那種）。
        const SYS = new Set(['transport', 'flight', 'note', 'process']);
        const normTitle = (t?: string) => (t ?? '').toLowerCase()
          .replace(/[（(][^）)]*[）)]/g, '')                 // 去括號內（英文/羅馬拼音）
          .replace(/[與和及]/g, '')                          // 去純連接詞（安全，不會誤併不同地點）
          .replace(/[\s\-·・、,，.。!！?？'"『』「」&]/g, '')
          .trim();
        const seen = new Set<string>();
        return withMeta.map(day => ({
          ...day,
          activities: day.activities.filter((a) => {
            if (SYS.has((a.type || '').toLowerCase())) return true;
            const k = normTitle(a.title);
            if (!k) return true;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }),
        }));
  }, CACHE_TTL.ITINERARY);
};

// ==========================================================
// 2. 航班查詢 (精準模式)
// ==========================================================
interface FlightInfo {
    code: string;
    depTime: string;
    arrTime: string;
    origin: string;
    dest: string;
    originTerm?: string;
    destTerm?: string;
}

export const lookupFlightInfo = async (flightCode: string): Promise<FlightInfo | null> => {
    if (!/^[A-Z0-9]{2,3}\d{3,4}$/.test(flightCode)) return null;
    return fetchWithCache(`flight_v2_${flightCode}`, async () => {
        const prompt = `
            Act as an aviation data specialist.
            Task: Provide the **STANDARD SCHEDULED ROUTE** for flight number "${flightCode}".
            
            Return valid JSON ONLY (No markdown):
            {
                "code": "${flightCode}",
                "depTime": "HH:MM",
                "arrTime": "HH:MM",
                "origin": "IATA_CODE",
                "dest": "IATA_CODE",
                "originTerm": "Terminal (optional)",
                "destTerm": "Terminal (optional)"
            }
        `;
        try {
            const text = await callGeminiDirectly(prompt);
            return parseJSON<FlightInfo>(text);
        } catch {
            return null;
        }
    }, CACHE_TTL.FLIGHT);
};

// ==========================================================
// 3. AI 推薦下一站
// ==========================================================
export const suggestNextSpot = async (
    currentLocation: string, 
    currentTime: string, 
    interests: string
): Promise<Activity | null> => {
    const prompt = `
        User is at "${currentLocation}" at "${currentTime}".
        Interests: ${interests}.
        Recommend ONE best place to visit next within 20 mins walking or short transit.
        Return JSON ONLY:
        {
            "time": "${currentTime}",
            "title": "Spot Name",
            "description": "Why go there? (Short reason)",
            "type": "sightseeing/food/cafe/shopping",
            "location": "Spot Location",
            "cost": 150
        }
        Language: Traditional Chinese.
    `;
    try {
        const text = await callGeminiDirectly(prompt);
        return parseJSON<Activity>(text);
    } catch (e) { return null; }
};

// ==========================================================
// 4.（已移除）AI 辨識收據
//   🗑️ 2026-08-14 資安批刪除：零呼叫端的死碼。曾讓外部稽核誤判「收據會被送去 Google」——
//   死碼的第一個受害者是每一個讀程式碼的人。日後做分帳收據辨識時從 git 歷史撿回，
//   並在**那時**一併補：隱私政策揭露＋影像大小上限＋輸出範圍檢查（金額為正、幣別白名單）。
// ==========================================================

// ==========================================================
// 5. 匯率查詢 & 其他工具
// ==========================================================
const fetchRealTimeRate = async (from: string, to: string): Promise<number | null> => {
    try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
        const data = await res.json();
        return data.rates[to] || null;
    } catch (e) { return null; }
};

export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   const realRate = await fetchRealTimeRate(from, to);
   if (realRate !== null) {
       const total = (amount * realRate).toLocaleString(undefined, { maximumFractionDigits: 0 });
       return ` ${total} ${to}`; 
   }
   return fetchWithCache(`rate_${from}_${to}_${amount}`, async () => {
       try {
        const prompt = `Exchange rate: ${amount} ${from} to ${to}. Output format: " X ${to}" (number only).`;
        const text = await callGeminiDirectly(prompt);
        return text.trim();
      } catch (error) { return "無法取得匯率"; }
   }, CACHE_TTL.CURRENCY);
}

export const translateText = async (text: string, targetLang: string): Promise<string> => {
  const cacheKey = `trans_${text.substring(0, 30)}_${targetLang}`;
  return fetchWithCache(cacheKey, async () => {
      try {
        const prompt = `Translate to ${targetLang}: "${text}". Only output the translated text.`;
        return await callGeminiDirectly(prompt);
      } catch (error) { return "翻譯暫時無法使用"; }
  }, 1440);
};

export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  return fetchWithCache(`emergency_${location}`, async () => {
      try {
        const prompt = `List emergency numbers for ${location} (Police, Ambulance). Traditional Chinese.`;
        return await callGeminiDirectly(prompt);
      } catch (error) { return "暫無資訊"; }
  }, CACHE_TTL.STATIC_INFO);
}

export const getPlugInfo = async (country: string): Promise<VoltageInfo | null> => {
  return fetchWithCache(`plug_${country}`, async () => {
      try {
        const prompt = `Return JSON: { "country": "${country}", "voltage": "220V", "frequency": "60Hz", "plugTypes": ["A", "B"], "description": "Info" }`;
        const text = await callGeminiDirectly(prompt);
        return parseJSON<VoltageInfo>(text);
    } catch (error) { return null; }
  }, CACHE_TTL.STATIC_INFO);
}

export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  return fetchWithCache(`weather_${location}`, async () => {
      try {
        const res = await callProxy('weather', { location });
        const data = res.data;
        if (!data) return null;
        return {
          location: data.location.name,
          temperature: `${Math.round(data.current.temp_c)}°C`,
          condition: data.current.condition.text,
          humidity: `${data.current.humidity}%`,
          wind: `${data.current.wind_kph} km/h`,
          description: `體感 ${data.current.feelslike_c}°C`,
          clothingSuggestion: "建議穿著舒適衣物",
          activityTip: "適合戶外走走",
          sunrise: data.forecast.forecastday[0].astro.sunrise,
          sunset: data.forecast.forecastday[0].astro.sunset,
          uvIndex: String(data.current.uv),
          hourly: []
        };
      } catch (error) { return null; }
  }, CACHE_TTL.WEATHER);
};

export const getTimezone = async (location: string): Promise<string | null> => {
    return fetchWithCache(`timezone_${location}`, async () => {
        try {
            const res = await callProxy('timezone', { location });
            if (res?.data?.location?.tz_id) return res.data.location.tz_id;
        } catch { /* 靜默 */ }
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }, CACHE_TTL.TIMEZONE);
}