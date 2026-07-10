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
      default:
        return json({ error: `未知的 action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});

// ---------- Gemini 文字 ----------
async function geminiText(
  { prompt, model = "gemini-3.1-flash-lite" }: {
    prompt: string;
    model?: string;
  },
) {
  if (!GEMINI_KEY) return { error: "伺服器未設定 GEMINI_KEY" };
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message ?? `Gemini 錯誤 ${res.status}` };
  }
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
}

// ---------- Gemini Vision ----------
async function geminiVision(
  { prompt, base64Image, model = "gemini-2.5-flash" }: {
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

async function findPlaceOne(query: string, context?: string): Promise<PlaceHit | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const textQuery = context ? `${query} ${context}` : query;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_GEOCODING_KEY,
      "X-Goog-FieldMask":
        "places.id,places.location,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery, languageCode: "zh-TW", maxResultCount: 3 }),
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

// ---------- Geo Benchmark（對抗式稽核專用；不寫快取、不佔額度）----------
// 對同一批「弄髒」的查詢，同時跑 Geocoding（含信心欄位）與 Places，方便並排比較。
// ⚠️ 診斷用途，會直接花 Google 費用；僅限已登入者、每次最多 120 筆。
interface GeoAuditHit {
  lat: number; lng: number; placeId?: string;
  locationType?: string; partialMatch?: boolean; formattedAddress?: string;
}

async function geocodeAuditOne(query: string, context?: string): Promise<GeoAuditHit | null> {
  if (!GOOGLE_GEOCODING_KEY) return null;
  const address = context ? `${query} ${context}` : query;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${
    encodeURIComponent(address)
  }&language=zh-TW&key=${GOOGLE_GEOCODING_KEY}`;
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

async function resolvePlaceOne(query: string, context?: string): Promise<ResolveResult | null> {
  const g = await geocodeAuditOne(query, context);
  if (g && g.locationType && STRONG_GEOCODE.has(g.locationType)) {
    return { lat: g.lat, lng: g.lng, placeId: g.placeId, source: "geocode", needsConfirm: false };
  }
  // 弱信心 → 升級 Places
  const p = await findPlaceOne(query, context);
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
  payload: { items?: { location: string; context?: string }[] },
  userId: string,
) {
  const items = (payload.items || []).slice(0, 100).filter((it) => it?.location);
  const keyed = items.map((it) => ({
    raw: it.location,
    context: it.context,
    key: "resolve:" + normalizeQuery(it.location, it.context),
  }));
  const results: Record<string, ResolveResult | null> = {};

  const keys = [...new Set(keyed.map((k) => k.key))];
  const { data: cachedRows } = await admin
    .from("cached_locations")
    .select("query,lat,lng,place_id")
    .in("query", keys);
  const cacheMap = new Map((cachedRows || []).map((r: any) => [r.query, r]));

  const missKeyed: { raw: string; context?: string; key: string }[] = [];
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

    const resolved = await Promise.all(toDo.map((m) => resolvePlaceOne(m.raw, m.context)));
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
