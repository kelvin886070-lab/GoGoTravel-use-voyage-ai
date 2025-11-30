import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { TripDay, WeatherInfo, VoltageInfo } from "../types";

// 1. 修正環境變數 (Vite 必須這樣寫)
const apiKey = import.meta.env.VITE_API_KEY || '';
console.log("目前的 API Key:", apiKey);

if (!apiKey) {
  console.error("API Key is missing! Please check your .env file.");
}

// 2. 初始化 Web SDK
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = "gemini-2.0-flash"; // 使用穩定的 2.0 flash 模型

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
                  // 注意：這裡改用 category 對應我們之前修改的 types
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

// 3. 修正天氣功能 (移除 googleSearch，改問典型天氣)
export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    // Prompt 修改：不問 Current，改問 Typical/Forecast based on historical data
    const prompt = `Provide the typical weather forecast for ${location} for the current month.
      Return a RAW JSON object.
      Reply in Traditional Chinese (繁體中文).
      JSON structure:
      {
        "location": "string",
        "temperature": "string (e.g. 24°C)",
        "condition": "string",
        "humidity": "string",
        "wind": "string",
        "description": "string (brief overview)",
        "clothingSuggestion": "string",
        "activityTip": "string",
        "sunrise": "string (approximate time)",
        "sunset": "string (approximate time)",
        "uvIndex": "string",
        "hourly": [
           { "time": "09:00", "temp": "22°C", "icon": "sun" },
           { "time": "12:00", "temp": "25°C", "icon": "cloud" },
           { "time": "15:00", "temp": "24°C", "icon": "rain" }
        ]
      }`;
    
    const result = await model.generateContent(prompt);
    return parseJSON<WeatherInfo>(result.response.text());
  } catch (error) {
    console.error("Weather fetch failed", error);
    return null;
  }
};

// 4. 修正時區功能 (移除 googleSearch，Gemini 本來就知道時區)
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

export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`Estimate the exchange rate from ${amount} ${from} to ${to}. Provide the calculated amount and rate. Reply in Traditional Chinese.`);
    return result.response.text();
  } catch (error) {
    return "匯率資訊暫時無法使用";
  }
}

export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`Provide emergency phone numbers for ${location}. Reply in Traditional Chinese.`);
    return result.response.text();
  } catch (error) {
    return "緊急資訊暫時無法使用";
  }
}

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