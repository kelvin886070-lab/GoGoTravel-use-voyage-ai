// supabase/functions/ai-proxy/index.ts
// ============================================================
// AI / 外部 API 代理 (Edge Function)
//   - 金鑰只存在伺服器端 (Supabase Secrets)，前端永遠拿不到
//   - 僅放行「已登入」的使用者 (驗證 JWT)，防止端點被匿名濫用
//   - 收編：Gemini 文字、Gemini Vision、天氣、時區
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY") ?? "";
const WEATHER_KEY = Deno.env.get("WEATHER_KEY") ?? "";
const GOOGLE_GEOCODING_KEY = Deno.env.get("GOOGLE_GEOCODING_KEY") ?? "";
const GEOCODE_DAILY_LIMIT = 200; // 每使用者每日「新」geocode 上限（快取命中不計費、不計數）

// service role client：專門讀寫快取表與用量表（繞過 RLS，前端永遠碰不到這些表）
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// CORS：目前先放寬，上線後請收斂成你的網域 (見部署說明)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // 預檢請求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1️⃣ 驗證使用者 JWT —— 只有登入過的人能用這個代理
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "缺少 Authorization 標頭" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "未授權 (請先登入)" }, 401);

    // 2️⃣ 路由
    const { action, payload } = await req.json();
    switch (action) {
      case "gemini-text":
        return json(await geminiText(payload));
      case "gemini-vision":
        return json(await geminiVision(payload));
      case "weather":
        return json(await weather(payload));
      case "timezone":
        return json(await timezone(payload));
      case "geocode":
        return json(await geocode(payload, user.id));
      case "findplace":
        return json(await findplace(payload, user.id));
      case "geo-benchmark":
        return json(await geoBenchmark(payload));
      case "resolve-place":
        return json(await resolvePlace(payload, user.id));
      case "resolve-maps-url":
        return json(await resolveMapsUrl(payload));
      case "directions":
        return json(await directions(payload, user.id));
      case "place-search":
        return json(await placeSearch(payload, user.id));
      case "place-details":
        return json(await placeDetails(payload, user.id));
      case "place-lookup":
        return json(await placeLookup(payload, user.id));
      case "cover-photo":
        return json(await coverPhoto(payload, user.id));
      case "destination-intel":
        return json(await destinationIntel(payload, user.id));
      default:
        return json({ error: `未知的 action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});

// ---------- 目的地情報（destination-intel）----------
// 生成表單重設計的資料管線：一次呼叫餵飽入口/縮圈/什麼時候/講究四頁。
//   成本模型：**全域快取**（cached_destination_intel，TTL 35 天）——同一查詢全體使用者共用，
//   第二次起零 LLM 成本；未命中才呼叫 Gemini 並計入每日限額（防有人用亂字串刷 API）。
//   失敗策略：任何錯誤回 { intel: null }，前端有各自退位（通用標籤／不擋輸入）。
const DEST_INTEL_TTL_DAYS = 35;

function parseJsonLoose<T>(text: string): T | null {
  if (!text) return null;
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(clean.slice(s, e + 1)) as T;
  } catch {
    return null;
  }
}

async function destinationIntel(
  payload: { query?: string },
  userId: string,
) {
  const raw = (payload.query || "").trim();
  // 前端已擋 <2 字元；後端再擋一次（省錢的第一道門）
  if (raw.length < 2) return { intel: null };
  const key = raw.toLowerCase().replace(/\s+/g, "");

  // 1) 全域快取（命中＝免費、不計數）
  const { data: cached } = await admin
    .from("cached_destination_intel")
    .select("data, created_at")
    .eq("query", key)
    .maybeSingle();
  if (cached) {
    const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86400000;
    if (ageDays < DEST_INTEL_TTL_DAYS) return { intel: cached.data, cached: true };
  }

  // 2) 未命中：計入每日限額後才呼叫 LLM
  if ((await bumpDailyOrLimit(userId)).limited) return { intel: null, limited: true };

  const prompt = `你是旅遊資料庫。分析使用者輸入的目的地「${raw}」，只回傳 JSON（不要說明文字、不要 markdown）。

規則：
- granularity：country（國家）／region（區域或州省，如「關西」「北海道」「加州」）／city（城市或明確地點）／unknown（無法辨識）
- **嚴格判定 unknown**：若輸入不是真實地名（隨手打的字、一句話、無意義字串、人名、商品名），granularity **必須** 回 unknown——**不要勉強猜成某個地方**；suggestions 給最接近的真實地名（最多 3 個），完全無法聯想時給空陣列
- **寧可說不知道**：只要你無法確定這個地方**真實存在於地圖上**，就回 unknown。猜錯的代價遠高於承認不知道
- granularity 不是 unknown 時，**country 必填**且必須是合法的 ISO 3166-1 alpha-2 兩碼國碼；連國家都無法確定，代表你其實不認識這個地方——請改回 unknown
- 所有中文顯示名用繁體中文；不要使用 emoji
- unknown 時：只需回 granularity 與 suggestions（最多 3 個最可能的目的地中文名）
- zones 只在 granularity 為 country 或 region 時提供，**6–8 組**；每組是「地帶」不是套裝路線（用地理範圍命名，例：「關西 · 大阪與京都」），reason 一句話（12–18 字，正面措辭，例「美食比例高」而非「吃的比重高」），tags 為該地帶 2–3 個特徵標籤
- tags：該目的地 8–10 個「玩法」標籤，名詞短語（例：市場與小吃、工藝與選物、庭園）
- nearby：3–5 個**同一個國家內**的城市中文名（**絕不可跨國**）——granularity 為 country/region 時給該國/該區最值得去的城市；為 city 時給鄰近可順遊的城市
- seasons：12 個月的一句話註記（**8–14 字**，描述當月最值得的景象或氣候）

JSON 結構：
{"granularity":"country|region|city|unknown","name":"正規中文名","nameEn":"English name","country":"ISO 3166-1 alpha-2 國碼","cityEn":"主要城市英文名(city 時給該城；其他給代表城市)","currency":"ISO 4217","zones":[{"name":"","en":"","cities":[""],"reason":"","tags":[""]}],"tags":[""],"nearby":[""],"seasons":{"1":"","2":"","3":"","4":"","5":"","6":"","7":"","8":"","9":"","10":"","11":"","12":""},"suggestions":[""]}`;

  // jsonMode（含關閉 thinking）＋放寬 token：兩者缺一都會讓長 JSON 拿不到內容
  const res = await geminiText({ prompt, jsonMode: true, maxOutputTokens: 8192 });
  if ("error" in res && res.error) {
    console.error("[destination-intel] gemini error", raw, res.error);
    return { intel: null, error: res.error };
  }
  const text = (res as { text?: string }).text || "";
  const finishReason = (res as { finishReason?: string }).finishReason ?? null;
  const intel = parseJsonLoose<Record<string, unknown>>(text);
  if (!intel || !intel.granularity) {
    // 診斷寫進 Edge Function 日誌（Dashboard → Edge Functions → ai-proxy → Logs）
    console.error("[destination-intel] parse failed", { query: raw, finishReason, len: text.length, head: text.slice(0, 200) });
    return { intel: null, reason: "parse", finishReason, len: text.length };
  }
  console.log("[destination-intel] ok", { query: raw, g: intel.granularity, nearby: (intel.nearby as string[] | undefined)?.length ?? 0 });

  // 3) 寫入全域快取（unknown 也存——避免同一個錯字反覆打 LLM）
  await admin.from("cached_destination_intel").upsert({
    query: key,
    data: intel,
    created_at: new Date().toISOString(),
  });
  return { intel, cached: false };
}

// ---------- Gemini 文字 ----------
async function geminiText(
  { prompt, model = "gemini-3.5-flash-lite", jsonMode, maxOutputTokens }: {
    prompt: string;
    model?: string;
    jsonMode?: boolean;        // 要求純 JSON 輸出（避免 markdown 包裹）
    maxOutputTokens?: number;  // 長 JSON 必須放寬，否則被截斷 → 解析失敗
  },
) {
  if (!GEMINI_KEY) return { error: "伺服器未設定 GEMINI_KEY" };
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const generationConfig: Record<string, unknown> = {};
  if (jsonMode) generationConfig.responseMimeType = "application/json";
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  // ⚠️ flash-lite 屬「思考型」模型：不關掉 thinking，輸出額度會被思考過程吃光、text 回空字串
  //    （destination-intel 全數失敗、快取表零列的真因）。結構化任務不需要 thinking。
  if (jsonMode) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message ?? `Gemini 錯誤 ${res.status}` };
  }
  const cand = data.candidates?.[0];
  // 有些回應把內容切成多段 parts；只取 [0] 會漏字 → 全部串起來
  const text = (cand?.content?.parts || []).map((x: { text?: string }) => x?.text || "").join("") || "";
  return { text, finishReason: cand?.finishReason ?? null };
}

// ---------- Gemini Vision ----------
async function geminiVision(
  { prompt, base64Image, model = "gemini-3.5-flash-lite" }: {
    prompt: string;
    base64Image: string;
    model?: string;
  },
) {
  if (!GEMINI_KEY) return { error: "伺服器未設定 GEMINI_KEY" };
  const clean = base64Image.replace(
    /^data:image\/(png|jpeg|jpg|webp|heic);base64,/,
    "",
  );
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: clean } },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message ?? `Vision 錯誤 ${res.status}` };
  }
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
}

// ---------- 天氣 ----------
async function weather({ location }: { location: string }) {
  if (!WEATHER_KEY) return { error: "伺服器未設定 WEATHER_KEY" };
  const url =
    `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_KEY}&q=${
      encodeURIComponent(location)
    }&days=1&aqi=no&alerts=no&lang=zh_tw`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) return { error: "天氣 API 失敗" };
  return { data };
}

// ---------- 時區 ----------
async function timezone({ location }: { location: string }) {
  if (!WEATHER_KEY) return { error: "伺服器未設定 WEATHER_KEY" };
  const url = `https://api.weatherapi.com/v1/timezone.json?key=${WEATHER_KEY}&q=${
    encodeURIComponent(location)
  }`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) return { error: "時區 API 失敗" };
  return { data };
}

// ---------- Geocoding（名稱 → 座標）----------
// 三道防線：全域快取(cached_locations) + 每使用者每日限額(geocode_usage) + 只有此代理能呼叫 Google
function normalizeQuery(location: string, context?: string): string {
  return `${location.trim()}${context ? "|" + context.trim() : ""}`.toLowerCase();
}

async function geocodeOne(
  query: string,
): Promise<{ lat: number; lng: number; placeId?: string } | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${
    encodeURIComponent(query)
  }&key=${GOOGLE_GEOCODING_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "OK" && data.results?.[0]) {
    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      placeId: r.place_id,
    };
  }
  return null;
}

// payload: { items: [{ location: "識名園", context: "沖繩" }, ...] }
// 回傳 { results: { "識名園": {lat,lng,placeId} | null, ... } }
async function geocode(
  payload: { items?: { location: string; context?: string }[] },
  userId: string,
) {
  const items = (payload.items || []).slice(0, 100).filter((it) => it?.location);
  const keyed = items.map((it) => ({
    raw: it.location,
    key: normalizeQuery(it.location, it.context),
  }));
  const results: Record<string, { lat: number; lng: number; placeId?: string } | null> = {};

  // 1) 批次查快取
  const keys = [...new Set(keyed.map((k) => k.key))];
  const { data: cachedRows } = await admin
    .from("cached_locations")
    .select("query,lat,lng,place_id")
    .in("query", keys);
  const cacheMap = new Map((cachedRows || []).map((r: any) => [r.query, r]));

  const missKeyed: { raw: string; key: string }[] = [];
  for (const k of keyed) {
    const c = cacheMap.get(k.key);
    if (c) results[k.raw] = { lat: c.lat, lng: c.lng, placeId: c.place_id };
    else missKeyed.push(k);
  }

  // 2) 去重 miss；查今日用量、算剩餘額度
  const uniqueMiss = [...new Map(missKeyed.map((m) => [m.key, m])).values()];
  if (uniqueMiss.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("geocode_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    const used = usage?.count ?? 0;
    const remaining = Math.max(0, GEOCODE_DAILY_LIMIT - used);
    const toDo = uniqueMiss.slice(0, remaining);
    const skipped = uniqueMiss.slice(remaining);

    // 3) 並行呼叫 Google，寫回快取
    const geos = await Promise.all(toDo.map((m) => geocodeOne(m.key)));
    const upserts: any[] = [];
    let newCount = 0;
    toDo.forEach((m, i) => {
      const geo = geos[i];
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => {
        results[mk.raw] = geo;
      });
      if (geo) {
        upserts.push({ query: m.key, lat: geo.lat, lng: geo.lng, place_id: geo.placeId });
        newCount++;
      }
    });
    // 超過每日額度的：回 null（地圖略過），不呼叫 Google
    skipped.forEach((m) => {
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => {
        results[mk.raw] = null;
      });
    });

    if (upserts.length) await admin.from("cached_locations").upsert(upserts);
    if (newCount) {
      await admin.from("geocode_usage").upsert({
        user_id: userId,
        day: today,
        count: used + newCount,
      });
    }
  }

  return { results };
}

// ---------- Find Place（Places API New：用名字找 POI，準度遠勝 Geocoding）----------
// T1 核心 + 稽核權威來源。回傳含 lowConfidence 旗標（嚴格：低信心 → 前端標「位置待確認」）。
const PLACES_AMBIGUOUS_KM = 2; // 前二候選相距 > 此值 → 視為模糊

function havKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180;
  const la1 = aLat * Math.PI / 180, la2 = bLat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface PlaceHit {
  lat: number; lng: number; placeId?: string;
  name?: string; formattedAddress?: string;
  lowConfidence: boolean; candidates: number;
}

async function findPlaceOne(query: string, context?: string, bias?: Bias): Promise<PlaceHit | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const textQuery = context ? `${query} ${context}` : query;
  const body: Record<string, unknown> = { textQuery, languageCode: "zh-TW", maxResultCount: 3 };
  // 🧭 座標偏置：以 bias 為中心 50km 圓當 locationBias（軟偏置）
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_GEOCODING_KEY,
      "X-Goog-FieldMask":
        "places.id,places.location,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const places = data.places || [];
  if (!places.length) return null;
  const top = places[0];
  const lat = top.location?.latitude, lng = top.location?.longitude;
  if (lat == null || lng == null) return null;

  let lowConfidence = false;
  // (1) 多候選且前二相距過遠 → 模糊
  if (places.length > 1 && places[1].location) {
    const d = havKm(lat, lng, places[1].location.latitude, places[1].location.longitude);
    if (d > PLACES_AMBIGUOUS_KM) lowConfidence = true;
  }
  // (2) 使用者給的城市/地區未出現在回傳地址 → 疑似不符
  if (context) {
    const addr = (top.formattedAddress || "").toLowerCase();
    const toks = context.toLowerCase().split(/[\s,、，]+/).filter(Boolean);
    if (toks.length && !toks.some((t: string) => addr.includes(t))) lowConfidence = true;
  }
  return {
    lat, lng, placeId: top.id,
    name: top.displayName?.text, formattedAddress: top.formattedAddress,
    lowConfidence, candidates: places.length,
  };
}

// payload: { items: [{ location, context? }] } → { results: { [location]: PlaceHit | null } }
// 快取用 "place:" 前綴 key，與 geocode 分流不衝突；沿用每日限額。
async function findplace(
  payload: { items?: { location: string; context?: string }[] },
  userId: string,
) {
  const items = (payload.items || []).slice(0, 100).filter((it) => it?.location);
  const keyed = items.map((it) => ({
    raw: it.location,
    context: it.context,
    key: "place:" + normalizeQuery(it.location, it.context),
  }));
  const results: Record<string, (PlaceHit & { cached?: boolean }) | null> = {};

  const keys = [...new Set(keyed.map((k) => k.key))];
  const { data: cachedRows } = await admin
    .from("cached_locations")
    .select("query,lat,lng,place_id")
    .in("query", keys);
  const cacheMap = new Map((cachedRows || []).map((r: any) => [r.query, r]));

  const missKeyed: { raw: string; context?: string; key: string }[] = [];
  for (const k of keyed) {
    const c = cacheMap.get(k.key);
    if (c) {
      // 快取命中只存座標，信心視為已接受（lowConfidence=false）
      results[k.raw] = { lat: c.lat, lng: c.lng, placeId: c.place_id, lowConfidence: false, candidates: 1, cached: true };
    } else missKeyed.push(k);
  }

  const uniqueMiss = [...new Map(missKeyed.map((m) => [m.key, m])).values()];
  if (uniqueMiss.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("geocode_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    const used = usage?.count ?? 0;
    const remaining = Math.max(0, GEOCODE_DAILY_LIMIT - used);
    const toDo = uniqueMiss.slice(0, remaining);
    const skipped = uniqueMiss.slice(remaining);

    const found = await Promise.all(toDo.map((m) => findPlaceOne(m.raw, m.context)));
    const upserts: any[] = [];
    let newCount = 0;
    toDo.forEach((m, i) => {
      const f = found[i];
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => { results[mk.raw] = f; });
      if (f) {
        upserts.push({ query: m.key, lat: f.lat, lng: f.lng, place_id: f.placeId });
        newCount++;
      }
    });
    skipped.forEach((m) => {
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => { results[mk.raw] = null; });
    });

    if (upserts.length) await admin.from("cached_locations").upsert(upserts);
    if (newCount) {
      await admin.from("geocode_usage").upsert({ user_id: userId, day: today, count: used + newCount });
    }
  }

  return { results };
}

// ---------- Place Search（Text Search 回清單，供 D2 typeahead）----------
// 快取：cached_searches(jsonb) TTL 7 天，命中免費；限額：計入 geocode_usage（共享 spend budget，防濫用）。
const SEARCH_CACHE_TTL_DAYS = 7;
const SEARCH_MAX_RESULTS = 8;

interface PlaceSearchResult {
  placeId?: string; name: string; address: string; lat: number; lng: number;
}

async function placeSearchGoogle(query: string, bias?: { lat: number; lng: number }, pageToken?: string): Promise<{ results: PlaceSearchResult[]; nextPageToken?: string }> {
  if (!GOOGLE_GEOCODING_KEY) return { results: [] };
  // ⚠️ Places API (New)：要拿 nextPageToken 必須用 pageSize（不是 maxResultCount，後者不給分頁 token）
  const body: Record<string, unknown> = { textQuery: query, languageCode: "zh-TW", pageSize: SEARCH_MAX_RESULTS };
  // 城市座標軟偏置（30km 圓）；那天的城市中心傳進來
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 30000 } };
  if (pageToken) body.pageToken = pageToken;   // 「更多結果」分頁
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_GEOCODING_KEY,
      // 與 findplace 同一組地點欄位（同 SKU，控成本）；加 nextPageToken（回應層欄位，供分頁）
      "X-Goog-FieldMask": "places.id,places.location,places.displayName,places.formattedAddress,nextPageToken",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { results: [] };
  const data = await res.json();
  const places = data.places || [];
  const results = places
    .filter((p: any) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p: any) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      lat: p.location.latitude,
      lng: p.location.longitude,
    }));
  return { results, nextPageToken: data.nextPageToken };
}

// ── 🖼️ 封面B：目的地嚮往照（Pexels）─────────────────────────────
// 金鑰只在 server env（PEXELS_KEY），客戶端永遠拿不到；$0 免費方案（見 docs/成本記錄與估算.md §3.6）。
// 一趟一張：前端拿到 URL 後存進 trip_data，之後不再呼叫。共用每日限額（防濫打）。
// 寧素勿錯：查無、非橫幅、任何失敗 → url: null，前端維持深色 fallback。
const PEXELS_KEY = Deno.env.get("PEXELS_KEY") ?? "";

async function coverPhoto(payload: { query?: string }, userId: string) {
  const query = (payload?.query || "").trim();
  if (!PEXELS_KEY) return { url: null, error: "PEXELS_KEY 未設定" };
  if (query.length < 2 || query.length > 80) return { url: null };
  if ((await bumpDailyOrLimit(userId)).limited) return { url: null, limited: true };
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    if (!res.ok) return { url: null };
    const data = await res.json();
    const photos: Array<{ width: number; height: number; src?: { landscape?: string; large2x?: string } }> =
      Array.isArray(data?.photos) ? data.photos : [];
    // 擇圖：第一張「確實橫幅」且有可用尺寸者（Pexels 偶爾混入直幅）
    const hit = photos.find(p => p.width > p.height && (p.src?.landscape || p.src?.large2x));
    return { url: hit?.src?.landscape || hit?.src?.large2x || null };
  } catch {
    return { url: null };
  }
}

// 每日限額檢查＋計數（與 geocode 共享 spend budget）
async function bumpDailyOrLimit(userId: string): Promise<{ limited: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin
    .from("geocode_usage").select("count").eq("user_id", userId).eq("day", today).maybeSingle();
  const used = usage?.count ?? 0;
  if (used >= GEOCODE_DAILY_LIMIT) return { limited: true };
  await admin.from("geocode_usage").upsert({ user_id: userId, day: today, count: used + 1 });
  return { limited: false };
}

// payload: { query, bias? } → { results: PlaceSearchResult[] }
async function placeSearch(
  payload: { query?: string; bias?: { lat: number; lng: number }; pageToken?: string },
  userId: string,
) {
  const query = (payload.query || "").trim();
  if (query.length < 2) return { results: [] };
  const bias = payload.bias;
  const pageToken = payload.pageToken;

  // 「更多結果」分頁：token 會過期→不走快取；仍計入限額
  if (pageToken) {
    if ((await bumpDailyOrLimit(userId)).limited) return { results: [], limited: true };
    return await placeSearchGoogle(query, bias, pageToken);
  }

  // 第一頁：走快取（存 { items, nextPageToken }；相容舊陣列格式）
  const biasKey = bias ? `@${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : "";
  const cacheKey = `search:${query.toLowerCase()}${biasKey}`;
  const { data: cached } = await admin
    .from("cached_searches").select("results, created_at").eq("query", cacheKey).maybeSingle();
  if (cached) {
    const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86400000;
    if (ageDays < SEARCH_CACHE_TTL_DAYS) {
      const c = cached.results;
      if (Array.isArray(c)) return { results: c, cached: true };
      return { results: c.items ?? [], nextPageToken: c.nextPageToken, cached: true };
    }
  }

  if ((await bumpDailyOrLimit(userId)).limited) return { results: [], limited: true };
  const { results, nextPageToken } = await placeSearchGoogle(query, bias);
  await admin.from("cached_searches").upsert({ query: cacheKey, results: { items: results, nextPageToken }, created_at: new Date().toISOString() });
  return { results, nextPageToken };
}

// ---------- Place Details（D2② 評分，方案A）----------
// 只在「存進心願盒/開地點細節」時查一次。FieldMask 僅取 id/rating/userRatingCount/displayName，
// 避開最貴的 openingHours（Atmosphere SKU）。快取 cached_place_details（TTL 30 天，評分變動慢）；
// 命中免費不計數，未命中才 bumpDailyOrLimit（共用 200/日硬限額）。placeId 快取＝同地點不重打。
const DETAILS_CACHE_TTL_DAYS = 30;
interface PlaceDetailsResult { placeId: string; rating?: number; ratingCount?: number; name?: string; }

async function placeDetailsGoogle(placeId: string): Promise<PlaceDetailsResult | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=zh-TW`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_GEOCODING_KEY,
        "X-Goog-FieldMask": "id,rating,userRatingCount,displayName",
      },
    },
  );
  if (!res.ok) return null;
  const p = await res.json();
  return {
    placeId: p.id ?? placeId,
    rating: typeof p.rating === "number" ? p.rating : undefined,
    ratingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
    name: p.displayName?.text,
  };
}

// payload: { placeId } → { details: PlaceDetailsResult | null }
async function placeDetails(payload: { placeId?: string }, userId: string) {
  const placeId = (payload.placeId || "").trim();
  if (!placeId) return { details: null };

  // 1) 快取（TTL 30 天）
  const { data: cached } = await admin
    .from("cached_place_details").select("data, created_at").eq("place_id", placeId).maybeSingle();
  if (cached) {
    const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86400000;
    if (ageDays < DETAILS_CACHE_TTL_DAYS) return { details: cached.data, cached: true };
  }

  // 2) 未命中 → 計入每日限額
  if ((await bumpDailyOrLimit(userId)).limited) return { details: null, limited: true };
  const details = await placeDetailsGoogle(placeId);
  if (details) {
    await admin.from("cached_place_details").upsert({
      place_id: placeId, data: details, created_at: new Date().toISOString(),
    });
  }
  return { details };
}

// ---------- Place Lookup（D2②-A：匯入/存檔時，用名稱＋座標偏置一次拿回 placeId＋評分）----------
// 針對「有座標但沒 placeId」的地點（貼連結匯入常見）。Text Search top-1，FieldMask 帶 rating。
// 命中就順手寫進 cached_place_details → 之後 fetchPlaceDetails 免費命中。計入每日限額。
interface PlaceLookupHit extends PlaceDetailsResult { lat?: number; lng?: number; }

async function placeLookupGoogle(query: string, bias?: { lat: number; lng: number }): Promise<PlaceLookupHit | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const body: Record<string, unknown> = { textQuery: query, languageCode: "zh-TW", pageSize: 1 };
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 20000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_GEOCODING_KEY,
      "X-Goog-FieldMask": "places.id,places.location,places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = (data.places || [])[0];
  if (!p?.id) return null;
  return {
    placeId: p.id,
    name: p.displayName?.text,
    rating: typeof p.rating === "number" ? p.rating : undefined,
    ratingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  };
}

// payload: { query, bias? } → { match: PlaceLookupHit | null }
async function placeLookup(payload: { query?: string; bias?: { lat: number; lng: number } }, userId: string) {
  const query = (payload.query || "").trim();
  if (query.length < 2) return { match: null };
  if ((await bumpDailyOrLimit(userId)).limited) return { match: null, limited: true };
  const m = await placeLookupGoogle(query, payload.bias);
  if (m?.placeId) {
    await admin.from("cached_place_details").upsert({
      place_id: m.placeId,
      data: { placeId: m.placeId, rating: m.rating, ratingCount: m.ratingCount, name: m.name },
      created_at: new Date().toISOString(),
    });
  }
  return { match: m };
}

// ---------- Geo Benchmark（對抗式稽核專用；不寫快取、不佔額度）----------
// 對同一批「弄髒」的查詢，同時跑 Geocoding（含信心欄位）與 Places，方便並排比較。
// ⚠️ 診斷用途，會直接花 Google 費用；僅限已登入者、每次最多 120 筆。
interface GeoAuditHit {
  lat: number; lng: number; placeId?: string;
  locationType?: string; partialMatch?: boolean; formattedAddress?: string;
}

type Bias = { lat: number; lng: number };

async function geocodeAuditOne(query: string, context?: string, bias?: Bias): Promise<GeoAuditHit | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const address = context ? `${query} ${context}` : query;
  // 🧭 座標偏置：以 bias 為中心畫 ±0.45° 視窗當 bounds（軟偏置，非硬過濾）
  const boundsParam = bias
    ? `&bounds=${(bias.lat - 0.45).toFixed(4)},${(bias.lng - 0.45).toFixed(4)}|${(bias.lat + 0.45).toFixed(4)},${(bias.lng + 0.45).toFixed(4)}`
    : "";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${
    encodeURIComponent(address)
  }&language=zh-TW${boundsParam}&key=${GOOGLE_GEOCODING_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === "OK" && data.results?.[0]) {
    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      placeId: r.place_id,
      locationType: r.geometry.location_type,   // ROOFTOP / RANGE_INTERPOLATED / GEOMETRIC_CENTER / APPROXIMATE
      partialMatch: !!r.partial_match,
      formattedAddress: r.formatted_address,
    };
  }
  return null;
}

async function geoBenchmark(
  payload: { items?: { key?: string; location: string; context?: string }[] },
) {
  const items = (payload.items || []).slice(0, 120).filter((it) => it?.location);
  const out: Record<string, { geocoding: GeoAuditHit | null; places: PlaceHit | null }> = {};
  await Promise.all(items.map(async (it) => {
    const [g, p] = await Promise.all([
      geocodeAuditOne(it.location, it.context),
      findPlaceOne(it.location, it.context),
    ]);
    out[it.key ?? it.location] = { geocoding: g, places: p };
  }));
  return { results: out };
}

// ---------- Resolve Place（T1 正式 cascade：Geocoding 主 → 弱信心才升級 Places）----------
// 數據結論：Geocoding 打錯必回 APPROXIMATE（0 靜默失敗）→ 用 location_type 當閘門，只在真的弱時才花 Places 錢。
//   ROOFTOP / RANGE_INTERPOLATED → 直接信任 Geocoding
//   APPROXIMATE / GEOMETRIC_CENTER / null → 升級 Places；Places 低信心或仍無 → needsConfirm=true（前端標「位置待確認」）
interface ResolveResult {
  lat: number; lng: number; placeId?: string;
  source: "geocode" | "places"; needsConfirm: boolean;
}

const STRONG_GEOCODE = new Set(["ROOFTOP", "RANGE_INTERPOLATED"]);

async function resolvePlaceOne(query: string, context?: string, bias?: Bias): Promise<ResolveResult | null> {
  const g = await geocodeAuditOne(query, context, bias);
  if (g && g.locationType && STRONG_GEOCODE.has(g.locationType)) {
    return { lat: g.lat, lng: g.lng, placeId: g.placeId, source: "geocode", needsConfirm: false };
  }
  // 弱信心 → 升級 Places
  const p = await findPlaceOne(query, context, bias);
  if (p) {
    return { lat: p.lat, lng: p.lng, placeId: p.placeId, source: "places", needsConfirm: p.lowConfidence };
  }
  // Places 也無 → 退回 Geocoding 的弱結果，但標待確認
  if (g) {
    return { lat: g.lat, lng: g.lng, placeId: g.placeId, source: "geocode", needsConfirm: true };
  }
  return null;
}

// payload: { items: [{ location, context? }] } → { results: { [location]: ResolveResult | null } }
// 快取用 "resolve:" 前綴（存已接受的最終座標）；沿用每日限額（每筆新查詢 +1）。
async function resolvePlace(
  payload: { items?: { location: string; context?: string; bias?: Bias }[] },
  userId: string,
) {
  const items = (payload.items || []).slice(0, 100).filter((it) => it?.location);
  const biasTag = (b?: Bias) => (b ? `@${b.lat.toFixed(2)},${b.lng.toFixed(2)}` : "");
  const keyed = items.map((it) => ({
    raw: it.location,
    context: it.context,
    bias: it.bias,
    // 偏置會改變結果 → 併入快取 key，避免拿到未偏置的舊錯座標
    key: "resolve:" + normalizeQuery(it.location, it.context) + biasTag(it.bias),
  }));
  const results: Record<string, ResolveResult | null> = {};

  const keys = [...new Set(keyed.map((k) => k.key))];
  const { data: cachedRows } = await admin
    .from("cached_locations")
    .select("query,lat,lng,place_id")
    .in("query", keys);
  const cacheMap = new Map((cachedRows || []).map((r: any) => [r.query, r]));

  const missKeyed: { raw: string; context?: string; bias?: Bias; key: string }[] = [];
  for (const k of keyed) {
    const c = cacheMap.get(k.key);
    // 快取命中＝先前已接受的座標，needsConfirm=false
    if (c) results[k.raw] = { lat: c.lat, lng: c.lng, placeId: c.place_id, source: "geocode", needsConfirm: false };
    else missKeyed.push(k);
  }

  const uniqueMiss = [...new Map(missKeyed.map((m) => [m.key, m])).values()];
  if (uniqueMiss.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("geocode_usage").select("count")
      .eq("user_id", userId).eq("day", today).maybeSingle();
    const used = usage?.count ?? 0;
    const remaining = Math.max(0, GEOCODE_DAILY_LIMIT - used);
    const toDo = uniqueMiss.slice(0, remaining);
    const skipped = uniqueMiss.slice(remaining);

    const resolved = await Promise.all(toDo.map((m) => resolvePlaceOne(m.raw, m.context, m.bias)));
    const upserts: any[] = [];
    let newCount = 0;
    toDo.forEach((m, i) => {
      const r = resolved[i];
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => { results[mk.raw] = r; });
      // 只快取「不需確認」的結果，避免把可疑座標固化
      if (r && !r.needsConfirm) {
        upserts.push({ query: m.key, lat: r.lat, lng: r.lng, place_id: r.placeId });
      }
      if (r) newCount++;
    });
    skipped.forEach((m) => {
      missKeyed.filter((mk) => mk.key === m.key).forEach((mk) => { results[mk.raw] = null; });
    });

    if (upserts.length) await admin.from("cached_locations").upsert(upserts);
    if (newCount) {
      await admin.from("geocode_usage").upsert({ user_id: userId, day: today, count: used + newCount });
    }
  }

  return { results };
}

// ---------- Resolve Maps URL（T0：短網址還原 → 抽座標）----------
// 短網址（maps.app.goo.gl / goo.gl/maps）本身無座標，跟隨轉址取得完整網址後再抽。
function coordsFromString(s: string): { lat: number; lng: number } | null {
  if (!s) return null;
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (!m) m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const decodeContinue = (u: string): string | null => {
  const m = u.match(/[?&](?:continue|url|q)=([^&]+)/);
  try { return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
};

async function resolveMapsUrl(payload: { url?: string }) {
  const url = (payload.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return { coords: null };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        // 用桌機瀏覽器 UA + zh-TW，降低被導到同意頁/精簡頁的機率
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });
    // 1) 還原後最終網址 2) 同意頁的 continue= 真網址 3) 網頁內容
    let coords = coordsFromString(res.url);
    if (!coords) { const cont = decodeContinue(res.url); if (cont) coords = coordsFromString(cont); }
    if (!coords) {
      const body = await res.text();
      coords = coordsFromString(body);
    }
    return { coords, finalUrl: res.url };
  } catch (_e) {
    return { coords: null };
  }
}

// ---------- Directions（沿道路的路線）----------
// payload: { coords: [{lat,lng}, ...] } → 回傳 { polyline: 編碼折線 | null }
// 快取(cached_routes) + 每日限額共用；失敗回 null，前端退回直線
async function directions(
  payload: { coords?: { lat: number; lng: number }[] },
  userId: string,
) {
  const coords = (payload.coords || []).filter(
    (c) => c && typeof c.lat === "number" && typeof c.lng === "number",
  );
  if (coords.length < 2) return { polyline: null };

  const key = coords.map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join(";");

  // 1) 查路線快取
  const { data: cached } = await admin
    .from("cached_routes")
    .select("polyline")
    .eq("route_key", key)
    .maybeSingle();
  if (cached?.polyline) return { polyline: cached.polyline };

  // 2) 每日限額（與 geocode 共用計數）
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin
    .from("geocode_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  const used = usage?.count ?? 0;
  if (used >= GEOCODE_DAILY_LIMIT) return { polyline: null };

  if (!GOOGLE_GEOCODING_KEY) return { polyline: null };

  // 3) 呼叫 Google Directions
  const origin = `${coords[0].lat},${coords[0].lng}`;
  const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`;
  const waypoints = coords.slice(1, -1).map((c) => `${c.lat},${c.lng}`).join("|");
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""
  }&mode=driving&key=${GOOGLE_GEOCODING_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "OK" && data.routes?.[0]?.overview_polyline?.points) {
    const polyline = data.routes[0].overview_polyline.points;
    await admin.from("cached_routes").upsert({ route_key: key, polyline });
    await admin.from("geocode_usage").upsert({ user_id: userId, day: today, count: used + 1 });
    return { polyline };
  }
  return { polyline: null };
}
