// src/views/create/ink.tsx
// 🖋️ 生成表單的「筆與紙」共用件（設計憲章 E1）
//   憲章三條，全表單共用這一份實作，各頁不得自己再定義一套：
//     ①**紙＝可書寫處**：只有需要圈選／書寫的地方才鋪紙；紙色唯一 `PAPER`，質地靠邊框與陰影分化。
//     ②**紙上用墨（INK_INK）、照片上用金（INK_GOLD）**——底材決定筆色，不是心情決定。
//     ③**選擇＝手繪圈、取消＝橡皮擦**；虛線圈＝暫定／未確認（琥珀 INK_AMBER）。
//   膠囊、實心色塊、彩色邊框一律退役。
import React from 'react';

export const PAPER = '#F6F1E7';     // 品牌紙色（唯一）
export const INK_INK = '#232320';   // 紙上的墨（**手寫筆跡**：濕的、深的——畫圈、劃除、簽名用）
/** 印在紙上的字：印刷的墨會被纖維吃掉一點，從來不是純黑。內文一律用它，才不會像螢幕在發光。 */
export const INK_PRINT = '#2A2723';
export const INK_GOLD = '#C9B98F';  // 照片上的燙金
export const INK_AMBER = '#E9BE7A'; // 未確認／軟提醒的琥珀

// ── 紙 ────────────────────────────────────────────────────────────────
// **音效是紙的，視覺就必須對得起那個聲音**（Kelvin 定案）：耳朵聽到紙、眼睛看到色塊＝儀式會垮。
// 紙的真實感來自三層，全部**程序生成**（零圖檔、零授權風險、解析度無限、不吃 egress）：
//   ①纖維紋：feTurbulence 高頻噪點，不透明度 5.5%——**摸得到、看不見**（遠看與純色紙無異，湊近有顆粒）
//   ②厚度：上緣受光的白線＋下緣壓陰的暗線＋外投影（紙是有厚度的物件，不是一塊填色）
//   ③手裁邊：四角半徑刻意不等（3/2/4/2）——機器切的邊才會四角一致
// 刻意不做「復古仿舊」：斑駁紋理會壓垮 10–11px 的繁體中文，而且那是羊皮紙的年代感，
//   與護照證件紙／票券卡紙不同代——同一個 app 裡不該有兩個年代。

const GRAIN_SVG =
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>` +
    `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/></filter>` +
    `<rect width='140' height='140' filter='url(#g)'/></svg>`;

// 做舊：**低頻**斑塊（不是高頻噪點）——老紙的味道來自大片不均勻的水漬與氧化，不是顆粒。
//   feColorMatrix 把噪點整片染成暖褐（R.55 G.42 B.22），alpha 取噪點自身 → 天然的不規則斑塊。
//   以 multiply 疊在紙上：只會讓紙變暗變黃，**不會壓過墨字**（乘法對深色幾乎無作用）。
const AGE_SVG =
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>` +
    `<filter id='a'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.021' numOctaves='4' seed='7'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.22  0 0 0 0.6 0'/>` +
    `</filter>` +
    `<rect width='320' height='320' filter='url(#a)'/></svg>`;

// 皺褶：**真的折痕**，不是把斑塊調濃。
//   成因模擬——feTurbulence 造出高低起伏的表面，feDiffuseLighting 用一盞遠方的燈去照它：
//   折痕的一側受光變亮、另一側落影變暗，這才是眼睛認得的皺紋（與護照紙同一套技法）。
//   baseFrequency 刻意各向異性（x 低、y 高）＝拉長的折痕，而不是均勻的凹凸。
//   光的方位角 225°／仰角 55° ＝ 與紙面受光層同一個左上光源（全站光源只有一個）。
const CREASE_SVG =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
    `<filter id='c'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.009 0.042' numOctaves='3' seed='11' result='t'/>` +
    `<feDiffuseLighting in='t' surface-scale='2.4' diffuseConstant='1' lighting-color='#ffffff'>` +
    `<feDistantLight azimuth='225' elevation='55'/>` +
    `</feDiffuseLighting>` +
    `</filter>` +
    `<rect width='400' height='400' filter='url(#c)'/></svg>`;

/** 紙纖維的背景圖（同一個 URL 全站共用＝瀏覽器只解碼一次） */
export const PAPER_GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;
/** 做舊斑塊（低頻、暖褐、以 multiply 疊加） */
export const PAPER_AGE_URL = `url("data:image/svg+xml,${encodeURIComponent(AGE_SVG)}")`;
/** 皺褶（受光／落影的折痕，以 overlay 疊加） */
export const PAPER_CREASE_URL = `url("data:image/svg+xml,${encodeURIComponent(CREASE_SVG)}")`;

/** 手裁邊的四角（機器切的邊才會四角一致） */
export const PAPER_RADIUS = '3px 2px 4px 2px';

/**
 * 🎚️ 紙的四個旋鈕（全站唯一調整處；要更舊就往上、要更乾淨就往下）。
 *   grain 顆粒感：0.05 幾乎看不見／0.07 現值／0.10 開始吃字
 *   age   斑塊做舊：0 全新／0.24 現值／0.40 明顯的老紙（10px 小字開始吃力）
 *   edge  邊角氧化：0.10 微／0.18 現值／0.30 像燒過邊
 *   seal  騎縫小印墨度：0.13 極淡／0.24 現值／0.35 明顯到會搶戲
 *   crease 皺褶深度（被揉過壓過的不規則起伏）：0.20 隱約／0.38 看得出起伏／0.60 現值（揉過再攤平）
 */
export const PAPER_TUNING = { grain: 0.07, age: 0.24, edge: 0.18, seal: 0.24, crease: 0.60 } as const;

// ❌ 幾何摺線（對摺的痕跡）已退役（2026-08-05 Kelvin 裁決）：
//    一道直線把紙分成兩個亮度不同的面，在小卡片上讀起來是「顏色不均」而不是「被摺過」——
//    紙必須是同一個顏色。只保留**有機皺褶**（下面的 crease 層）。

/**
 * 紙的立體感（依狀態變厚薄）：rest＝躺在桌上／press＝被指尖按住／picked＝圈起來後留在桌面上。
 * ⚠️ **陰影必須兩層**（2026-08-05 Kelvin 指出「還是像卡片」的第一個原因）：
 *   - 接觸陰影：很緊、很深、貼在紙的下緣 → 說明「紙**壓在**桌面上」
 *   - 環境陰影：很寬、很淡、往下擴散 → 說明「這裡有一盞燈」
 *   單層 8px 模糊＝Material Design 的浮起卡片，那是 UI 的語彙不是紙的。
 */
export const paperShadow = (state: 'rest' | 'press' | 'picked'): string => {
    // 紙的厚度：上緣受光的白線＋下緣壓陰的暗線
    const edge = 'inset 0 1px 0 rgba(255,255,255,.72), inset 0 -1px 0 rgba(35,35,32,.07)';
    if (state === 'press') return `${edge}, 0 1px 1px rgba(0,0,0,.32), 0 3px 6px -2px rgba(0,0,0,.24)`;
    if (state === 'picked') return `${edge}, 0 1px 2px rgba(0,0,0,.34), 0 5px 10px -4px rgba(0,0,0,.26)`;
    return `${edge}, 0 1px 2px rgba(0,0,0,.34), 0 10px 20px -6px rgba(0,0,0,.30)`;
};

// ❌ 「拿起 → 端詳 → 放下」三拍與 `HandShadow`／`paperShadow('hand'|'back')` 已於 2026-08-09 全數退役。
//    退役的理由值得留下來——**我論證錯了**：我當時說那是「寫完拿起來看一眼」，
//    但**使用者填完一張紙的心情不是端詳，是「下一個」**，那 246ms 的「儀式感」對他是卡頓。
//    判準應該是**「這個停頓服務的是誰的心理狀態」**，不是「這個隱喻聽起來成不成立」。

/**
 * 紙面紋理（放進任何鋪紙的容器裡當第一個子元素；容器要 `position: relative`）。
 * 全部程序生成，依序疊六層：
 *   ①纖維紋（高頻顆粒）②做舊斑塊（低頻暖褐、multiply）③皺褶（有機起伏、overlay）
 *   ④受光（全站同一個光源方向）⑤邊角氧化
 *   ⑥印刷痕跡：凹版內框線 ＋ 右下角 KELVIN TRIP 騎縫小印（憲章：全步驟每張紙統一）
 */
export const PaperTexture: React.FC<{
    radius?: string | number;
    /** 凹版內框線（票券卡紙才有；便條紙可關掉） */
    keyline?: boolean;
    /** 騎縫小印（憲章：全步驟每張紙統一）；'top' ＝ 印在紙的上緣正中（日曆的品牌抬頭位） */
    seal?: boolean | 'top';
    /**
     * 大張的紙用 dense：紋理貼圖縮小一半。
     * 為什麼需要：斑塊與皺褶是低頻的，貼圖 320/400px 攤在 300px 寬的月曆上往往只落在平坦的區域，
     * 於是大紙看起來比小卡片「新」。縮小貼圖＝同一張紙上看得到更多起伏。
     */
    dense?: boolean;
}> = ({ radius = PAPER_RADIUS, keyline = true, seal = true, dense = false }) => (
    <>
        {/* ①纖維紋（高頻顆粒） */}
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            opacity: PAPER_TUNING.grain, backgroundImage: PAPER_GRAIN_URL,
        }} />
        {/* ②做舊斑塊（低頻、暖褐、multiply——只讓紙變黃變暗，不吃墨字） */}
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            opacity: PAPER_TUNING.age, backgroundImage: PAPER_AGE_URL,
            backgroundSize: dense ? '170px 170px' : '320px 320px', mixBlendMode: 'multiply',
        }} />
        {/* ③皺褶：真的起伏被光照到（折痕一側受光、一側落影），不是把斑塊調濃。
            overlay 混色＝只改明暗不改色相，紙不會變髒；紋理隨紙張大小平鋪。 */}
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            opacity: PAPER_TUNING.crease, backgroundImage: PAPER_CREASE_URL,
            backgroundSize: dense ? '210px 210px' : '400px 400px', mixBlendMode: 'overlay',
        }} />
        {/* ④受光：光從左上來（與陰影往下落的方向一致，物理上才說得通） */}
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(158deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 38%, rgba(120,95,55,.05) 100%)',
        }} />
        {/* ⑤邊角氧化：老紙從邊緣開始黃 */}
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            backgroundImage: `radial-gradient(118% 88% at 50% 50%, rgba(0,0,0,0) 42%, rgba(150,118,66,${PAPER_TUNING.edge}) 100%)`,
        }} />
        {keyline && (
            <span aria-hidden style={{
                position: 'absolute', inset: 6, borderRadius: 1, pointerEvents: 'none',
                border: '1px solid rgba(35,35,32,.06)',
            }} />
        )}
        {seal && (
            <span aria-hidden style={seal === 'top'
                ? {
                    position: 'absolute', top: 5, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 6.5, letterSpacing: '0.28em', color: `rgba(35,35,32,${PAPER_TUNING.seal})`,
                }
                : {
                    position: 'absolute', right: 9, bottom: 6, pointerEvents: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 6.5, letterSpacing: '0.14em', color: `rgba(35,35,32,${PAPER_TUNING.seal})`,
                }}>KELVIN TRIP</span>
        )}
    </>
);

/** 直接印在照片上的字：規格化陰影，讓照片再花也吃不掉字（浮在照片上的每一段文案都要用） */
export const ON_PHOTO_SHADOW = '0 1px 3px rgba(0,0,0,.82)';

/** 文字 → 穩定 seed（同一個詞每次的筆跡一致，像同一個人寫的） */
export const seedOf = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 1000;
};

/** 手繪圈（筆跡帶 seed 抖動、永不重複）。
 *  dashed＝虛線：紙筆世界裡「暫定」的通用語彙——不確定的事不該畫成確定的線。 */
export const HandCircle: React.FC<{
    seed: number;
    color: string;
    dashed?: boolean;
    instant?: boolean;
    /** 圈得緊一點：一兩個字（月份數字、日期）用預設的大圈會明顯過大 */
    tight?: boolean;
}> = ({ seed, color, dashed, instant, tight }) => {
        const r = ((seed * 9301 + 49297) % 233280) / 233280;
        const d = `M${(30 + r * 4).toFixed(1)} 3 C 51 ${(1 + r * 2).toFixed(1)}, 61 8, 60 17 C 59 27, 46 31, 31 30 C 14 29, ${(3 + r * 2).toFixed(1)} 25, 4 16 C 5 7, 17 2, ${(35 + r * 3).toFixed(1)} 4`;
        const shadow = color === INK_INK
            ? 'drop-shadow(0 0 .5px rgba(35,35,32,.25))'          // 紙上：墨會微微暈開
            : 'drop-shadow(0 1px 2px rgba(0,0,0,.45))';           // 照片上：金需要一點浮起
        return (
            <svg viewBox="0 0 64 34" aria-hidden
                style={{
                    position: 'absolute',
                    inset: tight ? '-4px -7px' : '-7px -11px',
                    width: tight ? 'calc(100% + 14px)' : 'calc(100% + 22px)',
                    height: tight ? 'calc(100% + 8px)' : 'calc(100% + 14px)',
                    overflow: 'visible', pointerEvents: 'none', transform: `rotate(${(r * 6 - 3).toFixed(1)}deg)`,
                }}>
                <path d={d} fill="none" stroke={color} strokeWidth={dashed ? 1.6 : tight ? 1.5 : 1.9} strokeLinecap="round" pathLength={100}
                    style={dashed
                        // 虛線無法用「畫出來」的 dash 動畫（dasharray 被拿去做虛線）→ 改用淡入
                        ? { strokeDasharray: '4.5 4', opacity: instant ? 1 : 0, animation: instant ? undefined : 'ktInk .4s ease-out forwards', filter: shadow }
                        : { strokeDasharray: 100, strokeDashoffset: instant ? 0 : 100, animation: instant ? undefined : 'ktDraw .45s ease-out forwards', filter: shadow }} />
            </svg>
        );
    };

/** 各頁的 <style> 都要含這一段（筆跡、橡皮擦、落紙的關鍵影格只有這一份定義）。 */
export const INK_KEYFRAMES = `
    @keyframes ktDraw { to { stroke-dashoffset: 0 } }
    @keyframes ktInk { to { opacity: 1 } }
    @keyframes ktFadeOut { 0%{opacity:1} 60%{opacity:.12} 100%{opacity:0} }
    @keyframes ktRub { 0%{transform:translate(0,0) rotate(-4deg)} 45%{transform:translate(96px,2px) rotate(3deg)} 70%{transform:translate(48px,-2px) rotate(-3deg)} 100%{transform:translate(118px,0) rotate(3deg)} }
    @keyframes ktFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    @keyframes ktPaperDrop { 0%{opacity:0;transform:translateY(-22px) rotate(-.6deg)} 60%{opacity:1} 100%{opacity:1;transform:translateY(0) rotate(0deg)} }

    /* 紅筆的首次揭示（⑦）：自己浮起再放下＝「我可以被拿起來」。
       不加說明文字——讓那支筆自己說。一動手就取消。 */
    @keyframes ktPenPeek {
        0%   { transform: translateY(6px) rotate(0deg) }
        26%  { transform: translateY(-3px) rotate(-7deg) }
        54%  { transform: translateY(-3px) rotate(-7deg) }
        100% { transform: translateY(6px) rotate(0deg) }
    }
`;
/* 打勾（複選清單的筆法）沿用上面的 ktDraw——**筆跡是畫出來的，不是淡入的**，
   圈與勾雖然是兩種筆法，但「畫」這個動作是同一個。
   提醒：INK_KEYFRAMES 是 template literal，裡面的註解不可以出現反引號，會提前結束字串
   （曾因此讓 tsc 報出莫名其妙的 "',' expected"）。 */

/** 橡皮擦：可見的米白橡皮塊掃過（取消選擇時疊在被擦的字上） */
export const EraserBlock: React.FC = () => (
    <span aria-hidden style={{
        position: 'absolute', top: '50%', left: -18, width: 20, height: 13, marginTop: -7, borderRadius: 3,
        background: 'linear-gradient(#F7EEDD,#DCCAAA 60%,#C9B38D)', boxShadow: '0 3px 5px rgba(0,0,0,.35)',
        animation: 'ktRub .43s cubic-bezier(.4,.05,.55,.95) forwards', zIndex: 4,
    }} />
);
