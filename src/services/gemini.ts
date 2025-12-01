import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { TripDay, WeatherInfo, VoltageInfo } from "../types";

// 1. 讀取環境變數
const apiKey = import.meta.env.VITE_API_KEY || '';
const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY || ''; // 新增：讀取 WeatherAPI Key

if (!apiKey) {
  console.error("Gemini API Key is missing! Please check your .env file.");
}

// 2. 初始化 Web SDK
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = "gemini-2.0-flash"; // 保持使用穩定的 2.0 flash 模型

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

// --- 1. 行程生成 (維持使用 Gemini) ---
export const generateItinerary = async (destination: string, days: number, interests: string): Promise<TripDay[]> => {
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
  } catch (error) {
    console.error("Itinerary generation failed", error);
    throw error;
  }
};

// --- 2. 翻譯 (維持使用 Gemini) ---
export const translateText = async (text: string, targetLang: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`Translate the following text to ${targetLang}. Only return the translated text, nothing else.\n\nText: "${text}"`);
    return result.response.text();
  } catch (error) {
    console.error("Translation failed", error);
    return "翻譯錯誤";
  }
};

// --- 3. 真實天氣查詢 (改用 WeatherAPI) ---
export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  // 如果沒有設定 WeatherAPI Key，回傳 null
  if (!weatherApiKey) {
    console.error("缺少 WeatherAPI Key，請在 .env 設定 VITE_WEATHER_API_KEY");
    // 可以在這裡選擇是否要 fallback 回 Gemini，但建議直接用真實資料
    return null;
  }

  try {
    // 呼叫真實的氣象 API (要求繁體中文 lang=zh_tw)
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${location}&days=1&aqi=no&alerts=no&lang=zh_tw`
    );

    if (!response.ok) {
      throw new Error("Weather API request failed");
    }

    const data = await response.json();

    // 解析資料
    const current = data.current;
    const forecast = data.forecast.forecastday[0];
    const astro = forecast.astro;

    // Helper: 將 WeatherAPI 的 code 轉換為我們 App 的圖示格式
    const mapIcon = (code: number, isDay: number): 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' => {
        // 晴朗 (1000)
        if (code === 1000) return 'sun';
        // 多雲/陰天 (1003, 1006, 1009)
        if ([1003, 1006, 1009].includes(code)) return 'cloud';
        // 雨 (1063, 1180-1201, 1240-1246, etc)
        if ([1063, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) return 'rain';
        // 雪 (1066, 1114, 1210-1225, etc)
        if ([1066, 1114, 1210, 1213, 1216, 1219, 1222, 1225].includes(code)) return 'snow';
        // 雷雨 (1087, 1273-1282)
        if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'storm';
        
        // 預設回傳多雲
        return 'cloud';
    };

    // 根據真實溫度給建議
    const tempC = current.temp_c;
    let clothing = "建議穿著舒適衣物";
    if (tempC >= 28) clothing = "天氣炎熱，建議穿著短袖、透氣衣物，並注意防曬。";
    else if (tempC >= 20) clothing = "氣候宜人，建議穿著短袖或薄長袖。";
    else if (tempC >= 15) clothing = "稍有涼意，建議穿著長袖上衣搭配薄外套。";
    else clothing = "天氣寒冷，請務必穿著保暖外套、圍巾。";

    // 根據天氣狀況給活動建議
    let activity = "適合戶外活動";
    const conditionText = current.condition.text;
    if (conditionText.includes("雨")) activity = "可能會下雨，建議攜帶雨具或安排室內行程。";
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
      // 取每 3 小時的預報
      hourly: forecast.hour.filter((_: any, index: number) => index % 3 === 0).map((h: any) => ({
          time: h.time.split(' ')[1], // 取出 "14:00"
          temp: `${Math.round(h.temp_c)}°`,
          icon: mapIcon(h.condition.code, h.is_day)
      }))
    };

    return weatherInfo;

  } catch (error) {
    console.error("真實天氣獲取失敗:", error);
    return null;
  }
};

// --- 4. 時區查詢 (維持使用 Gemini) ---
export const getTimezone = async (location: string): Promise<string | null> => {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(`What is the IANA Timezone ID for ${location}? (e.g. "Asia/Tokyo"). Return ONLY the timezone ID string.`);
        const text = result.response.text().trim();
        return text.includes('/') ? text : null;
    } catch (error) {
        console.error("Timezone fetch failed", error);
        return null;
    }
}

// --- 5. 匯率換算 (維持使用 Gemini) ---
export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`Estimate the exchange rate from ${amount} ${from} to ${to}. Provide the calculated amount and rate. Reply in Traditional Chinese.`);
    return result.response.text();
  } catch (error) {
    return "匯率資訊暫時無法使用";
  }
}

// --- 6. 緊急資訊 (維持使用 Gemini) ---
export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`Provide emergency phone numbers for ${location}. Reply in Traditional Chinese.`);
    return result.response.text();
  } catch (error) {
    return "緊急資訊暫時無法使用";
  }
}

// --- 7. 電壓插座 (維持使用 Gemini) ---
export const getPlugInfo = async (country: string): Promise<VoltageInfo | null> => {
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
}