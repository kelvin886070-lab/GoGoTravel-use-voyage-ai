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
// 核心：智慧型 API 呼叫 (針對你的 2.5 環境優化)
// ==========================================================
async function callGeminiDirectly(prompt: string): Promise<string> {
    
    // 根據你的診斷報告，這些是你帳號裡有的模型
    // 我們依序嘗試，直到找到一個能用的
    const candidateModels = [
        "gemini-2.5-flash",       // 首選：最新版
        "gemini-2.0-flash-exp",   // 備選：實驗版 (通常免費額度高)
        "gemini-1.5-flash-latest",// 嘗試最新別名
        "gemini-1.5-flash"        // 最後嘗試舊版
    ];

    let lastError = null;

    for (const model of candidateModels) {
        // ⚠️ 關鍵修正：新模型 (2.5) 必須用 v1接口
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
        
        try {
            console.log(`🚀 [Kelvin Trip] 嘗試模型: ${model}`);
            
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
                console.warn(`⚠️ 模型 ${model} 失敗:`, err.error?.message || response.status);
                
                // 如果是 429 (額度滿)，這表示模型存在但不能用，換下一個試試
                if (response.status === 429) {
                    lastError = new Error(`模型 ${model} 額度已滿 (429)`);
                    continue; 
                }
                
                // 如果是 404 (找不到)，當然換下一個
                lastError = new Error(`模型 ${model} 不存在 (404)`);
            }
        } catch (e: any) {
            lastError = e;
        }
    }

    throw lastError || new Error("所有可用模型都嘗試失敗，請檢查 API Key 狀態。");
}

// --- 快取邏輯 (不變) ---
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

// JSON 解析工具 (不變)
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
export const generateItinerary = async (destination: string, days: number, interests: string): Promise<TripDay[]> => {
  const cacheKey = `itinerary_${destination}_${days}_${interests}`;
  
  return fetchWithCache(cacheKey, async () => {
      const prompt = `
        You are a travel assistant. Create a ${days}-day itinerary for ${destination}.
        User interests: ${interests}.
        
        Strictly follow this JSON format rule. Output ONLY the JSON string.
        Language: Traditional Chinese (繁體中文).

        JSON Structure Example:
        [
          {
            "day": 1,
            "activities": [
              {
                "time": "09:00",
                "title": "Activity Name",
                "description": "Brief description",
                "category": "sightseeing",
                "location": "Location Name",
                "cost": "100 TWD"
              }
            ]
          }
        ]
        
        Generate JSON:
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
// 2. 翻譯
// ==========================================================
export const translateText = async (text: string, targetLang: string): Promise<string> => {
  const cacheKey = `trans_${text.substring(0, 30)}_${targetLang}`; 
  return fetchWithCache(cacheKey, async () => {
      try {
        const prompt = `Translate to ${targetLang}: "${text}". Only output the translated text.`;
        return await callGeminiDirectly(prompt);
      } catch (error) {
        return "翻譯暫時無法使用";
      }
  }, 1440);
};

// ==========================================================
// 3. 匯率
// ==========================================================
export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   return fetchWithCache(`rate_${from}_${to}_${amount}`, async () => {
       try {
        const prompt = `10 words max: Exchange rate ${amount} ${from} to ${to}? Output: "約 X TWD"`;
        const text = await callGeminiDirectly(prompt);
        return text.trim();
      } catch (error) { return "無法取得匯率"; }
   }, CACHE_TTL.CURRENCY);
}

// ==========================================================
// 4. 緊急資訊
// ==========================================================
export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  return fetchWithCache(`emergency_${location}`, async () => {
      try {
        const prompt = `List emergency numbers for ${location} (Police, Ambulance). Traditional Chinese.`;
        return await callGeminiDirectly(prompt);
      } catch (error) { return "暫無資訊"; }
  }, CACHE_TTL.STATIC_INFO);
}

// ==========================================================
// 5. 電壓
// ==========================================================
export const getPlugInfo = async (country: string): Promise<VoltageInfo | null> => {
  return fetchWithCache(`plug_${country}`, async () => {
      try {
        const prompt = `Return JSON for voltage in ${country}: { "country": "${country}", "voltage": "220V", "frequency": "60Hz", "plugTypes": ["A", "B"], "description": "Info" }`;
        const text = await callGeminiDirectly(prompt);
        return parseJSON<VoltageInfo>(text);
    } catch (error) { return null; }
  }, CACHE_TTL.STATIC_INFO);
}

// ==========================================================
// WeatherAPI (不變)
// ==========================================================
export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  return fetchWithCache(`weather_${location}`, async () => {
      if (!weatherApiKey) return null;
      try {
        const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${location}&days=1&aqi=no&alerts=no&lang=zh_tw`);
        if (!response.ok) throw new Error("Weather API failed");
        const data = await response.json();
        
        const getIcon = (code: number): any => {
            if ([1000].includes(code)) return 'sun';
            if ([1003, 1006, 1009].includes(code)) return 'cloud';
            if (code > 1000) return 'rain';
            return 'cloud';
        };

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
                if (response.ok) {
                    const data = await response.json();
                    return data.location.tz_id; 
                }
            } catch (e) {}
        }
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }, CACHE_TTL.TIMEZONE);
}