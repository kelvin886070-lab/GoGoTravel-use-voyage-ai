// src/views/create/ZonePage.tsx
// 🗺️ 生成表單・縮圈頁（docs E3「縮圈」定稿 ＋ E1 紙與筆憲章回頭校正）
//
//   何時出現：目的地是**國家或區域級**才出現（城市級＝已經回答過，直接跳過——已回答的問題不再問）。
//   資料來源：`destination-deep` 的 zones（入口頁驗證通過時已背景預取 → 這裡通常是快取命中、零延遲）。
//
//   設計（Kelvin 2026-08-05 定案：回頭把這一步改成遵照憲章）：
//     - **鋪紙**：地帶要帶理由與城市名，資訊需要結構 → 這一頁的選項是紙，不是照片上的字。
//     - **統一材質與墨色**：紙色只有 `PAPER`、墨色只有 `INK_INK`（共用件 ink.tsx，各頁不得自己定義）。
//     - **零圓角**（3px）：圓角是 UI 的語彙，紙不會有圓角。
//     - **選中＝手繪墨圈、取消＝橡皮擦**，與入口頁同一支筆；膠囊／色塊／彩色邊框一律不用。
//     - **城市名那一行留著**（Kelvin 定案）：「關西」對沒去過的人是抽象的，城市名才讓人做得了決定。
//     - **即時回應**：選了幾帶就在右下角浮出手寫斜體（「兩個地帶，建議 6 天左右」）＝紙在回應你，
//       同一個數字之後直接反哺日期頁的預設天數。
//   物件連續：背景沿用入口頁那張照片，不重新載、不換場——換的只有標題與紙。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';
import { fetchDestinationDeep, type IntelZone } from '../../services/destinationIntel';
import { suggestedDays } from '../../services/tripBrief';
import { TicketNextButton } from './TicketNextButton';
import { HandCircle, EraserBlock, PaperTexture, paperShadow, seedOf, PAPER, PAPER_RADIUS, INK_INK, INK_PRINT, INK_AMBER, INK_KEYFRAMES } from './ink';

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const FIRST_BATCH = 6;      // 預設先給 6 張，其餘收在「更多地帶」後面（定稿）
const CROWDED_AT = 4;       // 第 4 帶起亮琥珀軟提醒（不擋路）

export interface ZoneResult {
    /** 選中的地帶（原始資料，順序＝畫面順序；供 brief 與 prompt 使用） */
    zones: IntelZone[];
    /** 地帶短名（「關西 · 大阪與京都」→「關西」）：下游當目的地用 */
    labels: string[];
    /** 反哺日期頁的建議天數（0＝略過，不給建議） */
    suggestedDays: number;
    /** 使用者選擇略過（整個國家都看看） */
    skipped: boolean;
}

/** 「關西 · 大阪與京都」→「關西」（下游目的地要短；全名留在 zones 裡不會遺失） */
const shortLabel = (name: string): string => (name.split('·')[0] || name).trim();

export const ZonePage: React.FC<{
    /** 麵包屑與略過文案用（「日本」） */
    destinationName: string;
    /** 打 deep 的查詢字串（＝入口頁已驗證的目的地原字串） */
    query: string;
    /** 背景照片（沿用入口頁那張＝物件連續） */
    coverUrl: string | null;
    isDomestic: boolean;
    onBack: () => void;
    onClose: () => void;
    onNext: (r: ZoneResult) => void;
}> = ({ destinationName, query, coverUrl, isDomestic, onBack, onClose, onNext }) => {
    const instant = useMemo(() => reduceMotion(), []);
    const [zones, setZones] = useState<IntelZone[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);      // 以地帶名為 key
    const [erasing, setErasing] = useState<string | null>(null);
    const [pressed, setPressed] = useState<string | null>(null);   // 指尖按住的那張紙（會沉下去）
    const aliveRef = useRef(true);
    const timersRef = useRef<Set<number>>(new Set());

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

    // 地帶資料（入口頁已預取 → 多半是快取命中）；失敗一律退位成「沒有地帶可選」，不擋路
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let deep = null;
            try { deep = await fetchDestinationDeep(query); } catch { deep = null; }
            if (cancelled || !aliveRef.current) return;
            const list = (deep?.zones || []).filter(z => !!z?.name);
            setZones(list);
            setLoading(false);
            if (list.length > 0 && !instant) playPageSound('paperDrop');   // 落紙一次就好（每張都響＝噪音）
        })();
        return () => { cancelled = true; };
    }, [query, instant]);

    const visible = useMemo(() => {
        const list = zones || [];
        return expanded ? list.slice(0, 12) : list.slice(0, FIRST_BATCH);
    }, [zones, expanded]);

    const toggle = useCallback((zone: IntelZone) => {
        const name = zone.name;
        if (erasing) return;
        if (picked.includes(name)) {
            if (instant) { setPicked(prev => prev.filter(n => n !== name)); return; }
            setErasing(name);
            playPageSound('eraser');
            hapticTap();
            const t = window.setTimeout(() => {
                if (!aliveRef.current) return;
                setPicked(prev => prev.filter(n => n !== name));
                setErasing(null);
            }, 450);
            timersRef.current.add(t);
            return;
        }
        setPicked(prev => [...prev, name]);
        playPageSound('penCircle');
        hapticTap();
    }, [picked, erasing, instant]);

    const pickedZones = useMemo(
        () => (zones || []).filter(z => picked.includes(z.name)),
        [zones, picked],
    );
    const days = suggestedDays(Math.max(1, picked.length));
    const crowded = picked.length >= CROWDED_AT;

    const finish = (viaSkipLink: boolean) => {
        // 一顆都沒圈就按下一步＝實質上就是略過（資料要誠實，不能記成「他選了空的」）
        const skipped = viaSkipLink || pickedZones.length === 0;
        onNext({
            zones: skipped ? [] : pickedZones,
            labels: skipped ? [] : pickedZones.map(z => shortLabel(z.name)),
            suggestedDays: skipped ? 0 : days,
            skipped,
        });
    };

    const noZones = !loading && (zones?.length ?? 0) === 0;

    return (
        <div className="fixed inset-0 z-[90] overflow-hidden" style={{ backgroundColor: '#1b1510' }}>
            {/* 背景：沿用入口頁那張照片（物件連續；沒有照片就退回主題色底） */}
            <div className="absolute inset-0" style={{
                backgroundImage: isDomestic ? 'linear-gradient(165deg,#4a5c48,#222b21)' : 'linear-gradient(165deg,#3A6350,#22372a)',
            }} />
            {coverUrl && (
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                }} />
            )}
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,14,13,.5), rgba(15,14,13,.78))' }} />

            <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                <button onClick={onBack} aria-label="上一步" className="absolute left-3 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <ChevronLeft className="w-5 h-5 text-white/80" />
                </button>
                <button onClick={onClose} aria-label="關閉" className="absolute right-4 p-2 z-30"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
                    <X className="w-5 h-5 text-white/80" />
                </button>

                {/* 麵包屑：墨白襯線字直落照片（無底無框，與「什麼時候」頁同語彙） */}
                <div className="text-center font-serif text-[11px] text-white/60 mt-1">{destinationName}</div>

                <div className="px-6 pt-5 pb-2 text-center">
                    <div className="font-serif text-[22px] font-bold text-[#F6F1E7]">先縮小到一帶</div>
                    <div className="font-mono text-[9px] tracking-[0.32em] text-white/55 mt-1.5">NARROW DOWN</div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3" style={{ paddingBottom: 12 }}>
                    {loading && (
                        <div className="text-center font-serif text-[12px] text-white/55 mt-10">正在攤開地圖…</div>
                    )}

                    {noZones && (
                        <div className="text-center font-serif text-[12px] text-white/60 mt-10 leading-relaxed">
                            這裡我沒有更細的地帶資料<br />直接往下一步也沒問題
                        </div>
                    )}

                    {visible.map((z, i) => {
                        const on = picked.includes(z.name);
                        const wiping = erasing === z.name;
                        return (
                            <button key={z.name} onClick={() => toggle(z)}
                                aria-pressed={on}
                                onPointerDown={() => setPressed(z.name)}
                                onPointerUp={() => setPressed(null)}
                                onPointerLeave={() => setPressed(null)}
                                onPointerCancel={() => setPressed(null)}
                                className="w-full text-left mb-2.5 px-3.5 py-3 block relative"
                                style={{
                                    backgroundColor: PAPER,
                                    borderRadius: PAPER_RADIUS,                        // 手裁邊：四角刻意不等
                                    boxShadow: paperShadow(pressed === z.name ? 'press' : on ? 'picked' : 'rest'),
                                    // 按住＝紙被指尖壓在桌面上（位移 1px＋陰影收緊）；圈起來之後就留在那個高度
                                    transform: (pressed === z.name || on) ? 'translateY(1px)' : undefined,
                                    transition: 'box-shadow .18s ease, transform .18s ease',
                                    animation: instant ? undefined : `ktPaperDrop .42s cubic-bezier(.2,.85,.35,1) ${i * 90}ms backwards`,
                                }}>
                                {/* 摺痕位置依地名 hash 決定：**版面維持整齊，但紙的紋理本來就該張張不同**
                                    （同一張紙每次重繪都在同一個位置，不會閃爍） */}
                                <PaperTexture />
                                <span className="relative inline-block">
                                    <span className="font-serif text-[15px]" style={{ color: INK_PRINT, letterSpacing: '0.012em' }}>{z.name}</span>
                                    {on && !wiping && <HandCircle seed={seedOf(z.name)} color={INK_INK} instant={instant} />}
                                    {wiping && (
                                        <>
                                            <EraserBlock />
                                            <span aria-hidden style={{ position: 'absolute', inset: 0, animation: 'ktFadeOut .43s ease forwards' }}>
                                                <HandCircle seed={seedOf(z.name)} color={INK_INK} instant />
                                            </span>
                                        </>
                                    )}
                                </span>
                                {z.reason && (
                                    <span className="relative block font-serif text-[11px] mt-2" style={{ color: '#6B665C' }}>{z.reason}</span>
                                )}
                                {(z.cities?.length ?? 0) > 0 && (
                                    <span className="relative block font-serif text-[10px] mt-1 pr-16" style={{ color: '#6E6858' }}>
                                        {z.cities!.slice(0, 4).join(' · ')}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {!expanded && (zones?.length ?? 0) > FIRST_BATCH && (
                        <button onClick={() => { setExpanded(true); playPageSound('paperSlide'); hapticTap(); }}
                            className="w-full text-center font-serif text-[11px] text-white/65 underline underline-offset-4 decoration-white/35 mt-2 mb-1 py-2">
                            更多地帶
                        </button>
                    )}
                </div>

                {/* 即時回應：紙在回應你（同時就是日期頁的預設天數來源） */}
                <div className="px-6 h-5 text-right">
                    {picked.length > 0 && (
                        <span className="font-serif italic text-[11px]" style={{ color: crowded ? INK_AMBER : 'rgba(246,241,231,.72)' }}>
                            {crowded
                                ? `${picked.length} 個地帶——待會記得給足天數，或考慮拆成兩趟`
                                : `${picked.length} 個地帶，建議 ${days} 天左右`}
                        </span>
                    )}
                </div>

                <div className="px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
                    <TicketNextButton onNext={() => finish(false)} />
                    <div className="flex justify-center mt-3">
                        <button onClick={() => finish(true)}
                            className="font-serif text-[12px] text-white/65 underline underline-offset-4 decoration-white/35">
                            略過，整個{destinationName}都看看
                        </button>
                    </div>
                </div>
            </div>

            <style>{INK_KEYFRAMES}</style>
        </div>
    );
};
