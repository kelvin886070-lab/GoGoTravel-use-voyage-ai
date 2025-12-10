import type { TripDay, WeatherInfo, VoltageInfo } from "../types";

// 1. 讀取環境變數
const apiKey = (import.meta.env.VITE_API_KEY || '').trim();
const weatherApiKey = (import.meta.env.VITE_WEATHER_API_KEY || '').trim();

if (!apiKey) console.error("Gemini API Key is missing!");

// --- 快取設定 ---
const CACHE_PREFIX = 'kelvin_cache_';
const CACHE_TTL = {
    WEATHER: 30,
    TIMEZONE: 10080,
    CURRENCY: 60, // 匯率快取 60 分鐘
    STATIC_INFO: 1440,
    ITINERARY: 60
};

// ==========================================================
// 核心：純 HTTP 請求函式 (已加入 Console Log)
// ==========================================================
async function callGeminiDirectly(prompt: string): Promise<string> {
    // 定義模型候選名單 (優先順序)
    const candidateModels = [
        "gemini-2.5-flash",       // 最新快速模型
        "gemini-2.0-flash-exp",   // 實驗性模型
        "gemini-1.5-flash",       // 穩定版
        "gemini-1.5-flash-001"    // 備用舊版
    ];

    let lastError = null;

    for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        try {
            // 🚀 Log 1: 顯示正在嘗試的模型
            console.log(`🚀 [Kelvin Trip] 嘗試呼叫模型: ${model}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                // ✅ Log 2: 顯示成功訊息
                console.log(`✅ 成功！模型 ${model} 正常運作。`);
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                const err = await response.json().catch(() => ({}));
                console.warn(`⚠️ 模型 ${model} 失敗:`, err.error?.message || response.status);
                
                if (response.status === 429) {
                    lastError = new Error(`模型 ${model} 額度已滿 (429)`);
                    continue; // 試下一個模型
                }
                lastError = new Error(`模型 ${model} 回傳 ${response.status}`);
            }
        } catch (e: any) {
            console.error(`❌ 模型 ${model} 連線錯誤:`, e);
            lastError = e;
        }
    }

    throw lastError || new Error("所有可用模型測試失敗，請確認 API Key。");
}

// --- 快取邏輯 ---
async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ttlMinutes: number): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            if ((Date.now() - timestamp) / 1000 / 60 < ttlMinutes) return data as T;
        } catch (e) {}
    }
    try {
        const data = await fetcher();
        if (data) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        return data;
    } catch (error) { throw error; }
}

const parseJSON = <T>(text: string | undefined): T | null => {
    if (!text) return null;
    try {
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstChar = clean.indexOf('[');
        const lastChar = clean.lastIndexOf(']');
        if (firstChar !== -1 && lastChar !== -1) clean = clean.substring(firstChar, lastChar + 1);
        return JSON.parse(clean) as T;
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return null;
    }
};

// ==========================================================
// 1. 行程生成
// ==========================================================
export const generateItinerary = async (
    destination: string, 
    days: number, 
    userPrompt: string, 
    currency: string 
): Promise<TripDay[]> => {
  
  const cacheKey = `itinerary_${destination}_${days}_${currency}_${userPrompt.substring(0, 20)}`;
  
  return fetchWithCache(cacheKey, async () => {
      const prompt = `
        Role: Professional Travel Planner.
        Task: Create a ${days}-day itinerary for ${destination}.
        User Preferences: ${userPrompt}
        
        CRITICAL REQUIREMENTS:
        1. **Currency**: Estimate costs in **${currency}**. 
           - The "cost" field must contain ONLY the number (e.g., 2500). Do NOT add symbols.
        
        2. **Categories**: You MUST classify each activity into exactly ONE of these types (lowercase):
           - "sightseeing" (landmarks, parks, museums)
           - "food" (restaurants, street food)
           - "cafe" (coffee shops)
           - "shopping" (malls, markets)
           - "transport" (bus, train, flight)
           - "hotel" (accommodation)
           - "relax" (spa, onsen)
           - "bar" (nightlife)
           - "culture" (temples, art)
           - "activity" (theme parks, workshops)
           - "other" (if nothing else fits)

        3. **Format**: Output valid JSON only.

        JSON Structure:
        [
          {
            "day": 1,
            "activities": [
              {
                "time": "09:00",
                "title": "Activity Name",
                "description": "Short description",
                "category": "food", 
                "location": "Address",
                "cost": "1500" 
              }
            ]
          }
        ]
        
        Language: Traditional Chinese (繁體中文).
      `;

      try {
        const text = await callGeminiDirectly(prompt);
        const data = parseJSON<TripDay[]>(text);
        if (!data) throw new Error("AI 生成格式錯誤");
        return data;
      } catch (error) {
        throw error;
      }
  }, CACHE_TTL.ITINERARY);
};

// ==========================================================
// 2. 匯率查詢 (優先使用即時 API)
// ==========================================================

// 輔助函式：從公開 API 抓取匯率
const fetchRealTimeRate = async (from: string, to: string): Promise<number | null> => {
    try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
        const data = await res.json();
        return data.rates[to] || null;
    } catch (e) {
        console.warn("Real-time rate fetch failed, falling back to Gemini.");
        return null;
    }
};

export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   // 1. 先嘗試抓即時匯率
   const realRate = await fetchRealTimeRate(from, to);
   
   if (realRate !== null) {
       const total = (amount * realRate).toLocaleString(undefined, { maximumFractionDigits: 0 });
       return `≈ ${total} ${to}`; 
   }

   // 2. Fallback: 使用 Gemini
   return fetchWithCache(`rate_${from}_${to}_${amount}`, async () => {
       try {
        const prompt = `Exchange rate: ${amount} ${from} to ${to}. Output format: "≈ X ${to}" (number only).`;
        const text = await callGeminiDirectly(prompt);
        return text.trim();
      } catch (error) { return "無法取得匯率"; }
   }, CACHE_TTL.CURRENCY);
}

// ==========================================================
// 3. 其他工具 (翻譯、緊急資訊、電壓、天氣)
// ==========================================================
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
      if (!weatherApiKey) return null;
      try {
        const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${location}&days=1&aqi=no&alerts=no&lang=zh_tw`);
        if (!response.ok) throw new Error("Weather API failed");
        const data = await response.json();
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
        if (weatherApiKey) {
            try {
                const response = await fetch(`https://api.weatherapi.com/v1/timezone.json?key=${weatherApiKey}&q=${location}`);
                if (response.ok) { return (await response.json()).location.tz_id; }
            } catch (e) {}
        }
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }, CACHE_TTL.TIMEZONE);
}