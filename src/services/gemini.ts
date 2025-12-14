import type { TripDay, WeatherInfo, VoltageInfo, Activity } from "../types";

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
    ITINERARY: 60, 
    FLIGHT: 1440 
};

// ==========================================================
// 核心：純 HTTP 請求函式
// ==========================================================
async function callGeminiDirectly(prompt: string): Promise<string> {
    const candidateModels = [
        "gemini-2.5-flash",
        
    ];
    let lastError = null;

    for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
            console.log(` [Kelvin Trip] 嘗試呼叫模型: ${model}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(` 成功！模型 ${model} 正常運作。`);
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                const err = await response.json().catch(() => ({}));
                console.warn(` 模型 ${model} 失敗 (${response.status}):`, err.error?.message);
                if ([429, 404, 503].includes(response.status)) {
                    continue;
                }
                lastError = new Error(`模型 ${model} 回傳 ${response.status}: ${err.error?.message}`);
            }
        } catch (e: any) {
            console.error(` 連線錯誤 (${model}):`, e);
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
        
        if (firstChar === -1) {
            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) clean = clean.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(clean) as T;
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return null;
    }
};

// ==========================================================
// 1. 行程生成 (大腦升級)
// ==========================================================
export const generateItinerary = async (
    destination: string, 
    days: number, 
    userPrompt: string, 
    currency: string,
    transportInfo?: { inbound?: string, outbound?: string },
    focusArea?: string,
    localTransportMode?: 'public' | 'car' | 'taxi'
): Promise<TripDay[]> => {
  
  const cacheKey = `itinerary_v4_${destination}_${days}_${currency}_${focusArea}_${localTransportMode}_${JSON.stringify(transportInfo)}`;
  
  return fetchWithCache(cacheKey, async () => {
      let context = "";
      
      if (transportInfo?.inbound) {
          const isFlight = transportInfo.inbound.toLowerCase().includes('flight');
          context += `\n- **ARRIVAL INFO**: ${transportInfo.inbound}. \n  **CRITICAL**: The very FIRST activity of Day 1 MUST be a '${isFlight ? 'flight' : 'transport'}' card representing arrival.`;
      }
      if (transportInfo?.outbound) {
          const isFlight = transportInfo.outbound.toLowerCase().includes('flight');
          context += `\n- **DEPARTURE INFO**: ${transportInfo.outbound}. \n  **CRITICAL**: The LAST activity of Day ${days} MUST be a '${isFlight ? 'flight' : 'transport'}' card representing departure.`;
      }

      if (focusArea) {
          context += `\n- **STRICT LOCATION CONSTRAINT**: The user ONLY wants to visit areas within: "${focusArea}". Do NOT suggest spots far outside these areas unless absolutely necessary.`;
      }

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
            - Insert "transport" items for drives > 30 mins. Set "transportDetail" mode to "car".
          `;
      } else {
          transportInstruction = `
            - **Transport Mode**: Taxi / Uber.
            - Provide estimated taxi travel time in "transport" items.
          `;
      }

      const prompt = `
        Role: Professional Travel Planner & Logistics Expert.
        Task: Create a ${days}-day itinerary for ${destination}.
        
        User Preferences: ${userPrompt}
        ${context}
        ${transportInstruction}
        
        **CRITICAL REQUIREMENTS (DO NOT IGNORE):**

        1. **Arrival Logic (Day 1)**:
           - The first activity MUST be the arrival (Flight/Train).
           - **IMPORTANT**: In the "description" of the arrival activity, provide **SPECIFIC EXIT INSTRUCTIONS**. 
             (e.g., "Exit North Gate to Bus Stop 5", "Go to B1 for Express Train").
           - The NEXT activity (e.g. moving to hotel) should imply a reasonable buffer for customs/immigration (e.g. 1-1.5 hours gap).

        2. **Gap Connectors (Transport)**:
           - You MUST explicitly calculate travel time between spots.
           - Use 'type': 'transport' for these movements.
           - Fill 'transportDetail': { "mode": "bus"|"train"|"car"|"walk", "duration": "XX min" }.
           - The 'duration' string will be used for timeline calculation.

        3. **Data Integrity**:
           - **Currency**: Estimate costs in **${currency}** (Number only).
           - **Types**: Use strict types: "sightseeing", "food", "cafe", "shopping", "transport", "flight", "hotel", "relax", "bar", "culture", "activity".
        
        4. **Format**: Output valid JSON only.
        
        JSON Structure Example:
        [
          {
            "day": 1,
            "activities": [
              {
                "time": "14:00",
                "title": "JX800 Landing",
                "description": "Terminal 1 Arrival.",
                "type": "flight",
                "location": "Narita Airport",
                "cost": "0"
              },
              {
                "time": "15:30", 
                "title": "Move to Ueno",
                "description": "Skyliner Express",
                "type": "transport",
                "location": "Transit",
                "cost": "2500",
                "transportDetail": {
                    "mode": "train",
                    "duration": "45 min",
                    "fromStation": "Narita T1",
                    "toStation": "Keisei Ueno",
                    "instruction": "Fastest route to city"
                }
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
            
            **CRITICAL RULES**:
            1. Return the accurate IATA Airport Codes for Origin and Destination.
            2. Do NOT guess. Use historical flight data knowledge.
            3. Specific known routes (Examples):
               - CI166 is KHH (Kaohsiung) -> KIX (Osaka/Kansai).
               - CI167 is KIX (Osaka/Kansai) -> KHH (Kaohsiung).
               - JX800 is TPE -> NRT.
            
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
        } catch (e) {
            return null;
        }
    }, CACHE_TTL.FLIGHT);
};

// ==========================================================
// 3. AI 推薦下一站 (新增功能)
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
            "cost": "Estimated Cost (Number)"
        }
        Language: Traditional Chinese.
    `;
    try {
        const text = await callGeminiDirectly(prompt);
        return parseJSON<Activity>(text);
    } catch (e) { return null; }
};

// ==========================================================
// 4. 匯率查詢 & 其他工具
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