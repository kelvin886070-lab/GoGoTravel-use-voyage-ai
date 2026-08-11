// src/views/create/NotesPage.tsx
// ✍️ 生成表單・⑦「這一趟，你的講究」（docs E3 定稿 ＋ 2026-08-10 雙筆定案）
//
//   兩張紙：①**標籤紙**（目的地感知標籤雲・雙筆）②**書寫紙**（手寫欄・整理一下・用說的）
//
//   ── 四個關鍵決定 ──────────────────────────────────────────────
//   ①🖊️ **雙筆取代三態循環**：舊定案是「點一下＝圈、再點＝劃除、第三下＝擦」，但那會與 ⑥
//     的「再點一次＝擦掉」**直接打架**——同一個手勢在相鄰兩頁意義不同，使用者無從預測。
//     改成兩隻筆：墨筆畫圈（想要）、紅筆劃除（不要），而**再點一次永遠是擦掉**。
//     只有兩種「畫」和一種「擦」，沒有循環。
//   ②**模式切換用物理隱喻，不用抽象狀態**：憲章第 4 條寫過「不做模式切換」，因為使用者會
//     忘記自己在哪個模式。解法是讓選中的那支筆**浮起、微傾、帶投影＝被拿在手上**——
//     **「你手上拿著哪支筆」本身就是最強的狀態指示**。模式是抽象的，拿筆是具體的。
//   ③❌ **不做「vibe → 跳出對應主題」的父子結構**：那會讓標籤雲從「目的地感知」降級成
//     「vibe 的子選單」。金澤的好標籤（兼六園的四季／金箔工藝／近江町市場）**不屬於任何
//     單一 vibe**；而且興趣跨 vibe 的人會被卡住。調性維度改由 prompt 承接
//     （tags 要求「涵蓋從熱門到冷門」）——**只剩一個維度，就沒有東西可以互相矛盾**。
//   ④**保留「整理一下」、砍掉「即時解讀」**（Kelvin）：兩者都在做「確認 AI 沒誤解」，
//     但整理是**主動、可控**的，而且它會**逼使用者把心裡的話說完整**——那是引導不是潤飾；
//     即時解讀每次停筆就彈一下，反而打擾。
//
//   ⚠️ TODO（需要上一份 brief 才能做，等 ⑧ brief 落地後接上）：
//      **記憶便條**（和紙膠帶兩段、飽和赭紅、FROM 上一趟、字跡轉印）與
//      **個人化排序的資料源**（`lastWanted` prop 目前沒有呼叫端傳值——
//      但沒有它時就是預設順序，畫面完全正常，不是假功能）。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, Mic } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';
import { toast } from '../../components/Toast';
import { fetchDestinationDeep, intelTags, refineNotes } from '../../services/destinationIntel';
import { TicketNextButton } from './TicketNextButton';
import {
    HandCircle, EraserBlock, PaperTexture, paperShadow, seedOf,
    PAPER, PAPER_RADIUS, INK_INK, INK_PRINT, INK_KEYFRAMES,
} from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** 出發章紅：劃除線與「不要」的顏色（與全站「出發／準備家族＝紅」同一支） */
const STAMP_RED = '#A23B2E';
/** 手寫欄上限；**160 字才顯示計數**——平常在旁邊倒數會讓人不敢寫 */
const NOTES_MAX = 200;
const COUNT_FROM = 160;
/** 圈太多的軟提醒門檻：標籤圈太多＝LLM 每天都要塞進所有主題＝行程會亂 */
const CROWDED_AT = 6;
/**
 * 「整理一下」的次數上限。
 * ⚠️ Kelvin 定案是 **3 次**，但**驗收後才開啟**——與「生成品質驗收批」同一個原則：
 *    **沒有量測就不要先加限制**，可能在解決一個不存在的問題。
 *    開啟時把這個值改成 3 即可，其餘程式一行都不用動。
 */
const TIDY_LIMIT = Infinity;
/** 書寫紙的橫線間距（必須與 textarea 的 line-height 相同，字才會坐在線上） */
const LINE_H = 25;

type Mark = 'want' | 'avoid';
type Pen = 'ink' | 'red';

export interface NotesResult {
    /** 圈起來＝必含（prompt 的正面約束） */
    tagsWanted: string[];
    /** 劃除＝負面約束（**執行力最高的材料**） */
    tagsAvoided: string[];
    /** 手寫欄原文（**永久保留、永不被覆蓋**） */
    notes: string;
    /** 「整理一下」的結果；**只有按了「用這個」才會有值**（原文仍在 notes） */
    notesRefined?: string;
    /** 整頁一個字都沒留 */
    skipped: boolean;
}

// ── 共用小元件（**必須在模組層級**：在元件內定義元件會讓每次 state 改變都卸載重掛子樹，
//    筆跡的描繪動畫會不停重播）────────────────────────────────────

/** 劃除線：手畫的線不是直的——兩端略微超出、中段帶一點弧。 */
const StrikeLine: React.FC<{ seed: number; instant?: boolean }> = ({ seed, instant }) => {
    const r = ((seed * 7919 + 13) % 1000) / 1000;
    const d = `M1 ${(7 + r * 1.6).toFixed(1)} C 22 ${(5.4 + r).toFixed(1)}, 44 ${(7.6 - r).toFixed(1)}, 63 ${(5.6 + r * 1.4).toFixed(1)}`;
    return (
        <svg viewBox="0 0 64 12" preserveAspectRatio="none" aria-hidden
            style={{
                position: 'absolute', left: -5, right: -5, top: '50%', marginTop: -6,
                width: 'calc(100% + 10px)', height: 12, overflow: 'visible', pointerEvents: 'none',
            }}>
            <path d={d} fill="none" stroke={STAMP_RED} strokeWidth={1.7} strokeLinecap="round" pathLength={100}
                style={{
                    strokeDasharray: 100,
                    strokeDashoffset: instant ? 0 : 100,
                    animation: instant ? undefined : 'ktDraw .4s ease-out forwards',
                    filter: 'drop-shadow(0 0 .5px rgba(162,59,46,.3))',
                }} />
        </svg>
    );
};

/**
 * 一支筆。**選中的那一支浮起 4px、微傾 −9°、帶投影＝被拿在手上。**
 * `peek`＝首次揭示（紅筆自己浮起再放下，不加說明文字，讓那支筆自己說「我可以被拿起來」）。
 */
const PenTool: React.FC<{
    kind: Pen; active: boolean; peek?: boolean; onPick: () => void;
}> = ({ kind, active, peek, onPick }) => {
    const red = kind === 'red';
    return (
        <button type="button" onClick={onPick} aria-label={red ? '紅筆・劃掉不想要的' : '墨筆・圈起想要的'}
            aria-pressed={active}
            style={{
                position: 'relative', width: 15, height: 46, border: 0, background: 'none', padding: 0,
                transform: active ? 'translateY(-4px) rotate(-9deg)' : 'translateY(6px)',
                filter: active ? 'drop-shadow(0 4px 5px rgba(0,0,0,.3))' : 'saturate(.55) opacity(.5)',
                transition: 'transform .22s cubic-bezier(.2,.8,.25,1), filter .22s ease',
                animation: peek ? 'ktPenPeek 1.5s cubic-bezier(.3,.7,.3,1) 1.1s both' : undefined,
            }}>
            <svg width="15" height="46" viewBox="0 0 15 46" style={{ display: 'block', overflow: 'visible' }}>
                <path d="M7.5 46 L3 34 H12 Z" fill={red ? STAMP_RED : '#2A2723'} />
                <rect x="3" y="6" width="9" height="28" rx="1.5" fill={red ? '#8E3227' : '#3A362F'} />
                <rect x="3" y="6" width="3.4" height="28" fill={red ? '#B04E3E' : '#4A453C'} opacity=".7" />
                <rect x="3.6" y="1" width="7.8" height="6" rx="2" fill="#C9B98F" />
            </svg>
        </button>
    );
};

/** 一個標籤（純文字、無框——膠囊全面退役）。 */
const TagChip: React.FC<{
    t: string; mark?: Mark; wiping: boolean; instant: boolean; onPick: () => void;
}> = ({ t, mark, wiping, instant, onPick }) => (
    <button type="button" onClick={onPick} aria-pressed={!!mark}
        className="relative font-serif text-[13.5px] px-0.5 py-[3px]"
        style={{
            letterSpacing: '.03em',
            color: mark === 'want' ? INK_PRINT : mark === 'avoid' ? 'rgba(42,39,35,.34)' : 'rgba(42,39,35,.62)',
            fontWeight: mark === 'want' ? 500 : 400,
            transition: 'color .2s ease',
        }}>
        {t}
        {mark === 'want' && !wiping && <HandCircle seed={seedOf(t)} color={INK_INK} instant={instant} tight />}
        {mark === 'avoid' && !wiping && <StrikeLine seed={seedOf(t)} instant={instant} />}
        {wiping && (
            <>
                <EraserBlock />
                <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                    {mark === 'want'
                        ? <HandCircle seed={seedOf(t)} color={INK_INK} instant tight />
                        : <StrikeLine seed={seedOf(t)} instant />}
                </span>
            </>
        )}
    </button>
);

// ── 語音輸入（瀏覽器不支援就整個隱藏，不做假按鈕）────────────────
interface SpeechCtor { new(): SpeechLike }
interface SpeechLike {
    lang: string; interimResults: boolean; continuous: boolean;
    start(): void; stop(): void;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
}
const getSpeechCtor = (): SpeechCtor | null => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const NotesPage: React.FC<{
    /** 麵包屑（「日本 · 九州」） */
    breadcrumb: string;
    /** 打 deep 的查詢字串（標籤雲；沿用入口頁已驗證的目的地） */
    query: string;
    coverUrl: string | null;
    isDomestic: boolean;
    /** 上一趟圈過的標籤（回頭客的個人化排序）；沒有＝維持重層給的主題群順序 */
    lastWanted?: string[];
    /**
     * 🔴 **回頭時的復原**：這一頁關閉時整個元件被卸載，state 隨之消失。
     * 沒有這個 prop 的話，使用者按「下一步」再按「上一步」，圈的標籤與寫的字會全部不見——
     * **那是最傷的一種資料遺失：他親手做過的事，系統卻假裝沒發生。**
     * ⚠️ 只在掛載時當初值用（每次回頭都是重新掛載，所以一定會生效）。
     */
    initial?: NotesResult;
    /** 從 ⑧ 確認書點「改」回來時＝「改好了」（沒有這個字，使用者會以為要重走一遍） */
    nextLabel?: string;
    /** ⚠️ 帶著當前內容離開——**「上一步」也要保存**，否則往回走一頁再回來一樣會清空 */
    onBack: (r: NotesResult) => void;
    onClose: () => void;
    onNext: (r: NotesResult) => void;
}> = ({ breadcrumb, query, coverUrl, isDomestic, lastWanted, initial, nextLabel, onBack, onClose, onNext }) => {
    const instant = useMemo(() => reduceMotion(), []);

    const [tags, setTags] = useState<string[]>([]);
    const [marks, setMarks] = useState<Record<string, Mark>>(() => {
        const m: Record<string, Mark> = {};
        initial?.tagsWanted.forEach(t => { m[t] = 'want'; });
        initial?.tagsAvoided.forEach(t => { m[t] = 'avoid'; });
        return m;
    });
    const [pen, setPen] = useState<Pen>('ink');
    const [penTouched, setPenTouched] = useState(false);   // 動過筆就不再播揭示動畫
    const [erasing, setErasing] = useState<string[]>([]);

    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [tidy, setTidy] = useState<string | null>(null);
    const [tidying, setTidying] = useState(false);
    const [tidyCount, setTidyCount] = useState(0);
    const [listening, setListening] = useState(false);

    const aliveRef = useRef(true);
    const timersRef = useRef<Set<number>>(new Set());
    const recRef = useRef<SpeechLike | null>(null);
    const taRef = useRef<HTMLTextAreaElement | null>(null);
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
            try { recRef.current?.stop(); } catch { /* ignore */ }
        };
    }, []);

    // 標籤雲（重層在入口頁就背景預取了 → 這裡多半是快取命中）；查不到＝通用組退位，畫面不會空
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let deep = null;
            try { deep = await fetchDestinationDeep(query); } catch { deep = null; }
            if (cancelled || !aliveRef.current) return;
            setTags(intelTags(deep, lastWanted));
        })();
        return () => { cancelled = true; };
    }, [query, lastWanted]);

    // 進場：兩張紙依序落下
    useEffect(() => {
        if (instant) return;
        const id = window.setTimeout(() => playPageSound('paperSettle', 0.8), 180);
        return () => window.clearTimeout(id);
    }, [instant]);

    const pickPen = useCallback((p: Pen) => {
        setPenTouched(true);
        if (p === pen) return;
        setPen(p);
        playPageSound('penSwitch', 0.85);
        hapticTap();
    }, [pen]);

    /**
     * 點標籤。
     * 🔑 **再點一次永遠是擦掉**（不論手上拿的是哪支筆）——與 ⑥ 完全一致。
     *    只有兩種「畫」的動作和一種「擦」的動作，**沒有三態循環**。
     */
    const hitTag = useCallback((t: string) => {
        if (erasing.includes(t)) return;
        if (marks[t]) {
            if (instant) { setMarks(m => { const n = { ...m }; delete n[t]; return n; }); return; }
            setErasing(prev => [...prev, t]);
            playPageSound('eraser');
            hapticTap();
            after(450, () => {
                setMarks(m => { const n = { ...m }; delete n[t]; return n; });
                setErasing(prev => prev.filter(k => k !== t));
            });
            return;
        }
        setMarks(m => ({ ...m, [t]: pen === 'ink' ? 'want' : 'avoid' }));
        playPageSound('penCircle');
        hapticTap();
    }, [marks, erasing, pen, instant, after]);

    const wanted = useMemo(() => tags.filter(t => marks[t] === 'want'), [tags, marks]);
    const avoided = useMemo(() => tags.filter(t => marks[t] === 'avoid'), [tags, marks]);

    // ── 整理一下 ───────────────────────────────────────────────
    const doTidy = useCallback(async () => {
        const raw = notes.trim();
        if (!raw) { toast('先寫幾句你的講究，我再幫你整理', 'info'); return; }
        if (tidyCount >= TIDY_LIMIT) { toast('這一趟的整理次數用完了', 'info'); return; }
        if (tidying) return;
        setTidying(true);
        playPageSound('penUncap');
        hapticTap();
        const out = await refineNotes(raw, breadcrumb);
        if (!aliveRef.current) return;
        setTidying(false);
        if (!out) { toast('這次沒能整理好，原文我都留著', 'info'); return; }
        setTidy(out);
        setTidyCount(c => c + 1);
        playPageSound('penCap', 0.8);
    }, [notes, tidying, tidyCount, breadcrumb]);

    /**
     * 🔴 三條不可違反的規則（原定案）：
     *   ①**永不自動套用**——整理結果顯示在原文下方，按「用這個」才生效。
     *   ②**永遠可還原**——`notes` 存原文、`notesRefined` 存整理後的版本，**原文永不被覆蓋**。
     *   ③只具體化不改語意（那條在 prompt 裡把關）。
     */
    // ⚠️ 不可以叫 `useTidy`：以 use 開頭的名字會被 eslint 當成 React Hook，
    //    在 onClick 的 callback 裡呼叫就會報 rules-of-hooks（實際踩過）。
    const applyTidy = useCallback((text: string) => {
        setNotes(text.slice(0, NOTES_MAX));
        setTidy(null);
        playPageSound('penCircle', 0.7);
        hapticTap();
    }, []);

    // ── 用說的 ─────────────────────────────────────────────────
    const speechOk = useMemo(() => !!getSpeechCtor(), []);
    const toggleMic = useCallback(() => {
        if (listening) { try { recRef.current?.stop(); } catch { /* ignore */ } return; }
        const Ctor = getSpeechCtor();
        if (!Ctor) return;
        try {
            const rec = new Ctor();
            rec.lang = 'zh-TW';
            rec.interimResults = false;
            rec.continuous = false;
            rec.onresult = (e) => {
                const said = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript || '').join('');
                if (!said) return;
                setNotes(prev => (prev ? `${prev}${prev.endsWith('。') ? '' : '，'}${said}` : said).slice(0, NOTES_MAX));
            };
            rec.onend = () => { if (aliveRef.current) setListening(false); };
            rec.onerror = () => { if (aliveRef.current) setListening(false); };
            recRef.current = rec;
            rec.start();
            setListening(true);
            hapticTap();
        } catch { setListening(false); }
    }, [listening]);

    /** 當前狀態的快照——**下一步與上一步共用**（兩個出口都要保存，不然往回走就清空） */
    const snapshot = useCallback((): NotesResult => ({
        tagsWanted: wanted,
        tagsAvoided: avoided,
        // ⚠️ `notesRefined` 只有在使用者按過「用這個」時才有值——這裡以 notes 為準（原文永不遺失）
        notes: notes.trim(),
        skipped: !wanted.length && !avoided.length && !notes.trim(),
    }), [wanted, avoided, notes]);
    const submit = useCallback(() => onNext(snapshot()), [snapshot, onNext]);

    // ── 版面 ───────────────────────────────────────────────────
    const sheetStyle = (i: number): React.CSSProperties => ({
        backgroundColor: PAPER,
        borderRadius: PAPER_RADIUS,
        color: INK_PRINT,
        boxShadow: paperShadow('rest'),
        animation: instant ? undefined : `ktPaperDrop .62s cubic-bezier(.18,.86,.32,1) ${180 + i * 220}ms backwards`,
    });
    const crowded = wanted.length >= CROWDED_AT;
    // ⚠️「還有」只有在**前面真的有東西**時才成立：只寫了字卻說「還有你寫下的講究」
    //    ——那個「還有」沒有前文（實機抓到）。
    const summary = [
        wanted.length ? `想要 ${wanted.length} 項` : '',
        avoided.length ? `避開 ${avoided.length} 項` : '',
        notes.trim() ? (wanted.length || avoided.length ? '還有你寫下的講究' : '你寫下的講究') : '',
    ].filter(Boolean);

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
                    <div className="font-serif text-[22px] font-bold text-[#F6F1E7]">這一趟，你的講究</div>
                    <div className="font-serif text-[11px] text-white/55 mt-1.5">圈起想要的，劃掉不想要的</div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pt-3">

                    {/* ═══ 標籤紙 ═══ */}
                    <div className="relative mx-[18px] mb-4 px-4 pt-4 pb-3.5" style={sheetStyle(0)}>
                        <PaperTexture />

                        {/* 🖊️ 兩隻筆：選中的浮起＋微傾＝被拿在手上 */}
                        <div className="absolute right-3.5 top-2.5 z-[5] flex gap-2.5 items-start">
                            <PenTool kind="ink" active={pen === 'ink'} onPick={() => pickPen('ink')} />
                            <PenTool kind="red" active={pen === 'red'} peek={!penTouched && !instant}
                                onPick={() => pickPen('red')} />
                        </div>

                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold" style={{ letterSpacing: '.05em' }}>
                            特別想要的
                        </h2>
                        {/* ⚠️ 紅筆必須被說出來，否則它看起來像裝飾 */}
                        <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 pr-[76px]" style={{ color: 'rgba(42,39,35,.52)' }}>
                            圈起想要的，換紅筆劃掉不想要的 · 再點一次就擦掉
                        </p>

                        {/* ⚠️ **打字時不收起**（2026-08-10 Kelvin 實機定案）：
                            我原本讓它在鍵盤升起時收成一行摘要，理由是「標籤紙會被推出畫面」。
                            但實測兩張紙加起來放得下，收起來只剩一行反而**浪費了它作為主視覺的價值**，
                            而且收合／展開的切換本身會讓畫面跳一下。**它是固定的。** */}
                        <div className="relative z-[2] flex flex-wrap gap-x-[18px] gap-y-3.5 mt-3.5">
                            {tags.map(t => (
                                <TagChip key={t} t={t} mark={marks[t]} wiping={erasing.includes(t)}
                                    instant={instant} onPick={() => hitTag(t)} />
                            ))}
                            {!tags.length && (
                                <span className="font-serif text-[11px]" style={{ color: 'rgba(42,39,35,.4)' }}>
                                    正在想這裡有什麼好玩的…
                                </span>
                            )}
                        </div>

                        {/* 回顯：不可編輯的事實。**不把標籤文字塞進書寫區**——使用者的紙不代筆，
                            也避免雙來源同步問題。 */}
                        <div className="relative z-[2] mt-3 pt-2.5 font-serif text-[10px] leading-[1.7]"
                            style={{ borderTop: '1px dashed rgba(35,35,32,.16)', color: 'rgba(42,39,35,.5)', minHeight: 32 }}>
                            {!wanted.length && !avoided.length && <span style={{ opacity: .55 }}>圈起來的、劃掉的，都會記在這裡</span>}
                            {!!wanted.length && <>已圈：<span style={{ color: INK_PRINT }}>{wanted.join('、')}</span></>}
                            {!!wanted.length && !!avoided.length && <br />}
                            {!!avoided.length && <>已劃除：<span style={{ color: STAMP_RED, opacity: .8 }}>{avoided.join('、')}</span></>}
                        </div>

                        {/* 圈太多的軟提醒：只陳述事實、永不擋路（與 ⑤ 密度提醒同一套語氣） */}
                        <div className="relative z-[2] text-right font-serif italic text-[10px]"
                            style={{ color: '#8A6A2E', opacity: crowded ? .9 : 0, transition: 'opacity .4s ease', minHeight: 16 }}>
                            {crowded ? `圈了 ${wanted.length} 個，每天都要塞這麼多主題會有點趕` : ' '}
                        </div>
                    </div>

                    {/* ═══ 書寫紙 ═══ */}
                    <div className="relative mx-[18px] mb-4 px-4 pt-5 pb-3.5" style={sheetStyle(1)}>
                        <PaperTexture />
                        {/* 金屬迴紋針 */}
                        <svg aria-hidden viewBox="0 0 20 38" className="absolute left-[22px] -top-[11px] w-5 h-[38px] z-[5]">
                            <path d="M6 34 V10 a4 4 0 0 1 8 0 v20 a2.6 2.6 0 0 1-5.2 0 V13"
                                fill="none" stroke="#9A968C" strokeWidth="2.2" strokeLinecap="round" />
                            <path d="M6 34 V10 a4 4 0 0 1 8 0 v20 a2.6 2.6 0 0 1-5.2 0 V13"
                                fill="none" stroke="#D7D3C8" strokeWidth=".9" strokeLinecap="round" transform="translate(-.5,-.5)" />
                        </svg>

                        <h2 className="relative z-[2] font-serif text-[14.5px] font-semibold ml-[26px]" style={{ letterSpacing: '.05em' }}>
                            寫下你的講究
                        </h2>
                        <p className="relative z-[2] font-serif text-[10.5px] mt-0.5 mb-2.5 ml-[26px]" style={{ color: 'rgba(42,39,35,.52)' }}>
                            圈起來的已經記下了，這裡寫下標籤沒有的想法吧
                        </p>

                        {/* 橫線書寫區：**字要坐在線上**——線畫在每 25px 的最後 1px（行底），
                            而 textarea 的 line-height 也是 25px，兩者必須一致，否則字會穿過線。 */}
                        <div className="relative z-[2]">
                            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
                                backgroundImage: `repeating-linear-gradient(transparent 0 ${LINE_H - 1}px, rgba(35,35,32,.075) ${LINE_H - 1}px ${LINE_H}px)`,
                            }} />
                            <textarea
                                ref={taRef}
                                value={notes}
                                maxLength={NOTES_MAX}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="想吃拉麵、不去咖啡廳、早上不要太早出門…"
                                className="relative w-full bg-transparent border-0 outline-none resize-none p-0"
                                style={{
                                    // ✨ 原文用**手寫感的襯線／楷書**，整理結果用**印刷體**——
                                    //    那個差異本身就在說「這段不是你寫的」，不需要任何標籤去解釋。
                                    fontFamily: '"Kaiti TC","STKaiti","BiauKai",Georgia,"Songti TC",serif',
                                    fontSize: 13.5, lineHeight: `${LINE_H}px`, letterSpacing: '.02em',
                                    color: INK_INK, minHeight: LINE_H * 4,
                                }} />
                        </div>

                        {/* 整理結果：新舊對照，**「用這個」才生效、永遠可還原** */}
                        {tidy && (
                            <div className="relative z-[2] mt-2.5 px-3 py-2.5"
                                style={{
                                    background: 'rgba(201,185,143,.14)', border: '1px dashed rgba(35,35,32,.18)',
                                    borderRadius: 2, animation: instant ? undefined : 'ktFadeUp .35s ease-out',
                                }}>
                                <div className="text-[9.5px] tracking-[.08em] mb-1.5" style={{ color: 'rgba(42,39,35,.45)' }}>
                                    整理成這樣，可以嗎？
                                </div>
                                <div className="text-[12.5px] leading-[1.8] whitespace-pre-line" style={{ color: INK_PRINT }}>
                                    {tidy}
                                </div>
                                <div className="flex gap-3.5 mt-2.5">
                                    <button type="button" onClick={() => applyTidy(tidy)}
                                        className="text-[11.5px] font-semibold"
                                        style={{ color: INK_PRINT, borderBottom: '1px solid rgba(35,35,32,.4)' }}>用這個</button>
                                    <button type="button" onClick={() => setTidy(null)}
                                        className="text-[11.5px]"
                                        style={{ color: 'rgba(42,39,35,.5)', borderBottom: '1px solid rgba(35,35,32,.2)' }}>保留原文</button>
                                </div>
                            </div>
                        )}

                        <div className="relative z-[2] flex items-center gap-3.5 mt-2 pt-2.5"
                            style={{ borderTop: '1px dashed rgba(35,35,32,.16)' }}>
                            <button type="button" onClick={doTidy} disabled={tidying}
                                className="font-serif text-[11.5px]"
                                style={{ color: 'rgba(42,39,35,.62)', borderBottom: '1px solid rgba(35,35,32,.26)', opacity: tidying ? .5 : 1 }}>
                                {tidying ? '整理中…' : '整理一下'}
                            </button>
                            {speechOk && (
                                <button type="button" onClick={toggleMic}
                                    className="font-serif text-[11.5px] inline-flex items-center gap-1"
                                    style={{ color: listening ? STAMP_RED : 'rgba(42,39,35,.62)', borderBottom: '1px solid rgba(35,35,32,.26)' }}>
                                    <Mic className="w-3 h-3" />{listening ? '聽著…' : '用說的'}
                                </button>
                            )}
                            {/* 平常不要在旁邊倒數（那會讓人不敢寫）；160 字才現身 */}
                            <span className="ml-auto font-mono text-[10px]"
                                style={{ color: notes.length >= NOTES_MAX - 10 ? STAMP_RED : 'rgba(42,39,35,.34)' }}>
                                {notes.length >= COUNT_FROM ? `${notes.length} / ${NOTES_MAX}` : ''}
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
                    {/* ⑦ 是**最後一次收集資訊**（⑧ 就是生成幕），所以「什麼都不填會怎樣」更需要交代 */}
                    <div className="text-center mb-2 px-2" style={{ minHeight: 30 }}>
                        <span className="font-serif text-[11.5px] leading-[1.5]"
                            style={{ color: summary.length ? '#E9BE7A' : '#8d887c', letterSpacing: '.05em', fontStyle: summary.length ? 'italic' : 'normal' }}>
                            {summary.length ? `${summary.join(' · ')}，都記下了` : '順應直覺，讓美好按慣例發生。'}
                        </span>
                    </div>
                    <TicketNextButton label={nextLabel} onNext={submit} />
                </div>
            </div>

            <style>{INK_KEYFRAMES}</style>
        </div>
    );
};
