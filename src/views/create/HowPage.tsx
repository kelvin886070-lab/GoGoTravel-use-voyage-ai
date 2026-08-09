// src/views/create/HowPage.tsx
// 🎴 生成表單・⑥「這一趟想怎麼玩」（docs E3-0 定案 2026-08-09；mockup `mockups/step6-how.html`）
//
//   三張紙依性質分：紙一「和誰同行」＝**事實**／紙二「一天想走多少」＝**品味**／紙三「大概想花多少」＝**限制**。
//   只有紙二會硬約束 prompt（每日站數是數字），所以它在視覺上放大一階。
//
//   ── 這一頁的六個關鍵決定（都有代價，不要憑印象改回去）──
//   ①**紙一分兩區，不是逐項互斥**：同一張紙上有兩種語意（上區單選／下區複選）時，若不先在視覺上
//     宣告，就會出現「點 A 會擦掉 B、點 C 什麼都不擦」——同樣長相的東西行為不同＝使用者無法預測
//     點擊後果。選「自己一個人」＝**整個下區退場**（一句話解釋完），而不是逐項擦除。
//   ②**版面是手風琴，不是精靈**：三張紙全部在場，沒輪到的退到桌子後面，填完的收攏成一行自己的筆跡。
//     反對 wizard 最硬的一條：**複選題沒有「我填完了」的訊號**——所以只有純單選的紙（②③）自動推進，
//     紙一永遠不推進（它下區是複選）。也**不放數字進度條**：收攏的紙本身就是進度條。
//   ③**動畫不擋操作**：下一張紙在第③拍一開始（426ms）就亮起，不等動畫播完；使用者中途點別張立刻打斷。
//   ④**預算金額不進 prompt**（見 destinationIntel.DestinationBudget 的三條規矩）——進 prompt 的是等級。
//   ⑤**矛盾用旁註不用對話框**：貼在那個矛盾的選項底下、絕對定位不佔版面高度、提醒但不擋。
//   ⑥**沒圈也能走**：票券鈕上方那行字可點＝一個**看得見的動作**（畫虛線圈）。空白讓人不安，動作不會。
//
//   ⚠️ TODO（定稿有、這一版刻意未做）：**回頭客的紙上有上次的筆跡**（依序重描 420ms 間隔／0.6s 描繪）。
//      需要把上一份 brief 接進來（`createBrief` 的 previous 概念），等 ⑧確認與生成幕一起做——
//      現在留一個永遠是 undefined 的 prop 只會變成假功能。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import type { PaceLevel, BudgetLevel } from '../../types';
import { playPageSound, hapticTap } from '../../services/sounds';
import { fetchDestinationDeep, budgetAnchors, type DestinationBudget } from '../../services/destinationIntel';
import { TicketNextButton } from './TicketNextButton';
import {
    HandCircle, EraserBlock, PaperTexture, HandShadow, paperShadow, seedOf,
    PAPER, PAPER_RADIUS, INK_INK, INK_PRINT, INK_AMBER, INK_KEYFRAMES,
} from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ── 三拍動畫的時間表（與 ink.tsx 的 ktPickPut 百分比一致；改一邊就要改另一邊）──
const PICKPUT_MS = 820;
/** 第③拍開始＝下一張紙亮起的時刻（52% × 820ms）。**不等動畫播完**：動畫是說明手段，不是收費站。 */
const HANDOFF_MS = 426;
/** 圈畫完之後、開始交棒之前的喘息（讓使用者看見自己的筆跡落下） */
const SETTLE_MS = 300;
const PUTDOWN_MS = 320;
const ERASE_MS = 450;

// ── 選項表（key 穩定、label 給 UI 與 prompt）──────────────────────
type PartyKey = 'solo' | 'couple' | 'group';
type WithKey = 'kids' | 'elder' | 'pet' | 'wheel' | 'work' | 'class';

interface Opt<K extends string> { v: K; t: string; d: string }

const PARTY: Opt<PartyKey>[] = [
    { v: 'solo', t: '自己一個人', d: '想去哪就去哪' },
    { v: 'couple', t: '兩個人', d: '走走停停的節奏' },
    { v: 'group', t: '一群人', d: '三個以上，要好聚好散' },
];
/** 摺頁外的兩項＝最常見的；其餘四項收在「還有 4 種」後面 */
const WITH_FRONT: Opt<WithKey>[] = [
    { v: 'kids', t: '帶著孩子', d: '要有休息與廁所' },
    { v: 'elder', t: '長輩同行', d: '走得慢、要坐著吃' },
];
const WITH_BACK: Opt<WithKey>[] = [
    { v: 'pet', t: '帶著寵物', d: '要能一起進去的地方' },
    // 「推車或輪椅」直接影響無障礙需求（電梯、平路），而且是**行為描述不是身分標籤**
    { v: 'wheel', t: '推車或輪椅', d: '要挑有電梯、有平路的' },
    { v: 'work', t: '同事', d: '白天可能要工作' },
    { v: 'class', t: '同學', d: '預算要抓緊一點' },
];

/** 副標的數字＝**形容詞的契約**（同一組數字同時進 UI 與 prompt；見 tripBrief.PACE_STOPS）。
 *  「深度」與「悠閒」原本語意打架，靠第二行的具體行為分開：悠閒是為了不累，深度是為了看透。 */
const PACE: { v: PaceLevel; t: string; d1: string; d2: string }[] = [
    { v: 'relaxed', t: '悠閒', d1: '一天 2–3 個地方', d2: '不趕路，中間坐得下來' },
    { v: 'standard', t: '標準', d1: '一天 4–5 個地方', d2: '走走看看，該去的都去' },
    { v: 'packed', t: '緊湊', d1: '一天 6 個以上', d2: '想去的都排進去' },
    { v: 'deep', t: '深度', d1: '一天 1–2 個地方', d2: '每個待上半天，看得透' },
];

/** ⚠️ 副標裡**不得出現住宿等級**——預算的範圍已排除住宿，寫了就自相矛盾。 */
const BUDGET: { v: BudgetLevel; t: string; d: string; anchor: (b: DestinationBudget) => string }[] = [
    { v: 'economy', t: '省著花', d: '小吃與便利商店 · 大眾運輸 · 挑免費的景點', anchor: b => b.lean },
    { v: 'standard', t: '剛剛好', d: '好好吃一餐 · 累了就搭車 · 該買的門票就買', anchor: b => b.mid },
    { v: 'luxury', t: '不將就', d: '想訂的餐廳就訂 · 想搭就搭 · 體驗優先', anchor: b => b.rich },
];

const LABEL: Record<string, string> = {
    solo: '一個人', couple: '兩個人', group: '一群人',
    kids: '帶孩子', elder: '有長輩', pet: '帶寵物', wheel: '有推車輪椅', work: '和同事', class: '和同學',
    relaxed: '悠閒的節奏', standard: '標準的節奏', packed: '緊湊的節奏', deep: '深度的節奏',
    economy: '省著花', luxury: '不將就',
};
/** 預算的 'standard' 與步調的 'standard' 撞名，摘要另外取（不要共用一張表就以為安全） */
const BUDGET_LABEL: Record<BudgetLevel, string> = { economy: '省著花', standard: '剛剛好', luxury: '不將就' };
/** 進 brief / prompt 的同行者措辭（完整、可讀；壓成單一字串會資訊死亡） */
const COMPANION_LABEL: Record<string, string> = {
    solo: '獨旅', couple: '兩人同行', group: '一群人',
    kids: '帶著孩子', elder: '長輩同行', pet: '帶著寵物',
    wheel: '有人使用推車或輪椅', work: '與同事同行', class: '與同學同行',
};

/**
 * 一個選項（圈／擦／旁註）。
 *
 * ⚠️ **必須定義在模組層級，不可以寫在 HowPage 內部**：在元件裡定義元件的話，每次 state 改變
 *    都會產生一個「新的元件型別」，React 會把整棵子樹卸載重掛——墨圈的描繪動畫會不停重播、
 *    橡皮擦動畫會被打斷。這是 React 最容易誤踩的效能／正確性陷阱之一。
 */
const OptionButton: React.FC<{
    v: string;
    t: string;
    d: React.ReactNode;
    on: boolean;
    onPick: () => void;
    /** 正在被擦掉（橡皮擦掃過＋舊圈淡出） */
    wiping: boolean;
    instant: boolean;
    note?: string;
    span?: boolean;
}> = ({ v, t, d, on, onPick, wiping, instant, note, span }) => (
    <button type="button" onClick={onPick} aria-pressed={on}
        className="relative text-left px-1.5 pt-1.5 pb-1"
        style={{ gridColumn: span ? '1 / -1' : undefined, color: INK_PRINT }}>
        <span className="relative inline-block">
            <span className="block font-serif text-[13.5px] font-medium leading-[1.35]" style={{ letterSpacing: '.04em' }}>{t}</span>
            {on && !wiping && <HandCircle seed={seedOf(v)} color={INK_INK} instant={instant} />}
            {wiping && (
                <>
                    <EraserBlock />
                    <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                        <HandCircle seed={seedOf(v)} color={INK_INK} instant />
                    </span>
                </>
            )}
        </span>
        <span className="block font-serif text-[10px] leading-[1.45] mt-0.5" style={{ color: 'rgba(42,39,35,.5)' }}>{d}</span>
        {/* 矛盾旁註：絕對定位、**不佔版面高度**——它出現時不能把下面的東西推走 */}
        {!!note && (
            <span aria-hidden className="absolute left-1 right-1 top-full font-serif italic text-[9.5px] leading-[1.45] pointer-events-none"
                style={{ color: INK_INK, opacity: .72, animation: instant ? undefined : 'ktFadeUp .4s ease-out' }}>
                ↖ {note}
            </span>
        )}
    </button>
);

export interface HowResult {
    /** 幾個人（單選；null＝沒圈） */
    party: PartyKey | null;
    /** 還有誰一起（複選；順序＝畫面順序） */
    withKeys: WithKey[];
    /** 給 brief 與 prompt 的完整同行者清單（中文；**以這個為準**，不要用單一代表值） */
    companions: string[];
    pace: PaceLevel;
    /** true＝使用者沒圈，我們用了標準（資料要誠實：「他選了標準」與「他沒選」不是同一件事） */
    paceAuto: boolean;
    budget: BudgetLevel;
    budgetAuto: boolean;
    /** 三張紙一顆都沒圈 */
    skipped: boolean;
}

/**
 * 🚧 **過渡期橋接**：舊的 `CreateTripModal` 步驟④「風格與預算」是**單選**的同行者，
 * 這裡挑一個最能代表這趟性質的值給它顯示用。
 *
 * ⚠️ 這是**顯示用的代表值，不是資料**——真正進 brief 與 prompt 的永遠是 `companions` 全集
 * （「長輩＋孩子」和「長輩」是兩件不同的事）。⑧確認與生成幕上線、舊步驟④退場後，
 * 這個函式與 `SoftPreferences.companion` 一起刪除。
 *
 * 優先序＝**對行程限制最強的先贏**：有人行動不便 > 長輩 > 孩子 > 寵物 > 其餘。
 */
export const legacyCompanionId = (r: HowResult): string => {
    if (r.withKeys.includes('wheel') || r.withKeys.includes('elder')) return 'elderly';
    if (r.withKeys.includes('kids')) return 'family';
    if (r.withKeys.includes('pet')) return 'pet';
    if (r.withKeys.includes('work')) return 'colleague';
    if (r.withKeys.includes('class')) return 'classmate';
    if (r.party === 'solo') return 'solo';
    if (r.party === 'group') return 'friends';
    return 'couple';
};

export const HowPage: React.FC<{
    /** 麵包屑（「日本 · 關西」） */
    breadcrumb: string;
    /** 打 deep 的查詢字串（預算錨點用；沿用入口頁已驗證的目的地） */
    query: string;
    /** 背景照片（沿用前面幾頁那張＝物件連續） */
    coverUrl: string | null;
    isDomestic: boolean;
    onBack: () => void;
    onClose: () => void;
    onNext: (r: HowResult) => void;
}> = ({ breadcrumb, query, coverUrl, isDomestic, onBack, onClose, onNext }) => {
    const instant = useMemo(() => reduceMotion(), []);

    const [party, setParty] = useState<PartyKey | null>(null);
    const [withKeys, setWithKeys] = useState<WithKey[]>([]);
    const [pace, setPace] = useState<PaceLevel | null>(null);
    const [paceAuto, setPaceAuto] = useState(false);
    const [budget, setBudget] = useState<BudgetLevel | null>(null);

    const [foldOpen, setFoldOpen] = useState(false);
    const [peeked, setPeeked] = useState(false);          // 首次揭示只做一次
    const [anchors, setAnchors] = useState<DestinationBudget | null>(null);

    /** 正在被擦掉的選項（可能同時有多個——「自己一個人」會一次擦掉整個下區） */
    const [erasing, setErasing] = useState<string[]>([]);

    // ── 聚焦（手風琴）───────────────────────────────────────────
    const [focus, setFocus] = useState(0);
    const [anim, setAnim] = useState<{ idx: number; kind: 'pickput' | 'putdown' } | null>(null);

    const aliveRef = useRef(true);
    const timersRef = useRef<Set<number>>(new Set());
    const after = useCallback((ms: number, fn: () => void) => {
        const id = window.setTimeout(() => {
            timersRef.current.delete(id);
            if (aliveRef.current) fn();
        }, ms);
        timersRef.current.add(id);
        return id;
    }, []);
    const clearTimers = useCallback(() => {
        timersRef.current.forEach(id => window.clearTimeout(id));
        timersRef.current.clear();
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

    // 預算錨點（重層在入口頁就背景預取了 → 這裡多半是快取命中）；缺 budget＝整行不顯示，不擋路
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let deep = null;
            try { deep = await fetchDestinationDeep(query); } catch { deep = null; }
            if (cancelled || !aliveRef.current) return;
            setAnchors(budgetAnchors(deep));
        })();
        return () => { cancelled = true; };
    }, [query]);

    // 進場：三張紙落下（音量遞減＝一疊紙被放下，等音量會變成打鼓）＋摺頁首次揭示
    useEffect(() => {
        if (instant) return;
        const ids = [
            window.setTimeout(() => playPageSound('paperLand', 1), 180),
            window.setTimeout(() => playPageSound('paperLand', 0.63), 400),   // −4dB
            window.setTimeout(() => playPageSound('paperLand', 0.45), 620),   // −7dB
        ];
        return () => ids.forEach(window.clearTimeout);
    }, [instant]);

    const filled = useCallback((i: number): boolean => (
        i === 0 ? (!!party || withKeys.length > 0) : i === 1 ? !!pace : !!budget
    ), [party, withKeys, pace, budget]);

    /** 交棒到下一張紙：完整三拍（只有純單選的紙會呼叫；複選沒有「我填完了」的訊號） */
    const advanceFrom = useCallback((idx: number) => {
        if (instant) { setFocus(f => Math.min(2, Math.max(f, idx + 1))); return; }
        if (idx >= 2) return;
        after(SETTLE_MS, () => {
            setAnim({ idx, kind: 'pickput' });
            playPageSound('paperLift', 0.8);
            after(HANDOFF_MS, () => {
                playPageSound('paperLand', 0.7);            // 第③拍落下（②端詳那一拍刻意無聲）
                setFocus(f => (f === idx ? idx + 1 : f));   // 已被使用者手動改過就不搶
            });
            after(PICKPUT_MS + 20, () => setAnim(a => (a?.idx === idx ? null : a)));
        });
    }, [after, instant]);

    /** 手動點別張紙：離開的那張只播短版放下（他的注意力已經走了，端詳是搶戲） */
    const focusTo = useCallback((i: number) => {
        if (i === focus) return;
        clearTimers();
        const from = focus;
        setFocus(i);
        if (instant) { setAnim(null); return; }
        setAnim({ idx: from, kind: 'putdown' });
        playPageSound('paperLand', 0.55);
        after(PUTDOWN_MS + 20, () => setAnim(a => (a?.idx === from ? null : a)));
    }, [focus, clearTimers, after, instant]);

    // ── 圈 / 擦 ────────────────────────────────────────────────
    const eraseThen = useCallback((keys: string[], commit: () => void) => {
        if (!keys.length) { commit(); return; }
        if (instant) { commit(); return; }
        setErasing(prev => [...prev, ...keys]);
        playPageSound('eraser');
        hapticTap();
        after(ERASE_MS, () => {
            commit();
            setErasing(prev => prev.filter(k => !keys.includes(k)));
        });
    }, [after, instant]);

    // 🔒 退到後面的紙上，選項不作用（每個 pick 開頭的 `focus !== N`）。
    //    ⚠️ **不能改用 `disabled`**：disabled 的按鈕不會發出 click，事件也就不會冒泡到紙身上，
    //       「點一下退到後面的紙就把它拿回前面」這件事會整個失效。
    //       這裡 early return，事件自然往上冒泡給紙的 onClick＝focusTo。

    const pickParty = useCallback((v: PartyKey) => {
        if (focus !== 0 || erasing.length) return;
        if (party === v) { eraseThen([v], () => setParty(null)); return; }
        setParty(v);
        playPageSound('penCircle');
        hapticTap();
        // 「自己一個人」＝整個下區不適用 → 已圈的一起擦掉（使用者必須**看見**筆跡是怎麼沒的，
        //   否則會以為那些選項自己壞掉了）
        if (v === 'solo' && withKeys.length) eraseThen([...withKeys], () => setWithKeys([]));
    }, [party, withKeys, erasing, eraseThen, focus]);

    const toggleWith = useCallback((v: WithKey) => {
        if (focus !== 0 || erasing.length || party === 'solo') return;
        if (withKeys.includes(v)) { eraseThen([v], () => setWithKeys(prev => prev.filter(k => k !== v))); return; }
        setWithKeys(prev => [...prev, v]);
        playPageSound('penCircle');
        hapticTap();
    }, [withKeys, party, erasing, eraseThen, focus]);

    const pickPace = useCallback((v: PaceLevel) => {
        if (focus !== 1 || erasing.length) return;
        if (pace === v) { eraseThen([v], () => { setPace(null); setPaceAuto(false); }); return; }
        setPace(v); setPaceAuto(false);
        playPageSound('penCircle');
        hapticTap();
        advanceFrom(1);   // 單選填完＝有明確的「我答完了」訊號，可以交棒
    }, [pace, erasing, eraseThen, focus, advanceFrom]);

    const pickBudget = useCallback((v: BudgetLevel) => {
        if (focus !== 2 || erasing.length) return;
        if (budget === v) { eraseThen([v], () => setBudget(null)); return; }
        setBudget(v);
        playPageSound('penCircle');
        hapticTap();
    }, [budget, erasing, eraseThen, focus]);

    /** 接受預設＝一個**看得見的動作**（虛線圈），不是一片空白 */
    const acceptDefault = useCallback(() => {
        if (pace) return;
        setPace('standard'); setPaceAuto(true);
        playPageSound('penCircle', 0.7);
        hapticTap();
        focusTo(1);
    }, [pace, focusTo]);

    const toggleFold = useCallback(() => {
        setPeeked(true);
        setFoldOpen(o => {
            playPageSound(o ? 'paperFold' : 'paperUnfold', 0.7);
            return !o;
        });
        hapticTap();
    }, []);

    // ── 摘要與旁註 ─────────────────────────────────────────────
    const soloOff = party === 'solo';
    const slowFolk = withKeys.some(k => k === 'elder' || k === 'wheel' || k === 'kids');

    const hand1 = useMemo(() => {
        if (soloOff) return '行程會排得鬆一點，方便隨時改';
        if (withKeys.includes('elder') && withKeys.includes('kids')) return '步調會放慢，清單上會多幾樣';
        if (withKeys.includes('wheel')) return '只挑有電梯、走得到的地方';
        if (withKeys.includes('elder')) return '步調會幫你放慢一些';
        if (withKeys.includes('kids')) return '會避開走太多路的行程';
        if (withKeys.includes('pet')) return '只挑能帶牠一起進去的地方';
        if (withKeys.includes('work')) return '白天會留一段可以工作的時間';
        return '';
    }, [soloOff, withKeys]);

    /** 矛盾旁註：貼在**那個選項**底下，不是紙的角落——旁註要旁得到東西才叫旁註 */
    const notePacked = useMemo(() => {
        if (pace !== 'packed' || !slowFolk) return '';
        if (withKeys.includes('wheel')) return '有推車或輪椅，這樣可能會太趕';
        if (withKeys.includes('elder')) return '圈了長輩，這樣可能有點趕';
        return '帶著孩子，這樣可能有點趕';
    }, [pace, slowFolk, withKeys]);
    const noteBudget = useMemo(
        () => (budget === 'economy' && (withKeys.includes('elder') || withKeys.includes('wheel'))
            ? '走不動的時候，車資這一項我不會省' : ''),
        [budget, withKeys],
    );

    const hiddenCarry = useMemo(
        () => withKeys.filter(k => WITH_BACK.some(o => o.v === k)).map(k => LABEL[k]),
        [withKeys],
    );

    const submit = useCallback(() => {
        const keys: string[] = [...(party ? [party] : []), ...withKeys];
        onNext({
            party,
            withKeys,
            companions: keys.map(k => COMPANION_LABEL[k]).filter(Boolean),
            pace: pace ?? 'standard',
            paceAuto: !pace || paceAuto,
            budget: budget ?? 'standard',
            budgetAuto: !budget,
            skipped: !party && withKeys.length === 0 && !pace && !budget,
        });
    }, [party, withKeys, pace, paceAuto, budget, onNext]);

    // ── 版面 ───────────────────────────────────────────────────
    const sheetStyle = (i: number): React.CSSProperties => {
        const active = focus === i;
        const playing = anim?.idx === i;
        const base: React.CSSProperties = {
            backgroundColor: PAPER,
            borderRadius: PAPER_RADIUS,
            color: INK_PRINT,
            boxShadow: paperShadow(active ? 'rest' : 'back'),
            transition: 'opacity .42s ease, transform .42s cubic-bezier(.2,.8,.25,1), box-shadow .42s ease',
        };
        if (playing) {
            // 動畫期間**不設 opacity/transform**，全權交給 keyframes（否則兩邊會打架）。
            // ktPickPut 的終態刻意 ＝ dim 的靜態值，所以動畫一結束移除 class 也不會跳。
            return {
                ...base,
                animation: anim.kind === 'pickput'
                    ? `ktPickPut ${PICKPUT_MS}ms cubic-bezier(.33,0,.2,1) forwards`
                    : `ktPutDown ${PUTDOWN_MS}ms cubic-bezier(.3,.7,.3,1) forwards`,
                zIndex: 8,
            };
        }
        return {
            ...base,
            opacity: active ? 1 : 0.34,
            transform: active ? undefined : 'scale(.968)',
            cursor: active ? undefined : 'pointer',
            // 進場：三張紙依序落下（延遲與音效同一組時間表）
            animation: instant ? undefined : `ktPaperDrop .62s cubic-bezier(.18,.86,.32,1) ${180 + i * 220}ms backwards`,
        };
    };

    /** 收攏：填完但沒輪到的紙只留下被圈起來的那幾個（點回來就全部展開） */
    const collapsed = (i: number) => focus !== i && filled(i);

    const sheetProps = (i: number) => ({
        className: 'relative mx-[18px] mb-[18px] px-4 pt-4 pb-3.5',
        style: sheetStyle(i),
        onClick: focus === i ? undefined : () => focusTo(i),
    });

    return (
        <div className="fixed inset-0 z-[90] overflow-hidden" style={{ backgroundColor: '#1b1510' }}>
            <div className="absolute inset-0" style={{
                backgroundImage: isDomestic ? 'linear-gradient(165deg,#4a5c48,#222b21)' : 'linear-gradient(165deg,#3A6350,#22372a)',
            }} />
            {coverUrl && (
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                }} />
            )}
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,14,13,.5), rgba(15,14,13,.8))' }} />

            <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                <button onClick={onBack} aria-label="上一步" className="absolute left-3 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <ChevronLeft className="w-5 h-5 text-white/80" />
                </button>
                <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <X className="w-5 h-5 text-white/80" />
                </button>

                <div className="text-center font-serif text-[11px] text-white/60 mt-1 px-14 truncate">{breadcrumb}</div>
                <div className="px-6 pt-4 pb-1 text-center"
                    style={{ animation: instant ? undefined : 'ktFadeUp .38s ease-out backwards' }}>
                    <div className="font-serif text-[22px] font-bold text-[#F6F1E7]">這一趟想怎麼玩</div>
                    <div className="font-serif text-[11px] text-white/55 mt-1.5">三件事就好，之後都還能改</div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pt-3">

                    {/* ═══ 紙一：和誰同行 ═══ */}
                    <div {...sheetProps(0)}>
                        <PaperTexture />
                        <HandShadow playing={anim?.idx === 0 && anim.kind === 'pickput'} />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>和誰同行</h2>
                        {!collapsed(0) && (
                            <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-3" style={{ color: 'rgba(42,39,35,.52)' }}>
                                上面選一個，下面可以圈不只一個
                            </p>
                        )}

                        {/* 上區：幾個人（單選） */}
                        <div className="relative z-[2]">
                            {!collapsed(0) && (
                                <div className="flex items-baseline gap-2 mb-2">
                                    <b className="font-serif text-[11.5px] font-semibold" style={{ color: 'rgba(42,39,35,.78)', letterSpacing: '.06em' }}>幾個人</b>
                                    <i className="not-italic font-serif text-[9.5px]" style={{ color: 'rgba(42,39,35,.42)' }}>選一個</i>
                                </div>
                            )}
                            <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: collapsed(0) ? '1fr' : '1fr 1fr' }}>
                                {PARTY.filter(o => !collapsed(0) || party === o.v).map(o => (
                                    <OptionButton key={o.v} v={o.v} t={o.t} d={o.d} on={party === o.v}
                                        wiping={erasing.includes(o.v)} instant={instant}
                                        span={!collapsed(0) && o.v === 'group'}
                                        onPick={() => pickParty(o.v)} />
                                ))}
                            </div>
                        </div>

                        {/* 下區：還有誰一起（複選）。solo 時**整區退場**——不適用的是一個「區」，一句話解釋完 */}
                        {(!collapsed(0) || withKeys.length > 0) && (
                            <div className="relative z-[2] mt-3 pt-2.5"
                                style={{
                                    borderTop: collapsed(0) ? undefined : '1px dashed rgba(35,35,32,.16)',
                                    opacity: soloOff ? .26 : 1,
                                    pointerEvents: soloOff ? 'none' : undefined,
                                    transition: 'opacity .35s ease',
                                }}>
                                {!collapsed(0) && (
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <b className="font-serif text-[11.5px] font-semibold" style={{ color: 'rgba(42,39,35,.78)', letterSpacing: '.06em' }}>還有誰一起</b>
                                        <i className="not-italic font-serif text-[9.5px]" style={{ color: 'rgba(42,39,35,.42)' }}>可複選</i>
                                    </div>
                                )}
                                <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: collapsed(0) ? '1fr' : '1fr 1fr' }}>
                                    {[...WITH_FRONT, ...(foldOpen ? WITH_BACK : WITH_BACK.filter(o => collapsed(0) && withKeys.includes(o.v)))]
                                        .filter(o => !collapsed(0) || withKeys.includes(o.v))
                                        .map(o => (
                                            <OptionButton key={o.v} v={o.v} t={o.t} d={o.d} on={withKeys.includes(o.v)}
                                                wiping={erasing.includes(o.v)} instant={instant}
                                                onPick={() => toggleWith(o.v)} />
                                        ))}
                                </div>

                                {!collapsed(0) && (
                                    <div className="relative mt-2.5" style={{ perspective: 900 }}>
                                        <button type="button" onClick={toggleFold}
                                            className="w-full flex items-center gap-2 pt-1.5 pb-0.5 font-serif text-[11px]"
                                            style={{ borderTop: '1px dashed rgba(35,35,32,.16)', color: 'rgba(42,39,35,.6)', letterSpacing: '.06em' }}>
                                            <span className="text-[9px] inline-block"
                                                style={{ transform: foldOpen ? 'rotate(180deg)' : undefined, transition: 'transform .5s cubic-bezier(.2,.8,.25,1)' }}>▼</span>
                                            {/* 有**數量**才有點開的理由——「還有…」什麼都沒告訴他 */}
                                            <span>還有 {WITH_BACK.length} 種</span>
                                            {hiddenCarry.length > 0 && !foldOpen && (
                                                <span className="ml-auto font-serif italic text-[11px]" style={{ color: INK_INK, opacity: .85 }}>
                                                    還有：{hiddenCarry.join('、')}
                                                </span>
                                            )}
                                        </button>
                                        {/* 首次揭示：摺頁自己翻起 12° 再收回＝紙被風吹了一下 */}
                                        {!foldOpen && !peeked && !instant && (
                                            <span aria-hidden className="block absolute left-0 right-0 top-full h-2 pointer-events-none"
                                                style={{
                                                    backgroundColor: PAPER, transformOrigin: 'top center',
                                                    animation: 'ktPeek 1.1s cubic-bezier(.3,.7,.3,1) .9s both',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,.18)',
                                                }} />
                                        )}
                                    </div>
                                )}

                                {soloOff && (
                                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 text-center pointer-events-none">
                                        <span className="font-serif italic text-[11px]" style={{ color: INK_INK, opacity: .75 }}>
                                            一個人的話，這一區就跳過了
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!collapsed(0) && !!hand1 && (
                            <div className="relative z-[3] text-right mt-2">
                                <span className="font-serif italic text-[11px]" style={{ color: INK_INK, opacity: .86 }}>↳ {hand1}</span>
                            </div>
                        )}
                    </div>

                    {/* ═══ 紙二：步調（唯一硬約束 prompt 的一張，視覺上放大一階）═══ */}
                    <div {...sheetProps(1)}>
                        <PaperTexture />
                        <HandShadow playing={anim?.idx === 1 && anim.kind === 'pickput'} />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>一天想走多少</h2>
                        {!collapsed(1) && (
                            <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-3" style={{ color: 'rgba(42,39,35,.52)' }}>
                                副標的數字會直接變成行程的密度
                            </p>
                        )}
                        <div className="relative z-[2] grid gap-x-3.5 gap-y-3.5"
                            style={{ gridTemplateColumns: collapsed(1) ? '1fr' : '1fr 1fr' }}>
                            {PACE.filter(o => !collapsed(1) || pace === o.v).map(o => (
                                <OptionButton key={o.v} v={o.v} t={o.t} on={pace === o.v}
                                    wiping={erasing.includes(o.v)} instant={instant}
                                    d={<>{o.d1}<br />{o.d2}</>}
                                    note={o.v === 'packed' ? notePacked : undefined}
                                    onPick={() => pickPace(o.v)} />
                            ))}
                        </div>
                        {/* 我幫他決定的那一筆要說出來（虛線圈在畫面上，這裡補一句為什麼） */}
                        {paceAuto && !collapsed(1) && (
                            <div className="relative z-[3] text-right mt-2">
                                <span className="font-serif italic text-[11px]" style={{ color: INK_INK, opacity: .86 }}>↳ 這是我先幫你圈的，改掉也沒關係</span>
                            </div>
                        )}
                    </div>

                    {/* ═══ 紙三：預算 ═══ */}
                    <div {...sheetProps(2)}>
                        <PaperTexture />
                        <HandShadow playing={anim?.idx === 2 && anim.kind === 'pickput'} />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>大概想花多少</h2>
                        {!collapsed(2) && (
                            // ⚠️「一天的旅費」在常識裡是含住宿的——範圍必須講在最前面
                            <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-3" style={{ color: 'rgba(42,39,35,.52)' }}>
                                吃、玩、車資 —— <b style={{ color: 'rgba(42,39,35,.72)' }}>不含機票和住宿</b>，那兩樣你自己訂
                            </p>
                        )}
                        <div className="relative z-[2] grid gap-y-2.5" style={{ gridTemplateColumns: '1fr' }}>
                            {BUDGET.filter(o => !collapsed(2) || budget === o.v).map(o => (
                                <OptionButton key={o.v} v={o.v} t={o.t} on={budget === o.v}
                                    wiping={erasing.includes(o.v)} instant={instant}
                                    note={o.v === 'economy' ? noteBudget : undefined}
                                    onPick={() => pickBudget(o.v)}
                                    d={<>
                                        {o.d}
                                        {/* 錨點：重層沒給就整行不顯示（缺就退位，不猜數字） */}
                                        {anchors && (
                                            <span className="block font-serif italic text-[10px] mt-0.5" style={{ color: INK_INK, opacity: .62 }}>
                                                {o.anchor(anchors)} ／人／天 · 粗估
                                            </span>
                                        )}
                                    </>} />
                            ))}
                        </div>
                        {!collapsed(2) && anchors && (
                            <p className="relative z-[2] font-serif text-[9.5px] mt-2.5 pt-2 text-right"
                                style={{ borderTop: '1px dashed rgba(35,35,32,.16)', color: 'rgba(42,39,35,.4)' }}>
                                金額以當地貨幣粗估，只用來比較三個等級
                            </p>
                        )}
                    </div>
                </div>

                <div className="relative px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                    {/* 底部漸層：必須是這個容器的**直接子層**（曾被包進會淡出的元素裡而整個消失） */}
                    <div aria-hidden className="absolute left-0 right-0 pointer-events-none" style={{
                        bottom: '100%', height: 42,
                        backgroundImage: 'linear-gradient(rgba(15,14,13,0), rgba(15,14,13,.82))',
                    }} />
                    {/* 高度固定＝票券鈕不會隨文字有無跳動（佔位元素必須真的佔位） */}
                    <div className="text-center mb-2" style={{ minHeight: 18 }}>
                        {!pace ? (
                            <button type="button" onClick={acceptDefault}
                                className="font-serif text-[11px] text-white/60" style={{ letterSpacing: '.05em' }}>
                                {[party ? LABEL[party] : '', ...withKeys.map(k => LABEL[k])].filter(Boolean).join(' · ') || '沒圈選'}
                                {'，'}
                                <u className="no-underline" style={{ borderBottom: '1px solid rgba(255,255,255,.34)', paddingBottom: 1 }}>
                                    使用標準的節奏安排
                                </u>
                            </button>
                        ) : (
                            <span className="font-serif italic text-[11px]" style={{ color: INK_AMBER, letterSpacing: '.05em' }}>
                                {[
                                    party ? LABEL[party] : '',
                                    ...withKeys.map(k => LABEL[k]),
                                    LABEL[pace] + (paceAuto ? '（我幫你選的）' : ''),
                                    budget ? BUDGET_LABEL[budget] : '',
                                ].filter(Boolean).join(' · ')}
                            </span>
                        )}
                    </div>
                    <TicketNextButton onNext={submit} />
                </div>
            </div>

            <style>{INK_KEYFRAMES}</style>
        </div>
    );
};
