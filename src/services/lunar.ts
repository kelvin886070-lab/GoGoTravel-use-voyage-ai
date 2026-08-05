// src/services/lunar.ts
// 🌙 農曆（給「單日撕日曆」用的旁註）
//
//   為什麼要有它：家裡那本每天撕的日曆，國曆大字旁邊一定有農曆與節日——那是台灣人對「一天」的認知方式。
//   少了農曆，那張卡只是一個日期；有了農曆，它才是**日曆**。
//
//   資料來源：`solarlunar`（MIT）。**不自己手寫曆法表**——農曆換算有閏月與節氣邊界，
//   憑記憶寫一張 1900–2100 的壓縮表，錯一個位元就會有某一年整年偏掉，而且是半年後才會發現的錯。
//   已用官方假期反查驗證 7 個錨點全對：
//     2026-02-17 正月初一（春節）／2026-06-19 五月初五（端午）／2026-09-25 八月十五（中秋）
//     2027-02-06 正月初一／2027-06-09 五月初五／2027-09-15 八月十五／2028-01-26 正月初一
//
//   ⚡ **動態載入**：這包約 280KB（未壓縮），只在使用者真的選到日期時才抓，
//      不進首屏包（冷啟大小是我們花過一整批修的東西，不能因為一個旁註就吐回去）。
//   失敗策略：載不到就回 null——卡片上少一行農曆，不影響任何功能。

interface SolarLunarResult {
    monthCn: string;   // 「八月」（閏月會是「閏八月」）
    dayCn: string;     // 「十五」
}
type Solar2Lunar = (y: number, m: number, d: number) => SolarLunarResult;

let loader: Promise<Solar2Lunar | null> | null = null;

const load = (): Promise<Solar2Lunar | null> => {
    if (loader) return loader;
    loader = import('solarlunar')
        .then(mod => {
            // 這個套件只有 default 匯出（CJS interop）
            const api = (mod as unknown as { default?: { solar2lunar?: Solar2Lunar } }).default;
            return api?.solar2lunar ?? null;
        })
        .catch(() => null);
    return loader;
};

/** 事先暖機（進入日期頁時呼叫；使用者選日期時就已經在手上了）。 */
export const preloadLunar = (): void => { void load(); };

/**
 * 取農曆旁註（「八月十五」）。
 * @param iso YYYY-MM-DD（本地時區）
 */
export async function lunarLabel(iso: string): Promise<string | null> {
    const fn = await load();
    if (!fn) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    try {
        const r = fn(y, m, d);
        const text = `${r.monthCn || ''}${r.dayCn || ''}`.trim();
        return text || null;
    } catch {
        return null;
    }
}
