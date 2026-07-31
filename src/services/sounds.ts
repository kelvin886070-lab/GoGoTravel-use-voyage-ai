// src/services/sounds.ts
// 🎵 批⑥：護照翻頁音效引擎。
//   三段素材（public/sounds/，已用 ffmpeg 對齊動畫長度：flip 1.04s / riffle 1.75s / close 1.10s；
//   原始 wav 備份在 brand-assets/sounds/）。
//   設計原則：
//   - 永不 throw：音效是氛圍不是功能，任何失敗（自動播放政策、檔案缺失、Safari 限制）一律靜默。
//   - 播放時機＝動畫「起點」（紙聲發生在翻的過程中，不是翻完；PassportBook settle 內呼叫）。
//   - 開關存 localStorage（預設開；'0'＝關）——會員中心的真開關讀寫這裡，無假按鈕鐵律。
//   - 預載 lazy：首次呼叫才建 Audio（個人檔案分頁以外的使用者零成本）。

export type PageSoundKind = 'flip' | 'riffle' | 'close';

const SOUND_KEY = 'kt_pp_sound';   // 缺席或 '1' ＝開；'0' ＝關
const VOLUME = 0.5;                // 質感音量：聽得到紙、不搶注意力

const SRC: Record<PageSoundKind, string> = {
    flip: '/sounds/page-flip.mp3',
    riffle: '/sounds/page-riffle.mp3',
    close: '/sounds/book-close.mp3',
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

/** 播放翻頁音（永不 throw；關閉時靜默）。 */
export const playPageSound = (kind: PageSoundKind): void => {
    if (!isPageSoundOn()) return;
    const a = getAudio(kind);
    if (!a) return;
    try {
        a.currentTime = 0;
        void a.play().catch(() => { /* 自動播放政策擋下＝靜默 */ });
    } catch { /* ignore */ }
};
