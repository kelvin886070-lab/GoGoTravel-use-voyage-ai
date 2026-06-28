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
