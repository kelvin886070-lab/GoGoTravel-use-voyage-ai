// src/services/placeSanity.ts
// 🧪 目的地本地防呆（第一道篩・零成本、零網路、純函式）
//   定位：**只抓「結構上確定是亂打」的字串**，抓到就不打 LLM（省錢）並讓畫面立刻標成「未確認」。
//   絕不做的事：
//     - 不擋使用者（呼叫端一律只改視覺狀態，不 disable、不擋送出）
//     - 不試圖判斷「這個地名是否真的存在」——那是 LLM 的工作，本檔只看字形
//   誤判成本評估：偽陽性（真地名被判 junk）＝該筆少了情報、畫虛線圈、送出前多一次確認；
//                 偽陰性（亂碼沒被抓到）＝交給 LLM 判 unknown，仍走同一套未確認流程。
//     兩種誤判都不會讓使用者卡住，所以規則一律**寧可少抓，不可錯抓**。
//   反例來源：規則全部拿真實世界地名對照過（見各條註解），Szczecin／Berlin／Ljubljana／
//     Strasbourg／Milwaukee 這類「看起來很怪但真實存在」的名字必須通過。

export type LocalVerdict = 'junk' | 'pass';

/** 完全相符才算數的黑名單（exact match 才不會誤傷 Testaccio、Abcoude 之類的真地名）。 */
const EXACT_JUNK = new Set([
    'test', 'testing', 'abc', 'abcd', 'aaa', 'xxx', 'yyy', 'zzz', 'foo', 'bar', 'baz',
    'null', 'undefined', 'none', 'nan',
    '測試', '測試用', '測試一下', '亂打', '隨便', '隨便啦', '哈哈', '無', '沒有', '不知道',
]);

/** 鍵盤相鄰列（含數字列）；連打 4 鍵以上＝人在敲鍵盤，不是在寫地名。 */
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

/** 「兩個罕用子音相鄰」的組合——刻意只收雙方都罕見者，避開所有已知的真實反例：
 *  cz(Czestochowa)、sz(Szeged)、dz(Dzialdowo)、rz(Rzeszów)、tz(Metz)、nz(Nzérékoré)、
 *  mz(Mzuzu)、zh(Zhuhai)、fj(Fjærland)、sq(Squamish)、jn/jl/jm/jk/jp(荷語 ij 後接子音)。 */
//  已知並接受的偽陽性：'jw' 會誤傷 Jwaneng（波札那小鎮）——換來抓住 fjwiefp 這類亂碼，划算，
//  且誤傷的代價只是虛線圈＋送出前一次確認，不影響他繼續。
const IMPOSSIBLE_BIGRAMS = new Set([
    'jw', 'jq', 'jx', 'jz', 'jv', 'jf',
    'xj', 'xq', 'xz',
    'zq', 'zx', 'zj',
    'vq', 'vx', 'vz', 'vw',
    'wq', 'wx', 'wj', 'wv',
    'kq', 'kx', 'kz',
    'fq', 'fx', 'fz',
    'bq', 'bx', 'bz',
    'gq', 'gx', 'gz',
    'hq', 'hx', 'hz',
    'cq', 'cx',
    'dq', 'dx',
    'mq', 'mx',
    'nq', 'nx',
    'pq', 'px', 'pz',
    'sx',
    'tq', 'tx',
    'lq', 'lx',
    'rq', 'rx',
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
/** 算連續子音時額外把 w 當母音：威爾斯語的 w 是母音（Cwmbrân），否則會誤判。 */
const RUN_VOWELS = new Set([...VOWELS, 'w']);
/** 上限長度：拉丁轉寫地名（Stratford-upon-Avon）需要較寬；超過＝一整句話而非地名。 */
const MAX_PLACE_LEN = 24;
/** 中日韓地名極少超過 12 字（「北海道美瑛町」6 字）——超過就是在寫句子，不是在寫地名。 */
const MAX_CJK_LEN = 12;
/** 連續子音門檻：Szczecin（szcz＝4）必須通過，所以門檻設 5。 */
const CONSONANT_RUN_LIMIT = 5;
/** 中日韓字元（用來切換長度上限） */
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/u;

/** 是否為純拉丁字母串（子音／鍵盤／bigram 規則只對它適用；中日韓一律不套用）。 */
const isLatinWord = (s: string): boolean => /^[a-z]+$/.test(s);

/** 最長連續子音長度。 */
const maxConsonantRun = (s: string): number => {
    let run = 0, best = 0;
    for (const ch of s) {
        if (RUN_VOWELS.has(ch)) run = 0;
        else { run += 1; if (run > best) best = run; }
    }
    return best;
};

/** 是否含 4 鍵以上的鍵盤連打（正序或逆序，如 asdf、qwer、0987）。 */
const hasKeyboardRun = (s: string): boolean => {
    for (let i = 0; i + 4 <= s.length; i++) {
        const seg = s.slice(i, i + 4);
        const rev = seg.split('').reverse().join('');
        if (KEYBOARD_ROWS.some(row => row.includes(seg) || row.includes(rev))) return true;
    }
    return false;
};

/**
 * 本地判定：這串字是不是**明顯**亂打的。
 * - 'junk'：字形上確定不是地名 → 呼叫端不打 API、直接標未確認
 * - 'pass'：交給 LLM 判斷（**不代表**這是真地名）
 */
export const localPlaceVerdict = (raw: string): LocalVerdict => {
    const low = (raw || '').trim().toLowerCase();
    if (!low) return 'junk';

    // 先去掉地名裡合法的連接符號（New York、Stratford-upon-Avon、O'Fallon、St. Louis）
    const compact = low.replace(/[\s\-'’.·,]/g, '');
    if (compact.length < 2) return 'junk';                    // 一個字＝資訊量不足（與 API 的 <2 門檻同規）
    const cjkChars = [...compact].filter(c => CJK.test(c)).length;
    const limit = cjkChars > compact.length / 2 ? MAX_CJK_LEN : MAX_PLACE_LEN;   // 中日韓的地名短得多
    if (compact.length > limit) return 'junk';                // 整句話
    if (!/[\p{L}\p{N}]/u.test(compact)) return 'junk';        // 純標點符號
    if (/^\p{N}+$/u.test(compact)) return 'junk';             // 純數字
    if (EXACT_JUNK.has(compact)) return 'junk';               // 公認的測試字串（完全相符）
    if (/(.)\1{2,}/u.test(compact)) return 'junk';            // 同一字元連續 3 次（aaa、哈哈哈）

    if (isLatinWord(compact)) {
        if (hasKeyboardRun(compact)) return 'junk';                                       // asdfgh
        if (compact.length >= 4 && ![...compact].some(c => VOWELS.has(c))) return 'junk';  // 全無母音
        if (maxConsonantRun(compact) >= CONSONANT_RUN_LIMIT) return 'junk';               // 5 個子音連在一起
        if (/q[^uaeiou]/.test(compact)) return 'junk';                                    // q 後面不接母音（Qatar/Qingdao 皆通過）
        for (let i = 0; i + 2 <= compact.length; i++) {
            if (IMPOSSIBLE_BIGRAMS.has(compact.slice(i, i + 2))) return 'junk';            // 罕用子音相鄰
        }
    }

    return 'pass';
};

/** 便利判斷（可讀性用）。 */
export const isObviousJunk = (raw: string): boolean => localPlaceVerdict(raw) === 'junk';
