// src/services/sounds.ts
// 🎵 批⑥：護照翻頁音效引擎。
//   三段素材（public/sounds/，已用 ffmpeg 對齊動畫長度：flip 1.04s / riffle 1.75s / close 1.10s；
//   原始 wav 備份在 brand-assets/sounds/）。
//   設計原則：
//   - 永不 throw：音效是氛圍不是功能，任何失敗（自動播放政策、檔案缺失、Safari 限制）一律靜默。
//   - 播放時機＝動畫「起點」（紙聲發生在翻的過程中，不是翻完；PassportBook settle 內呼叫）。
//   - 開關存 localStorage（預設開；'0'＝關）——會員中心的真開關讀寫這裡，無假按鈕鐵律。
//   - 預載 lazy：首次呼叫才建 Audio（個人檔案分頁以外的使用者零成本）。

export type PageSoundKind =
    | 'flip' | 'riffle' | 'close' | 'tear'
    | 'penCircle' | 'eraser' | 'penWrite' | 'paperDrop' | 'paperSlide' | 'stamp' | 'penUncap' | 'penCap'
    // ── 2026-08-05 補齊（Kelvin 提供素材，ffmpeg 裁切：tick 0.10s／release 0.29s／tear 0.34s／unfold 0.65s）
    | 'rulerTick' | 'rulerRelease' | 'paperUnfold' | 'paperFold' | 'pageTear'
    // ── 2026-08-09 ⑥想怎麼玩頁；素材由 Kelvin 提供、ffmpeg 裁切
    | 'paperLand' | 'paperLift' | 'paperSettle' | 'tick'
    // ── 2026-08-10 ⑦你的講究頁
    | 'penSwitch';

const SOUND_KEY = 'kt_pp_sound';   // 缺席或 '1' ＝開；'0' ＝關
const VOLUME = 0.5;                // 質感音量：聽得到紙、不搶注意力

const SRC: Record<PageSoundKind, string> = {
    flip: '/sounds/page-flip.mp3',
    riffle: '/sounds/page-riffle.mp3',
    close: '/sounds/book-close.mp3',
    tear: '/sounds/ticket-tear.mp3',   // 撕票（生成表單入口＋步間快撕；步間播放時音量另降）
    // 🖋️ 生成表單的紙筆世界（Kelvin 自選素材，2026-08-04 裁齊）
    penCircle: '/sounds/pen-circle.mp3',   // 畫圈＝選中
    eraser: '/sounds/eraser.mp3',          // 橡皮擦＝取消
    penWrite: '/sounds/pen-write.mp3',     // 逐字書寫（連續播放，音量最輕）
    paperDrop: '/sounds/paper-drop.mp3',   // 紙張落桌
    paperSlide: '/sounds/paper-slide.mp3', // 紙張滑動／票被遞過來
    stamp: '/sounds/stamp.mp3',            // 蓋章（情感最高點）
    penUncap: '/sounds/pen-uncap.mp3',     // 開筆蓋＝要開始寫了
    penCap: '/sounds/pen-cap.mp3',         // 關筆蓋＝寫完擱筆
    rulerTick: '/sounds/ruler-tick.mp3',       // 尺規每一格（0.10s、-4dB；連放十幾次也不吵）
    rulerRelease: '/sounds/ruler-release.mp3', // 放開拉桿的收尾（噠噠噠噠…咚）
    paperUnfold: '/sounds/paper-unfold.mp3',   // 攤開一張紙（展開日曆／攤開整年）
    paperFold: '/sounds/paper-fold.mp3',       // 收起一張紙（攤開的相反方向，不共用滑動聲）
    pageTear: '/sounds/page-tear.mp3',         // 撕下日曆的一頁（比票券撕更薄更脆）
    paperLand: '/sounds/paper-land.mp3',       // **單張**紙落到桌面（短音）
    // 一疊紙被鋪定（1.23s 的連續紙聲）。⚠️ **不要改回「短音連放三次」**：
    //   三個短音是三次獨立事件，會把從容的情緒切碎；一段連續的紙聲才是一個過程（Kelvin 實測定案）。
    paperSettle: '/sounds/paper-settle.mp3',
    paperLift: '/sounds/paper-lift.mp3',       // 紙從桌面被拿起（⚠️ 目前無呼叫端，保留給 ⑧生成幕的「抽新紙」）
    tick: '/sounds/tick.mp3',                  // 打勾（複選清單專用；與圈選的 penCircle 是兩種不同的筆法）
    penSwitch: '/sounds/pen-switch.mp3',       // 換筆（放下一支、拿起另一支——素材裡兩聲都留著）
};

/**
 * 🚧 **素材尚未到位**的音效：一律靜默，`getAudio` 也不會替它們建 Audio。
 *
 * 為什麼要有這張表，而不是「檔案不存在自然失敗」：
 *   ①`preloadPageSounds()` 會對每一個 SRC 建 Audio，缺檔會在 console 洗一排 404——
 *     那是**假的錯誤訊息**，會讓真的錯誤更難看見。
 *   ②有名字沒聲音是一種「假按鈕」；明確列出來，才知道還欠什麼。
 *
 * ➜ Kelvin 把 mp3 放進 `public/sounds/` 之後，**只要從這個集合刪掉那一行就上線**，
 *   呼叫端一行都不用改（見 `docs/音效素材清單.md`）。
 */
const PENDING: ReadonlySet<PageSoundKind> = new Set<PageSoundKind>([
    // （目前全部到位。日後新增音效時先把代號放進來，素材進 public/sounds/ 再刪掉這一行。）
]);

/** 翻頁音效目前是否開啟（預設開）。 */
export const isPageSoundOn = (): boolean => {
    try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
};

/** 設定翻頁音效開關（會員中心用）。 */
export const setPageSoundOn = (on: boolean): void => {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
};

// lazy 快取：每種音一個 Audio 實例（重播＝rewind，不疊加多實例）
const cache: Partial<Record<PageSoundKind, HTMLAudioElement>> = {};

const getAudio = (kind: PageSoundKind): HTMLAudioElement | null => {
    if (PENDING.has(kind)) return null;   // 素材未到位＝連 Audio 都不要建（避免 console 被 404 洗版）
    try {
        if (!cache[kind]) {
            const a = new Audio(SRC[kind]);
            a.preload = 'auto';
            a.volume = VOLUME;
            cache[kind] = a;
        }
        return cache[kind] ?? null;
    } catch { return null; }   // 無 Audio 環境（測試/SSR）
};

/** 預載三段音效（進個人檔案分頁時呼叫一次；失敗靜默）。 */
export const preloadPageSounds = (): void => {
    (Object.keys(SRC) as PageSoundKind[]).forEach(getAudio);
};

/** 翻頁觸覺回饋（10ms 輕震；與音效開關獨立——靜音的人仍有指尖的紙感）。
 *  iOS Safari 無 navigator.vibrate＝靜默不動作；原生打包後換 Capacitor Haptics（上架批）。 */
export const hapticTap = (): void => {
    try { navigator.vibrate?.(10); } catch { /* ignore */ }
};

/**
 * 播放**可重疊**的極短音效（拉桿的 tick 專用）。
 * 為什麼不能用一般的 playPageSound：單一 Audio 實例重播＝先 rewind，前一聲會被硬切斷，
 * 快速拖曳時聽起來是「斷奏」而不是連續的噠噠噠。這裡用一個小 pool 輪流播。
 */
const POOL_SIZE = 4;
const pools: Partial<Record<PageSoundKind, HTMLAudioElement[]>> = {};
let poolIdx = 0;
export const playOverlapping = (kind: PageSoundKind, volumeScale = 1): void => {
    if (!isPageSoundOn() || PENDING.has(kind)) return;
    try {
        if (!pools[kind]) {
            pools[kind] = Array.from({ length: POOL_SIZE }, () => {
                const a = new Audio(SRC[kind]);
                a.preload = 'auto';
                return a;
            });
        }
        const pool = pools[kind]!;
        const a = pool[poolIdx++ % POOL_SIZE];
        a.volume = Math.max(0, Math.min(1, VOLUME * volumeScale));
        a.currentTime = 0;
        void a.play().catch(() => { /* 自動播放政策擋下＝靜默 */ });
    } catch { /* ignore */ }
};

/** 播放翻頁音（永不 throw；關閉時靜默）。
 *  volumeScale：相對音量（撕票的「步間快撕」用 0.5＝約 -6dB，同一語言不同音量）。 */
export const playPageSound = (kind: PageSoundKind, volumeScale = 1): void => {
    if (!isPageSoundOn()) return;
    const a = getAudio(kind);
    if (!a) return;
    try {
        a.volume = Math.max(0, Math.min(1, VOLUME * volumeScale));
        a.currentTime = 0;
        void a.play().catch(() => { /* 自動播放政策擋下＝靜默 */ });
    } catch { /* ignore */ }
};
