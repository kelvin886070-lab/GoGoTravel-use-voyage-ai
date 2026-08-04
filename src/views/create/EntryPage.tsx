// src/views/create/EntryPage.tsx
// 🎫 生成表單・入口頁（docs E3 定稿・圈選版）
//   設計憲章：**選擇的語言＝筆**（圈起來＝選中、橡皮擦＝取消）、**照片上用金**（紙上才用墨）。
//   全頁零膠囊、零框線——唯一有框的是底部「下一步」票券鈕（票券＝前進的專屬物件）。
//   四拍：①撕票 ②開票 ③櫥窗（心願盒／回憶照輪播，**地名可點直接加入**＝淡季鉤子閉環）
//        ④浮現（確認目的地→主題色先變臉、照片預載完成才交班，永不見黑）。
//   誠實等待：目的地文字**先出現**，情報回來才**畫上金圈**——筆跡落下＝確認完成。
//   候選字**跟著最新的目的地更新**（加了大阪→候選換成大阪的順遊）。
//   🛡️ 亂填防線（2026-08 批，四層＋本地篩）：
//     ⓪本地啟發式：明顯亂打不打 API，直接進「未確認」。
//     ①修競態：逾時**只改畫面**（先畫虛線圈＝暫定），情報回來才定案——
//       舊版逾時就畫實線金圈，等於把「我不等了」誤當成「驗證通過」，這是漏接的真因。
//     ②三態視覺：實線金圈＝已驗證／虛線琥珀圈＝查不到或還沒定案（紙筆世界裡虛線天生就是「暫定」）。
//     ③出口攔截：按下一步時若還有未確認的地點，紙卡確認（回去改／照這樣繼續）——
//       偵測可以不完美，但**絕不無聲接受**：亂填必定被使用者親眼看見並親手放行。
//     ④資料衛生：未驗證的地點不換主題色、不抓封面照、不寫入 intel（見 services/destinationIntel）。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Mic } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';
import { toast } from '../../components/Toast';
import { fetchDestinationIntel, isVerifiedIntel, misspellSuggestions, prefetchDestinationDeep, type DestinationIntel } from '../../services/destinationIntel';
import { localPlaceVerdict } from '../../services/placeSanity';
import { fetchCoverPhoto, heroCoverUrl } from '../../services/coverPhoto';
import { isDomesticTrip } from '../../services/tripBrief';
import { TicketNextButton } from './TicketNextButton';
import { HandCircle, EraserBlock, seedOf, INK_GOLD, INK_AMBER, INK_KEYFRAMES } from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** 版面錨點：輸入列**橫跨畫面正中線**；此值＝輸入列高度的一半（上下兩塊各自貼齊它的邊） */
const INPUT_HALF = 26;

/** 圈選的三種狀態：等情報／已驗證／未確認（查不到、逾時未定、或本地判定亂填） */
type PickState = 'pending' | 'verified' | 'unverified';

/** 已選目的地：文字先在、圈後到；再點一下＝橡皮擦擦掉 */
const PickedItem: React.FC<{ name: string; state: PickState; instant: boolean; onRemove: () => void }> =
    ({ name, state, instant, onRemove }) => {
        const [erasing, setErasing] = useState(false);
        const ref = useRef<HTMLButtonElement>(null);
        const handle = () => {
            if (erasing) return;
            if (instant) { onRemove(); return; }
            setErasing(true);
            playPageSound('eraser');
            hapticTap();
            window.setTimeout(onRemove, 450);
        };
        const unverified = state === 'unverified';
        return (
            <button ref={ref} onClick={handle}
                aria-label={unverified ? `移除 ${name}（未確認的地點）` : `移除 ${name}`}
                className="relative font-serif text-[17px] px-1 py-0.5"
                style={{ color: unverified ? '#F0E6D2' : '#F6F1E7' }}>
                {name}
                {state !== 'pending' && !erasing && (
                    <HandCircle seed={seedOf(name)} color={unverified ? INK_AMBER : INK_GOLD} dashed={unverified} instant={instant} />
                )}
                {erasing && (
                    <>
                        <EraserBlock />
                        <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                            <HandCircle seed={seedOf(name)} color={unverified ? INK_AMBER : INK_GOLD} dashed={unverified} instant />
                        </span>
                    </>
                )}
            </button>
        );
    };

export interface ShowcaseItem {
    url: string;
    /** 這張照片的由來（顯示用）：心願盒＝「你收藏的 · 京都」／回憶＝「照片來自 · 南投」 */
    caption?: string;
    /** 若這是一個真的地點名（心願盒的城市）才給——只有它可以點一下加入 */
    place?: string;
}

export interface EntryResult {
    destinations: string[];
    /** 其中「查不到／未驗證」的地點（下游要誠實對待：不猜幣別、不硬排景點、生成前再核對一次） */
    unverified: string[];
    intel: DestinationIntel | null;
    isDomestic: boolean;
    coverUrl: string | null;
}

interface Picked { name: string; state: PickState }

export const EntryPage: React.FC<{
    residenceCountry: string;             // 批A：居住國（國內外推斷；表單永不問）
    showcaseItems?: ShowcaseItem[];       // 櫥窗：心願盒收藏／護照回憶（label 可點直接加入）
    recentPlaces?: string[];              // 「再去一次」：過去去過的地方
    initialDestinations?: string[];       // 從下一步返回時復原（不必重打）
    onClose: () => void;
    onNext: (r: EntryResult) => void;
    onManualCreate: () => void;
    onImport: () => void;
}> = ({ residenceCountry, showcaseItems = [], recentPlaces = [], initialDestinations, onClose, onNext, onManualCreate, onImport }) => {
    const instant = useMemo(() => reduceMotion(), []);
    const [entered, setEntered] = useState(instant);   // 背景淡入（撕票在首頁演完才掛載本頁）
    // 返回情境：先復原成 pending，再靜默重驗一次（快取命中＝零延遲零成本；不重驗就等於相信上一輪的畫面）
    const [picked, setPicked] = useState<Picked[]>(() => (initialDestinations || []).map(name => ({ name, state: 'pending' as PickState })));
    const [input, setInput] = useState('');
    const [intel, setIntel] = useState<DestinationIntel | null>(null);   // 恆為「最新**已驗證**目的地」的情報
    const [pendingCount, setPendingCount] = useState(0);                 // 進行中的查詢數（多筆同時輸入也不會亂）
    /** 最近一筆未通過驗證的提醒（琥珀字跟著**那一筆**走，不再靠全域 intel 判斷） */
    const [hint, setHint] = useState<{ name: string; suggestions: string[] } | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);               // 出口攔截卡
    const [listening, setListening] = useState(false);
    const [showcaseIdx, setShowcaseIdx] = useState(0);
    const [layerA, setLayerA] = useState<string | null>(null);
    const [layerB, setLayerB] = useState<string | null>(null);
    const [active, setActive] = useState<'A' | 'B'>('A');
    const [hasPhoto, setHasPhoto] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeRef = useRef<'A' | 'B'>('A');
    const aliveRef = useRef(true);                       // 卸載後不再 setState（非同步回來時的守門）
    const timersRef = useRef<Set<number>>(new Set());    // 逾時計時器：卸載一律清乾淨

    useEffect(() => {
        // ⚠️ 必須在每次掛載時把旗標設回 true。React StrictMode（開發模式）會刻意
        //    掛載→卸載→再掛載；只在 useRef 初值設 true 的話，那次假卸載會把它永久關掉，
        //    之後所有非同步結果都會被 `if (!aliveRef.current) return` 擋掉——
        //    症狀＝圈永遠畫不上、spinner 永遠不停（2026-08-04 追了兩輪的真兇）。
        aliveRef.current = true;
        const timers = timersRef.current;
        return () => {
            aliveRef.current = false;
            timers.forEach(id => window.clearTimeout(id));
            timers.clear();
        };
    }, []);

    // 背景：預載完成才交班（永不見黑、永不見空白）
    const swapBackground = useCallback((url: string) => {
        const img = new Image();
        img.onload = () => {
            if (activeRef.current === 'A') { setLayerB(url); activeRef.current = 'B'; setActive('B'); }
            else { setLayerA(url); activeRef.current = 'A'; setActive('A'); }
            setHasPhoto(true);
        };
        img.src = url;
    }, []);

    // ① 撕票已改由**首頁那顆真的 CTA** 自己演（見 TripsView：ktCtaStub）——
    //    本頁在票根落到一半時才掛載，只負責把新世界淡進來（背景 opacity 0→1）。
    useEffect(() => {
        const t = window.requestAnimationFrame(() => setEntered(true));
        return () => window.cancelAnimationFrame(t);
    }, []);

    // ② 櫥窗輪播（尚未選目的地時）
    useEffect(() => {
        if (picked.length > 0 || showcaseItems.length === 0) return;
        swapBackground(showcaseItems[showcaseIdx % showcaseItems.length].url);
        if (showcaseItems.length < 2 || instant) return;
        const t = window.setInterval(() => setShowcaseIdx(i => i + 1), 7000);
        return () => window.clearInterval(t);
    }, [picked.length, showcaseItems, showcaseIdx, instant, swapBackground]);

    /** 只改「這一筆」的狀態（同時多筆在飛也互不干擾；已被擦掉的筆自動失效） */
    const settle = useCallback((name: string, state: PickState) => {
        setPicked(prev => prev.map(p => (p.name === name ? { ...p, state } : p)));
    }, []);

    /**
     * 送出一個地點並驗證（可由輸入框、候選字、櫥窗地名、語音呼叫）。
     * 關鍵約定：**逾時只改畫面、不下結論**——先畫虛線圈表示「暫定」，情報真的回來才定案。
     * @param silent 靜默模式（返回時的背景重驗）：不出聲、不換背景、不搶 hint。
     */
    const commit = useCallback(async (raw?: string, silent = false) => {
        const value = (raw ?? input).trim();
        if (!value) return;
        if (!silent) {
            if (picked.some(p => p.name === value)) { setInput(''); return; }   // 重複＝靜默忽略（已經在紙上了）
            setInput('');
            // ⓪本地啟發式：明顯亂打就不花這一次 LLM 呼叫，直接進未確認
            if (localPlaceVerdict(value) === 'junk') {
                setPicked(prev => [...prev, { name: value, state: 'unverified' }]);
                setHint({ name: value, suggestions: [] });
                hapticTap();
                return;
            }
            setPicked(prev => [...prev, { name: value, state: 'pending' }]);
        }
        setPendingCount(c => c + 1);

        // ①競態修正：1.6s 後先畫**虛線**圈（讓字有著落、不空等），但結論仍未定
        const soft = window.setTimeout(() => {
            if (!aliveRef.current) return;
            setPicked(prev => prev.map(p => (p.name === value && p.state === 'pending' ? { ...p, state: 'unverified' } : p)));
        }, 1600);
        timersRef.current.add(soft);

        // 硬上限：請求若整個掛住（無網路、Edge Function 卡死），8 秒後一律當作查不到——
        //   否則 pendingCount 永遠不歸零，「下一步」會變成永久按不動的死路。
        const hard = new Promise<'timeout'>(res => {
            const id = window.setTimeout(() => res('timeout'), 8000);
            timersRef.current.add(id);
        });
        const outcome = await Promise.race([fetchDestinationIntel(value).catch(() => null), hard]);
        const got: DestinationIntel | null = outcome === 'timeout' ? null : outcome;
        window.clearTimeout(soft);
        timersRef.current.delete(soft);
        if (!aliveRef.current) return;

        setPendingCount(c => Math.max(0, c - 1));
        const ok = isVerifiedIntel(got);
        settle(value, ok ? 'verified' : 'unverified');

        if (!ok) {
            // ④資料衛生：查不到就不換主題色、不抓封面照、不寫進 intel（錯的資訊比沒有更貴）
            if (!silent) setHint({ name: value, suggestions: misspellSuggestions(got) });
            return;
        }
        if (!silent) {
            playPageSound('penCircle');   // 筆跡落下＝驗證通過（與實線金圈同幀）
            hapticTap();
            setHint(h => (h && h.name === value ? null : h));
        }
        setIntel(got);                   // 候選字跟著「最新已驗證的目的地」走
        prefetchDestinationDeep(value);  // 重層（地帶卡／標籤／季節）背景預熱——使用者填後面幾頁時就備好了
        if (silent) return;
        const url = await fetchCoverPhoto(`${got?.cityEn || value} travel`);
        const hero = heroCoverUrl(url || undefined);
        if (aliveRef.current && hero) swapBackground(hero);
    }, [input, picked, settle, swapBackground]);

    // 返回時復原的目的地：靜默重驗一次（快取命中＝零延遲、零成本；也順便把 intel 補回來）
    const revalidatedRef = useRef(false);
    useEffect(() => {
        if (revalidatedRef.current) return;
        revalidatedRef.current = true;
        (initialDestinations || []).forEach(name => { void commit(name, true); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const removeAt = (name: string) => {
        setHint(h => (h && h.name === name ? null : h));
        setPicked(prev => {
            const next = prev.filter(p => p.name !== name);
            if (next.length === 0) { setIntel(null); setHasPhoto(false); }
            return next;
        });
    };

    // 語音輸入（瀏覽器不支援＝不顯示；辨識結果直接成為目的地）
    const speechSupported = useMemo(() => {
        const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
        return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    }, []);
    const startVoice = () => {
        const w = window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        };
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor) return;
        try {
            const rec = new Ctor();
            rec.lang = 'zh-TW';
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            rec.onresult = (e: SpeechResultLike) => {
                const said = e.results?.[0]?.[0]?.transcript?.trim();
                if (said) void commit(said.replace(/[。，、！？.\s]/g, ''));
            };
            rec.onend = () => setListening(false);
            rec.onerror = () => setListening(false);
            setListening(true);
            rec.start();
        } catch { setListening(false); }
    };

    const isDomestic = isDomesticTrip(intel?.country, residenceCountry);
    const pickedNames = picked.map(p => p.name);
    const unverifiedNames = picked.filter(p => p.state === 'unverified').map(p => p.name);
    const loading = pendingCount > 0;
    const candidates = (intel?.nearby || []).filter(n => !pickedNames.includes(n)).slice(0, 5);
    const recents = recentPlaces.filter(n => !pickedNames.includes(n)).slice(0, 4);
    const showcase = showcaseItems[showcaseIdx % Math.max(showcaseItems.length, 1)];
    const canNext = picked.length > 0;
    const crowded = picked.length >= 5;

    /** 真的往下一步（撕票由 TicketNextButton 負責，這裡只交出資料） */
    const goNext = useCallback(() => {
        onNext({
            destinations: picked.map(p => p.name),
            unverified: picked.filter(p => p.state === 'unverified').map(p => p.name),
            intel, isDomestic,
            coverUrl: activeRef.current === 'A' ? layerA : layerB,
        });
    }, [picked, intel, isDomestic, layerA, layerB, onNext]);

    /** ③出口攔截：回 false ＝ 不撕不前進（永不 disabled——沒填給提示、還在查請他等、
     *  有未確認的先讓他親眼看見）。回 true 才由票券鈕演出快撕並交棒。 */
    const guardNext = (): boolean => {
        if (!canNext) { toast('先寫下想去的地方，至少一個', 'info'); inputRef.current?.focus(); return false; }
        if (pendingCount > 0) { toast('正在確認地點，稍等一下', 'info'); return false; }
        if (unverifiedNames.length > 0) {
            setConfirmOpen(true);
            playPageSound('paperDrop');
            hapticTap();
            return false;
        }
        return true;
    };

    return (
        <div className="fixed inset-0 z-[90] overflow-hidden">
            {/* 背景四層：掛載時由透明淡入＝**接住首頁撕票的最後一拍**（票根還在落，世界才換）。
                只用長寫屬性：混用 background 簡寫會洗掉 backgroundSize＝平鋪 bug。 */}
            <div className="absolute inset-0"
                style={{ opacity: entered ? 1 : 0, transition: instant ? undefined : 'opacity .38s ease' }}>
                <div className="absolute inset-0" style={{ backgroundColor: '#1b1510' }} />
                <div className="absolute inset-0" style={{
                    backgroundImage: isDomestic ? 'linear-gradient(165deg,#4a5c48,#222b21)' : 'linear-gradient(165deg,#3A6350,#22372a)',
                    transition: 'background-image .6s ease',
                }} />
                <div className="absolute inset-0" style={{
                    backgroundImage: layerA ? `url("${layerA}")` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    opacity: active === 'A' && layerA ? 1 : 0, transition: 'opacity 1s ease',
                }} />
                <div className="absolute inset-0" style={{
                    backgroundImage: layerB ? `url("${layerB}")` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    opacity: active === 'B' && layerB ? 1 : 0, transition: 'opacity 1s ease',
                }} />
                <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,14,13,.42), rgba(15,14,13,.72))' }} />
            </div>

            <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                    <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-30" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                        <X className="w-5 h-5 text-white/80" />
                    </button>

                    {/* 櫥窗地名（可點直接加入＝淡季鉤子閉環） */}
                    {picked.length === 0 && hasPhoto && showcase?.caption && (
                        showcase.place ? (
                            <button onClick={() => void commit(showcase.place!)}
                                className="absolute left-6 z-30 font-serif text-[11px] text-white/75 underline underline-offset-4 decoration-white/35"
                                style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}>
                                {showcase.caption}
                            </button>
                        ) : (
                            <div className="absolute left-6 z-30 font-serif text-[11px] text-white/60"
                                style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}>
                                {showcase.caption}
                            </div>
                        )
                    )}

                    {/* 版面錨點（Kelvin 選 B）：**輸入線恆在畫面 42%**——上半往上長、下半往下長，
                        內容再多也不會把輸入線推走；42% 略高於幾何中線＝人眼的視覺中心，且替鍵盤留出空間。
                        ⚠️ 基準必須是**整個畫面**：先前錨在 flex-1 內容區，而內容區已扣掉底部票券鈕，
                        手機上那塊佔比更大 → 錨點被往上推（Kelvin 實測「還是沒置中」的真因）。
                        故本層 absolute inset-0 脫離 flex 流，底部票券鈕改用 mt-auto 自行貼底。 */}
                    <div className="absolute inset-0" style={{ animation: instant ? undefined : 'ktFadeUp .5s ease-out' }}>
                        {/* 上半：標題與已選——底邊貼齊輸入列的上緣 */}
                        <div className="absolute inset-x-0 top-0 px-6 flex flex-col justify-end overflow-y-auto"
                            style={{ bottom: `calc(50% + ${INPUT_HALF}px)`, paddingBottom: 14 }}>
                            <div className="font-serif text-[25px] font-bold text-[#F6F1E7] text-center">這一趟，想去哪？</div>
                            <div className="font-mono text-[9px] tracking-[0.34em] text-white/55 text-center mt-1.5">DESTINATION</div>

                            {/* 已選：金圈墨字（每行最多三個、間距足夠，圈與圈不打架） */}
                            {picked.length > 0 && (
                                <div className="flex flex-wrap justify-center mt-6 mx-auto" style={{ gap: '16px 20px', maxWidth: 260 }}>
                                    {picked.map(p => (
                                        <PickedItem key={p.name} name={p.name} state={p.state} instant={instant}
                                            onRemove={() => removeAt(p.name)} />
                                    ))}
                                </div>
                            )}
                            {crowded && (
                                <div className="text-center font-serif text-[10px] text-[#FAC775] mt-3">城市多——待會記得給足天數，或考慮拆成兩趟</div>
                            )}
                        </div>

                        {/* 輸入列：**整條橫跨畫面正中線**（top 50% + translateY(-50%)）——
                            這是全頁唯一的錨點，上下內容各自往外長，永遠不會把它推走。 */}
                        <div className="absolute inset-x-0 px-6" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                        {/* 輸入：金色髮絲線＋金游標；IME 組字中的 Enter 不送出。
                            ⚠️ 排版鐵則（2026-08-05 追到的水平偏移真因）：
                              ①`<input>` 不可用 `flex-1` 排在圖示旁邊——flex 項目預設 `min-width:auto`，
                                input 的固有寬度（約 20 字元）撐破容器往右溢出，圖示被擠到畫面外，
                                「在輸入框內置中」的文字也跟著整段偏右。
                              ②改成 input **獨佔整條線**（w-full＋min-w-0），圖示**絕對定位疊在線的右端**（不佔排版寬度）。
                              ③左右內距必須**對稱**（各 28px）——不對稱的內距會再一次把文字中心推走。 */}
                        <div className="relative mx-auto w-full max-w-[250px] pb-1.5"
                            style={{ borderBottom: '1px solid rgba(201,185,143,.75)' }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.nativeEvent.isComposing) return;
                                    if (e.key === 'Enter') { e.preventDefault(); void commit(); }
                                }}
                                enterKeyHint="done"
                                placeholder="搜尋城市或地方…"
                                className="w-full min-w-0 bg-transparent text-center font-serif text-[16px] text-[#F6F1E7] placeholder:text-white/45 outline-none py-1"
                                style={{ caretColor: '#C9B98F', paddingLeft: 28, paddingRight: 28 }}
                            />
                            <span className="absolute right-0 bottom-1.5 flex items-center justify-center w-6 h-6">
                                {loading ? (
                                    <Loader2 className="w-4 h-4 text-[#C9B98F] animate-spin" />
                                ) : input.trim() ? (
                                    <button onClick={() => void commit()} aria-label="加入這個地方"
                                        className="w-6 h-6 rounded-full border border-[#C9B98F]/70 text-[#C9B98F] flex items-center justify-center text-[14px] leading-none">＋</button>
                                ) : speechSupported ? (
                                    <button onClick={startVoice} aria-label="用說的" className="w-6 h-6 flex items-center justify-center">
                                        <Mic className={`w-4 h-4 ${listening ? 'text-[#C9B98F] animate-pulse' : 'text-white/55'}`} />
                                    </button>
                                ) : null}
                            </span>
                        </div>
                        </div>

                        {/* 下半：提醒與候選——頂邊貼齊輸入列下緣，往下長；底部留出票券鈕的位置 */}
                        <div className="absolute inset-x-0 px-6 overflow-y-auto"
                            style={{ top: `calc(50% + ${INPUT_HALF}px)`, bottom: 118 }}>

                        {/* ②未確認提醒：跟著**那一筆**走（不再靠全域 intel 判斷，逾時也一定會說話）；提醒但不擋 */}
                        {hint && pickedNames.includes(hint.name) && (
                            <div className="text-center mt-4 font-serif text-[12px]" style={{ color: INK_AMBER }}>
                                {hint.suggestions.length > 0 ? (
                                    <>
                                        「{hint.name}」我不太確定——你是不是想找：
                                        <span className="inline-flex gap-3 ml-1">
                                            {hint.suggestions.map(s => (
                                                <button key={s} onClick={() => { removeAt(hint.name); void commit(s); }}
                                                    className="underline underline-offset-4" style={{ textDecorationColor: 'rgba(233,190,122,.6)' }}>{s}</button>
                                            ))}
                                        </span>
                                    </>
                                ) : `「${hint.name}」我查不到——仍然可以照你寫的排，或換個寫法試試`}
                            </div>
                        )}

                        {/* 再去一次（回頭客捷徑）＋ 候選（跟著最新目的地更新）——皆為無框的字，點了金圈當場畫上 */}
                        {recents.length > 0 && picked.length === 0 && (
                            <div className="mt-14 text-center">
                                <div className="font-serif text-[11px] text-white/55 mb-1">再去一次</div>
                                <div className="font-serif text-[9px] text-white/35 mb-3">點一下加入</div>
                                <div className="flex flex-wrap justify-center" style={{ gap: '14px 20px' }}>
                                    {recents.map(n => (
                                        <button key={n} onClick={() => void commit(n)} className="font-serif text-[14px] text-white/75">{n}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {candidates.length > 0 && (
                            <div className="mt-10 text-center">
                                <div className="font-serif text-[11px] text-white/55 mb-1">
                                    {intel?.granularity === 'city' ? '順遊建議' : '熱門城市'}
                                </div>
                                <div className="font-serif text-[9px] text-white/35 mb-3">點一下加入</div>
                                <div className="flex flex-wrap justify-center" style={{ gap: '14px 20px' }}>
                                    {candidates.map(n => (
                                        <button key={n} onClick={() => void commit(n)} className="font-serif text-[14px] text-white/75">{n}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

                    <div className="px-4 mt-auto relative z-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                        <TicketNextButton onPress={guardNext} onNext={goNext} />
                        <div className="flex justify-center gap-7 mt-3">
                            <button onClick={onManualCreate} className="font-serif text-[12px] text-white/70 underline underline-offset-4 decoration-white/40">自己手動建立</button>
                            <button onClick={onImport} className="font-serif text-[12px] text-white/70 underline underline-offset-4 decoration-white/40">從分享連結匯入</button>
                        </div>
                    </div>
            </div>

            {/* ③出口攔截：一張落在桌上的便條紙。偵測可以不完美，但絕不無聲放行——
                使用者必須親眼看見「哪幾個地方我查不到」，再親手決定。仍然尊重自由：堅持就放行。 */}
            {confirmOpen && (
                <div className="absolute inset-0 z-20 flex items-center justify-center px-8"
                    style={{ backgroundColor: 'rgba(15,14,13,.58)' }}
                    onClick={() => setConfirmOpen(false)}>
                    <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="有查不到的地點"
                        className="w-full max-w-[300px] bg-[#F6F1E7] px-6 py-6 text-center"
                        style={{
                            borderRadius: 3, boxShadow: '0 18px 42px rgba(0,0,0,.5)', transform: 'rotate(-.6deg)',
                            animation: instant ? undefined : 'ktDropIn .34s cubic-bezier(.2,.9,.3,1)',
                        }}>
                        <div className="font-mono text-[9px] tracking-[0.28em] text-[#8A8266]">UNCONFIRMED</div>
                        <div className="font-serif text-[16px] font-bold text-[#232320] mt-2">
                            有 {unverifiedNames.length} 個地方我查不到
                        </div>
                        <div className="font-serif text-[14px] text-[#3F3B33] mt-2 leading-relaxed">
                            {unverifiedNames.join('、')}
                        </div>
                        <div className="font-serif text-[11px] text-[#8A8266] mt-3 leading-relaxed">
                            可能是打錯字，也可能只是很小的地方。<br />
                            照這樣繼續的話，這幾個地方的建議會少一些。
                        </div>
                        <div className="flex items-center justify-center gap-8 mt-6">
                            <button onClick={() => { setConfirmOpen(false); inputRef.current?.focus(); }}
                                className="font-serif text-[13px] text-[#5A564C] underline underline-offset-4 decoration-[#B9B09A]">回去改</button>
                            <button onClick={() => { setConfirmOpen(false); playPageSound('tear', 0.5); hapticTap(); goNext(); }}
                                className="relative font-serif text-[14px] font-bold text-[#232320] px-1 py-0.5">
                                照這樣繼續
                                {/* 紙上用墨（照片上才用金）——主要動作用手繪墨圈，與圈選同一種語言 */}
                                <HandCircle seed={seedOf('continue')} color="#232320" instant={instant} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                ${INK_KEYFRAMES}
                @keyframes ktDropIn { 0%{opacity:0;transform:translateY(-14px) rotate(-2.4deg)} 100%{opacity:1;transform:translateY(0) rotate(-.6deg)} }
            `}</style>
        </div>
    );
};

// 語音辨識的最小型別（避免 any；瀏覽器差異大，只用我們需要的欄位）
interface SpeechResultLike { results?: Array<Array<{ transcript?: string }>> }
interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: (e: SpeechResultLike) => void;
    onend: () => void;
    onerror: () => void;
    start: () => void;
}
