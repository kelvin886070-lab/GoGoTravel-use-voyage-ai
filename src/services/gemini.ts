import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { TripDay, WeatherInfo, VoltageInfo } from "../types";

// 1. 讀取環境變數
const apiKey = import.meta.env.VITE_API_KEY || '';
const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY || '';

if (!apiKey) {
  console.error("Gemini API Key is missing! Please check your .env file.");
}

// 2. 初始化 Web SDK
const genAI = new GoogleGenerativeAI(apiKey);
// 修正：改用 1.5-flash，這是目前最穩定且免費額度最高的版本
const modelName = "gemini-2.0-flash";

// --- Cache Helper System (快取系統) ---
const CACHE_PREFIX = 'kelvin_cache_';

// 定義不同資料的快取時間 (單位: 分鐘)
const CACHE_TTL = {
    WEATHER: 30,      // 天氣：30 分鐘
    TIMEZONE: 10080,  // 時區：7 天 (幾乎不會變)
    CURRENCY: 60,     // 匯率：1 小時
    STATIC_INFO: 1440,// 電壓、緊急資訊：24 小時
    ITINERARY: 60     // 行程：1 小時
};

/**
 * 智慧快取函式
 */
async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ttlMinutes: number): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            const age = (Date.now() - timestamp) / 1000 / 60; // 分鐘
            
            if (age < ttlMinutes) {
                // console.log(`[Cache Hit] 使用快取: ${key}`);
                return data as T;
            }
        } catch (e) {
            console.warn('Cache parse error', e);
        }
    }

    // console.log(`[API Call] 呼叫 API: ${key}`);
    try {
        const data = await fetcher();
        if (data !== null && data !== undefined) {
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        }
        return data;
    } catch (error) {
        throw error;
    }
}

// Helper: JSON 解析工具
const parseJSON = <T>(text: string | undefined): T | null => {
    if (!text) return null;
    try {
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstCurly = cleanText.indexOf('{');
        const firstSquare = cleanText.indexOf('[');
        let startIndex = -1;
        
        if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
             startIndex = firstCurly;
        } else if (firstSquare !== -1) {
             startIndex = firstSquare;
        }

        if (startIndex !== -1) {
            const lastCurly = cleanText.lastIndexOf('}');
            const lastSquare = cleanText.lastIndexOf(']');
            const endIndex = Math.max(lastCurly, lastSquare);
            if (endIndex !== -1) {
                cleanText = cleanText.substring(startIndex, endIndex + 1);
            }
        }
        return JSON.parse(cleanText) as T;
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
};

// --- 1. 行程生成 ---
export const generateItinerary = async (destination: string, days: number, interests: string): Promise<TripDay[]> => {
  const cacheKey = `itinerary_${destination}_${days}_${interests}`;
  
  return fetchWithCache(cacheKey, async () => {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: { type: SchemaType.INTEGER },
                activities: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      time: { type: SchemaType.STRING },
                      title: { type: SchemaType.STRING },
                      description: { type: SchemaType.STRING },
                      category: { type: SchemaType.STRING },
                      location: { type: SchemaType.STRING },
                      cost: { type: SchemaType.STRING },
                      latitude: { type: SchemaType.NUMBER },
                      longitude: { type: SchemaType.NUMBER }
                    },
                    required: ["time", "title", "category", "location"]
                  }
                }
              },
              required: ["day", "activities"]
            }
          }
        }
      });

      const prompt = `Create a ${days}-day travel itinerary for ${destination}. 
        The user is interested in: ${interests}.
        The content MUST be in Traditional Chinese (繁體中文).
        For each activity, try to estimate the latitude and longitude coordinates if possible.`;

      try {
        const result = await model.generateContent(prompt);
        return parseJSON<TripDay[]>(result.response.text()) || [];
      } catch (error: any) {
        if (error.message && error.message.includes('429')) {
            console.error("Gemini API Quota Exceeded");
            throw new Error("系統繁忙中 (API 額度已滿)，請稍後再試。");
        }
        throw error;
      }
  }, CACHE_TTL.ITINERARY);
};

// --- 2. 翻譯 ---
export const translateText = async (text: string, targetLang: string): Promise<string> => {
  const cacheKey = `trans_${text.substring(0, 30)}_${targetLang}`; 
  
  return fetchWithCache(cacheKey, async () => {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(`Translate the following text to ${targetLang}. Only return the translated text, nothing else.\n\nText: "${text}"`);
        return result.response.text();
      } catch (error) {
        return "翻譯服務暫時無法使用";
      }
  }, 1440);
};

// --- 3. 真實天氣查詢 ---
export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  return fetchWithCache(`weather_${location}`, async () => {
      if (!weatherApiKey) return null;

      try {
        const response = await fetch(
          `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${location}&days=1&aqi=no&alerts=no&lang=zh_tw`
        );
        if (!response.ok) throw new Error("Weather API failed");

        const data = await response.json();
        const current = data.current;
        const forecast = data.forecast.forecastday[0];
        const astro = forecast.astro;

        const mapIcon = (code: number, isDay: number): 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' => {
            if (code === 1000) return 'sun';
            if ([1003, 1006, 1009].includes(code)) return 'cloud';
            if ([1063, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) return 'rain';
            if ([1066, 1114, 1210, 1213, 1216, 1219, 1222, 1225].includes(code)) return 'snow';
            if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'storm';
            return 'cloud';
        };

        const tempC = current.temp_c;
        let clothing = "建議穿著舒適衣物";
        if (tempC >= 28) clothing = "天氣炎熱，建議穿著短袖、透氣衣物。";
        else if (tempC >= 20) clothing = "氣候宜人，建議穿著短袖或薄長袖。";
        else if (tempC >= 15) clothing = "稍有涼意，建議穿著長袖上衣搭配薄外套。";
        else clothing = "天氣寒冷，請務必穿著保暖外套、圍巾。";

        let activity = "適合戶外活動";
        const conditionText = current.condition.text;
        if (conditionText.includes("雨")) activity = "可能會下雨，建議攜帶雨具。";
        else if (tempC > 32) activity = "避免長時間在戶外曝曬，多補充水分。";

        const weatherInfo: WeatherInfo = {
          location: data.location.name,
          temperature: `${Math.round(current.temp_c)}°C`,
          condition: current.condition.text,
          humidity: `${current.humidity}%`,
          wind: `${current.wind_kph} km/h`,
          description: `體感 ${current.feelslike_c}°C，${current.condition.text}`,
          clothingSuggestion: clothing,
          activityTip: activity,
          sunrise: astro.sunrise,
          sunset: astro.sunset,
          uvIndex: String(current.uv),
          hourly: forecast.hour.filter((_: any, index: number) => index % 3 === 0).map((h: any) => ({
              time: h.time.split(' ')[1],
              temp: `${Math.round(h.temp_c)}°`,
              icon: mapIcon(h.condition.code, h.is_day)
          }))
        };
        return weatherInfo;

      } catch (error) {
        console.error(error);
        return null;
      }
  }, CACHE_TTL.WEATHER);
};

// --- 4. 時區查詢 (不使用 AI，改用 WeatherAPI) ---
export const getTimezone = async (location: string): Promise<string | null> => {
    return fetchWithCache(`timezone_${location}`, async () => {
        // 優先使用 WeatherAPI (免費且快速)
        if (weatherApiKey) {
            try {
                const response = await fetch(
                    `https://api.weatherapi.com/v1/timezone.json?key=${weatherApiKey}&q=${location}`
                );
                if (response.ok) {
                    const data = await response.json();
                    return data.location.tz_id; 
                }
            } catch (e) {
                console.warn("WeatherAPI Timezone failed, falling back...");
            }
        }

        // 靜態備援表 (避免 API 失敗時完全沒畫面)
        const commonCities: Record<string, string> = {
            '台北': 'Asia/Taipei', 'Taipei': 'Asia/Taipei',
            '東京': 'Asia/Tokyo', 'Tokyo': 'Asia/Tokyo',
            '大阪': 'Asia/Tokyo', 'Osaka': 'Asia/Tokyo',
            '首爾': 'Asia/Seoul', 'Seoul': 'Asia/Seoul',
            '曼谷': 'Asia/Bangkok', 'Bangkok': 'Asia/Bangkok',
            '紐約': 'America/New_York', 'New York': 'America/New_York',
            '倫敦': 'Europe/London', 'London': 'Europe/London',
            '巴黎': 'Europe/Paris', 'Paris': 'Europe/Paris',
            '香港': 'Asia/Hong_Kong', 'Hong Kong': 'Asia/Hong_Kong',
            '新加坡': 'Asia/Singapore', 'Singapore': 'Asia/Singapore'
        };

        for (const city in commonCities) {
            if (location.includes(city)) return commonCities[city];
        }

        // 最後手段：回傳使用者本地時區
        return Intl.DateTimeFormat().resolvedOptions().timeZone;

    }, CACHE_TTL.TIMEZONE);
}

// --- 5. 匯率換算 ---
export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   return fetchWithCache(`rate_${from}_${to}_${amount}`, async () => {
       try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(`Estimate the exchange rate from ${amount} ${from} to ${to}. Provide the calculated amount and rate. Reply in Traditional Chinese.`);
        return result.response.text();
      } catch (error) {
        return "匯率資訊暫時無法使用";
      }
   }, CACHE_TTL.CURRENCY);
}

// --- 6. 緊急資訊 ---
export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  return fetchWithCache(`emergency_${location}`, async () => {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(`Provide emergency phone numbers for ${location}. Reply in Traditional Chinese.`);
        return result.response.text();
      } catch (error) {
        return "緊急資訊暫時無法使用";
      }
  }, CACHE_TTL.STATIC_INFO);
}

// --- 7. 電壓插座 ---
export const getPlugInfo = async (country: string): Promise<VoltageInfo | null> => {
  return fetchWithCache(`plug_${country}`, async () => {
      try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: SchemaType.OBJECT,
                  properties: {
                      country: { type: SchemaType.STRING },
                      voltage: { type: SchemaType.STRING },
                      frequency: { type: SchemaType.STRING },
                      plugTypes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                      description: { type: SchemaType.STRING }
                  }
                }
            }
        });
        const result = await model.generateContent(`What is the voltage info for ${country}? Reply in Traditional Chinese.`);
        return parseJSON<VoltageInfo>(result.response.text());
    } catch (error) {
         return null;
    }
  }, CACHE_TTL.STATIC_INFO);
}