// src/views/create/WhenPage.tsx
// 🗓️ 生成表單・「什麼時候」頁（docs E3 定稿 v3：ink-on-photo，三層確定度階梯）
//
//   為什麼是三層：使用者對日期的確定度天差地遠——有人只有「秋天想去」，有人機票已經買了。
//   **模糊是預設、精確是升級**，同一頁不設門、不重複問：
//     ①月份層（品牌年曆）：圈一個月 → 浮出**季節回應行**（那個月的那個地方長什麼樣）
//     ②天數層（尺規拉桿）：縮圈反哺預設值；數字可點＝就地自訂 2–60；密度提醒只陳述事實
//     ③精確層（可展開日曆）：起訖雙圈＋範圍金染；與上面兩層**雙向同步**，兩層永遠說同一件事
//
//   為什麼這頁**不鋪紙**：紙留給要書寫、要圈選的地方（縮圈頁、講究頁）。年曆是「印在照片上的
//   物件」——整頁無容器，只靠金髮絲線與規格化暗紗撐可讀性，與入口頁同一個世界（照片上用金）。
//   年曆版式（金色雙細線刊頭、春夏秋冬四排、季節側標、頂部兩枚裝訂圈）＝未來周邊月曆的設計稿。
//
//   資料：季節註記來自 `destination-deep` 的 seasons（入口頁已背景預取 → 通常快取命中、零成本）。
//   聲音：**一次使用者動作只播一聲**（選回程日重繪雙圈時，起點圈靜默）。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';
import { toast } from '../../components/Toast';
import { fetchDestinationDeep, seasonNote, seasonTable, type DestinationDeep } from '../../services/destinationIntel';
import { densityWarning } from '../../services/tripBrief';
import { holidayOf, isWeekend, holidaysInMonth, hasHolidayData } from '../../services/twHolidays';
import { TicketNextButton } from './TicketNextButton';
import { HandCircle, PaperTexture, paperShadow, seedOf, PAPER, PAPER_RADIUS, INK_INK, INK_PRINT, INK_GOLD, INK_AMBER, ON_PHOTO_SHADOW, INK_KEYFRAMES } from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ── 純日期工具（一律走**本地時區**；用 toISOString 會被 UTC 位移吃掉一天）──────────
const pad2 = (n: number): string => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number): string => `${y}-${pad2(m)}-${pad2(d)}`;
const daysInMonth = (y: number, m: number): number => new Date(y, m, 0).getDate();
/** 該月 1 號是星期幾（0＝週日） */
const firstWeekday = (y: number, m: number): number => new Date(y, m - 1, 1).getDay();
/** 兩個 YYYY-MM-DD 之間的**含頭尾**天數 */
const inclusiveDays = (a: string, b: string): number => {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.round((t2 - t1) / 86400000) + 1;
};
/** 起點 + n 天（含頭尾）＝ 回程日 */
const addDays = (isoStr: string, n: number): string => {
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return isoOf(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
};

const MIN_DAYS = 2;
const MAX_DAYS = 60;        // 就地自訂的上限
const RULER_MAX = 14;       // 尺規拉桿的刻度上限（超過 14 只能用自訂輸入）
const SEASON_ROWS: Array<{ label: string; months: number[] }> = [
    { label: '春', months: [3, 4, 5] },
    { label: '夏', months: [6, 7, 8] },
    { label: '秋', months: [9, 10, 11] },
    { label: '冬', months: [12, 1, 2] },
];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
/** 出發章紅：週末與連假的標記色（與全站「出發／準備家族＝紅」同一支） */
const STAMP_RED = '#A23B2E';
/** 冬季高山的風險提示關鍵字（只給通用、查得到的建議，不編造路況） */
const ALPINE_HINT = /合歡|玉山|雪山|高山|武嶺|太平山|阿里山|清境|雪/;

export interface WhenResult {
    /** 出發月份（1–12） */
    month: number;
    /** 出發年份（跨年已處理：選了比今天早的月份＝明年） */
    year: number;
    /** 天數（含頭尾） */
    days: number;
    /** 精確層才有（YYYY-MM-DD，本地時區） */
    startDate?: string;
    endDate?: string;
    /** 使用者是否給了確切日期 */
    exact: boolean;
}

export const WhenPage: React.FC<{
    /** 麵包屑（「南投 · 日月潭與水里」） */
    breadcrumb: string;
    /** 打 deep 的查詢字串（季節註記用；沿用入口頁已驗證的目的地） */
    query: string;
    /** 背景照片（沿用前面幾頁那張＝物件連續） */
    coverUrl: string | null;
    isDomestic: boolean;
    /** 縮圈頁反哺的建議天數（0＝沒有建議，退回用地點數推算） */
    suggestedDaysHint: number;
    /** 地點數（密度提醒用：平均每地不到兩天才會說話） */
    placeCount: number;
    onBack: () => void;
    onClose: () => void;
    onNext: (r: WhenResult) => void;
}> = ({ breadcrumb, query, coverUrl, isDomestic, suggestedDaysHint, placeCount, onBack, onClose, onNext }) => {
    const instant = useMemo(() => reduceMotion(), []);
    const now = useMemo(() => new Date(), []);
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const [deep, setDeep] = useState<DestinationDeep | null>(null);
    const [year, setYear] = useState(thisYear);              // 年曆目前顯示的年份
    const [month, setMonth] = useState<number | null>(null); // 已圈起的月份
    const [days, setDays] = useState(() => Math.min(MAX_DAYS, Math.max(MIN_DAYS, suggestedDaysHint || 4)));
    const [editingDays, setEditingDays] = useState(false);
    const [daysDraft, setDaysDraft] = useState('');
    const [expertOpen, setExpertOpen] = useState(false);
    const [exactOpen, setExactOpen] = useState(false);
    const [calYear, setCalYear] = useState(thisYear);
    const [calMonth, setCalMonth] = useState(thisMonth);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [scrolled, setScrolled] = useState(false);      // 捲過年曆之後，標題換成常駐摘要
    const [atBottom, setAtBottom] = useState(false);     // 已經捲到底＝底部漸層收起來
    const scrollRef = useRef<HTMLDivElement>(null);
    const exactRef = useRef<HTMLDivElement>(null);
    const aliveRef = useRef(true);
    const daysInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // ⚠️ 旗標必須在每次掛載時設回 true（StrictMode 的假卸載會把它永久關掉）
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    // 季節註記（快取命中即零延遲；失敗＝該行不顯示，永不擋路）
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let d: DestinationDeep | null = null;
            try { d = await fetchDestinationDeep(query); } catch { d = null; }
            if (!cancelled && aliveRef.current) setDeep(d);
        })();
        return () => { cancelled = true; };
    }, [query]);

    /**
     * ⚠️ 年份**不再自動推算**（2026-08-05 Kelvin 裁決）。
     * 舊版沿用「比今天早的月份＝明年」的聰明規則，結果在 2026 的年曆上出現一堆小小的「2027」——
     * 使用者當場疑惑。**清楚優先於聰明**：翻到哪一年就是哪一年，已經過去的月份淡掉、不可點；
     * 想去明年三月，就按 `›` 翻到 2027 再圈。
     */
    const yearOfMonth = useCallback((): number => year, [year]);
    /** 這個月份已經過去了（只可能發生在年曆停在今年時） */
    const isPastMonth = useCallback(
        (m: number): boolean => year === thisYear && m < thisMonth,
        [year, thisYear, thisMonth],
    );

    /** 動到粗略層＝精確日期已經與畫面不一致，必須清掉（兩層永遠說同一件事） */
    const dropExact = useCallback(() => {
        setStartDate(null);
        setEndDate(null);
    }, []);

    const pickMonth = (m: number) => {
        if (isPastMonth(m)) return;            // 過去的月份不可點（畫面上也已經淡掉）
        if (month === m) {                     // 再點一次＝擦掉
            setMonth(null);
            dropExact();
            playPageSound('eraser');
            hapticTap();
            return;
        }
        setMonth(m);
        setExpertOpen(false);
        dropExact();
        if (exactOpen) { setCalMonth(m); setCalYear(yearOfMonth()); }   // 日曆已展開＝跟著跳到那個月
        playPageSound('penCircle');
        hapticTap();
    };

    const changeDays = (n: number) => {
        const v = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
        if (v === days) return;
        setDays(v);
        // ⚠️ 不沒收使用者已經選好的日期：起點不動，回程日跟著新天數往後移。
        //   舊版是「動了粗略層就清掉精確日期」——一次手滑就把辛苦選的日子拿走，而且沒有任何提示。
        if (startDate) setEndDate(addDays(startDate, v - 1));
        hapticTap();                            // 每一格一個輕震（拉桿的手感）
    };

    const commitDaysDraft = () => {
        const v = parseInt(daysDraft, 10);
        setEditingDays(false);
        if (!Number.isFinite(v)) return;
        changeDays(v);
    };

    // ── 精確層 ──────────────────────────────────────────────────────
    const openExact = () => {
        // 開啟時自動跳到已選月份（舊版失憶是 Kelvin 抓到的缺陷）
        if (month) { setCalMonth(month); setCalYear(yearOfMonth()); }
        else { setCalMonth(thisMonth); setCalYear(thisYear); }
        setExactOpen(true);
        playPageSound('paperSlide');
        hapticTap();
        // 展開的東西自己走到眼前：等一幀讓 DOM 先長出來再捲
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                exactRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' });
            });
        });
    };

    const shiftCalendar = (delta: number) => {
        const raw = calMonth - 1 + delta;
        const y = calYear + Math.floor(raw / 12);
        const m = ((raw % 12) + 12) % 12 + 1;
        // 不讓他翻到已經過去的月份（整頁都是禁用的日子＝白給一個死畫面）
        if (y < thisYear || (y === thisYear && m < thisMonth)) return;
        setCalYear(y);
        setCalMonth(m);
    };

    const pickDay = (iso: string) => {
        // 尚未有起點、或已經是完整區間 → 重新從這一天開始
        if (!startDate || (startDate && endDate)) {
            setStartDate(iso);
            setEndDate(null);
            playPageSound('penCircle');
            hapticTap();
            return;
        }
        if (iso < startDate) {                  // 往前點＝改起點（不做反向區間）
            setStartDate(iso);
            playPageSound('penCircle');
            hapticTap();
            return;
        }
        // 完成區間：同步回月份與天數（雙向同步；只播一聲——起點圈重繪時靜默）
        setEndDate(iso);
        const [sy, sm] = startDate.split('-').map(Number);
        setMonth(sm);
        setYear(sy);
        setDays(Math.min(MAX_DAYS, Math.max(MIN_DAYS, inclusiveDays(startDate, iso))));
        playPageSound('penCircle');
        hapticTap();
    };

    /** 由「月份＋天數」推一組建議日期（只在使用者要求精確層時當預填，不自動寫進結果） */
    const suggestStart = useCallback((): string => {
        const m = month ?? thisMonth;
        const y = month ? yearOfMonth() : thisYear;
        const d = (y === thisYear && m === thisMonth) ? Math.min(now.getDate() + 7, daysInMonth(y, m)) : 1;
        return isoOf(y, m, d);
    }, [month, thisMonth, thisYear, now, yearOfMonth]);

    const grid = useMemo(() => {
        const lead = firstWeekday(calYear, calMonth);
        const total = daysInMonth(calYear, calMonth);
        const cells: Array<string | null> = Array(lead).fill(null);
        for (let d = 1; d <= total; d++) cells.push(isoOf(calYear, calMonth, d));
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [calYear, calMonth]);

    const todayIso = isoOf(thisYear, thisMonth, now.getDate());
    /** 倒數：有確切日期就數到那一天，否則數到那個月的 1 號——把「計畫」變成「倒數」 */
    const countdown = useMemo(() => {
        if (!month) return null;
        const target = startDate || isoOf(yearOfMonth(), month, 1);
        const n = inclusiveDays(todayIso, target) - 1;
        return n > 0 ? n : null;
    }, [month, startDate, yearOfMonth, todayIso]);
    /** 風險提示：只給查得到、通用的提醒（不編造即時路況；專業感來自說出他不知道的事） */
    const risk = useMemo(() => {
        if (!month) return null;
        const winter = month === 12 || month === 1 || month === 2;
        if (winter && ALPINE_HINT.test(breadcrumb)) return '冬天的高山可能結冰或封路，出發前記得查即時路況與雪鏈規定';
        return null;
    }, [month, breadcrumb]);
    const note = month ? seasonNote(deep, month) : null;
    const expertRows = useMemo(() => seasonTable(deep), [deep]);
    const density = densityWarning(placeCount, days);
    const rulerValue = Math.min(RULER_MAX, days);
    const exact = !!(startDate && endDate);
    /**
     * 粗略層（年曆＋拉桿＋專家清單）收起的時機：**有確切日期且日曆已關閉**。
     *   - 為什麼不是「選完第二個日期就收」：上面的內容瞬間變短，日曆會從使用者指頭底下往上跳。
     *   - 為什麼要收而不是淡出：半透明但仍可拖的拉桿是陷阱——看起來停用，手滑碰到卻會默默改掉回程日。
     *     **要嘛能動、要嘛收起來，不該有中間狀態。**
     */
    const coarseHidden = exact && !exactOpen;
    /** 跨月的旅程要說兩句季節（天氣真的會變）——但年曆不必顯示兩個月，那是輸入工具，已經不是輸入了 */
    const endMonth = endDate ? Number(endDate.slice(5, 7)) : null;
    const noteEnd = exact && endMonth && endMonth !== month ? seasonNote(deep, endMonth) : null;

    const guardNext = (): boolean => {
        if (!month) {
            // 只有真的有季節建議可看時才叫他去點——沒有資料卻叫人去點一行不存在的字＝失信
            toast(expertRows.length > 0 ? '先圈一個月份——還沒想法的話，點下面那行我給你建議' : '先圈一個月份', 'info');
            if (expertRows.length > 0) setExpertOpen(true);
            return false;
        }
        return true;
    };

    const submit = () => {
        const m = month as number;
        onNext({
            month: m,
            year: exact ? Number(startDate!.split('-')[0]) : yearOfMonth(),
            days,
            startDate: exact ? startDate! : undefined,
            endDate: exact ? endDate! : undefined,
            exact,
        });
    };

    return (
        <div className="fixed inset-0 z-[90] overflow-hidden" style={{ backgroundColor: '#1b1510' }}>
            {/* 背景：沿用前面幾頁那張照片（物件連續） */}
            <div className="absolute inset-0" style={{
                backgroundImage: isDomestic ? 'linear-gradient(165deg,#4a5c48,#222b21)' : 'linear-gradient(165deg,#3A6350,#22372a)',
            }} />
            {coverUrl && (
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                }} />
            )}
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,14,13,.6), rgba(15,14,13,.84))' }} />

            <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                <button onClick={onBack} aria-label="上一步" className="absolute left-3 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <ChevronLeft className="w-5 h-5 text-white/80" />
                </button>
                <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <X className="w-5 h-5 text-white/80" />
                </button>

                {/* 麵包屑：墨白襯線字直落照片（無底無框） */}
                <div className="text-center font-serif text-[11px] text-white/70 mt-1 px-12 truncate" style={{ textShadow: ON_PHOTO_SHADOW }}>{breadcrumb}</div>

                <div className="px-6 pt-4 pb-1 text-center" style={{ minHeight: 58 }}>
                    {scrolled && month ? (
                        <div className="font-serif text-[15px] text-[#F6F1E7] pt-2" style={{ textShadow: ON_PHOTO_SHADOW }}>
                            {exact
                                ? `${startDate!.slice(5).replace('-', '.')} – ${endDate!.slice(5).replace('-', '.')} · ${days} 天`
                                : `${month} 月 · ${days} 天`}
                        </div>
                    ) : (
                        <>
                            <div className="font-serif text-[22px] font-bold text-[#F6F1E7]" style={{ textShadow: ON_PHOTO_SHADOW }}>什麼時候去？</div>
                            <div className="font-mono text-[9px] tracking-[0.32em] text-white/65 mt-1.5" style={{ textShadow: ON_PHOTO_SHADOW }}>WHEN</div>
                        </>
                    )}
                </div>

                <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-3"
                    onScroll={e => {
                        const el = e.currentTarget;
                        setScrolled(el.scrollTop > 130);
                        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
                    }}>
                    {/* ── ①月份層：品牌年曆（有確切日期並關閉日曆後收起） ───────── */}
                    {!coarseHidden && (
                    <div className="relative mx-auto" style={{
                        maxWidth: 300,
                        backgroundColor: PAPER,
                        borderRadius: PAPER_RADIUS,
                        boxShadow: paperShadow('rest'),
                        padding: '12px 12px 10px',
                    }}>
                        <PaperTexture keyline={false} dense />
                        {/* 頂部兩枚裝訂孔：打穿紙、看得到底下的照片 */}
                        <span aria-hidden className="absolute w-[9px] h-[9px] rounded-full"
                            style={{ top: -4, left: '32%', backgroundColor: 'rgba(18,15,12,.62)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.5)' }} />
                        <span aria-hidden className="absolute w-[9px] h-[9px] rounded-full"
                            style={{ top: -4, right: '32%', backgroundColor: 'rgba(18,15,12,.62)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.5)' }} />

                        {/* 刊頭：雙細線＋年份（兩側 ‹ › 切年）——紙上一律用墨 */}
                        <div className="relative flex items-center justify-between py-1.5 mb-2"
                            style={{ borderTop: '1px solid rgba(35,35,32,.45)', borderBottom: '1px solid rgba(35,35,32,.18)' }}>
                            <button onClick={() => setYear(y => Math.max(thisYear, y - 1))} aria-label="上一年"
                                className="px-2 text-[13px]" style={{ color: 'rgba(35,35,32,.5)' }}>‹</button>
                            <span className="font-mono text-[9px] tracking-[0.22em]" style={{ color: INK_PRINT }}>KELVIN TRIP · {year}</span>
                            <button onClick={() => setYear(y => Math.min(thisYear + 2, y + 1))} aria-label="下一年"
                                className="px-2 text-[13px]" style={{ color: 'rgba(35,35,32,.5)' }}>›</button>
                        </div>

                        {SEASON_ROWS.map(row => (
                            <div key={row.label} className="relative grid items-center" style={{ gridTemplateColumns: '20px repeat(3, minmax(0,1fr))', gap: '0 4px' }}>
                                <span className="font-serif text-[10px]" style={{ color: 'rgba(35,35,32,.42)', letterSpacing: '.08em' }}>{row.label}</span>
                                {row.months.map(m => {
                                    const on = month === m;
                                    const isNow = year === thisYear && m === thisMonth;
                                    const past = isPastMonth(m);
                                    return (
                                        <button key={m} onClick={() => pickMonth(m)} aria-pressed={on} disabled={past}
                                            aria-label={past ? `${m} 月（已經過了）` : `${year} 年 ${m} 月`}
                                            className="relative flex items-center justify-center"
                                            style={{ height: 44 }}>
                                            {/* 圈要圈住「數字」，不是圈住整個格子——圈的大小必須配字的大小 */}
                                            <span className="relative inline-block">
                                                <span className="font-serif text-[13px]"
                                                    style={{ color: past ? 'rgba(35,35,32,.24)' : INK_PRINT, letterSpacing: '.02em' }}>{m}</span>
                                                {on && <HandCircle seed={seedOf(`m${m}`)} color={INK_INK} instant={instant} />}
                                            </span>
                                            {/* 「今天」記號絕對定位：不佔高度，四排才會等高 */}
                                            {isNow && (
                                                <span className="absolute font-serif text-[7px] whitespace-nowrap"
                                                    style={{ bottom: 3, color: '#3F6B52' }}>今天</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    )}

                    {/* 季節回應行：那個月的那個地方長什麼樣（deep.seasons，零額外成本）。
                        **收起粗略層之後這一行留著**——它不是輸入控制項，是回報：你剛決定了日期，
                        它告訴你那時候的那個地方長什麼樣。這是這一頁唯一的情感產物。 */}
                    {note && (
                        <div className="text-center font-serif text-[11px] mt-3" style={{ color: INK_GOLD, textShadow: ON_PHOTO_SHADOW }}>
                            {note}
                        </div>
                    )}
                    {noteEnd && (
                        <div className="text-center font-serif text-[11px] mt-1" style={{ color: INK_GOLD, textShadow: ON_PHOTO_SHADOW }}>
                            {noteEnd}
                        </div>
                    )}
                    {risk && (
                        <div className="text-center font-serif text-[11px] mt-1.5" style={{ color: INK_AMBER, textShadow: ON_PHOTO_SHADOW }}>
                            {risk}
                        </div>
                    )}
                    {countdown && (
                        <div className="text-center font-mono text-[10px] tracking-[0.14em] mt-2"
                            style={{ color: 'rgba(246,241,231,.7)', textShadow: ON_PHOTO_SHADOW }}>
                            還有 {countdown} 天
                        </div>
                    )}

                    {/* 專家時刻：還沒想法時，把整年攤開讓他挑（點一列＝直接圈那個月） */}
                    {!coarseHidden && !month && expertRows.length > 0 && (
                        <div className="text-center mt-3">
                            <button onClick={() => { setExpertOpen(o => !o); hapticTap(); }}
                                className="font-serif text-[12px] font-bold underline underline-offset-4"
                                style={{ color: '#F6F1E7', textDecorationColor: 'rgba(246,241,231,.5)', textShadow: '0 1px 4px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.6)' }}>
                                {expertOpen ? '收起來' : '還沒想法？看看每個月的樣子'}
                            </button>
                            {expertOpen && (
                                <div className="mt-3 mx-auto text-left" style={{ maxWidth: 300 }}>
                                    {expertRows.map(r => (
                                        <button key={r.month} onClick={() => pickMonth(r.month)} disabled={isPastMonth(r.month)}
                                            className="w-full flex items-baseline gap-2 py-1.5"
                                            style={{ borderBottom: '1px solid rgba(201,185,143,.14)' }}>
                                            <span className="font-mono text-[11px] shrink-0 whitespace-nowrap text-right"
                                                style={{ width: 34, color: INK_GOLD, textShadow: ON_PHOTO_SHADOW }}>{r.month} 月</span>
                                            <span className="font-serif text-[11px] text-white/80" style={{ textShadow: ON_PHOTO_SHADOW }}>{r.note}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ②天數層：尺規拉桿 ─────────────────────────────── */}
                    {!coarseHidden && (
                    <div className="mt-7 mx-auto" style={{ maxWidth: 300 }}>
                        <div className="text-center">
                            {editingDays ? (
                                <input
                                    ref={daysInputRef}
                                    autoFocus
                                    value={daysDraft}
                                    inputMode="numeric"
                                    onChange={e => setDaysDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                    onBlur={commitDaysDraft}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDaysDraft(); } }}
                                    aria-label="自訂天數"
                                    className="bg-transparent text-center font-mono text-[26px] text-[#F6F1E7] outline-none w-16"
                                    style={{ caretColor: INK_GOLD, borderBottom: `1px dashed ${INK_GOLD}` }}
                                />
                            ) : (
                                <button onClick={() => { setDaysDraft(String(days)); setEditingDays(true); hapticTap(); }}
                                    aria-label="點一下自訂天數"
                                    className="font-mono text-[26px] text-[#F6F1E7]"
                                    style={{ borderBottom: '1px dashed rgba(201,185,143,.6)', paddingBottom: 1, textShadow: ON_PHOTO_SHADOW }}>
                                    {days}
                                </button>
                            )}
                            <span className="font-serif text-[11px] text-white/70 ml-1" style={{ textShadow: ON_PHOTO_SHADOW }}>天</span>
                        </div>

                        {/* 尺規：刻度在下、拉桿在上（原生 range＝鍵盤與輔助技術可用，拖曳也不會捲到頁面） */}
                        <div className="relative mt-3" style={{ height: 30 }}>
                            <div className="absolute left-0 right-0" style={{ top: 13, height: 1, backgroundColor: 'rgba(201,185,143,.4)' }} />
                            <div className="absolute left-0 right-0 flex justify-between" style={{ top: 7 }}>
                                {Array.from({ length: RULER_MAX - MIN_DAYS + 1 }, (_, i) => i + MIN_DAYS).map(v => (
                                    <span key={v} aria-hidden style={{
                                        width: 1, height: v % 4 === 2 ? 11 : 6,
                                        backgroundColor: v % 4 === 2 ? 'rgba(201,185,143,.5)' : 'rgba(201,185,143,.32)',
                                    }} />
                                ))}
                            </div>
                            <input
                                type="range"
                                min={MIN_DAYS}
                                max={RULER_MAX}
                                step={1}
                                value={rulerValue}
                                onChange={e => changeDays(Number(e.target.value))}
                                aria-label="天數"
                                className="kt-ruler absolute inset-0 w-full appearance-none bg-transparent"
                                style={{ height: 30 }}
                            />
                        </div>

                        {/* 快速刻度：常見天數點一下就到；14 天以上走「自訂」（拉桿刻度到 14 為止，
                            再長的尺規在手機上每一格太小，反而選不準） */}
                        <div className="relative mt-1" style={{ height: 22 }}>
                            {[3, 5, 7, 10, 14].map(v => (
                                <button key={v} onClick={() => changeDays(v)}
                                    className="absolute font-mono text-[11px] px-1"
                                    style={{
                                        // 與上方刻度同一套幾何：第一格在 0%、最後一格在 100%
                                        left: `${((v - MIN_DAYS) / (RULER_MAX - MIN_DAYS)) * 100}%`,
                                        transform: 'translateX(-50%)',
                                        color: days === v ? '#F6F1E7' : 'rgba(246,241,231,.55)',
                                        textShadow: ON_PHOTO_SHADOW,
                                        borderBottom: days === v ? `1px solid ${INK_GOLD}` : '1px solid transparent',
                                    }}>{v}</button>
                            ))}
                        </div>
                        <div className="text-center mt-1">
                            <button onClick={() => { setDaysDraft(String(days)); setEditingDays(true); hapticTap(); }}
                                className="font-serif text-[11px] underline underline-offset-4"
                                style={{ color: 'rgba(246,241,231,.7)', textShadow: ON_PHOTO_SHADOW, textDecorationColor: 'rgba(255,255,255,.35)' }}>
                                自訂天數（最多 {MAX_DAYS} 天）
                            </button>
                        </div>

                        {/* 理由行（縮圈反哺）與密度提醒（只陳述事實，永不擋路） */}
                        {suggestedDaysHint > 0 && !density && (
                            <div className="text-center font-serif text-[10px] text-white/65 mt-2" style={{ textShadow: ON_PHOTO_SHADOW }}>
                                {placeCount} 個地方，建議 {suggestedDaysHint} 天左右
                            </div>
                        )}
                        {density && (
                            <div className="text-center font-serif text-[10px] mt-2" style={{ color: INK_AMBER, textShadow: ON_PHOTO_SHADOW }}>{density}</div>
                        )}
                    </div>
                    )}

                    {/* ── ③精確層：可展開的日曆 ─────────────────────────── */}
                    <div ref={exactRef} className="mt-7 mx-auto" style={{ maxWidth: 300 }}>
                        {!exactOpen && !exact && (
                            <button onClick={openExact}
                                className="w-full font-serif text-[12px] text-white/80 underline underline-offset-4 decoration-white/40 py-1" style={{ textShadow: ON_PHOTO_SHADOW }}>
                                已經有確切日期？
                            </button>
                        )}

                        {exact && !exactOpen && (
                            <div className="flex flex-col items-center">
                                {/* 摘要籤（定稿：精確日期選定→摺疊成摘要籤）：**事實印在紙上**，
                                    照片再花也吃不掉；也讓「已經決定」這件事有一個實體的落點。 */}
                                <div className="relative px-4 py-2" style={{
                                    backgroundColor: PAPER,
                                    borderRadius: PAPER_RADIUS,
                                    boxShadow: paperShadow('picked'),
                                }}>
                                    <PaperTexture keyline={false} seal={false} />
                                    <span className="relative font-serif text-[14px]" style={{ color: INK_PRINT, letterSpacing: '.02em' }}>
                                        {startDate!.replace(/-/g, '.')} – {endDate!.slice(5).replace('-', '.')}
                                    </span>
                                    <span className="relative font-serif text-[12px] ml-2" style={{ color: '#6B665C' }}>· {days} 天</span>
                                </div>
                                {/* 兩條回頭路都明講，不會有人被鎖在裡面 */}
                                <div className="flex items-center gap-6 mt-3">
                                    <button onClick={openExact}
                                        className="font-serif text-[11px] text-white/78 underline underline-offset-4 decoration-white/40"
                                        style={{ textShadow: ON_PHOTO_SHADOW }}>改日期</button>
                                    <button onClick={() => { dropExact(); hapticTap(); }}
                                        className="font-serif text-[11px] text-white/78 underline underline-offset-4 decoration-white/40"
                                        style={{ textShadow: ON_PHOTO_SHADOW }}>改用月份與天數</button>
                                </div>
                            </div>
                        )}

                        {exactOpen && (
                            <div className="relative" style={{
                                backgroundColor: PAPER,
                                borderRadius: PAPER_RADIUS,
                                boxShadow: paperShadow('rest'),
                                padding: '12px 12px 10px',
                            }}>
                                <PaperTexture keyline={false} dense />
                                {/* 左上一枚撕頁孔（與年曆的裝訂孔同一套語彙） */}
                                <span aria-hidden className="absolute w-[9px] h-[9px] rounded-full"
                                    style={{ top: -4, left: 18, backgroundColor: 'rgba(18,15,12,.62)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.5)' }} />

                                <div className="relative flex items-center justify-between py-1.5 mb-2"
                                    style={{ borderTop: '1px solid rgba(35,35,32,.45)', borderBottom: '1px solid rgba(35,35,32,.18)' }}>
                                    <button onClick={() => shiftCalendar(-1)} aria-label="上個月" className="px-2 text-[13px]" style={{ color: 'rgba(35,35,32,.5)' }}>‹</button>
                                    <span className="font-mono text-[10px] tracking-[0.18em]" style={{ color: INK_PRINT }}>{calYear} · {pad2(calMonth)}</span>
                                    <button onClick={() => shiftCalendar(1)} aria-label="下個月" className="px-2 text-[13px]" style={{ color: 'rgba(35,35,32,.5)' }}>›</button>
                                </div>

                                <div className="relative grid grid-cols-7 gap-y-1 mb-1">
                                    {WEEKDAYS.map(w => (
                                        <span key={w} className="text-center font-serif text-[9px]" style={{ color: 'rgba(35,35,32,.4)' }}>{w}</span>
                                    ))}
                                </div>

                                <div className="relative grid grid-cols-7 gap-y-1">
                                    {grid.map((iso, i) => {
                                        if (!iso) return <span key={`b${i}`} />;
                                        const d = Number(iso.slice(8));
                                        const isStart = iso === startDate;
                                        const isEnd = iso === endDate;
                                        const inRange = !!(startDate && endDate && iso > startDate && iso < endDate);
                                        const past = iso < todayIso;
                                        return (
                                            <button key={iso} onClick={() => pickDay(iso)} disabled={past}
                                                aria-label={`${iso}${isStart ? ' 出發' : isEnd ? ' 回程' : ''}`}
                                                className="relative py-1.5 flex items-center justify-center"
                                                style={{ backgroundColor: inRange ? 'rgba(35,35,32,.09)' : undefined }}>
                                                {/* 圈住數字（不是圈住格子）——與年曆同一個比例，畫面才一致 */}
                                                <span className="relative inline-block">
                                                    <span className="font-serif text-[13px]" style={{
                                                        color: past
                                                            ? 'rgba(35,35,32,.26)'
                                                            : (holidayOf(iso) || isWeekend(iso)) ? STAMP_RED : INK_PRINT,
                                                    }}>{d}</span>
                                                    {(isStart || isEnd) && <HandCircle seed={seedOf(iso)} color={INK_INK} instant />}
                                                </span>
                                                {/* 連假：數字下面一點紅——週末已經是紅字，連假再多一個記號 */}
                                                {!past && holidayOf(iso) && (
                                                    <span aria-hidden className="absolute rounded-full"
                                                        style={{ bottom: 2, width: 3, height: 3, backgroundColor: STAMP_RED }} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* 當月的連假：**大部分人的日期是被假期決定的**，這一行比季節更影響決策 */}
                                {hasHolidayData(calYear) && holidaysInMonth(calYear, calMonth).length > 0 && (
                                    <div className="relative mt-2 text-center">
                                        {holidaysInMonth(calYear, calMonth).slice(0, 2).map(h => (
                                            <div key={h.name} className="font-serif text-[10px]" style={{ color: STAMP_RED }}>
                                                {h.start.slice(5).replace('-', '/')}
                                                {h.end !== h.start ? `–${h.end.slice(5).replace('-', '/')}` : ''} {h.name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 起點常駐顯示：舊版選完起點就失憶，使用者不知道下一步要點什麼 */}
                                <div className="relative text-center font-serif text-[10px] mt-2.5" style={{ color: 'rgba(35,35,32,.62)' }}>
                                    {!startDate && '選擇出發日'}
                                    {startDate && !endDate && `${startDate.slice(5).replace('-', '.')} 出發 → 選擇回程日`}
                                    {startDate && endDate && `${startDate.slice(5).replace('-', '.')} – ${endDate.slice(5).replace('-', '.')} · ${days} 天`}
                                </div>

                                <div className="relative flex items-center justify-center gap-5 mt-2">
                                    {!startDate && (
                                        <button onClick={() => {
                                            const s = suggestStart();
                                            setStartDate(s); setEndDate(addDays(s, days - 1));
                                            setCalYear(Number(s.slice(0, 4))); setCalMonth(Number(s.slice(5, 7)));   // 日曆跟著跳過去
                                            playPageSound('penCircle'); hapticTap();
                                        }}
                                            className="font-serif text-[11px] underline underline-offset-4"
                                            style={{ color: 'rgba(35,35,32,.6)', textDecorationColor: 'rgba(35,35,32,.28)' }}>
                                            用上面的月份與天數幫我填
                                        </button>
                                    )}
                                    <button onClick={() => { setExactOpen(false); dropExact(); hapticTap(); }}
                                        className="font-serif text-[11px] underline underline-offset-4"
                                        style={{ color: 'rgba(35,35,32,.6)', textDecorationColor: 'rgba(35,35,32,.28)' }}>
                                        還是先不指定
                                    </button>
                                    {exact && (
                                        <button onClick={() => { setExactOpen(false); hapticTap(); }}
                                            className="font-serif text-[11px] font-bold underline underline-offset-4"
                                            style={{ color: INK_INK, textDecorationColor: 'rgba(35,35,32,.4)' }}>
                                            就這樣
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                    {/* A：底部漸層——內容被切在空白處時，這道漸層說明「下面還有」。
                        捲到底自動收起；pointer-events none，不吃點擊。 */}
                    <div aria-hidden className="absolute left-0 right-0 pointer-events-none"
                        style={{
                            bottom: '100%', height: 42,
                            backgroundImage: 'linear-gradient(rgba(15,14,13,0), rgba(15,14,13,.82))',
                            opacity: atBottom ? 0 : 1, transition: 'opacity .3s ease',
                        }} />
                    <TicketNextButton onPress={guardNext} onNext={submit} />
                </div>
            </div>

            <style>{`
                ${INK_KEYFRAMES}
                /* 尺規拉桿：原生 range 去皮，只留一顆紙色拇指（軌道由下層的刻度線負責） */
                input[type="range"].kt-ruler::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none;
                    width: 18px; height: 18px; border-radius: 50%;
                    background: #F6F1E7; box-shadow: 0 2px 6px rgba(0,0,0,.45); cursor: pointer;
                }
                input[type="range"].kt-ruler::-moz-range-thumb {
                    width: 18px; height: 18px; border: none; border-radius: 50%;
                    background: #F6F1E7; box-shadow: 0 2px 6px rgba(0,0,0,.45); cursor: pointer;
                }
                input[type="range"].kt-ruler::-webkit-slider-runnable-track { background: transparent; height: 30px; }
                input[type="range"].kt-ruler::-moz-range-track { background: transparent; height: 30px; }
            `}</style>
        </div>
    );
};
