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
    CURRENCY: 60,
    STATIC_INFO: 1440,
    ITINERARY: 60
};

// ==========================================================
// 核心：純 HTTP 請求函式
// ==========================================================
async function callGeminiDirectly(prompt: string): Promise<string> {
    const candidateModels = [
        "gemini-2.5-flash",       // 首選
    ];

    let lastError = null;

    for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        try {
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
                console.log(`✅ 成功！模型 ${model} 正常運作。`);
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                const err = await response.json().catch(() => ({}));
                console.warn(`⚠️ 模型 ${model} 失敗 (${response.status}):`, err.error?.message);
                if ([429, 404, 503].includes(response.status)) {
                    continue; 
                }
                lastError = new Error(`模型 ${model} 回傳 ${response.status}: ${err.error?.message}`);
            }
        } catch (e: any) {
            lastError = e;
        }
    }

    throw lastError || new Error("系統忙碌中，請稍後再試。");
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
    currency: string,
    transportInfo?: { inbound?: string, outbound?: string }
): Promise<TripDay[]> => {
  
  const cacheKey = `itinerary_${destination}_${days}_${currency}_${JSON.stringify(transportInfo)}_${userPrompt.substring(0, 20)}`;
  
  return fetchWithCache(cacheKey, async () => {
      let transportContext = "";
      if (transportInfo?.inbound) {
          transportContext += `\n- Day 1 Arrival Info: ${transportInfo.inbound} (Please arrange schedule starting after arrival + 2h for clearance).`;
      }
      if (transportInfo?.outbound) {
          transportContext += `\n- Day ${days} Departure Info: ${transportInfo.outbound} (Please end sightseeing 3.5h before departure).`;
      }

      const prompt = `
        Role: Professional Travel Planner.
        Task: Create a ${days}-day itinerary for ${destination}.
        
        User Preferences: ${userPrompt}
        ${transportContext}
        
        CRITICAL REQUIREMENTS:
        1. **Currency**: Estimate costs in **${currency}**. Cost must be NUMBER ONLY (e.g. 2500).
        2. **Categories**: Choose exactly ONE from: "sightseeing", "food", "cafe", "shopping", "transport", "hotel", "relax", "bar", "culture", "activity", "other".
        
        3. **Flow**: 
           - Start each day with a "Morning" activity.
           - End each day with an "Evening" activity.
           - **Transport**: Insert a SEPARATE item with category **"transport"** between locations if travel > 15 mins. Title: "Travel to [Location]", Desc: "Time & Method".
           - **Day 1 & Day ${days}**: Strictly follow the arrival/departure times if provided above.

        4. **Format**: Output valid JSON only.

        JSON Structure Example:
        [
          {
            "day": 1,
            "activities": [
              {
                "time": "14:00",
                "title": "Arrive at City Center",
                "description": "Check-in at hotel",
                "category": "transport",
                "location": "Hotel",
                "cost": "0"
              },
              {
                "time": "15:00",
                "title": "Activity Name",
                "description": "Description",
                "category": "sightseeing", 
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

// ... (以下 匯率、翻譯、緊急資訊 等函式保持不變，請保留原有的內容) ...
// ==========================================================
// 2. 匯率查詢
// ==========================================================
const fetchRealTimeRate = async (from: string, to: string): Promise<number | null> => {
    try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
        const data = await res.json();
        return data.rates[to] || null;
    } catch (e) {
        return null;
    }
};

export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   const realRate = await fetchRealTimeRate(from, to);
   if (realRate !== null) {
       const total = (amount * realRate).toLocaleString(undefined, { maximumFractionDigits: 0 });
       return `≈ ${total} ${to}`; 
   }
   return fetchWithCache(`rate_${from}_${to}_${amount}`, async () => {
       try {
        const prompt = `Exchange rate: ${amount} ${from} to ${to}. Output format: "≈ X ${to}" (number only).`;
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