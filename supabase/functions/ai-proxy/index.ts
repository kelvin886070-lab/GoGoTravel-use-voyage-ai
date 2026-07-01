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
