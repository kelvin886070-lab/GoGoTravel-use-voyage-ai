// src/services/twHolidays.ts
// 🇹🇼 台灣國定假日與連假（本地資料表，零 API、零成本、離線可用）
//
//   為什麼要有這張表：**大部分人的旅行日期是被假期決定的，不是被季節決定的**。
//   日曆上不標連假，等於讓使用者自己去別的 app 查——那是把最關鍵的決策依據推出門外。
//
//   資料來源：行政院人事行政總處「政府行政機關辦公日曆表」（115／116 年），
//   經 104 職場力整理表核對（見 docs 產品筆記的來源連結）。
//   ⚠️ **維護方式**：人事總處每年 5–6 月公告次年日曆表，屆時把新的一年加進 RANGES 即可（一年一次）。
//      表裡沒有的年份＝不標記，畫面自動退位（不會出錯，只是少了資訊）。
export interface HolidayRange {
    /** 連假起（YYYY-MM-DD，本地時區） */
    start: string;
    /** 連假迄（含當日） */
    end: string;
    name: string;
}

/** 已建檔的年份（用來判斷「這一年有沒有資料」，避免對未建檔年份做出錯誤承諾） */
export const HOLIDAY_YEARS: number[] = [2026, 2027];

const RANGES: HolidayRange[] = [
    // ── 民國 115 年（2026）：本表建立於 2026-08，僅收錄當時尚未過去的假期 ──
    { start: '2026-09-25', end: '2026-09-28', name: '中秋節＋教師節連假' },
    { start: '2026-10-09', end: '2026-10-11', name: '國慶日連假' },
    { start: '2026-10-24', end: '2026-10-26', name: '光復節連假' },
    { start: '2026-12-25', end: '2026-12-27', name: '行憲紀念日連假' },

    // ── 民國 116 年（2027）──
    { start: '2027-01-01', end: '2027-01-03', name: '元旦連假' },
    { start: '2027-02-04', end: '2027-02-10', name: '春節連假' },
    { start: '2027-02-27', end: '2027-03-01', name: '和平紀念日連假' },
    { start: '2027-04-03', end: '2027-04-06', name: '兒童節＋清明連假' },
    { start: '2027-04-30', end: '2027-05-02', name: '勞動節連假' },
    { start: '2027-06-09', end: '2027-06-09', name: '端午節' },
    { start: '2027-09-15', end: '2027-09-15', name: '中秋節' },
    { start: '2027-09-28', end: '2027-09-28', name: '教師節' },
    { start: '2027-10-09', end: '2027-10-11', name: '國慶日連假' },
    { start: '2027-10-23', end: '2027-10-25', name: '光復節連假' },
    { start: '2027-12-24', end: '2027-12-26', name: '行憲紀念日連假' },
    { start: '2027-12-31', end: '2028-01-02', name: '跨年連假' },
];

/**
 * **逐日**的節日名稱（單日日曆上直排紅字用）。
 * 為什麼不能用連假名稱去標單日：2026/09/25 那天是「中秋節」，「教師節」是 09/28——
 * 用「中秋節＋教師節連假」去標 9/25，寫在日曆上就是錯的。日曆標的是**那一天叫什麼**。
 */
const FESTIVALS: Record<string, string> = {
    // 2026（民國 115）
    '2026-09-25': '中秋節', '2026-09-28': '教師節',
    '2026-10-10': '國慶日', '2026-10-25': '光復節', '2026-12-25': '行憲紀念日',
    // 2027（民國 116）
    '2027-01-01': '元旦', '2027-02-04': '小年夜', '2027-02-05': '除夕', '2027-02-06': '春節',
    '2027-02-28': '和平紀念日', '2027-04-04': '兒童節', '2027-04-05': '清明節',
    '2027-05-01': '勞動節', '2027-06-09': '端午節', '2027-09-15': '中秋節',
    '2027-09-28': '教師節', '2027-10-10': '國慶日', '2027-10-25': '光復節',
    '2027-12-25': '行憲紀念日', '2028-01-01': '元旦',
};

/** 那一天的節日名（沒有專屬節日但落在連假中＝回「連假」；平日回 null）。 */
export const festivalOf = (iso: string): string | null => {
    const f = FESTIVALS[iso];
    if (f) return f;
    const r = holidayOf(iso);
    if (!r) return null;
    return r.start === r.end ? r.name : '連假';
};

/** 這一天是不是假日（含國定假日與連假中的日子）；不是則回 null。 */
export const holidayOf = (iso: string): HolidayRange | null =>
    RANGES.find(r => iso >= r.start && iso <= r.end) ?? null;

/** 週六日（0＝週日、6＝週六）。 */
export const isWeekend = (iso: string): boolean => {
    const [y, m, d] = iso.split('-').map(Number);
    const w = new Date(y, m - 1, d).getDay();
    return w === 0 || w === 6;
};

/** 某個月份裡出現的連假（供日曆下方的說明行使用；已去重、依日期排序）。 */
export const holidaysInMonth = (year: number, month: number): HolidayRange[] => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return RANGES.filter(r => r.start.startsWith(prefix) || r.end.startsWith(prefix));
};

/** 這一年有沒有建檔（沒有就不做任何標記，誠實退位）。 */
export const hasHolidayData = (year: number): boolean => HOLIDAY_YEARS.includes(year);
