// src/services/reconcile/reconcile.ts
// 🛡️ Phase 2：決定性對帳器（護城河）——純函式、無 LLM、無網路、零 token。
//
// 職責：把一天的活動「時間對帳」——讓 pinned 釘死錨（航班/check-in/訂位）當擋牆，
//   floating 活動沿時間軸往後級聯（骨牌），相鄰間隙壓到 buffer 下限；塞不下的（溢位）
//   移進「待安排」托盤（只搬不刪），並把無法自動解的衝突（兩個釘死錨互撞）回報給上層。
//
// 三個觸發點共用這一顆引擎：匯入訂位 / 改日期 / 旅途亂流。差別只在「誰呼叫、配什麼語氣」，
//   演算法本身完全一致、決定性、可單元測試。
//
// 鐵律：
//   1) 只搬、只標，永不刪 —— 溢位進 parked[]，呼叫端負責放進托盤，資料不蒸發。
//   2) pinned 不可位移（事實層）；floating 才會被推。
//   3) 溢位時先犧牲 nice、再考慮 must；must 被移出一律標記需關注。
//   4) buffer 用算的（不存）；pace 決定 buffer 下限。
import type { Activity, TripDay } from '../../types';
import { activityDuration, activityMovable, activityPriority } from '../../types';

// ── 衝突種類 ──────────────────────────────────────────────
export type ConflictKind =
  | 'anchor-collision'     // 兩個釘死錨自己重疊（訂位 vs 訂位／航班 vs 航班）→ 需使用者決定，不可自動解
  | 'parked-must'          // 塞不下、被移進待安排，但屬 must（門票/訂位級）→ 需關注
  | 'parked-nice'          // 塞不下、被移進待安排，屬 nice → 資訊性
  | 'booking-out-of-range'; // 訂位日期落在行程範圍外（如 11 月機票 vs 1 月行程）→ 不投影錨，提示對日期

export interface Conflict {
  kind: ConflictKind;
  activityId?: string;
  title: string;
  message: string;   // 繁體中文、冷靜陳述事實（不喊口號、不用「！」）
}

export interface ReconcileOptions {
  bufferMin?: number;     // 相鄰活動最小間隙（分鐘）；預設 30，建議由 pace 帶入（paceBuffer）
  dayStartMin?: number;   // 一天可用起點（分鐘）；預設 08:00
  dayEndMin?: number;     // 一天可用終點（分鐘）；預設 22:00
}

export interface DayReconcileResult {
  day: TripDay;           // 重排後（時間已順、溢位已移出，維持原順序再依時間排序）
  parked: Activity[];     // 溢位 → 待安排托盤（只搬不刪）
  conflicts: Conflict[];
}

// ── 常數與小工具（全部純函式）────────────────────────────────
const DAY_START = 8 * 60;    // 08:00
// point 2：不硬限「一天卡片數」。放到凌晨 03:00 才算跨出邊界——讓夜貓子/酒吧行程玩到凌晨，
//   真正 gate 溢位的是釘死錨（離開航班），不是這個 soft cap。過午夜的活動由 UI 掛小月亮提示。
const DAY_END = 27 * 60;     // 27:00（隔日 03:00）

export const PACE_BUFFER_MIN: Record<string, number> = {
  relaxed: 45, standard: 30, packed: 15, deep: 60,
};
export const paceBuffer = (pace?: string): number => PACE_BUFFER_MIN[pace ?? 'standard'] ?? 30;

// "HH:MM" → 分鐘（容忍跨日 25:30 之類）；解不出回 null。
export const timeToMin = (t?: string | null): number | null => {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (mm > 59) return null;
  return h * 60 + mm;
};
export const minToTime = (n: number): string => {
  const v = Math.max(0, Math.round(n));
  const h = Math.floor(v / 60), m = v % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// 一個活動是否為「有效的釘死擋牆」：pinned 且時間解得出。
const isWall = (a: Activity): boolean => activityMovable(a) === 'pinned' && timeToMin(a.time) !== null;

// 溢位時挑犧牲者：優先最後一個 nice；若無 nice 則最後一個（must）。回傳 index。
// 系統連接/處理卡（移動、航班、備註、入境流程）不是可獨立安排的「站」——永不 park。
const SYSTEM_TYPES = new Set(['transport', 'flight', 'note', 'process']);
const isSystemCard = (a: Activity): boolean => SYSTEM_TYPES.has((a.type || '').toLowerCase());

// 溢位挑犧牲者：只在「真景點」中挑（連接卡不進待安排）；先犧牲最後一個 nice，無 nice 則最後一個 must。
// 回傳 floats 內的 index；沒有可犧牲的真景點 → -1。
function pickVictim(floats: Activity[]): number {
  let lastNice = -1, lastReal = -1;
  for (let i = 0; i < floats.length; i++) {
    if (isSystemCard(floats[i])) continue;   // 連接卡跳過
    lastReal = i;
    if (activityPriority(floats[i]) === 'nice') lastNice = i;
  }
  return lastNice >= 0 ? lastNice : lastReal;
}

interface Segment { start: number; end: number; floats: Activity[]; }

/**
 * 對帳單一天。純函式：不改動傳入的 day / activities（回傳新物件）。
 */
export function reconcileDay(day: TripDay, opts: ReconcileOptions = {}): DayReconcileResult {
  const winStart = opts.dayStartMin ?? DAY_START;
  const winEnd = opts.dayEndMin ?? DAY_END;
  const buffer = opts.bufferMin ?? 30;

  const src = (day.activities ?? []).map(a => ({ ...a }));   // 淺拷貝，避免變更輸入
  const conflicts: Conflict[] = [];
  const parked: Activity[] = [];

  // 1) 切段：以 pinned 擋牆把一天分成數個「自由區段」，floating 依陣列順序歸入所屬區段。
  const segments: Segment[] = [];
  const walls: Activity[] = [];
  let cur: Segment = { start: winStart, end: winEnd, floats: [] };

  for (const a of src) {
    if (isWall(a)) {
      const wStart = timeToMin(a.time)!;
      const wEnd = wStart + activityDuration(a);
      // 收掉目前區段（其 end = 這道牆的開始）
      cur.end = wStart;
      segments.push(cur);
      walls.push(a);
      // 下一區段從牆的結束開始
      cur = { start: wEnd, end: winEnd, floats: [] };
    } else {
      cur.floats.push(a);
    }
  }
  segments.push(cur);

  // 2) 釘死錨互撞偵測（訂位 vs 訂位）：相鄰兩道牆若後者開始早於前者結束 → 不可自動解，回報。
  for (let i = 1; i < walls.length; i++) {
    const prevEnd = timeToMin(walls[i - 1].time)! + activityDuration(walls[i - 1]);
    const thisStart = timeToMin(walls[i].time)!;
    if (thisStart < prevEnd) {
      conflicts.push({
        kind: 'anchor-collision',
        activityId: walls[i].id,
        title: walls[i].title,
        message: `「${walls[i - 1].title}」與「${walls[i].title}」的時間互相重疊，這兩筆都是釘死的行程，需要你決定怎麼調整。`,
      });
    }
  }

  // 3) 逐區段安置 floating：先依容量決定要不要移出溢位（先犧牲 nice），再沿時間軸鋪排。
  for (const seg of segments) {
    const capacity = seg.end - seg.start;
    const floats = seg.floats;

    // 🛣️ C：連接卡（系統卡）不吃 pace buffer——它本身就是移動時間；buffer 只在「真站之後」加一次，
    //   避免「移動時間 ＋ 前後緩衝」重複灌水（例：移動 11 分不該再前後各加 30 分）。
    const bufferAfter = (f: Activity) => (isSystemCard(f) ? 0 : buffer);
    // 3a) 容量不足 → 反覆挑犧牲者移進 parked，直到裝得下或清空。
    const needed = () => floats.reduce((sum, f, i) => sum + activityDuration(f) + (i < floats.length - 1 ? bufferAfter(f) : 0), 0);
    while (floats.length > 0 && needed() > capacity) {
      const vi = pickVictim(floats);
      if (vi < 0) break;   // 只剩連接卡、無真景點可犧牲 → 停手（連接卡讓它流動、不 park）
      const victim = floats.splice(vi, 1)[0];
      parked.push(victim);
      const nice = activityPriority(victim) === 'nice';
      conflicts.push({
        kind: nice ? 'parked-nice' : 'parked-must',
        activityId: victim.id,
        title: victim.title,
        message: nice
          ? `這天排不下「${victim.title}」，先幫你收進待安排，之後找空檔或挪到別天。`
          : `「${victim.title}」是不能錯過的行程，但這天排不下了，先收進待安排，建議挪到別天。`,
      });
    }

    // 3b) 鋪排：start = max(區段游標, 原訂時間下限)，只往後推、不無故提前。
    let cursor = seg.start;
    for (const f of floats) {
      const dur = activityDuration(f);
      const orig = timeToMin(f.time);
      let start = Math.max(cursor, orig ?? cursor);
      if (start + dur > seg.end && !isSystemCard(f)) {
        // 因原訂時間造成的殘餘溢位（含間隙）→ 一樣只搬不刪。連接卡不 park（照樣鋪、讓它流動）。
        parked.push(f);
        const nice = activityPriority(f) === 'nice';
        conflicts.push({
          kind: nice ? 'parked-nice' : 'parked-must',
          activityId: f.id,
          title: f.title,
          message: nice
            ? `這天排不下「${f.title}」，先幫你收進待安排，之後找空檔或挪到別天。`
            : `「${f.title}」是不能錯過的行程，但這天排不下了，先收進待安排，建議挪到別天。`,
        });
        continue;
      }
      f.time = minToTime(start);
      cursor = start + dur + bufferAfter(f);
    }
  }

  // 4) 組回這天：src / walls / seg.floats / parked 共享同一批拷貝參考，故用參考比對移除 parked。
  //    留下的活動（牆 + 已鋪排 float）依時間排序輸出。
  const parkedSet = new Set(parked);
  const keptSorted = src
    .filter(a => !parkedSet.has(a))
    .sort((x, y) => (timeToMin(x.time) ?? 0) - (timeToMin(y.time) ?? 0));

  return {
    day: { ...day, activities: keptSorted },
    parked,
    conflicts,
  };
}

/**
 * 對帳整趟。以 pace 決定 buffer 下限，逐天跑 reconcileDay。
 * parked 目前彙整回傳，交由上層（Phase 4）決定「主動建議挪到哪天」或放進托盤。
 */
export function reconcileTrip(
  trip: { days: TripDay[]; pace?: string },
  opts: ReconcileOptions = {},
): { days: TripDay[]; parked: Activity[]; conflicts: Conflict[] } {
  const buffer = opts.bufferMin ?? paceBuffer(trip.pace);
  const days: TripDay[] = [];
  const parked: Activity[] = [];
  const conflicts: Conflict[] = [];
  for (const d of trip.days ?? []) {
    const r = reconcileDay(d, { ...opts, bufferMin: buffer });
    days.push(r.day);
    parked.push(...r.parked);
    conflicts.push(...r.conflicts);
  }
  return { days, parked, conflicts };
}

// ── 偵測模式（手動編輯用）─────────────────────────────────────
// 跑 reconcileDay 但「不套用」重排/park，只回報「誰塞不下／撞牆」。純函式、不改輸入。
// 用途：手動編輯（拖/加/刪）後，在那張卡旁顯示警示＋一鍵「收進待安排」（使用者按了才真的搬；
//   自動 park 只留給匯入/改日期那種系統級變動）。對齊「訂位＞使用者＞生成」：手動最該被尊重。
export interface DayIssue {
  activityId?: string;
  title: string;
  kind: ConflictKind;
  message: string;   // 警示語氣（不說「已收進」，因為此模式不動東西）
}
export interface DayDetectResult {
  overflowIds: string[];   // 會塞不下的活動 id（可一鍵收進待安排）
  issues: DayIssue[];
  hasIssues: boolean;
}
export function detectDayIssues(day: TripDay, opts: ReconcileOptions = {}): DayDetectResult {
  const r = reconcileDay(day, opts);   // 純函式、不改 day
  const overflowIds: string[] = [];
  const issues: DayIssue[] = [];
  for (const p of r.parked) {
    if (p.id) overflowIds.push(p.id);
    issues.push({
      activityId: p.id,
      title: p.title,
      kind: activityPriority(p) === 'nice' ? 'parked-nice' : 'parked-must',
      message: `這天可能排不下「${p.title}」`,
    });
  }
  for (const c of r.conflicts) {
    if (c.kind === 'anchor-collision') {
      issues.push({ activityId: c.activityId, title: c.title, kind: c.kind, message: c.message });
    }
  }
  return { overflowIds, issues, hasIssues: issues.length > 0 };
}
