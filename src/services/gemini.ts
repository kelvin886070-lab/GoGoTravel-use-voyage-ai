
import { GoogleGenAI, Type } from "@google/genai";
import type { TripDay, WeatherInfo, VoltageInfo } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to parse JSON from AI response robustly
const parseJSON = <T>(text: string | undefined): T | null => {
    if (!text) return null;
    try {
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Try to find the first '{' or '[' and the last '}' or ']'
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
        console.log("Raw Text:", text);
        return null;
    }
};

export const generateItinerary = async (destination: string, days: number, interests: string): Promise<TripDay[]> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `Create a ${days}-day travel itinerary for ${destination}. 
  The user is interested in: ${interests}.
  Return the response strictly as a JSON array of daily activities.
  The content MUST be in Traditional Chinese (繁體中文).
  For each activity, try to estimate the latitude and longitude coordinates if possible.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER },
              activities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['sightseeing', 'food', 'transport', 'flight', 'hotel'] },
                    location: { type: Type.STRING },
                    cost: { type: Type.STRING },
                    latitude: { type: Type.NUMBER },
                    longitude: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      }
    });

    return parseJSON<TripDay[]>(response.text) || [];
  } catch (error) {
    console.error("Itinerary generation failed", error);
    throw error;
  }
};

export const translateText = async (text: string, targetLang: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following text to ${targetLang}. Only return the translated text, nothing else.\n\nText: "${text}"`
    });
    return response.text || "";
  } catch (error) {
    console.error("Translation failed", error);
    return "翻譯錯誤";
  }
};

export const getWeatherForecast = async (location: string): Promise<WeatherInfo | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the current weather forecast for ${location}? 
      Return a RAW JSON object (no markdown formatting).
      Reply in Traditional Chinese (繁體中文).
      The JSON object must have these keys:
      - location (string)
      - temperature (string, e.g. "24°C")
      - condition (string, e.g. "晴朗")
      - humidity (string, e.g. "60%")
      - wind (string, e.g. "15 km/h")
      - description (string)
      - clothingSuggestion (string)
      - activityTip (string)
      - sunrise (string)
      - sunset (string)
      - uvIndex (string)
      - hourly (array of objects with time, temp, icon: 'sun'|'cloud'|'rain'|'snow'|'storm')`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    
    return parseJSON<WeatherInfo>(response.text);
  } catch (error) {
    console.error("Weather fetch failed", error);
    return null;
  }
};

export const getTimezone = async (location: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `What is the IANA Timezone ID for ${location}? (e.g. "Asia/Tokyo", "Europe/Paris").
            Return ONLY the timezone ID string. Nothing else.`,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        const text = response.text?.trim();
        if (text && text.includes('/')) {
            return text;
        }
        return null;
    } catch (error) {
        console.error("Timezone fetch failed", error);
        return null;
    }
}

export const getCurrencyRate = async (from: string, to: string, amount: number): Promise<string> => {
   try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the current exchange rate from ${amount} ${from} to ${to}? Provide the calculated amount and the rate. Reply in Traditional Chinese (繁體中文).`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "無法獲取匯率";
  } catch (error) {
    console.error("Currency fetch failed", error);
    return "匯率資訊暫時無法使用";
  }
}

export const getLocalEmergencyInfo = async (location: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide the emergency phone numbers (Police, Ambulance, Fire) for ${location}. Also list one nearby hospital if possible. Reply in Traditional Chinese (繁體中文).`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "無法獲取緊急資訊";
  } catch (error) {
    console.error("Emergency info fetch failed", error);
    return "緊急資訊暫時無法使用";
  }
}

export const getPlugInfo = async (country: string): Promise<VoltageInfo | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the voltage, frequency, and plug type used in ${country}? 
      Return a JSON object with: country, voltage, frequency, plugTypes (array of strings, e.g. "A", "G"), description (brief travel advice).
      Reply in Traditional Chinese (繁體中文).`,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  country: { type: Type.STRING },
                  voltage: { type: Type.STRING },
                  frequency: { type: Type.STRING },
                  plugTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING }
              }
          }
      }
    });
    return parseJSON<VoltageInfo>(response.text);
  } catch (error) {
     console.error("Plug info fetch failed", error);
     return null;
  }
}
