// src/views/create/EntryPage.tsx
// 🎫 生成表單・入口頁（docs E3 定稿・圈選版）
//   設計憲章：**選擇的語言＝筆**（圈起來＝選中、橡皮擦＝取消）、**照片上用金**（紙上才用墨）。
//   全頁零膠囊、零框線——唯一有框的是底部「下一步」票券鈕（票券＝前進的專屬物件）。
//   四拍：①撕票 ②開票 ③櫥窗（心願盒／回憶照輪播，**地名可點直接加入**＝淡季鉤子閉環）
//        ④浮現（確認目的地→主題色先變臉、照片預載完成才交班，永不見黑）。
//   誠實等待：目的地文字**先出現**，情報回來（或逾時）才**畫上金圈**——筆跡落下＝確認完成。
//   候選字**跟著最新的目的地更新**（加了大阪→候選換成大阪的順遊）。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, X, Loader2, Mic } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';
import { fetchDestinationIntel, misspellSuggestions, type DestinationIntel } from '../../services/destinationIntel';
import { fetchCoverPhoto, heroCoverUrl } from '../../services/coverPhoto';
import { isDomesticTrip } from '../../services/tripBrief';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** 地名 → 穩定 seed（同一個地方每次的筆跡一致，像同一個人寫的） */
const seedOf = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 1000;
};

/** 燙金手繪圈（照片上用金；筆跡帶 seed 抖動、永不重複） */
const GoldCircle: React.FC<{ seed: number; instant?: boolean }> = ({ seed, instant }) => {
    const r = ((seed * 9301 + 49297) % 233280) / 233280;
    const d = `M${(30 + r * 4).toFixed(1)} 3 C 51 ${(1 + r * 2).toFixed(1)}, 61 8, 60 17 C 59 27, 46 31, 31 30 C 14 29, ${(3 + r * 2).toFixed(1)} 25, 4 16 C 5 7, 17 2, ${(35 + r * 3).toFixed(1)} 4`;
    return (
        <svg viewBox="0 0 64 34" aria-hidden
            style={{
                position: 'absolute', inset: '-7px -11px', width: 'calc(100% + 22px)', height: 'calc(100% + 14px)',
                overflow: 'visible', pointerEvents: 'none', transform: `rotate(${(r * 6 - 3).toFixed(1)}deg)`,
            }}>
            <path d={d} fill="none" stroke="#C9B98F" strokeWidth={1.9} strokeLinecap="round" pathLength={100}
                style={{
                    strokeDasharray: 100,
                    strokeDashoffset: instant ? 0 : 100,
                    animation: instant ? undefined : 'ktDraw .45s ease-out forwards',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))',
                }} />
        </svg>
    );
};

/** 已選目的地：文字先在、金圈後到；再點一下＝橡皮擦擦掉 */
const PickedItem: React.FC<{ name: string; confirmed: boolean; instant: boolean; onRemove: () => void }> =
    ({ name, confirmed, instant, onRemove }) => {
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
        return (
            <button ref={ref} onClick={handle} aria-label={`移除 ${name}`}
                className="relative font-serif text-[17px] text-[#F6F1E7] px-1 py-0.5">
                {name}
                {confirmed && !erasing && <GoldCircle seed={seedOf(name)} instant={instant} />}
                {erasing && (
                    <>
                        <span aria-hidden style={{
                            position: 'absolute', top: '50%', left: -18, width: 20, height: 13, marginTop: -7, borderRadius: 3,
                            background: 'linear-gradient(#F7EEDD,#DCCAAA 60%,#C9B38D)', boxShadow: '0 3px 5px rgba(0,0,0,.35)',
                            animation: 'ktRub .43s cubic-bezier(.4,.05,.55,.95) forwards', zIndex: 4,
                        }} />
                        <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                            <GoldCircle seed={seedOf(name)} instant />
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
    intel: DestinationIntel | null;
    isDomestic: boolean;
    coverUrl: string | null;
}

interface Picked { name: string; confirmed: boolean }

export const EntryPage: React.FC<{
    residenceCountry: string;             // 批A：居住國（國內外推斷；表單永不問）
    showcaseItems?: ShowcaseItem[];       // 櫥窗：心願盒收藏／護照回憶（label 可點直接加入）
    recentPlaces?: string[];              // 「再去一次」：過去去過的地方
    onClose: () => void;
    onNext: (r: EntryResult) => void;
    onManualCreate: () => void;
    onImport: () => void;
}> = ({ residenceCountry, showcaseItems = [], recentPlaces = [], onClose, onNext, onManualCreate, onImport }) => {
    const instant = useMemo(() => reduceMotion(), []);
    const [phase, setPhase] = useState<'tear' | 'open'>(instant ? 'open' : 'tear');
    const [picked, setPicked] = useState<Picked[]>([]);
    const [input, setInput] = useState('');
    const [intel, setIntel] = useState<DestinationIntel | null>(null);   // 恆為「最新確認的目的地」的情報
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [showcaseIdx, setShowcaseIdx] = useState(0);
    const [layerA, setLayerA] = useState<string | null>(null);
    const [layerB, setLayerB] = useState<string | null>(null);
    const [active, setActive] = useState<'A' | 'B'>('A');
    const [hasPhoto, setHasPhoto] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeRef = useRef<'A' | 'B'>('A');

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

    // ① 撕票 → ② 開票
    useEffect(() => {
        if (instant) return;
        playPageSound('tear');
        hapticTap();
        const t = window.setTimeout(() => setPhase('open'), 680);
        return () => window.clearTimeout(t);
    }, [instant]);

    // ③ 櫥窗輪播（尚未選目的地時）
    useEffect(() => {
        if (picked.length > 0 || showcaseItems.length === 0) return;
        swapBackground(showcaseItems[showcaseIdx % showcaseItems.length].url);
        if (showcaseItems.length < 2 || instant) return;
        const t = window.setInterval(() => setShowcaseIdx(i => i + 1), 7000);
        return () => window.clearInterval(t);
    }, [picked.length, showcaseItems, showcaseIdx, instant, swapBackground]);

    // ④ 確認目的地：文字先進場 → 情報回來（或 1.6s 逾時）才畫金圈 → 背景換照片
    const commit = useCallback(async (raw?: string) => {
        const value = (raw ?? input).trim();
        if (!value || picked.some(p => p.name === value)) return;
        setPicked(prev => [...prev, { name: value, confirmed: false }]);
        setInput('');
        setLoading(true);
        const timeout = new Promise<null>(res => window.setTimeout(() => res(null), 1600));
        const got = await Promise.race([fetchDestinationIntel(value), timeout]);
        setLoading(false);
        setPicked(prev => prev.map(p => (p.name === value ? { ...p, confirmed: true } : p)));
        playPageSound('penCircle');   // 筆跡落下＝確認完成（與金圈同幀）
        hapticTap();
        if (got) setIntel(got);                       // 候選字改跟「最新確認的目的地」走
        const query = `${got?.cityEn || value} travel`;
        const url = await fetchCoverPhoto(query);
        const hero = heroCoverUrl(url || undefined);
        if (hero) swapBackground(hero);
    }, [input, picked, swapBackground]);

    const removeAt = (name: string) => {
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
    const suggestions = misspellSuggestions(intel);
    const pickedNames = picked.map(p => p.name);
    const candidates = (intel?.nearby || []).filter(n => !pickedNames.includes(n)).slice(0, 5);
    const recents = recentPlaces.filter(n => !pickedNames.includes(n)).slice(0, 4);
    const showcase = showcaseItems[showcaseIdx % Math.max(showcaseItems.length, 1)];
    const canNext = picked.length > 0;
    const crowded = picked.length >= 5;

    return (
        <div className="fixed inset-0 z-[90] overflow-hidden" style={{ backgroundColor: '#1b1510' }}>
            {/* 背景三層（只用長寫屬性：混用 background 簡寫會洗掉 backgroundSize＝平鋪 bug） */}
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

            {phase === 'tear' && (
                <div className="absolute inset-x-4 top-24 h-[66px] bg-[#F6F1E7] rounded-2xl flex items-stretch overflow-hidden"
                    style={{ animation: 'ktTearBody .68s cubic-bezier(.22,.9,.3,1) forwards' }}>
                    <span className="flex-1 flex flex-col justify-center pl-[18px]">
                        <span className="font-mono text-[10px] tracking-[0.2em] text-[#3F6B52]">START A NEW TRIP</span>
                        <span className="font-serif text-[19px] font-bold text-[#232320]">規劃新的一趟</span>
                    </span>
                    <span className="w-[66px] border-l-2 border-dashed border-[#D6CDB8] flex items-center justify-center"
                        style={{ animation: 'ktTearStub .68s cubic-bezier(.4,.1,.7,1) forwards' }}>
                        <span className="w-11 h-11 rounded-full bg-[#232320] text-white flex items-center justify-center"><ArrowRight className="w-5 h-5" /></span>
                    </span>
                </div>
            )}

            {phase === 'open' && (
                <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                    <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                        <X className="w-5 h-5 text-white/80" />
                    </button>

                    {/* 櫥窗地名（可點直接加入＝淡季鉤子閉環） */}
                    {picked.length === 0 && hasPhoto && showcase?.caption && (
                        showcase.place ? (
                            <button onClick={() => void commit(showcase.place!)}
                                className="absolute left-6 font-serif text-[11px] text-white/75 underline underline-offset-4 decoration-white/35"
                                style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}>
                                {showcase.caption}
                            </button>
                        ) : (
                            <div className="absolute left-6 font-serif text-[11px] text-white/60"
                                style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}>
                                {showcase.caption}
                            </div>
                        )
                    )}

                    <div className="flex-1 flex flex-col justify-center px-6 pb-24 overflow-y-auto"
                        style={{ animation: instant ? undefined : 'ktFadeUp .5s ease-out' }}>
                        <div className="font-serif text-[25px] font-bold text-[#F6F1E7] text-center">這一趟，想去哪？</div>
                        <div className="font-mono text-[9px] tracking-[0.34em] text-white/55 text-center mt-1.5 mb-6">DESTINATION</div>

                        {/* 已選：金圈墨字（每行最多三個、間距足夠，圈與圈不打架） */}
                        {picked.length > 0 && (
                            <div className="flex flex-wrap justify-center mb-2 mx-auto" style={{ gap: '16px 20px', maxWidth: 260 }}>
                                {picked.map(p => (
                                    <PickedItem key={p.name} name={p.name} confirmed={p.confirmed} instant={instant}
                                        onRemove={() => removeAt(p.name)} />
                                ))}
                            </div>
                        )}
                        {crowded && (
                            <div className="text-center font-serif text-[10px] text-[#FAC775] mb-3">城市多——待會記得給足天數，或考慮拆成兩趟</div>
                        )}

                        {/* 輸入：金色髮絲線＋金游標；IME 組字中的 Enter 不送出 */}
                        <div className="flex items-end gap-2 mx-auto w-full max-w-[250px] pb-1.5"
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
                                className="flex-1 bg-transparent text-center font-serif text-[16px] text-[#F6F1E7] placeholder:text-white/45 outline-none py-1"
                                style={{ caretColor: '#C9B98F' }}
                            />
                            {loading ? (
                                <Loader2 className="w-4 h-4 text-[#C9B98F] animate-spin mb-1.5" />
                            ) : input.trim() ? (
                                <button onClick={() => void commit()} aria-label="加入這個地方"
                                    className="mb-1 w-6 h-6 rounded-full border border-[#C9B98F]/70 text-[#C9B98F] flex items-center justify-center text-[14px] leading-none">＋</button>
                            ) : speechSupported ? (
                                <button onClick={startVoice} aria-label="用說的"
                                    className="mb-1 w-6 h-6 flex items-center justify-center">
                                    <Mic className={`w-4 h-4 ${listening ? 'text-[#C9B98F] animate-pulse' : 'text-white/55'}`} />
                                </button>
                            ) : null}
                        </div>

                        {/* 打錯字：提醒但不擋 */}
                        {suggestions.length > 0 && (
                            <div className="text-center mt-4 font-serif text-[12px] text-white/80">
                                找不到這個地方——你是不是想找：
                                <span className="inline-flex gap-3 ml-1">
                                    {suggestions.map(s => (
                                        <button key={s} onClick={() => { removeAt(pickedNames[pickedNames.length - 1]); void commit(s); }}
                                            className="underline underline-offset-4 decoration-white/50">{s}</button>
                                    ))}
                                </span>
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

                    <div className="px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                        <button
                            onClick={() => {
                                if (!canNext) { inputRef.current?.focus(); return; }   // 永不 disabled
                                playPageSound('tear', 0.5); hapticTap();
                                onNext({ destinations: pickedNames, intel, isDomestic, coverUrl: active === 'A' ? layerA : layerB });
                            }}
                            className="w-full flex items-stretch active:scale-[0.99] transition-transform"
                        >
                            <span className="flex-1 bg-[#F6F1E7] rounded-l-full pl-5 pr-3 py-2.5 flex items-center justify-between">
                                <span className="font-serif text-[15px] font-bold text-[#232320]">下一步</span>
                                <span className="font-mono text-[8px] tracking-[0.2em] text-[#8A8266]">NEXT</span>
                            </span>
                            <span className="bg-[#F6F1E7] rounded-r-full px-3 flex items-center border-l-2 border-dashed border-[#C9BFA6]">
                                <span className="w-7 h-7 rounded-full bg-[#232320] text-[#F6F1E7] flex items-center justify-center"><ArrowRight className="w-4 h-4" /></span>
                            </span>
                        </button>
                        <div className="flex justify-center gap-7 mt-3">
                            <button onClick={onManualCreate} className="font-serif text-[12px] text-white/70 underline underline-offset-4 decoration-white/40">自己手動建立</button>
                            <button onClick={onImport} className="font-serif text-[12px] text-white/70 underline underline-offset-4 decoration-white/40">從分享連結匯入</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes ktTearStub { 0%{transform:translate(0,0) rotate(0)} 18%{transform:translate(3px,0) rotate(0)} 100%{transform:translate(52px,34px) rotate(18deg);opacity:0} }
                @keyframes ktTearBody { 0%{transform:scale(1);opacity:1} 55%{transform:scale(1.02)} 100%{transform:scale(1.06);opacity:0} }
                @keyframes ktFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
                @keyframes ktDraw { to { stroke-dashoffset: 0 } }
                @keyframes ktRub { 0%{transform:translate(0,0) rotate(-4deg)} 45%{transform:translate(96px,2px) rotate(3deg)} 70%{transform:translate(48px,-2px) rotate(-3deg)} 100%{transform:translate(118px,0) rotate(3deg)} }
                @keyframes ktFadeOut { 0%{opacity:1} 60%{opacity:.12} 100%{opacity:0} }
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
