// src/views/create/HowPage.tsx
// 🎴 生成表單・⑥「這一趟想怎麼玩」（docs E3-0 v3 定案 2026-08-09；mockup `mockups/step6-how.html`）
//
//   三張紙：①和誰同行（事實）②一天想走多少＋主要移動（密度）③大概想花多少（限制）。
//
//   ── v2 → v3：拆掉整台狀態機 ────────────────────────────────────────
//   v2 的病灶是**把「三題的短表單」做成了一台有狀態機的互動裝置**：聚焦／變暗／鎖定／
//   自動推進／收攏／「拿起-端詳-放下」三拍。複雜度全部來自機制，不是來自內容。
//   v3 全部移除——三張紙平等、全亮、全展開、隨時可填。
//
//   🔴 我論證錯的那一條，留給未來的自己：
//     「拿起來端詳」我當時說是「寫完拿起來看一眼」。**但使用者填完一張紙的心情不是端詳，
//      是「下一個」**。那 246ms 我稱為「儀式感來源」的停頓，對他而言就是卡頓。
//      我為一個想做的動畫找了一個好聽的理由。判準應該是**「這個停頓服務的是誰的心理狀態」**，
//      而不是「這個隱喻聽起來成不成立」。
//
//   ── 情感改由兩件更便宜的事承擔 ──
//     ①**儀式放在開場**：三張紙依序落下（220ms 間隔）＋三聲遞減的落紙聲。一次性，不擋路。
//     ②**情感終點在票券鈕上方那一行**：隨每次圈選長出來（「兩個人 · 有長輩 · 悠閒的節奏 ·
//       自己開車 · 剛剛好」）。它**累積**、它在**出口**、零動畫成本。
//     堆疊感的真正來源是**墨跡**，不是狀態機——紙上的圈越來越多，那就是進度。
//
//   ── 四個關鍵決定（都有代價，不要憑印象改回去）──
//   ①**紙一用兩種不同的紙上動作**：上區＝一句填空（單選）、下區＝打勾清單（複選）。
//     病灶不是「缺標題」，是兩區長得一樣、行為卻不同——使用者在**動手之前**無從預測。
//     圈 vs 勾是紙上真實存在的兩種動作（圈＝挑一個、勾＝清單打勾），這不是破壞
//     「選擇＝手繪圈」的憲章，是把它**分化**（如同紙分成證件紙／書寫紙／票券卡紙）。
//   ②**漸進揭露的依據是「進度」不是「條件」**：選了上區任一項，下區才浮出。
//     刻意不做「獨旅／兩個人就隱藏」——「我陪我媽去」＝兩個人＋長輩同行（台灣孝親旅遊
//     最典型的組合）、獨旅＋寵物（一人一狗）、**獨旅＋推車或輪椅（使用者自己就是輪椅
//     使用者——無障礙旅遊的核心情境，藏起來等於把一整群人排除在外）**。
//     **擋掉合法組合的代價，遠大於允許奇怪組合。**
//   ③**墨圈只圈標題那個詞**，不圈整張選項——圈住兩行副標會讓一大團墨壓在紙上，
//     而使用者選的是那個詞，不是那段說明。
//   ④**「主要移動」和「步調」同一張紙**：自駕的「一天 5 個地方」和大眾運輸的
//     「一天 5 個地方」難度差一倍，它們一起決定密度，而且兩者都硬約束 prompt。
//     順序上交通在預算**之前**，所以選「自己開車」時預算那張才能立刻說「油錢與停車另計」。
//     逐日的交通方式**不在這裡問**——使用者填表單時還不知道哪一天要去哪，那屬於行程頁
//     （與 Lawson 邊界同一條原則：表單只收意圖）。而「主要包車」本來就不代表每一段都包車，
//     市區短程 LLM 自然會排步行或電車，**混合是預設就會發生的，不需要宣告**。
//
//   ⚠️ TODO（定稿有、這一版刻意未做）：**回頭客重描上次的筆跡**。需要把上一份 brief 接進來，
//      等 ⑧確認與生成幕一起做——現在留一個永遠 undefined 的 prop 只會變成假功能。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import type { PaceLevel, BudgetLevel, LocalTransport } from '../../types';
import { playPageSound, hapticTap } from '../../services/sounds';
import { fetchDestinationDeep, budgetAnchors, type DestinationBudget } from '../../services/destinationIntel';
import { TicketNextButton } from './TicketNextButton';
import {
    HandCircle, EraserBlock, PaperTexture, paperShadow, seedOf,
    PAPER, PAPER_RADIUS, INK_INK, INK_PRINT, INK_AMBER, INK_KEYFRAMES,
} from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** 落紙的時間表（動畫延遲與音效排程共用同一組數字） */
const DROP_BASE = 180;
const DROP_GAP = 220;
const ERASE_MS = 450;
/** 漸進揭露的高度上限（四個勾選項固定內容；用 max-height 而非 grid-template-rows——
 *  後者要 Safari 17.4+，iOS 舊機吃不到） */
const REVEAL_MAX = 260;

// ── 選項表（key 穩定、label 給 UI 與 prompt）──────────────────────
type PartyKey = 'solo' | 'couple' | 'friends' | 'family' | 'work' | 'class';
type WithKey = 'kids' | 'elder' | 'pet' | 'wheel';

/** 上區＝一句填空。六個詞**不需要副標**（「兩個人」要解釋什麼？），兩行三欄等寬排列。
 *  「兩個人」刻意不改成「情侶」：情侶會排除夫妻／母女／兄弟／兩個朋友，而且
 *  **人數對 prompt 更有用**（行程密度看人數、餐廳訂位看人數），關係由下區補足。 */
const PARTY: { v: PartyKey; t: string }[] = [
    { v: 'solo', t: '獨旅' },
    { v: 'couple', t: '兩個人' },
    { v: 'friends', t: '一群朋友' },
    { v: 'family', t: '家人' },
    { v: 'work', t: '同事' },
    { v: 'class', t: '同學' },
];

/** 下區＝打勾清單。標題是身分（提醒清單需要「有長輩」才推得出藥盒與健保卡），
 *  副標是需求（真正影響行程的東西）。 */
const WITHS: { v: WithKey; t: string; d: string }[] = [
    { v: 'kids', t: '帶著孩子', d: '要有休息與廁所' },
    { v: 'elder', t: '長輩同行', d: '走得慢、要坐著吃' },
    { v: 'pet', t: '帶著寵物', d: '要能一起進去的地方' },
    { v: 'wheel', t: '推車或輪椅', d: '要挑有電梯、有平路的' },
];

/** 副標的數字＝**形容詞的契約**（同一組數字同時進 UI 與 prompt；見 tripBrief.PACE_STOPS）。
 *  「深度」與「悠閒」原本語意打架，靠第二行的具體行為分開：悠閒是為了不累，深度是為了看透。 */
const PACE: { v: PaceLevel; t: string; d1: string; d2: string }[] = [
    { v: 'relaxed', t: '悠閒', d1: '一天 2–3 個地方', d2: '不趕路，中間坐得下來' },
    { v: 'standard', t: '標準', d1: '一天 4–5 個地方', d2: '走走看看，該去的都去' },
    { v: 'packed', t: '緊湊', d1: '一天 6 個以上', d2: '想去的都排進去' },
    { v: 'deep', t: '深度', d1: '一天 1–2 個地方', d2: '每個待上半天，看得透' },
];

const MOVES: { v: LocalTransport; t: string }[] = [
    { v: 'public', t: '大眾運輸' },
    { v: 'car', t: '自己開車' },
    { v: 'charter', t: '包車接送' },
];

/** ⚠️ 副標裡**不得出現住宿等級**（範圍已排除住宿），也**不得指定交通工具**
 *  （「大眾運輸」對自駕的人不成立，而且那是紙二在問的事）。
 *
 *  `hint`＝**圈選後才浮出**的一行說明。它的職責和副標不同：
 *    副標說「這個等級大概是什麼」，hint 說「**我實際上會怎麼排**」。
 *  這是為了把使用者心裡的形容詞和我們的定義對齊——「不將就」每個人的想像差很多，
 *  但「需要預約的餐廳與體驗會優先排入」是一個**可驗證的具體行為**。
 *  語氣一律客觀陳述，不評價、不勸說。
 *
 *  🔴 **承諾＝交付**：這三句都必須在生成的行程裡看得到，否則就是空頭支票。
 *     對應的 prompt 指令寫在 `services/gemini.ts` 的 `BUDGET_DIRECTIVE`——**改這裡就要改那裡**。
 *  ⚠️ economy 原本寫的是「由你決定是否保留」，已降級為「會標示出來」：
 *     前者承諾了一個**專門的決定介面**（保留／不保留），我們沒有做，而且不值得做——
 *     使用者本來就能刪掉任何活動，選了「省著花」的人 LLM 也本來就會避開高價景點，
 *     真正會發生的只有「貴但非去不可的地標」那少數幾個。**標示就夠了，別承諾介面。** */
const BUDGET: { v: BudgetLevel; t: string; d: string; hint: string; pick: (b: DestinationBudget) => string }[] = [
    {
        v: 'economy', t: '省著花', d: '小吃與便利商店 · 交通挑便宜的 · 挑免費的景點',
        hint: '門票偏高的地方，會在行程上標示出來', pick: b => b.lean,
    },
    {
        v: 'standard', t: '剛剛好', d: '好好吃一餐 · 該搭車就搭車 · 該買的門票就買',
        hint: '一天安排一餐正式的，其餘從簡', pick: b => b.mid,
    },
    {
        v: 'luxury', t: '不將就', d: '想訂的餐廳就訂 · 怎麼順就怎麼走 · 體驗優先',
        hint: '需要預約的餐廳與體驗會優先排入行程', pick: b => b.rich,
    },
];

/** 票券鈕上方摘要用的短標籤 */
const LABEL: Record<string, string> = {
    solo: '獨旅', couple: '兩個人', friends: '一群朋友', family: '家人', work: '和同事', class: '和同學',
    kids: '帶孩子', elder: '有長輩', pet: '帶寵物', wheel: '有推車輪椅',
    relaxed: '悠閒的節奏', standard: '標準的節奏', packed: '緊湊的節奏', deep: '深度的節奏',
    public: '搭大眾運輸', car: '自己開車', charter: '包車',
};
/** 預算的 'standard' 與步調的 'standard' 撞名，摘要另外取（不要共用一張表就以為安全） */
const BUDGET_LABEL: Record<BudgetLevel, string> = { economy: '省著花', standard: '剛剛好', luxury: '不將就' };
/** 進 brief / prompt 的同行者措辭（完整、可讀；壓成單一字串會資訊死亡） */
const COMPANION_LABEL: Record<string, string> = {
    solo: '獨旅', couple: '兩人同行', friends: '一群朋友', family: '家人同行',
    work: '與同事同行', class: '與同學同行',
    kids: '帶著孩子', elder: '長輩同行', pet: '帶著寵物', wheel: '有人使用推車或輪椅',
};

export interface HowResult {
    /** 幾個人／什麼關係（單選；null＝沒填） */
    party: PartyKey | null;
    /** 還有誰有特別需要（複選；順序＝畫面順序） */
    withKeys: WithKey[];
    /** 給 brief 與 prompt 的完整同行者清單（中文；**以這個為準**，不要用單一代表值） */
    companions: string[];
    pace: PaceLevel;
    /** true＝使用者沒圈，我們用了標準（資料要誠實：「他選了標準」與「他沒選」不是同一件事） */
    paceAuto: boolean;
    move: LocalTransport;
    moveAuto: boolean;
    budget: BudgetLevel;
    budgetAuto: boolean;
    /** 使用者**親手輸入**的每人每天上限——**唯一會進 prompt 的金額**（見 destinationIntel 三條規矩）。
     *  語意是**上限**不是目標：寫成目標，LLM 會為了湊到那個數字硬塞景點。 */
    budgetCap?: number;
    /** 整頁一顆都沒圈 */
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
 * 優先序＝**對行程限制最強的先贏**：行動不便 > 長輩 > 孩子 > 寵物 > 關係。
 */
export const legacyCompanionId = (r: HowResult): string => {
    if (r.withKeys.includes('wheel') || r.withKeys.includes('elder')) return 'elderly';
    if (r.withKeys.includes('kids')) return 'family';
    if (r.withKeys.includes('pet')) return 'pet';
    switch (r.party) {
        case 'solo': return 'solo';
        case 'friends': return 'friends';
        case 'family': return 'family';
        case 'work': return 'colleague';
        case 'class': return 'classmate';
        default: return 'couple';
    }
};

// ── 共用的小元件（**必須在模組層級**）──────────────────────────────
// ⚠️ 在元件裡定義元件的話，每次 state 改變都會產生「新的元件型別」，React 會卸載重掛整棵子樹
//    ——墨圈的描繪動畫會不停重播、橡皮擦動畫會被打斷。這是 React 最容易誤踩的陷阱之一。

/** 圈選型選項（步調／主要移動／預算）。**墨圈只落在標題那個詞上**。 */
const InkOption: React.FC<{
    /** 🔴 **全頁唯一**的 key（`pace:standard` / `budget:standard`）。
     *  ⚠️ 不可以只用 `v`：預算的 'standard'（剛剛好）與步調的 'standard'（標準）**撞名**——
     *     用 v 當 key 的話，擦掉預算那顆時，步調的「標準」也會跟著演一次橡皮擦（實測過的 bug）。
     *     seed 也吃這個 key，順便讓兩處的筆跡不再一模一樣。 */
    k: string;
    v: string;
    t: string;
    d?: React.ReactNode;
    on: boolean;
    wiping: boolean;
    instant: boolean;
    onPick: () => void;
    note?: string;
    compact?: boolean;
}> = ({ k, t, d, on, wiping, instant, onPick, note, compact }) => (
    <button type="button" onClick={onPick} aria-pressed={on}
        className={compact ? 'relative text-center px-0.5 py-1' : 'relative text-left px-1.5 pt-1.5 pb-1'}
        style={{ color: INK_PRINT }}>
        {/* inline-block＝寬度貼合文字，墨圈才會只框住那個詞（block 會撐滿整欄） */}
        <span className="relative inline-block leading-[1.35]"
            style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: compact ? 400 : 500, letterSpacing: '.04em' }}>
            {t}
            {on && !wiping && <HandCircle seed={seedOf(k)} color={INK_INK} instant={instant} tight />}
            {wiping && (
                <>
                    <EraserBlock />
                    <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                        <HandCircle seed={seedOf(k)} color={INK_INK} instant tight />
                    </span>
                </>
            )}
        </span>
        {!!d && (
            <span className="block font-serif text-[10px] leading-[1.45] mt-0.5" style={{ color: 'rgba(42,39,35,.5)' }}>{d}</span>
        )}
        {/* 說明／矛盾旁註：**在這一顆的框線內**（曾用絕對定位放在框外，讀起來像是下一項的標題）。
            它只在被圈選時出現，所以佔位置是合理的——那是「這一顆展開了」。 */}
        {!!note && (
            <span aria-hidden className="block font-serif italic text-[9.5px] leading-[1.45] mt-1.5"
                style={{ color: INK_INK, opacity: .72, animation: instant ? undefined : 'ktFadeUp .4s ease-out' }}>
                ↳ {note}
            </span>
        )}
    </button>
);

/**
 * 打勾型選項（下區複選）。勾＝清單的語彙，與圈刻意不同。
 *
 * 勾用 **SVG path** 畫，不用 CSS 的 border 拼角（後者是兩條直線硬轉 46°，
 * 位置難對齊、線寬不會變化，看起來是「圖示」而不是「筆跡」）。
 * path 刻意**先短下、再長上**，尾端帶一點上揚——那是手寫勾的形狀；
 * 描繪動畫（stroke-dashoffset）與墨圈同一套語彙：筆跡是**畫出來的**，不是淡入的。
 */
const CheckOption: React.FC<{
    t: string; d: string; on: boolean; instant: boolean; onPick: () => void;
}> = ({ t, d, on, instant, onPick }) => (
    <button type="button" onClick={onPick} aria-pressed={on}
        className="relative text-left pl-[24px] pr-1 pt-1.5 pb-1" style={{ color: INK_PRINT }}>
        <span aria-hidden className="absolute left-0.5 top-[8px] w-[15px] h-[15px] rounded-[2px]"
            style={{ border: '1.3px solid rgba(35,35,32,.38)' }}>
            {on && (
                <svg viewBox="0 0 16 16" width="15" height="15"
                    style={{ position: 'absolute', left: -1.3, top: -1.3, overflow: 'visible' }}>
                    <path d="M3.4 8.2 C4.5 9.1, 5.3 10.2, 6.2 11.8 C8.0 8.2, 10.2 5.4, 13.2 3.4"
                        fill="none" stroke={INK_INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                        pathLength={100}
                        style={{
                            strokeDasharray: 100,
                            strokeDashoffset: instant ? 0 : 100,
                            animation: instant ? undefined : 'ktDraw .26s cubic-bezier(.3,.8,.4,1) forwards',
                            filter: 'drop-shadow(0 0 .4px rgba(35,35,32,.28))',
                        }} />
                </svg>
            )}
        </span>
        <span className="block font-serif text-[13.5px] font-medium leading-[1.35]" style={{ letterSpacing: '.04em' }}>{t}</span>
        <span className="block font-serif text-[10px] leading-[1.45] mt-0.5" style={{ color: 'rgba(42,39,35,.5)' }}>{d}</span>
    </button>
);

export const HowPage: React.FC<{
    /** 麵包屑（「日本 · 關西」） */
    breadcrumb: string;
    /** 打 deep 的查詢字串（預算錨點用；沿用入口頁已驗證的目的地） */
    query: string;
    /** 背景照片（沿用前面幾頁那張＝物件連續） */
    coverUrl: string | null;
    isDomestic: boolean;
    /**
     * 🔴 **回頭時的復原**：這一頁關閉時整個元件被卸載，state 隨之消失。
     * ⚠️ `*Auto` 為 true 代表「**他沒選、是我們填的預設**」——復原時必須還原成**未選**，
     *    否則他回來會看到自己從沒圈過的選項被圈起來，那是在竄改他的答案。
     */
    initial?: HowResult;
    /** 從 ⑧ 確認書點「改」回來時＝「改好了」（沒有這個字，使用者會以為要重走一遍） */
    nextLabel?: string;
    /** ⚠️ 帶著當前選擇離開——**「上一步」也要保存** */
    onBack: (r: HowResult) => void;
    onClose: () => void;
    onNext: (r: HowResult) => void;
}> = ({ breadcrumb, query, coverUrl, isDomestic, initial, nextLabel, onBack, onClose, onNext }) => {
    const instant = useMemo(() => reduceMotion(), []);

    const [party, setParty] = useState<PartyKey | null>(initial?.party ?? null);
    const [withKeys, setWithKeys] = useState<WithKey[]>(initial?.withKeys ?? []);
    const [pace, setPace] = useState<PaceLevel | null>(initial && !initial.paceAuto ? initial.pace : null);
    const [paceAuto, setPaceAuto] = useState(false);
    const [move, setMove] = useState<LocalTransport | null>(initial && !initial.moveAuto ? initial.move : null);
    const [budget, setBudget] = useState<BudgetLevel | null>(initial && !initial.budgetAuto ? initial.budget : null);
    const [capRaw, setCapRaw] = useState(initial?.budgetCap ? String(initial.budgetCap) : '');
    /** 這一輪是否剛幫他把「獨旅」改成「家人」（只用來決定要不要說那句話） */
    const [autoFamily, setAutoFamily] = useState(false);
    const [anchors, setAnchors] = useState<DestinationBudget | null>(null);
    /** 正在被擦掉的選項（單選換選時同時有兩個：舊的在擦、新的在畫） */
    const [erasing, setErasing] = useState<string[]>([]);

    const aliveRef = useRef(true);
    const timersRef = useRef<Set<number>>(new Set());
    const after = useCallback((ms: number, fn: () => void) => {
        const id = window.setTimeout(() => {
            timersRef.current.delete(id);
            if (aliveRef.current) fn();
        }, ms);
        timersRef.current.add(id);
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

    // 進場：三張紙依序落下。**這是這一頁唯一的儀式**。
    // ⚠️ 音效是**一段 1.23s 的連續紙聲，只播一次**——不是三個短音。
    //    三個短音是三次獨立事件，會把從容的情緒切碎；一段連續的聲音才是一個過程（Kelvin 實測定案）。
    useEffect(() => {
        if (instant) return;
        const id = window.setTimeout(() => playPageSound('paperSettle', 0.85), DROP_BASE);
        return () => window.clearTimeout(id);
    }, [instant]);

    // ── 圈 / 擦 ────────────────────────────────────────────────
    const eraseThen = useCallback((key: string, commit: () => void) => {
        if (instant) { commit(); return; }
        setErasing(prev => [...prev, key]);
        playPageSound('eraser');
        hapticTap();
        after(ERASE_MS, () => {
            commit();
            setErasing(prev => prev.filter(k => k !== key));
        });
    }, [after, instant]);

    /** 單選三張紙共用：同一顆再點＝擦掉；換選＝舊的擦、新的畫（一次動作只播一個聲音）。
     *  ⚠️ `group` 不是裝飾——沒有它，預算與步調的 'standard' 會互相觸發橡皮擦。 */
    const pickOne = useCallback(<T extends string>(
        group: string, cur: T | null, next: T, set: (v: T | null) => void,
    ) => {
        if (cur === next) { eraseThen(`${group}:${next}`, () => set(null)); return; }
        if (cur) eraseThen(`${group}:${cur}`, () => { /* 只是把舊圈擦掉，值已經換了 */ });
        set(next);
        playPageSound('penCircle');
        hapticTap();
    }, [eraseThen]);

    const pickParty = useCallback((v: PartyKey) => {
        setAutoFamily(false);
        if (party === v) { setParty(null); return; }
        setParty(v);
        hapticTap();
    }, [party]);

    const toggleWith = useCallback((v: WithKey) => {
        setAutoFamily(false);
        if (withKeys.includes(v)) {
            setWithKeys(prev => prev.filter(k => k !== v));
            playPageSound('eraser', 0.7);
            hapticTap();
            return;
        }
        setWithKeys(prev => [...prev, v]);
        playPageSound('tick', 0.9);
        hapticTap();
        // 🤝 承諾＝交付：文案說「幫你改成家人」，就要**真的改**。
        //    長輩是完整的旅伴，有長輩就不是獨旅；改成「家人」而不是「兩個人」——
        //    長輩同行絕大多數是陪爸媽，而且人數不一定只有兩個。
        //    改完他看得見填空句的字變了，不同意就自己點回去。
        //    ⚠️ 只在**勾長輩的當下**改一次——之後他愛怎麼選都不再干預（一次性的協助，不是持續的規則）。
        if (v === 'elder' && party === 'solo') { setParty('family'); setAutoFamily(true); }
    }, [withKeys, party]);

    const pickPace = useCallback((v: PaceLevel) => {
        pickOne('pace', pace, v, x => { setPace(x); setPaceAuto(false); });
    }, [pace, pickOne]);
    const pickMove = useCallback((v: LocalTransport) => { pickOne('move', move, v, setMove); }, [move, pickOne]);
    const pickBudget = useCallback((v: BudgetLevel) => { pickOne('budget', budget, v, setBudget); }, [budget, pickOne]);

    /** 接受預設＝一個**看得見的動作**（虛線圈），不是一片空白 */
    const acceptDefault = useCallback(() => {
        if (pace) return;
        setPace('standard'); setPaceAuto(true);
        playPageSound('penCircle', 0.7);
        hapticTap();
    }, [pace]);

    // ── 摘要與旁註 ─────────────────────────────────────────────
    const has = useCallback((k: WithKey) => withKeys.includes(k), [withKeys]);

    const hand1 = useMemo(() => {
        if (autoFamily) return '有長輩同行，幫你改成家人了';
        if (has('elder') && has('kids')) return '步調會放慢，清單上會多幾樣';
        if (has('wheel')) return '只挑有電梯、走得到的地方';
        if (has('elder')) return '步調會幫你放慢一些';
        if (has('kids')) return '會避開走太多路的行程';
        if (has('pet')) return '只挑能帶牠一起進去的地方';
        if (party === 'work') return '白天會留一段可以工作的時間';
        if (party === 'class') return '會挑省一點、人多也好玩的地方';
        return '';
    }, [autoFamily, has, party]);

    /** 步調與交通的合成回應——**同一個「緊湊」配不同交通方式，意思不一樣**。 */
    const hand2 = useMemo(() => {
        if (move === 'car' && pace === 'packed') return '自駕的話，六個以上還算跑得動';
        if (move === 'public' && pace === 'packed') return '搭車移動，六個以上會很趕';
        if (move === 'charter') return '包車的話，遠一點的地方也排得進去';
        if (pace === 'deep') return '一天只去 1–2 個地方';
        return '';
    }, [move, pace]);

    /** 自駕的花費結構完全不同——這句只有在「交通排在預算上面」時才做得到 */
    const hand3 = move === 'car' ? '自駕的話，油錢與停車另計' : '';

    const notePacked = useMemo(() => {
        const slow = has('elder') || has('wheel') || has('kids');
        // 自駕／包車已經把移動成本吃掉了，這時再說「會太趕」是雜訊
        if (pace !== 'packed' || !slow || move === 'car' || move === 'charter') return '';
        if (has('wheel')) return '有推車或輪椅，這樣可能會太趕';
        if (has('elder')) return '圈了長輩，這樣可能有點趕';
        return '帶著孩子，這樣可能有點趕';
    }, [pace, move, has]);
    /** 圈選後的說明；**矛盾優先於一般說明**（有話要修正時，先講那句）。 */
    const budgetNote = useCallback((v: BudgetLevel, hint: string): string | undefined => {
        if (budget !== v) return undefined;
        if (v === 'economy' && (has('elder') || has('wheel'))) return '同行者行動不便時，交通仍以便利為優先';
        return hint;
    }, [budget, has]);

    /** 使用者輸入的上限（去掉逗號與非數字；0 或無效＝視為沒填） */
    const capNum = useMemo(() => {
        const n = parseInt(capRaw.replace(/[^\d]/g, ''), 10);
        return Number.isFinite(n) && n > 0 ? n : undefined;
    }, [capRaw]);

    const summary = useMemo(() => {
        const p: string[] = [];
        if (party) p.push(LABEL[party]);
        withKeys.forEach(k => p.push(LABEL[k]));
        if (pace) p.push(LABEL[pace] + (paceAuto ? '（我幫你選的）' : ''));
        if (move) p.push(LABEL[move]);
        if (budget) p.push(BUDGET_LABEL[budget]);
        return p;
    }, [party, withKeys, pace, paceAuto, move, budget]);

    /** 當前選擇的快照——**下一步與上一步共用**（兩個出口都要保存，不然往回走就清空） */
    const snapshot = useCallback((): HowResult => {
        const keys: string[] = [...(party ? [party] : []), ...withKeys];
        return {
            party,
            withKeys,
            companions: keys.map(k => COMPANION_LABEL[k]).filter(Boolean),
            pace: pace ?? 'standard',
            paceAuto: !pace || paceAuto,
            move: move ?? 'public',
            moveAuto: !move,
            budget: budget ?? 'standard',
            budgetAuto: !budget,
            budgetCap: capNum,
            skipped: !party && withKeys.length === 0 && !pace && !move && !budget,
        };
    }, [party, withKeys, pace, paceAuto, move, budget, capNum]);
    const submit = useCallback(() => onNext(snapshot()), [snapshot, onNext]);

    // ── 版面 ───────────────────────────────────────────────────
    const sheetStyle = (i: number): React.CSSProperties => ({
        backgroundColor: PAPER,
        borderRadius: PAPER_RADIUS,
        color: INK_PRINT,
        boxShadow: paperShadow('rest'),
        animation: instant ? undefined : `ktPaperDrop .62s cubic-bezier(.18,.86,.32,1) ${DROP_BASE + i * DROP_GAP}ms backwards`,
    });
    const RULE: React.CSSProperties = { borderTop: '1px dashed rgba(35,35,32,.16)' };

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
                <button onClick={() => onBack(snapshot())} aria-label="上一步" className="absolute left-3 p-2 z-30"
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
                    <div className="relative mx-[18px] mb-4 px-4 pt-4 pb-3.5" style={sheetStyle(0)}>
                        <PaperTexture />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>和誰同行</h2>

                        {/* 上區＝一句填空。**句子只有一個空格 → 一眼就知道只能填一個**，不必試、不必想。 */}
                        <div className="relative z-[2] mt-2">
                            <span className="block font-serif text-[12.5px] mb-1.5" style={{ color: 'rgba(42,39,35,.62)' }}>這一趟是</span>
                            <div className="grid grid-cols-3 gap-x-2.5 gap-y-2.5">
                                {PARTY.map(o => (
                                    <button key={o.v} type="button" onClick={() => pickParty(o.v)} aria-pressed={party === o.v}
                                        className="font-serif text-[14px] text-center pt-0.5 pb-[5px] px-0.5"
                                        style={{
                                            letterSpacing: '.03em',
                                            color: party === o.v ? INK_PRINT : 'rgba(42,39,35,.5)',
                                            fontWeight: party === o.v ? 600 : 400,
                                            // 未填＝淡墨＋底線（「這裡要填一個字」）；填了＝墨色、底線消失
                                            borderBottom: `1px solid ${party === o.v ? 'transparent' : 'rgba(35,35,32,.18)'}`,
                                            transition: 'color .2s ease, border-color .2s ease',
                                        }}>{o.t}</button>
                                ))}
                            </div>
                        </div>

                        {/* 下區：**選了上區任一項才浮出**（依據是進度，不是條件） */}
                        <div style={{
                            maxHeight: party ? REVEAL_MAX : 0,
                            opacity: party ? 1 : 0,
                            overflow: 'hidden',
                            transition: instant ? undefined : 'max-height .48s cubic-bezier(.2,.8,.25,1), opacity .34s ease',
                        }}>
                            <div className="relative z-[2] mt-3 pt-2.5" style={RULE}>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                    {WITHS.map(o => (
                                        <CheckOption key={o.v} t={o.t} d={o.d} on={has(o.v)} instant={instant}
                                            onPick={() => toggleWith(o.v)} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-[3] text-right mt-2" style={{ minHeight: 16 }}>
                            <span className="font-serif italic text-[11px]"
                                style={{ color: INK_INK, opacity: hand1 ? .86 : 0, transition: 'opacity .4s ease' }}>
                                {hand1 ? `↳ ${hand1}` : ' '}
                            </span>
                        </div>
                    </div>

                    {/* ═══ 紙二：密度（步調 ＋ 主要移動）═══ */}
                    <div className="relative mx-[18px] mb-4 px-4 pt-4 pb-3.5" style={sheetStyle(1)}>
                        <PaperTexture />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>一天想走多少</h2>
                        <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-3" style={{ color: 'rgba(42,39,35,.52)' }}>
                            副標的數字會直接變成行程的密度
                        </p>
                        <div className="relative z-[2] grid grid-cols-2 gap-x-3.5 gap-y-3.5">
                            {PACE.map(o => (
                                <InkOption key={o.v} k={`pace:${o.v}`} v={o.v} t={o.t} on={pace === o.v}
                                    wiping={erasing.includes(`pace:${o.v}`)} instant={instant}
                                    d={<>{o.d1}<br />{o.d2}</>}
                                    note={o.v === 'packed' ? notePacked : undefined}
                                    onPick={() => pickPace(o.v)} />
                            ))}
                        </div>

                        {/* 標籤獨佔一行、三個選項均分——**與紙一「這一趟是 ␣ 六個詞」同一個結構**。
                            一致性比省下的 20px 值錢：同一個表單有兩種提問的排版語彙，使用者說不出哪裡怪，但會覺得亂。
                            標籤與選項**同一個字級**（12.5px），靠字重與墨色分辨誰是標籤、誰是可點的。 */}
                        <div className="relative z-[2] mt-3 pt-2.5" style={RULE}>
                            <span className="block font-serif text-[12.5px] font-semibold mb-1.5"
                                style={{ color: 'rgba(42,39,35,.72)', letterSpacing: '.06em' }}>主要移動</span>
                            <div className="grid grid-cols-3">
                                {MOVES.map(o => (
                                    <InkOption key={o.v} k={`move:${o.v}`} v={o.v} t={o.t} on={move === o.v} compact
                                        wiping={erasing.includes(`move:${o.v}`)} instant={instant}
                                        onPick={() => pickMove(o.v)} />
                                ))}
                            </div>
                        </div>

                        <div className="relative z-[3] text-right mt-2" style={{ minHeight: 16 }}>
                            <span className="font-serif italic text-[11px]"
                                style={{ color: INK_INK, opacity: hand2 ? .86 : 0, transition: 'opacity .4s ease' }}>
                                {hand2 ? `↳ ${hand2}` : ' '}
                            </span>
                        </div>
                    </div>

                    {/* ═══ 紙三：預算 ═══ */}
                    <div className="relative mx-[18px] mb-4 px-4 pt-4 pb-3.5" style={sheetStyle(2)}>
                        <PaperTexture />
                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>大概想花多少</h2>
                        {/* ⚠️「一天的旅費」在常識裡是含住宿的——範圍必須講在最前面 */}
                        <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-3" style={{ color: 'rgba(42,39,35,.52)' }}>
                            吃、玩、車資 —— <b style={{ color: 'rgba(42,39,35,.72)' }}>不含機票和住宿</b>，那兩樣你自己訂
                        </p>
                        <div className="relative z-[2] grid gap-y-2">
                            {BUDGET.map(o => (
                                <InkOption key={o.v} k={`budget:${o.v}`} v={o.v} t={o.t} on={budget === o.v}
                                    wiping={erasing.includes(`budget:${o.v}`)} instant={instant}
                                    note={budgetNote(o.v, o.hint)}
                                    onPick={() => pickBudget(o.v)}
                                    d={<>
                                        {o.d}
                                        {/* 錨點：重層沒給就整行不顯示（缺就退位，不猜數字） */}
                                        {anchors && (
                                            <span className="block font-serif italic text-[10px] mt-0.5" style={{ color: INK_INK, opacity: .62 }}>
                                                {o.pick(anchors)} ／人／天 · 粗估
                                            </span>
                                        )}
                                    </>} />
                            ))}
                        </div>

                        {/* 自訂上限：**藏在三級之後**（選了才浮出）；placeholder ＝ 該級的上限。
                            對著空白框想數字很難，對著一個數字調整很容易——這是錨點最大的價值。
                            排版刻意**兩行**：一行放不下就會折成鋸齒狀，那正是「雜亂」的來源。 */}
                        {budget && (
                            <div className="relative z-[2] mt-2.5 pt-2.5" style={{ ...RULE, animation: instant ? undefined : 'ktFadeUp .4s ease-out' }}>
                                <div className="flex items-baseline gap-2 whitespace-nowrap font-serif text-[11.5px]" style={{ color: 'rgba(42,39,35,.6)' }}>
                                    <span className="flex-none">或者，我最多想花</span>
                                    {/* ⚠️ min-w-0：flex 項目預設 min-width:auto 會撐破容器（入口頁踩過的坑） */}
                                    <input value={capRaw} onChange={e => setCapRaw(e.target.value)}
                                        inputMode="numeric" aria-label="每人每天的花費上限"
                                        placeholder={anchors ? '' : '例如 10000'}
                                        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-center font-serif italic text-[13.5px] pb-0.5"
                                        style={{ color: INK_INK, borderBottom: '1px solid rgba(35,35,32,.3)' }} />
                                    <span className="flex-none text-[11px]">／人／天</span>
                                </div>
                                <div className="font-serif text-[9.5px] leading-[1.5] mt-1.5" style={{ color: 'rgba(42,39,35,.42)' }}>
                                    超過的地方我會標出來，不會直接砍掉
                                </div>
                            </div>
                        )}

                        <div className="relative z-[3] text-right mt-2" style={{ minHeight: 16 }}>
                            <span className="font-serif italic text-[11px]"
                                style={{ color: INK_INK, opacity: hand3 ? .86 : 0, transition: 'opacity .4s ease' }}>
                                {hand3 ? `↳ ${hand3}` : ' '}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                    {/* 底部漸層：必須是這個容器的**直接子層**（曾被包進會淡出的元素裡而整個消失） */}
                    <div aria-hidden className="absolute left-0 right-0 pointer-events-none" style={{
                        bottom: '100%', height: 42,
                        backgroundImage: 'linear-gradient(rgba(15,14,13,0), rgba(15,14,13,.82))',
                    }} />
                    {/* 💛 這一頁的情感終點：他的選擇被念回來。**累積**，不是重播同一段動畫。
                        高度固定＝票券鈕不會隨文字有無跳動（佔位元素必須真的佔位）。 */}
                    <div className="text-center mb-2 px-2" style={{ minHeight: 32 }}>
                        {!pace ? (
                            <button type="button" onClick={acceptDefault}
                                className="font-serif text-[11.5px] text-white/60 leading-[1.5]" style={{ letterSpacing: '.05em' }}>
                                {summary.length ? `${summary.join(' · ')}，` : '沒圈選，'}
                                <span style={{ borderBottom: '1px solid rgba(255,255,255,.34)', paddingBottom: 1 }}>
                                    使用標準的節奏安排
                                </span>
                            </button>
                        ) : (
                            <span className="font-serif italic text-[11.5px] leading-[1.5]"
                                style={{ color: INK_AMBER, letterSpacing: '.05em' }}>
                                {summary.join(' · ')}
                            </span>
                        )}
                    </div>
                    <TicketNextButton label={nextLabel} onNext={submit} />
                </div>
            </div>

            <style>{INK_KEYFRAMES}</style>
        </div>
    );
};
