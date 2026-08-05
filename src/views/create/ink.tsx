// src/views/create/ink.tsx
// 🖋️ 生成表單的「筆與紙」共用件（設計憲章 E1）
//   憲章三條，全表單共用這一份實作，各頁不得自己再定義一套：
//     ①**紙＝可書寫處**：只有需要圈選／書寫的地方才鋪紙；紙色唯一 `PAPER`，質地靠邊框與陰影分化。
//     ②**紙上用墨（INK_INK）、照片上用金（INK_GOLD）**——底材決定筆色，不是心情決定。
//     ③**選擇＝手繪圈、取消＝橡皮擦**；虛線圈＝暫定／未確認（琥珀 INK_AMBER）。
//   膠囊、實心色塊、彩色邊框一律退役。
import React from 'react';

export const PAPER = '#F6F1E7';     // 品牌紙色（唯一）
export const INK_INK = '#232320';   // 紙上的墨
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

/** 紙纖維的背景圖（同一個 URL 全站共用＝瀏覽器只解碼一次） */
export const PAPER_GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

/** 手裁邊的四角（機器切的邊才會四角一致） */
export const PAPER_RADIUS = '3px 2px 4px 2px';

/** 紙的立體感（依狀態變厚薄）：rest＝躺在桌上／press＝被指尖按住／picked＝被圈起來後留在桌面上 */
export const paperShadow = (state: 'rest' | 'press' | 'picked'): string => {
    const edge = 'inset 0 1px 0 rgba(255,255,255,.7), inset 0 -1px 0 rgba(35,35,32,.06)';
    if (state === 'press') return `${edge}, 0 1px 2px rgba(0,0,0,.28)`;
    if (state === 'picked') return `${edge}, 0 1px 3px rgba(0,0,0,.30)`;
    return `${edge}, 0 3px 8px rgba(0,0,0,.24)`;
};

/** 紙面的兩層紋理（放進任何鋪紙的容器裡當第一個子元素；容器要 position:relative） */
export const PaperTexture: React.FC<{ radius?: string | number }> = ({ radius = PAPER_RADIUS }) => (
    <>
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            opacity: 0.055, backgroundImage: PAPER_GRAIN_URL,
        }} />
        <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 55%, rgba(150,120,70,.10) 100%)',
        }} />
    </>
);

/** 文字 → 穩定 seed（同一個詞每次的筆跡一致，像同一個人寫的） */
export const seedOf = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 1000;
};

/** 手繪圈（筆跡帶 seed 抖動、永不重複）。
 *  dashed＝虛線：紙筆世界裡「暫定」的通用語彙——不確定的事不該畫成確定的線。 */
export const HandCircle: React.FC<{ seed: number; color: string; dashed?: boolean; instant?: boolean }> =
    ({ seed, color, dashed, instant }) => {
        const r = ((seed * 9301 + 49297) % 233280) / 233280;
        const d = `M${(30 + r * 4).toFixed(1)} 3 C 51 ${(1 + r * 2).toFixed(1)}, 61 8, 60 17 C 59 27, 46 31, 31 30 C 14 29, ${(3 + r * 2).toFixed(1)} 25, 4 16 C 5 7, 17 2, ${(35 + r * 3).toFixed(1)} 4`;
        const shadow = color === INK_INK
            ? 'drop-shadow(0 0 .5px rgba(35,35,32,.25))'          // 紙上：墨會微微暈開
            : 'drop-shadow(0 1px 2px rgba(0,0,0,.45))';           // 照片上：金需要一點浮起
        return (
            <svg viewBox="0 0 64 34" aria-hidden
                style={{
                    position: 'absolute', inset: '-7px -11px', width: 'calc(100% + 22px)', height: 'calc(100% + 14px)',
                    overflow: 'visible', pointerEvents: 'none', transform: `rotate(${(r * 6 - 3).toFixed(1)}deg)`,
                }}>
                <path d={d} fill="none" stroke={color} strokeWidth={dashed ? 1.6 : 1.9} strokeLinecap="round" pathLength={100}
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
`;

/** 橡皮擦：可見的米白橡皮塊掃過（取消選擇時疊在被擦的字上） */
export const EraserBlock: React.FC = () => (
    <span aria-hidden style={{
        position: 'absolute', top: '50%', left: -18, width: 20, height: 13, marginTop: -7, borderRadius: 3,
        background: 'linear-gradient(#F7EEDD,#DCCAAA 60%,#C9B38D)', boxShadow: '0 3px 5px rgba(0,0,0,.35)',
        animation: 'ktRub .43s cubic-bezier(.4,.05,.55,.95) forwards', zIndex: 4,
    }} />
);
