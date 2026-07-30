// src/services/weather.ts
// 🌤️ 旅途中天氣（批4臉1）：Open-Meteo——免費、無金鑰、前端直呼（無 API key 外洩面；已記入 docs/成本記錄與估算.md）。
//   原則：裝飾性資訊「拿不到就靜默消失」——任何失敗回 null，UI 不顯示、不佔位、不轉圈。
//   時區：timezone=auto → 回傳以目的地當地時間為準（避免跨時區顯示錯時段）。
//   快取：模組級 1 小時（座標取到小數 2 位 ≈ 1km 網格），失敗也快取（避免斷網時瘋狂重打）。

export interface TripWeather {
    temp: number;                       // 現在氣溫（°C）
    isDay: boolean;                     // 目的地當地是否白天（icon 用）
    kind: 'clear' | 'cloud' | 'rain';   // WMO code 粗分：0 晴｜1–48 雲霧｜≥51 降水（雨雪雷都算「帶傘」）
    rainProb: number | null;            // 今日最大降雨機率（%）；≥60 觸發琥珀警示
}

const _cache = new Map<string, { at: number; data: TripWeather | null }>();
const TTL_MS = 60 * 60 * 1000;

export async function fetchWeather(lat: number, lng: number): Promise<TripWeather | null> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const hit = _cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

    let data: TripWeather | null = null;
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
            + `&current=temperature_2m,weather_code,is_day&daily=precipitation_probability_max&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        const temp = Number(j?.current?.temperature_2m);
        if (!Number.isFinite(temp)) throw new Error('no temp');
        const code = Number(j?.current?.weather_code ?? 0);
        const rp = Number(j?.daily?.precipitation_probability_max?.[0]);
        data = {
            temp,
            isDay: Number(j?.current?.is_day ?? 1) === 1,
            kind: code >= 51 ? 'rain' : code >= 1 ? 'cloud' : 'clear',
            rainProb: Number.isFinite(rp) ? rp : null,
        };
    } catch {
        data = null;   // 靜默失敗；下方照樣快取，避免斷網時每次 render 重打
    }
    _cache.set(key, { at: Date.now(), data });
    return data;
}
