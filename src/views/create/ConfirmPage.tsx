// src/views/create/ConfirmPage.tsx
// 📜 生成表單・⑧「確認與生成」幕（docs E3 定稿 ＋ 2026-08-10 六拍定案；mockup `mockups/step8-confirm.html`）
//
//   六拍：①核對（行程確認書）→ ②抽新紙 → ③等待（紙張輪播＋回述文案）→ ④揭幕（這一趟的封面）
//        → ⑤速覽（行程概覽）→ ⑥出票＋蓋章（合併）
//
//   ── 三個關鍵決定 ─────────────────────────────────────────────
//   ①🔴 **第③拍不做串流、也不假裝在寫**。定案原本是「鋼筆逐字書寫真實生成內容」，但管線是
//     「等 Gemini 回完整結果才回應」——逐字顯示已到手的內容＝**假的進度條**；而完整行程約
//     2000 字，用 95–165ms/字要三分鐘，使用者第 30 秒就拿到結果了，那是**在拖延**。
//     改成**背景輪播他填過的紙 ＋ 文案直接引用他填的內容**——那不是 loading 動畫，是**證據**：
//     證明系統真的讀了他寫的東西。「修辭 vs 證據」：「正漫步在靈感森林」是修辭，
//     「你劃掉了部落尋訪，我避開了」是證據。全部從 brief 現撈，**零 LLM 成本**。
//   ②**⑥⑦ 合併**：章本來就該蓋在票上；蓋章是按「進入規劃行程」的副產品——**承諾與行動合一**。
//     章落下後**停留 2 秒**再進去：那 2 秒不是拖延，**承諾要被看見才算數**（Kelvin 定案）。
//     （那 2 秒同時拿來跑 geocode，一點都不浪費。）
//   ③**每一趟都完整演出**（Kelvin 定案）：演出是在利用 LLM 回傳的時間空檔——
//     只有第③拍是「填滿等待」，其他拍都有實際功能（核對＝最後攔截、速覽＝看內容、出票＝承諾）。
//
//   🏛️ 古典化的手法不是裝飾多，是**排版的紀律**：雙細線框、四角 L 形角飾、寬字距、菱形飾記。
//     五個畫面共用同一套語彙＝同一份文件的五頁。
//
//   ⚠️ 這一頁把生成邏輯從 `CreateTripModal.handleCreate` 搬了過來——舊 modal 從此只服務
//     「手動建立空白行程」。兩組**字彙轉換的唯一轉換點**也跟著搬到這裡：
//     `BudgetLevel.economy` ↔ 舊資料的 `cheap`、`LocalTransport.charter` ↔ 舊欄位的 `taxi`。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Trip, TripDay, TripConstraints, RearrangeMood } from '../../types';
import { playPageSound, hapticTap } from '../../services/sounds';
import { generateItinerary } from '../../services/gemini';
import { recalculateTimeline } from '../../services/timeline';
import { ensureTripGeocoded } from '../../services/geo';
import { currencyForCountry } from '../../services/tripBrief';
import { MOOD_LABEL } from '../../services/tripBrief';
import type { WhenResult } from './WhenPage';
import { legacyCompanionId, type HowResult } from './HowPage';
import type { NotesResult } from './NotesPage';
import { PaperTexture, PAPER, INK_PRINT, INK_KEYFRAMES } from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const STAMP_RED = '#A23B2E';
const SEAL_GREEN = '#3F6B52';
/**
 * 等待的**最短時間**：生成太快（快取熱、行程短）時，回述文案會在使用者讀完第一句前就被蓋掉
 * ——那些句子等於沒出現。⚠️ 這不是拖延，是**避免閃現**；超過下限就立刻走，絕不多等。
 * ⚠️ 必須**大於一句話的停留時間**（SAY_MS 3.5s），否則第一句還沒讀完畫面就換了。
 *    ❌「抽新紙」那一拍已移除（2026-08-10 Kelvin：一掃而過、沒有存在感），
 *      它原本吃掉的 1.4s 要補回這裡，不然總等待會短一截。
 */
const MIN_WAIT_MS = 3600;
/** 回述文案的節奏：一句停 3.5 秒、**不重複**（重複會立刻暴露「它只是在轉圈」） */
const SAY_MS = 3500;
/** 網路慢的提示：**18 秒才出現**——太早道歉反而讓人覺得慢 */
const SLOW_AT_MS = 18000;
/** 等太久的出路：60 秒給他離開的門（生成繼續跑，回來得及就照常揭幕） */
const LONG_AT_MS = 60000;
/** 蓋章後停留：**承諾要被看見才算數**，蓋完就閃走等於沒蓋（同時拿來跑 geocode） */
const STAMP_HOLD_MS = 2000;

type Phase = 'review' | 'wait' | 'error' | 'reveal' | 'overview' | 'ticket';
export type EditStep = 'entry' | 'when' | 'how' | 'notes';

export interface ConfirmDone {
    trip: Trip;
}

// ── 純函式（可測、無副作用）────────────────────────────────────────

/** 本地時區的 YYYY-MM-DD（絕不能用 toISOString——UTC 會讓日期少一天） */
const isoOf = (y: number, m: number, d: number): string =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * 日期推導：有確切日期就用；**沒有＝該月 1 號起算的佔位日期**（過去則從今天起）。
 * ⚠️ 誠實說明：`Trip` 的資料模型要求絕對日期，但「10 月、4 天」的人還沒決定——
 *    這裡的佔位遵循「活動掛相對天數、絕對日期是投影」原則（§1 原則 10）：
 *    之後改日期是純位移，行程結構全部存活。
 */
const deriveDates = (w: WhenResult): { start: string; end: string } => {
    if (w.exact && w.startDate && w.endDate) return { start: w.startDate, end: w.endDate };
    const today = new Date();
    let base = new Date(w.year, w.month - 1, 1);
    if (base < today) base = today;
    const end = new Date(base);
    end.setDate(base.getDate() + w.days - 1);
    return {
        start: isoOf(base.getFullYear(), base.getMonth() + 1, base.getDate()),
        end: isoOf(end.getFullYear(), end.getMonth() + 1, end.getDate()),
    };
};

/**
 * 票券編號：**必須穩定**——同一趟每次看到都是同一組號碼（用出發日＋天數推導，不用亂數）。
 * **一張每次刷新就換號的票，就不是票了。** 例：出發 2026-08-19、4 天 → KT-260819-04
 */
const ticketNo = (start: string, days: number): string =>
    `KT-${start.slice(2).replace(/-/g, '')}-${String(days).padStart(2, '0')}`;

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
/** 中文天數（第十一天之後退回數字——中文數字的優勢只到十） */
const cnDay = (n: number): string => (n <= 10 ? `第${CN_NUM[n - 1]}天` : `第 ${n} 天`);
const cnDays = (n: number): string => (n <= 10 ? `共${CN_NUM[n - 1]}天` : `共 ${n} 天`);

const SLOT_LABEL: Record<string, string> = { morning: '早上', afternoon: '下午', evening: '晚上' };
const PACE_TEXT: Record<string, { name: string; num: string }> = {
    relaxed: { name: '悠閒', num: '一天 2–3 個地方' },
    standard: { name: '標準', num: '一天 4–5 個地方' },
    packed: { name: '緊湊', num: '一天 6 個以上' },
    deep: { name: '深度', num: '一天 1–2 個地方' },
};
const MOVE_TEXT: Record<string, string> = { public: '搭大眾運輸', car: '自己開車', charter: '包車' };
const BUDGET_TEXT: Record<string, string> = { economy: '省著花', standard: '剛剛好', luxury: '不將就' };

interface Saying { paper: 'where' | 'when' | 'how' | 'notes' | null; html: React.ReactNode }

// ── 共用小元件（**必須在模組層級**，元件內定義元件會讓子樹被卸載重掛）──────

/** 四角 L 形角飾（古典文件的裁切／對位記號） */
const Corners: React.FC = () => {
    const bar = 'rgba(35,35,32,.5)';
    const mk = (pos: React.CSSProperties, flipX: boolean, flipY: boolean): React.CSSProperties => ({
        position: 'absolute', width: 11, height: 11, pointerEvents: 'none', opacity: .42, ...pos,
        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
    });
    const L = (
        <svg width="11" height="11" viewBox="0 0 11 11">
            <path d="M0 .5 H11 M.5 0 V11" stroke={bar} strokeWidth="1" fill="none" />
        </svg>
    );
    return (
        <>
            <span aria-hidden style={mk({ left: 13, top: 13 }, false, false)}>{L}</span>
            <span aria-hidden style={mk({ right: 13, top: 13 }, true, false)}>{L}</span>
            <span aria-hidden style={mk({ left: 13, bottom: 13 }, false, true)}>{L}</span>
            <span aria-hidden style={mk({ right: 13, bottom: 13 }, true, true)}>{L}</span>
        </>
    );
};

/** 細線＋菱形飾記 */
const DLine: React.FC<{ width?: number | string; margin?: string }> = ({ width = 34, margin = '13px auto 0' }) => (
    <div aria-hidden style={{ position: 'relative', height: 1, background: 'rgba(35,35,32,.16)', width, margin }}>
        <span style={{
            position: 'absolute', left: '50%', top: -7, transform: 'translateX(-50%)',
            fontSize: 6.5, color: 'rgba(35,35,32,.34)', background: PAPER, padding: '0 6px',
        }}>◆</span>
    </div>
);

/** 手繪打勾（與 ⑥ 的 CheckOption 同一道筆跡） */
const CheckMark: React.FC<{ on: boolean }> = ({ on }) => (
    <span aria-hidden style={{ position: 'relative', flex: 'none', width: 14, height: 14, marginTop: 3, border: '1px solid rgba(35,35,32,.32)' }}>
        {on && (
            <svg viewBox="0 0 16 16" width="14" height="14" style={{ position: 'absolute', left: -1, top: -1, overflow: 'visible' }}>
                <path d="M3.4 8.2 C4.5 9.1, 5.3 10.2, 6.2 11.8 C8.0 8.2, 10.2 5.4, 13.2 3.4"
                    fill="none" stroke="#232320" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                    pathLength={100}
                    style={{ strokeDasharray: 100, strokeDashoffset: 0, animation: 'ktDraw .26s cubic-bezier(.3,.8,.4,1)' }} />
            </svg>
        )}
    </span>
);

export const ConfirmPage: React.FC<{
    /** 交給生成的目的地（含縮圈短名，已去重） */
    destinations: string[];
    /** 顯示用：主目的地名（「南投」）與細分（「埔里與國姓」） */
    destinationName: string;
    coverUrl: string | null;
    isDomestic: boolean;
    /** 幣別推斷用（intel.country；沒有＝USD 保底） */
    country?: string;
    when: WhenResult;
    how: HowResult | null;
    notes: NotesResult | null;
    /** 點確認書的某一行＝回該頁修改（改完那頁的票券鈕變「改好了」、直接回這裡） */
    onEditStep: (step: EditStep) => void;
    onClose: () => void;
    /** 蓋章＋停留 2 秒後才呼叫（geocode 已 best-effort 完成） */
    onDone: (r: ConfirmDone) => void;
}> = ({ destinations, destinationName, coverUrl, isDomestic, country, when, how, notes, onEditStep, onClose, onDone }) => {
    const instant = useMemo(() => reduceMotion(), []);

    const [phase, setPhase] = useState<Phase>('review');
    const [checks, setChecks] = useState<boolean[]>([false, false, false, false]);
    const [genDays, setGenDays] = useState<TripDay[] | null>(null);
    const [sayIdx, setSayIdx] = useState(0);
    const [slowLine, setSlowLine] = useState<0 | 1 | 2>(0);   // 0 無 / 1 十八秒 / 2 六十秒
    const [moodOpen, setMoodOpen] = useState(false);
    const [stamping, setStamping] = useState(false);

    const aliveRef = useRef(true);
    const timersRef = useRef<Set<number>>(new Set());
    /** 生成序號：重試／重排會讓舊的那次作廢（結果回來時比對，不符就丟棄） */
    const genSeqRef = useRef(0);

    const after = useCallback((ms: number, fn: () => void) => {
        const id = window.setTimeout(() => {
            timersRef.current.delete(id);
            if (aliveRef.current) fn();
        }, ms);
        timersRef.current.add(id);
        return id;
    }, []);

    useEffect(() => {
        // ⚠️ 旗標必須在每次掛載時設回 true：StrictMode 的假卸載會把它永久關掉（入口頁踩過的坑）
        aliveRef.current = true;
        const timers = timersRef.current;
        return () => {
            aliveRef.current = false;
            timers.forEach(id => window.clearTimeout(id));
            timers.clear();
        };
    }, []);

    // 進場＝攤開一份文件（與 ⑤「還沒想法？點開來看每個月的樣子」同一個聲音——
    // 兩者都是「攤開一張大紙」，同一個動作用同一個聲音）
    useEffect(() => {
        if (instant) return;
        const id = window.setTimeout(() => playPageSound('paperUnfold'), 120);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 資料推導（全部純函式）──────────────────────────────────
    const dates = useMemo(() => deriveDates(when), [when]);
    const currency = useMemo(() => currencyForCountry(country), [country]);
    const tno = useMemo(() => ticketNo(dates.start, when.days), [dates.start, when.days]);
    const mmdd = (iso: string) => iso.slice(5).replace('-', '.');
    /** 主標／副標：目的地第一個當主角，其餘當細分行 */
    const mainName = destinations[0] || destinationName;
    const subNames = destinations.slice(1).join('、');

    /**
     * TripConstraints 組裝（原 `CreateTripModal.buildConstraints` 搬家）。
     * ⚠️ 兩組字彙轉換的**唯一轉換點**：economy→cheap、charter→taxi（舊資料與 gemini.ts 的字彙）。
     */
    const buildConstraints = useCallback((mood?: RearrangeMood): TripConstraints => {
        const moodNote = mood ? `重新安排的方向：${MOOD_LABEL[mood]}` : '';
        const requests = [notes?.notes.trim() || '', moodNote].filter(Boolean).join('；');
        return {
            tripType: isDomestic ? 'domestic' : 'international',
            origin: isDomestic ? '台北' : 'TPE',
            currency,
            legs: destinations.map(city => ({ city, startDay: 1, endDay: when.days })),
            hard: {
                // ⚠️ 'unset' 絕不能送出去（prompt 會出現英文原字）；沒有答案就不給欄位
                ...(when.arrivalSlot !== 'unset' ? { arrival: { confidence: 'hint' as const, value: when.arrivalSlot } } : {}),
                ...(when.departureSlot !== 'unset' ? { departure: { confidence: 'hint' as const, value: when.departureSlot } } : {}),
            },
            soft: {
                companion: how ? legacyCompanionId(how) : 'couple',
                companions: how?.companions.length ? how.companions : undefined,
                pace: how?.pace ?? 'standard',
                vibe: 'balanced',   // vibe 已退場（由 ⑦ 標籤雲承接）；欄位保留中性預設
                budgetLevel: (how?.budget ?? 'standard') === 'economy' ? 'cheap' : (how?.budget ?? 'standard'),
                budgetCap: how?.budgetCap,
                interests: (notes?.tagsWanted ?? []).map(tag => ({ tag })),
                tagsAvoided: notes?.tagsAvoided.length ? notes.tagsAvoided : undefined,
                specificRequests: requests || undefined,
                localTransportMode: (how?.move ?? 'public') === 'charter' ? 'taxi' : (how?.move ?? 'public') as 'public' | 'car',
            },
        };
    }, [destinations, isDomestic, currency, when, how, notes]);

    // ── ③等待的素材（全部從 brief 現撈，零 LLM 成本）────────────
    const sayings = useMemo<Saying[]>(() => {
        const out: Saying[] = [];
        const B = (s: string) => <b style={{ color: '#E9BE7A', fontWeight: 600 }}>{s}</b>;
        out.push({ paper: 'where', html: <>{B(destinations.join('、'))}，{cnDays(when.days).replace('共', '')}的旅程</> });
        if (when.arrivalSlot !== 'unset') {
            out.push({
                paper: 'when',
                html: <>{B(`${mmdd(dates.start)} ${SLOT_LABEL[when.arrivalSlot]}到`)}，第一天我留得鬆一點</>,
            });
        } else {
            out.push({ paper: 'when', html: <>{B(`${mmdd(dates.start)} — ${mmdd(dates.end)}`)}，日子我都記下了</> });
        }
        if (how) {
            const withs = how.withKeys;
            if (withs.includes('elder')) out.push({ paper: 'how', html: <>{B('有長輩同行')}，我在找可以坐下來吃飯的地方</> });
            if (withs.includes('kids')) out.push({ paper: 'how', html: <>{B('帶著孩子')}，走太多路的行程我先剔掉</> });
            if (withs.includes('wheel')) out.push({ paper: 'how', html: <>{B('有推車或輪椅')}，只挑有電梯、走得到的地方</> });
            if (withs.includes('pet')) out.push({ paper: 'how', html: <>{B('帶著寵物')}，要能一起進去的才算數</> });
            if (!how.paceAuto) {
                const p = PACE_TEXT[how.pace];
                out.push({ paper: 'how', html: <>{B(`${p.name}的節奏`)}，{p.num}</> });
            }
            if (!how.moveAuto && how.move === 'car') out.push({ paper: 'how', html: <>{B('自己開車')}，遠一點的地方也排得進去</> });
            if (!how.moveAuto && how.move === 'charter') out.push({ paper: 'how', html: <>{B('包車')}，路上的時間我幫你省下來</> });
        }
        if (notes) {
            notes.tagsWanted.slice(0, 2).forEach(t =>
                out.push({ paper: 'notes', html: <>你圈了{B(t)}，我在挑最合適的那一天</> }));
            notes.tagsAvoided.slice(0, 2).forEach(t =>
                out.push({ paper: 'notes', html: <>你劃掉了{B(t)}，我避開了</> }));
            if (notes.notes.trim()) out.push({ paper: 'notes', html: <>你寫的{B('每一句講究')}，我都放在手邊對照</> });
        }
        // 通用墊檔：**只在句子用完時出現**（填得多的人句子多、等得久，自然對齊）
        out.push({ paper: null, html: <>在算兩個點之間要走多久</> });
        out.push({ paper: null, html: <>把每一天的順路排整齊</> });
        return out;
    }, [destinations, when, how, notes, dates]);

    /** ③等待輪播的四張紙（縮小版的四頁摘要） */
    const papers = useMemo(() => ({
        where: { k: 'WHERE', h: '去哪', rows: [destinations.join('、')] },
        when: {
            k: 'WHEN', h: '什麼時候',
            rows: [
                `${mmdd(dates.start)} — ${mmdd(dates.end)}`, cnDays(when.days),
                ...(when.arrivalSlot !== 'unset' ? [`第一天 ${SLOT_LABEL[when.arrivalSlot]}到`] : []),
            ],
        },
        how: {
            k: 'HOW', h: '想怎麼玩',
            rows: how ? [
                how.companions.join('、') || '——',
                `${PACE_TEXT[how.pace].name} · ${PACE_TEXT[how.pace].num}`,
                `${MOVE_TEXT[how.move]} · ${BUDGET_TEXT[how.budget]}`,
            ] : ['照慣例安排'],
        },
        notes: {
            k: 'NOTES', h: '你的講究',
            rows: notes && !notes.skipped ? [
                notes.tagsWanted.join('、') || '——',
                ...(notes.tagsAvoided.length ? [`避開 ${notes.tagsAvoided.join('、')}`] : []),
                ...(notes.notes.trim() ? [notes.notes.trim()] : []),
            ] : ['順應直覺'],
        },
    }), [destinations, dates, when, how, notes]);

    // ── 生成流程 ───────────────────────────────────────────────
    const startGeneration = useCallback((mood?: RearrangeMood) => {
        const seq = ++genSeqRef.current;
        setPhase('wait');
        setSayIdx(0);
        setSlowLine(0);
        setMoodOpen(false);
        // 抽一張新紙（❌ 那一拍的畫面已移除，但聲音留著——它標記「開始了」這件事）
        playPageSound('paperLift', 0.8);

        const t0 = Date.now();
        (async () => {
            try {
                const days = await generateItinerary(buildConstraints(mood), when.days);
                if (!aliveRef.current || genSeqRef.current !== seq) return;   // 已重試／已離開＝作廢
                const withTime = days.map(d => recalculateTimeline(d));
                // 最短等待：避免回述文案閃現；超過下限就立刻走，絕不多等
                const rest = Math.max(0, MIN_WAIT_MS - (Date.now() - t0));
                after(rest, () => {
                    if (genSeqRef.current !== seq) return;
                    setGenDays(withTime);
                    setPhase('reveal');
                    playPageSound('paperDrop');
                    hapticTap();
                });
            } catch {
                if (!aliveRef.current || genSeqRef.current !== seq) return;
                // 失敗訊息**冷靜講事實＋給出路**，不俏皮（出錯時使用者是焦慮的）
                const rest = Math.max(0, 1200 - (Date.now() - t0));
                after(rest, () => { if (genSeqRef.current === seq) setPhase('error'); });
            }
        })();
    }, [after, buildConstraints, when.days]);

    // ③等待：回述輪播＋慢速提示（phase 進入 wait 才啟動）
    useEffect(() => {
        if (phase !== 'wait') return;
        const say = window.setInterval(() => {
            setSayIdx(i => Math.min(i + 1, sayings.length - 1));   // 走到最後一句就停住，不循環（重複＝轉圈感）
        }, SAY_MS);
        const slow = window.setTimeout(() => { if (aliveRef.current) setSlowLine(1); }, SLOW_AT_MS);
        const long = window.setTimeout(() => { if (aliveRef.current) setSlowLine(2); }, LONG_AT_MS);
        return () => { window.clearInterval(say); window.clearTimeout(slow); window.clearTimeout(long); };
    }, [phase, sayings.length]);

    // ── 完成：組 Trip、蓋章、停留 2 秒（同時 geocode）────────────
    const finishTrip = useCallback(() => {
        if (stamping || !genDays) return;
        setStamping(true);
        playPageSound('stamp');
        hapticTap();
        const constraints = buildConstraints();
        const trip: Trip = {
            id: Date.now().toString(),
            destination: destinations.join(' + '),
            origin: isDomestic ? '台北' : 'TPE',
            transportMode: isDomestic ? 'train' : 'flight',
            localTransportMode: constraints.soft.localTransportMode,
            startDate: dates.start,
            endDate: dates.end,
            coverImage: coverUrl || '',
            days: genDays,
            isDeleted: false,
            currency,
            pace: (how?.pace ?? 'standard') as Trip['pace'],
            constraints,   // 🧬 常駐約束存進 trip（規劃臉可重開重編、重生成共讀）
        };
        // 蓋章的 2 秒停留＝geocode 的時間（best-effort，失敗不擋建立）
        const hold = new Promise<void>(res => { after(STAMP_HOLD_MS, res); });
        const geo = ensureTripGeocoded(trip).then(r => r.trip).catch(() => trip);
        void Promise.all([hold, geo]).then(([, finalTrip]) => {
            if (!aliveRef.current) return;
            onDone({ trip: finalTrip });
        });
    }, [stamping, genDays, buildConstraints, destinations, isDomestic, dates, coverUrl, currency, how, after, onDone]);

    // ── ①核對的四行 ────────────────────────────────────────────
    const reviewRows = useMemo(() => ([
        { step: 'entry' as EditStep, k: '去　哪', v: destinations.join('、') },
        {
            step: 'when' as EditStep, k: '什麼時候',
            v: `${mmdd(dates.start)} — ${mmdd(dates.end)} · ${cnDays(when.days)}`
                + (when.arrivalSlot !== 'unset' ? `，${SLOT_LABEL[when.arrivalSlot]}到` : ''),
        },
        {
            step: 'how' as EditStep, k: '想怎麼玩',
            v: how && !how.skipped
                ? [how.companions.join('、'), `${PACE_TEXT[how.pace].name} · ${MOVE_TEXT[how.move]} · ${BUDGET_TEXT[how.budget]}`]
                    .filter(Boolean).join('\n')
                : '照慣例安排',
        },
        {
            step: 'notes' as EditStep, k: '你的講究',
            v: notes && !notes.skipped
                ? [
                    notes.tagsWanted.length ? `想要 ${notes.tagsWanted.join('、')}` : '',
                    notes.tagsAvoided.length ? `避開 ${notes.tagsAvoided.join('、')}` : '',
                    notes.notes.trim(),
                ].filter(Boolean).join('\n')
                : '順應直覺',
        },
    ]), [destinations, dates, when, how, notes]);

    const currentSaying = sayings[Math.min(sayIdx, sayings.length - 1)];

    // ── 版面 ───────────────────────────────────────────────────
    const paperCard: React.CSSProperties = {
        position: 'relative', backgroundColor: PAPER, color: INK_PRINT, borderRadius: 2,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.72), 0 2px 4px rgba(0,0,0,.32), 0 16px 30px -10px rgba(0,0,0,.45)',
    };
    const innerFrame: React.CSSProperties = { position: 'absolute', inset: 7, border: '1px solid rgba(35,35,32,.16)', pointerEvents: 'none' };
    const innerFrame2: React.CSSProperties = { position: 'absolute', inset: 10, border: '.5px solid rgba(35,35,32,.09)', pointerEvents: 'none' };

    return (
        <div className="fixed inset-0 z-[95] overflow-hidden" style={{ backgroundColor: '#1a140f' }}>
            {/* 書桌場景：檯燈暖光（不畫人，只留工具與光） */}
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(58% 42% at 50% 30%, rgba(214,178,120,.28), transparent 70%),'
                    + 'radial-gradient(90% 60% at 50% 100%, rgba(60,44,30,.7), transparent 70%),'
                    + 'linear-gradient(170deg,#3a2e22,#1a140f)',
            }} />

            {/* 只有核對與等待階段可以離開；蓋章之後就是進入行程了 */}
            {(phase === 'review' || phase === 'wait' || phase === 'error') && (
                <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <X className="w-5 h-5 text-white/70" />
                </button>
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

                {/* ═══ ①核對：行程確認書 ═══ */}
                {phase === 'review' && (
                    <div className="w-full flex flex-col items-center" style={{ animation: instant ? undefined : 'ktFadeUp .45s ease-out' }}>
                        <div className="w-full" style={{ ...paperCard, maxWidth: 306 }}>
                            <PaperTexture radius={2} keyline={false} seal={false} />
                            <span style={innerFrame} aria-hidden /><span style={innerFrame2} aria-hidden />
                            <Corners />
                            <div className="relative text-center pt-5 px-5 pb-3">
                                <div className="font-serif text-[14px] font-semibold" style={{ letterSpacing: '.42em', textIndent: '.42em' }}>行程確認書</div>
                                <div className="font-mono text-[7px] mt-1.5" style={{ letterSpacing: '.34em', color: 'rgba(35,35,32,.34)' }}>KELVIN TRIP · CONFIRMATION</div>
                                <DLine />
                            </div>
                            <div className="relative px-[22px] pb-1.5">
                                {reviewRows.map((r, i) => (
                                    <button key={r.step} type="button"
                                        onClick={() => {
                                            const turningOn = !checks[i];
                                            setChecks(c => c.map((v, j) => (j === i ? !v : v)));
                                            playPageSound(turningOn ? 'tick' : 'eraser', turningOn ? 0.9 : 0.6);
                                            hapticTap();
                                        }}
                                        // 點列＝打勾；**長按或點標籤＝回去改**太隱晦——改的入口放在 v 右側的小字
                                        className="relative flex items-start gap-3 w-full py-[11px] text-left"
                                        style={{ borderTop: i === 0 ? undefined : '1px solid rgba(35,35,32,.09)', color: INK_PRINT }}>
                                        <CheckMark on={checks[i]} />
                                        <span className="flex-none font-serif text-[10px] pt-[3px]"
                                            style={{ width: 52, letterSpacing: '.2em', color: 'rgba(42,39,35,.44)', lineHeight: 1.5 }}>{r.k}</span>
                                        <span className="flex-1 min-w-0 font-serif text-[12.5px] whitespace-pre-line"
                                            style={{ lineHeight: 1.7, letterSpacing: '.02em', color: checks[i] ? 'rgba(42,39,35,.55)' : undefined }}>
                                            {r.v}
                                        </span>
                                        <span role="button" tabIndex={0}
                                            onClick={e => { e.stopPropagation(); onEditStep(r.step); }}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onEditStep(r.step); } }}
                                            className="flex-none font-serif text-[10px] pt-[3px] underline underline-offset-2"
                                            style={{ color: 'rgba(42,39,35,.4)', textDecorationColor: 'rgba(35,35,32,.25)' }}>
                                            改
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex justify-between items-baseline px-[22px] pt-2 pb-3.5 font-mono text-[7.5px]"
                                style={{ letterSpacing: '.18em', color: 'rgba(35,35,32,.3)', borderTop: '1px solid rgba(35,35,32,.09)' }}>
                                <span>NO. {tno}</span>
                                <span>點「改」可回去修</span>
                            </div>
                        </div>

                        <button onClick={() => {
                            setChecks([true, true, true, true]);
                            if (!checks.every(Boolean)) playPageSound('tick', 0.9);   // 一次勾完＝一聲就好，不要四聲
                            after(380, () => startGeneration());
                            hapticTap();
                        }}
                            className="mt-5 font-serif text-[13.5px] text-[#F1EBDD] pb-[3px]"
                            style={{ borderBottom: '1px solid rgba(255,255,255,.45)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                            都沒問題，開始排
                        </button>
                        {/* ⚠️ 不寫「還有 N 張沒看」——那是施壓；打勾是給想逐項確認的人用的 */}
                        <div className="mt-2 font-serif text-[10.5px]" style={{ color: 'rgba(255,255,255,.45)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                            {checks.every(Boolean) ? '都確認過了' : '看過就好，不用每行都勾'}
                        </div>
                    </div>
                )}

                {/* ❌「②抽新紙」那一拍已移除（2026-08-10 Kelvin：一掃而過、沒有存在感）——
                    一個只有 1.4 秒又沒有資訊的過場，**佔的是使用者的時間，換來的只是一個轉場**。
                    它的聲音（paperLift）留著，標記「開始了」這件事。 */}

                {/* ═══ ②等待：紙張輪播＋回述文案 ═══ */}
                {(phase === 'wait' || phase === 'error') && (
                    <div className="w-full flex flex-col items-center">
                        {/* 出錯時不留一塊 250px 的空紙區——失敗畫面要乾淨，只有訊息與出路 */}
                        {phase === 'wait' && (
                        <div className="relative" style={{ width: 238, height: 250, marginBottom: 30 }}>
                            {(Object.keys(papers) as Array<keyof typeof papers>).map(id => {
                                const p = papers[id];
                                const show = phase === 'wait' && currentSaying.paper === id;
                                return (
                                    <div key={id} style={{
                                        ...paperCard, position: 'absolute', inset: 0, padding: '22px 20px',
                                        opacity: show ? 1 : 0,
                                        transform: show ? 'none' : 'translateY(10px) scale(.97)',
                                        transition: 'opacity .6s ease, transform .6s cubic-bezier(.2,.8,.25,1)',
                                    }}>
                                        <PaperTexture radius={2} keyline={false} seal={false} />
                                        <span style={innerFrame} aria-hidden /><span style={innerFrame2} aria-hidden />
                                        <Corners />
                                        <div className="relative text-center font-mono text-[7px]" style={{ letterSpacing: '.34em', color: 'rgba(42,39,35,.34)' }}>{p.k}</div>
                                        <div className="relative text-center font-serif text-[13px] font-semibold mt-2" style={{ letterSpacing: '.3em', textIndent: '.3em' }}>{p.h}</div>
                                        <DLine width={30} margin="12px auto 13px" />
                                        {p.rows.map((r, i) => (
                                            <div key={i} className="relative text-center font-serif text-[12px]"
                                                style={{ lineHeight: 2.1, color: 'rgba(42,39,35,.66)', letterSpacing: '.06em' }}>{r}</div>
                                        ))}
                                        <div className="absolute left-0 right-0 text-center font-mono text-[6.5px]"
                                            style={{ bottom: 16, letterSpacing: '.28em', color: 'rgba(35,35,32,.24)' }}>KELVIN TRIP</div>
                                    </div>
                                );
                            })}
                            {/* 沒綁定紙的句子（通用墊檔）＝一張空白紙 */}
                            {currentSaying.paper === null && (
                                <div style={{ ...paperCard, position: 'absolute', inset: 0 }}>
                                    <PaperTexture radius={2} keyline={false} seal={false} />
                                </div>
                            )}
                        </div>
                        )}

                        {phase === 'wait' ? (
                            <>
                                <div className="flex items-center justify-center px-4" style={{ minHeight: 56 }}>
                                    <span key={sayIdx} className="font-serif text-[14px] text-center text-[#F1EBDD]"
                                        style={{ lineHeight: 1.85, letterSpacing: '.05em', textShadow: '0 1px 4px rgba(0,0,0,.85)', animation: instant ? undefined : 'ktFadeUp .55s ease-out' }}>
                                        {currentSaying.html}
                                    </span>
                                </div>
                                {/* 刻度尺上的游標（圓點是 UI 的語彙，菱形在細線上滑行才是這個世界的） */}
                                <div aria-hidden className="relative mt-5" style={{ width: 104, height: 1, background: 'rgba(255,255,255,.2)' }}>
                                    <span style={{
                                        position: 'absolute', top: -4, fontSize: 7, color: 'rgba(255,255,255,.7)',
                                        animation: 'ktGauge 2.8s ease-in-out infinite',
                                    }}>◆</span>
                                </div>
                                {slowLine >= 1 && (
                                    <div className="mt-4 font-serif text-[11px]" style={{ color: 'rgba(255,255,255,.5)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                        比平常久一點，再等一下
                                    </div>
                                )}
                                {slowLine >= 2 && (
                                    <button onClick={onClose} className="mt-2 font-serif text-[11px] underline underline-offset-4"
                                        style={{ color: 'rgba(255,255,255,.55)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                        等太久了？先回去，等等再試
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                {/* 失敗：冷靜講事實＋給出路，不俏皮（你填的都還在） */}
                                <div className="font-serif text-[13.5px] text-center text-[#F1EBDD]"
                                    style={{ lineHeight: 1.85, textShadow: '0 1px 4px rgba(0,0,0,.85)' }}>
                                    這次沒能寫完——你填的都還在
                                </div>
                                <div className="flex gap-6 mt-4">
                                    <button onClick={() => startGeneration()}
                                        className="font-serif text-[13px] text-[#F1EBDD] pb-[3px]"
                                        style={{ borderBottom: '1px solid rgba(255,255,255,.45)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                        再試一次
                                    </button>
                                    <button onClick={() => setPhase('review')}
                                        className="font-serif text-[12px] pb-[3px]"
                                        style={{ color: 'rgba(255,255,255,.55)', borderBottom: '1px solid rgba(255,255,255,.25)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                        回核對頁
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ═══ ④揭幕：這一趟的封面 ═══ */}
                {phase === 'reveal' && (
                    <div className="flex flex-col items-center">
                        <div className="relative text-center" style={{
                            ...paperCard, width: 264, padding: '34px 24px 30px',
                            animation: instant ? undefined : 'ktCoverDrop .72s cubic-bezier(.18,.9,.3,1) both',
                        }}>
                            <PaperTexture radius={2} keyline={false} seal={false} />
                            <span style={innerFrame} aria-hidden /><span style={innerFrame2} aria-hidden />
                            <Corners />
                            <span aria-hidden className="absolute rounded-full" style={{
                                left: '50%', top: -5, marginLeft: -5, width: 10, height: 10,
                                background: 'rgba(18,15,12,.6)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.5)',
                            }} />
                            <div className="relative font-mono text-[7px]" style={{ letterSpacing: '.34em', color: 'rgba(35,35,32,.3)' }}>KELVIN TRIP</div>
                            <div className="relative font-serif text-[34px] font-semibold mt-[18px]" style={{ letterSpacing: '.3em', textIndent: '.3em', lineHeight: 1.15 }}>{mainName}</div>
                            {subNames && (
                                <div className="relative font-serif text-[12px] mt-[9px]" style={{ letterSpacing: '.28em', textIndent: '.28em', color: 'rgba(42,39,35,.52)' }}>{subNames}</div>
                            )}
                            <DLine width={54} margin="20px auto 18px" />
                            <div className="relative font-mono text-[15px]" style={{ letterSpacing: '.16em', color: 'rgba(42,39,35,.7)' }}>
                                {mmdd(dates.start)} – {mmdd(dates.end)}
                            </div>
                            <div className="relative font-serif text-[11px] mt-[7px]" style={{ letterSpacing: '.3em', textIndent: '.3em', color: 'rgba(42,39,35,.45)' }}>{cnDays(when.days)}</div>
                            {/* 騎縫印樣式：印上去的，不是貼上去的 */}
                            <div aria-hidden className="absolute font-mono text-[7.5px]" style={{
                                right: 20, bottom: 18, letterSpacing: '.24em', color: SEAL_GREEN, opacity: .62, transform: 'rotate(-6deg)',
                            }}>已排好</div>
                        </div>
                        {/* 🔊 翻到速覽＝**下一張紙落到桌上**（Kelvin 定案用 paperDrop；
                            ❌ 不用 flip——那是護照書的翻頁聲，這裡沒有書，只有一張張的紙）。 */}
                        <button onClick={() => { setPhase('overview'); playPageSound('paperDrop', 0.8); hapticTap(); }}
                            className="mt-5 font-serif text-[13px] text-[#F1EBDD] pb-[3px]"
                            style={{ borderBottom: '1px solid rgba(255,255,255,.45)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                            看看排出了什麼
                        </button>
                    </div>
                )}

                {/* ═══ ⑤速覽：行程概覽 ═══ */}
                {phase === 'overview' && genDays && (
                    <div className="w-full flex flex-col items-center" style={{ animation: instant ? undefined : 'ktFadeUp .45s ease-out' }}>
                        <div className="w-full" style={{ ...paperCard, maxWidth: 300 }}>
                            <PaperTexture radius={2} keyline={false} seal={false} />
                            <span style={innerFrame} aria-hidden /><span style={innerFrame2} aria-hidden />
                            <Corners />
                            <div className="relative text-center pt-5 px-[22px]">
                                <div className="font-serif text-[13.5px] font-semibold" style={{ letterSpacing: '.42em', textIndent: '.42em' }}>行程概覽</div>
                                <div className="font-mono text-[7px] mt-1.5" style={{ letterSpacing: '.32em', color: 'rgba(35,35,32,.32)' }}>
                                    ITINERARY · {when.days} DAYS
                                </div>
                                <DLine />
                            </div>
                            <div className="relative px-[22px] pt-1.5">
                                {genDays.map((d, i) => {
                                    const stops = d.activities.filter(a => a.type !== 'transport').length;
                                    const label = d.city || d.vibeTag || d.activities.find(a => a.type !== 'transport')?.title || '自由活動';
                                    return (
                                        <div key={d.day} className="flex items-baseline gap-3 py-[10px]"
                                            style={{ borderTop: i === 0 ? undefined : '1px solid rgba(35,35,32,.09)' }}>
                                            <span className="flex-none font-serif text-[10.5px]" style={{ width: 44, letterSpacing: '.14em', color: 'rgba(42,39,35,.44)' }}>{cnDay(d.day)}</span>
                                            <span className="flex-1 min-w-0 font-serif text-[12.5px] truncate" style={{ lineHeight: 1.6, letterSpacing: '.03em' }}>{label}</span>
                                            <span className="flex-none font-mono text-[9.5px]" style={{ letterSpacing: '.08em', color: 'rgba(42,39,35,.4)' }}>{stops} 站</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="relative font-serif text-[9.5px] mx-[22px] mt-0.5 pt-2.5 pb-3.5"
                                style={{ lineHeight: 1.85, color: 'rgba(42,39,35,.46)', letterSpacing: '.02em', borderTop: '1px solid rgba(35,35,32,.09)' }}>
                                這只是初稿——進去之後每一站都能改、能換，單天也能重排。
                            </div>
                        </div>

                        {/* 重新安排：**要讓使用者明確知道自己在重新生成**（會再花一次完整的生成成本），
                            不是以為在微調。四個「速覽看得出來」的方向（定案；「換一批景點」＝盲換已刪）。 */}
                        {moodOpen ? (
                            <div className="mt-4 flex flex-col items-center gap-2.5">
                                <div className="font-serif text-[11px]" style={{ color: 'rgba(255,255,255,.6)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                    往哪個方向重排？（會整趟重新生成）
                                </div>
                                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-4">
                                    {(Object.keys(MOOD_LABEL) as RearrangeMood[]).map(m => (
                                        <button key={m} onClick={() => startGeneration(m)}
                                            className="font-serif text-[12.5px] text-[#F1EBDD] pb-[2px]"
                                            style={{ borderBottom: '1px solid rgba(255,255,255,.4)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                            {MOOD_LABEL[m]}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setMoodOpen(false)} className="font-serif text-[11px] mt-1"
                                    style={{ color: 'rgba(255,255,255,.45)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                                    先不重排
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3 mt-4 w-full" style={{ maxWidth: 300 }}>
                                <button onClick={() => { setMoodOpen(true); hapticTap(); }}
                                    className="flex-1 font-serif text-[13px] py-[11px] rounded-[2px] text-[#F1EBDD]"
                                    style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.28)' }}>
                                    重新安排
                                </button>
                                {/* 🔊 待換素材：這裡的動作是**從一疊紙裡抽出一張票遞過來**。
                                    暫用 `paperUnfold` 當替身（比 paperSlide 乾淨），素材到位改代號即可。 */}
                                <button onClick={() => { setPhase('ticket'); playPageSound('paperUnfold', 0.6); hapticTap(); }}
                                    className="flex-1 font-serif text-[13px] font-semibold py-[11px] rounded-[2px]"
                                    style={{ background: PAPER, color: INK_PRINT, boxShadow: '0 8px 16px -6px rgba(0,0,0,.4)' }}>
                                    確認行程
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ ⑥出票＋蓋章 ═══ */}
                {phase === 'ticket' && (
                    <div className="flex flex-col items-center">
                        <h2 className="font-serif text-[16px] font-semibold text-[#F1EBDD] mb-1" style={{ letterSpacing: '.05em', textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>
                            按下去，就出發了
                        </h2>
                        <p className="font-serif text-[11.5px] mb-4" style={{ color: 'rgba(255,255,255,.6)', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
                            承諾發生在你伸手的那一刻
                        </p>

                        <div className="relative" style={{
                            ...paperCard, width: 272, padding: '0 0 58px',
                            animation: instant ? undefined : 'ktHandIn .72s cubic-bezier(.2,.85,.3,1) both',
                        }}>
                            <PaperTexture radius={2} keyline={false} seal={false} />
                            <span style={innerFrame} aria-hidden /><span style={innerFrame2} aria-hidden />
                            <Corners />
                            <div className="relative flex justify-between items-baseline font-mono text-[6.5px] pt-[15px] px-5"
                                style={{ letterSpacing: '.26em', color: 'rgba(42,39,35,.34)' }}>
                                <span>TRAVEL PASS</span><span>NO. {tno}</span>
                            </div>
                            <div className="relative text-center pt-[17px] px-5">
                                <div className="font-serif text-[30px] font-semibold" style={{ letterSpacing: '.3em', textIndent: '.3em', lineHeight: 1.15 }}>{mainName}</div>
                                {subNames && (
                                    <div className="font-serif text-[10.5px] mt-2" style={{ letterSpacing: '.32em', textIndent: '.32em', color: 'rgba(42,39,35,.46)' }}>{subNames}</div>
                                )}
                                <DLine width="100%" margin="16px 0 0" />
                            </div>
                            <div className="relative text-center pt-[14px] px-5">
                                <div className="font-mono text-[14.5px]" style={{ letterSpacing: '.14em', color: INK_PRINT }}>
                                    {mmdd(dates.start)}<i className="not-italic px-[5px]" style={{ color: 'rgba(42,39,35,.3)' }}>—</i>{mmdd(dates.end)}
                                </div>
                                <div className="font-serif text-[9.5px] mt-2" style={{ letterSpacing: '.3em', textIndent: '.3em', color: 'rgba(42,39,35,.42)' }}>{cnDays(when.days)}</div>
                            </div>

                            {/* 齒孔（兩側真的圓孔）；票根只留一行＝他圈起來最期待的（期待才有紀念價值） */}
                            <div aria-hidden className="relative mt-[14px]" style={{
                                height: 1, backgroundImage: 'repeating-linear-gradient(90deg, rgba(35,35,32,.24) 0 3px, transparent 3px 7px)',
                            }}>
                                <span className="absolute rounded-full" style={{ left: -7, top: -7, width: 14, height: 14, background: '#221b14', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.5)' }} />
                                <span className="absolute rounded-full" style={{ right: -7, top: -7, width: 14, height: 14, background: '#221b14', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.5)' }} />
                            </div>
                            <div className="relative text-center pt-[13px] px-5">
                                <div className="font-serif text-[10.5px]" style={{ lineHeight: 1.85, letterSpacing: '.16em', textIndent: '.16em', color: 'rgba(42,39,35,.55)' }}>
                                    {(notes?.tagsWanted.length ? notes.tagsWanted.slice(0, 2).join(' · ') : destinations.join(' · '))}
                                </div>
                            </div>

                            {/* 章位（蓋章前極淡）＋章（壓過齒孔線與文字、偏右不置中、multiply） */}
                            <div aria-hidden className="absolute rounded-full flex items-center justify-center" style={{
                                left: '50%', bottom: 14, marginLeft: -25, width: 78, height: 78,
                                border: '1px dashed rgba(35,35,32,.2)', color: 'rgba(42,39,35,.22)',
                                fontSize: 8.5, letterSpacing: '.14em', opacity: stamping ? 0 : 1, transition: 'opacity .35s',
                            }}>
                                <span className="absolute rounded-full" style={{ inset: 5, border: '.5px dashed rgba(35,35,32,.13)' }} />
                                DEPARTURE
                            </div>
                            <div aria-hidden className="absolute rounded-full flex flex-col items-center justify-center" style={{
                                left: '50%', bottom: 12, marginLeft: -29, width: 86, height: 86,
                                border: `2.4px solid ${STAMP_RED}`, color: STAMP_RED, mixBlendMode: 'multiply',
                                opacity: 0, transform: 'scale(1.7) rotate(-14deg)',
                                animation: stamping ? 'ktStampPress .46s cubic-bezier(.2,1.4,.4,1) forwards' : undefined,
                            }}>
                                <span className="absolute rounded-full" style={{ inset: 5, border: `1px solid ${STAMP_RED}`, opacity: .55 }} />
                                <span className="font-mono text-[9.5px] font-bold" style={{ letterSpacing: '.16em' }}>DEPARTURE</span>
                                <span className="font-mono text-[7.5px] mt-[3px]" style={{ letterSpacing: '.12em' }}>{dates.start.replace(/-/g, '.')}</span>
                            </div>
                        </div>

                        <button onClick={finishTrip} disabled={stamping}
                            className="mt-6 font-serif text-[14px] font-semibold py-[13px] px-[30px] rounded-[2px]"
                            style={{
                                background: PAPER, color: INK_PRINT, letterSpacing: '.14em',
                                boxShadow: '0 10px 20px -8px rgba(0,0,0,.5)', opacity: stamping ? .55 : 1, transition: 'opacity .4s',
                            }}>
                            {stamping ? '出　發' : '進入規劃行程'}
                        </button>
                    </div>
                )}
            </div>

            <style>{INK_KEYFRAMES + `
                @keyframes ktSlideIn { from{opacity:0;transform:translateX(90px) rotate(2deg)} to{opacity:1;transform:none} }
                @keyframes ktHandSweep { 0%{transform:translateX(-60%);opacity:0} 30%{opacity:.9} 100%{transform:translateX(120%);opacity:0} }
                @keyframes ktCoverDrop { from{opacity:0;transform:translateY(-26px) scale(1.02)} to{opacity:1;transform:none} }
                @keyframes ktHandIn { from{opacity:0;transform:translate(70px,26px) rotate(7deg) scale(.94)} to{opacity:1;transform:none} }
                @keyframes ktGauge { 0%{left:0;opacity:.25} 50%{left:calc(100% - 7px);opacity:.9} 100%{left:0;opacity:.25} }
                @keyframes ktStampPress {
                    0%{opacity:0;transform:scale(1.7) rotate(-14deg)}
                    58%{opacity:1;transform:scale(.93) rotate(-9deg)}
                    100%{opacity:.88;transform:scale(1) rotate(-9deg)}
                }
            `}</style>
        </div>
    );
};
