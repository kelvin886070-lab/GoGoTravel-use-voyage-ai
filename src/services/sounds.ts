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
    | 'penCircle' | 'eraser' | 'penWrite' | 'paperDrop' | 'paperSlide' | 'stamp' | 'penUncap' | 'penCap';

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
};

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
