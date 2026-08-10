// src/types.ts

// ==========================================
// 1. App 基礎設定
// ==========================================
export const AppView = {
  TRIPS: 'trips',
  EXPLORE: 'explore',
  WISHBOX: 'wishbox',
  TOOLS: 'tools',
  VAULT: 'vault',
  PROFILE: 'profile',   // 🛂 個人檔案（護照）分頁
  LOGIN: 'login'
} as const;
export type AppView = typeof AppView[keyof typeof AppView];

export const ToolType = {
  TRANSLATE: 'translate',
  CURRENCY: 'currency',
  LOCAL_TRANSPORT: 'transport',
  EMERGENCY: 'emergency',
  UNIT_CONVERT: 'unit_convert',
  VOLTAGE: 'voltage',
  BACKGROUND: 'background',
  PACKING_LIST: 'packing_list'
} as const;
export type ToolType = typeof ToolType[keyof typeof ToolType];

// ==========================================
// 2. 使用者與成員
// ==========================================
export interface User {
  id: string;
  name: string;
  joinedDate: string;
  avatar: string;
  email?: string;
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  isHost?: boolean;
}

// ==========================================
// 3. 行程與活動 (核心結構)
// ==========================================
export type ActivityLayout = 'list' | 'polaroid';

export type ActivityType = 
  | 'food' | 'shopping' | 'sightseeing' | 'hotel' | 'gift' | 'bar' | 'activity' 
  | 'tickets' | 'snacks' | 'health' | 'cafe' | 'relax' | 'culture' | 'other'
  | 'expense' | 'commute'
  | 'transport' | 'flight' | 'note' | 'process'
  | string;

export type TransportMode = 'bus' | 'train' | 'subway' | 'walk' | 'taxi' | 'car' | 'tram' | 'flight';

export interface TransportDetail {
  mode: TransportMode;
  duration: string;      
  fromStation?: string;  
  toStation?: string;    
  instruction?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;       
  amount: number;     
  assignedTo?: string[]; 
}

export interface Activity {
  id?: string;
  time: string;
  title: string;
  description: string;
  type: ActivityType; 
  layout?: ActivityLayout; 
  category?: string; 
  location?: string; 
  cost?: string | number; 
  transportDetail?: TransportDetail;
  payer?: string;        
  splitWith?: string[];  
  expenseImage?: string;         // 顯示用：載入時填 signed URL；舊資料為 base64
  expenseImagePath?: string;     // 🖼️ 2.2b durable：Storage 路徑（DB 真正保存的來源）
  imagePositionY?: number;
  items?: ExpenseItem[]; 
  
  image?: string;                // 顯示用：活動縮圖（載入時填 signed URL；舊資料為 base64/http）
  imagePath?: string;            // 🐘 瘦身①b：活動縮圖的 Storage 路徑（DB 真正保存的來源；與 expenseImagePath 同制）
  wishItemId?: string;

  // 🗺️ Phase D：geocoding 後填入的座標（供地圖使用；沒有座標的活動地圖略過）
  lat?: number;
  lng?: number;
  placeId?: string;

  // 🧬 Phase 0：三層對帳與骨牌重排的最小結構（皆選填，舊資料自動合法）。
  //    預設政策一律收斂在下方 helper（activitySource / activityPriority / activityDuration / activityMovable），
  //    政策單點可改，不散落各處。
  source?: ActivitySource;   // 血統：precedence 靠它（缺值＝視為 'user'，保守保護既有心血）
  bookingId?: string;        // source==='booking' 時釘回 bookings 表那筆（單向投影來源）
  durationMin?: number;      // 預估時長（分鐘）；未填由 type 給預設。⚠️ buffer 不存＝相鄰活動間隙算出來的
  movable?: 'pinned' | 'floating';  // pinned=釘死(航班/check-in/訂位)不可位移；floating=可被骨牌往後推
  priority?: 'must' | 'nice';       // must=不可犧牲(訂位/門票)；nice=溢位時可退「待安排」托盤
}

// 🧬 Phase 0：活動血統。訂位(事實) ＞ 使用者編輯 ＞ 生成(猜測)。
export type ActivitySource = 'booking' | 'generated' | 'user';

// type→預設時長（分鐘）。transport/flight/note 這類「點或間隙」給 0，時長不由活動本身表達。
const DEFAULT_DURATION_MIN: Record<string, number> = {
  food: 90, cafe: 45, shopping: 90, sightseeing: 120, bar: 120, culture: 120,
  relax: 90, activity: 120, tickets: 60, snacks: 30, gift: 30, health: 30,
  hotel: 0, flight: 0, transport: 0, commute: 0, note: 0, process: 0, expense: 0,
};

// 缺值＝'user'：舊資料一律當使用者的、不給 LLM 自動重排（保護既有心血）。
export const activitySource = (a: Activity): ActivitySource => a.source ?? 'user';

// 缺值依血統分流：user/booking→must（不可拋棄）、generated→nice（溢位可退托盤）。
export const activityPriority = (a: Activity): 'must' | 'nice' =>
  a.priority ?? (activitySource(a) === 'generated' ? 'nice' : 'must');

// 缺值查 type 預設表，再退 90 分。
export const activityDuration = (a: Activity): number =>
  a.durationMin ?? DEFAULT_DURATION_MIN[a.type as string] ?? 90;

// 缺值：flight/hotel 天生釘死，其餘漂浮（transport 是間隙、由對帳器重算）。
export const activityMovable = (a: Activity): 'pinned' | 'floating' =>
  a.movable ?? (a.type === 'flight' || a.type === 'hotel' ? 'pinned' : 'floating');

export interface TripDay {
  day: number;
  date?: string;
  vibeTag?: string;
  city?: string;          // 🧭 空間類·第一刀：這天基地在哪個城市（多城市時由生成分配，連續、少換城）。地點把關用它比對。
  cityEn?: string;        // 🖼️ 封面B：該城市英文名（生成時 LLM 順帶輸出；封面抓圖查詢用，舊資料退回 cityEn 對照表）
  activities: Activity[];
}

export interface Reminder {
  id: string;
  text: string;
  time?: string;
  isCompleted: boolean;
}

// ==========================================
// 3b. TripConstraints — 常駐的「約束模型」（Phase 0）
//   表單不再把輸入壓成 prose 生成一次即丟，而是填這個結構化、存 trip 上、可再讀可再編的物件。
//   生成／把關／對帳全部改讀它；拼 prompt 的工作下沉到生成層由結構化約束現拼。
//   硬約束（booking／確切航班）與軟偏好（步調／興趣）分槽；
//   hard.confidence==='confirmed' 存在時 UI 完全無視 hint（hint 只是沒 booking 時的備胎）。
// ==========================================

// 硬約束：事實(booking)或使用者明確指定；決定性、LLM 不可亂動。
export interface HardAnchors {
  // confidence='confirmed' → value 是真時間 '2027-01-09 12:30'（來自 booking）
  // confidence='hint'      → value 是時段 'morning' | 'afternoon' | 'evening'（使用者給的大概）
  arrival?:   { confidence: 'confirmed' | 'hint'; value: string; bookingId?: string };
  departure?: { confidence: 'confirmed' | 'hint'; value: string; bookingId?: string };
  // 未來擴充：飯店每晚基地、門票釘死點……
}

// 軟偏好：LLM 可自由發揮的部分。
export interface SoftPreferences {
  companion?: string;
  /** 完整的同行者清單（⑥想怎麼玩頁的複選；`companion` 只是給舊 UI 顯示的代表值）。
   *  ⚠️ 進 prompt 時以這個為準——「長輩＋孩子」和「長輩」是兩件不同的事，壓成單值就資訊死亡。 */
  companions?: string[];
  pace?: 'relaxed' | 'standard' | 'packed' | 'deep';
  vibe?: string;
  budgetLevel?: string;
  customBudget?: string;
  /** 使用者**親手輸入**的每人每天上限（餐飲／當地交通／門票，**不含機票住宿**）。
   *  ⚠️ 語意是**上限**不是目標——寫成目標，LLM 會為了湊到那個數字硬塞景點。
   *     這是唯一會進 prompt 的金額；我們自己估的三級錨點永遠不進（見 §1 原則 14）。 */
  budgetCap?: number;
  interests?: { tag: string; detail?: string }[];
  /** ⑦ 紅筆劃除的標籤＝**負面約束**。
   *  ⚠️ 這是 prompt 裡**執行力最高的材料**——「不要什麼」比「想要什麼」明確得多，
   *     模型幾乎不會違反。所以它必須獨立成欄，不可以混進 specificRequests 的自由文字裡。 */
  tagsAvoided?: string[];
  specificRequests?: string;
  localTransportMode?: 'public' | 'car' | 'taxi';
}

// 結構化多城市，取代 destinations.join('+')。日期用相對天數（非絕對日期），呼應「活動掛 Day N」原則。
export interface TripLeg {
  city: string;
  startDay: number;
  endDay: number;
}

export interface TripConstraints {
  tripType?: 'international' | 'domestic';
  origin?: string;
  legs: TripLeg[];          // 硬門檻：至少一段（有目的地才生成）
  hard: HardAnchors;        // 硬約束（事實層）
  soft: SoftPreferences;    // 軟偏好（LLM 發揮）
  currency?: string;
}

export interface Trip {
  id: string;
  destination: string;
  origin?: string; 
  focusArea?: string;
  transportMode?: 'flight' | 'train' | 'time';
  localTransportMode?: 'public' | 'car' | 'taxi';
  pace?: 'relaxed' | 'standard' | 'packed' | 'deep';   // 🧱 C1-3 步調（影響每日容量與停留時間）
  // 🧬 Phase 0：常駐約束模型（生成/把關/對帳共讀）。先與下方扁平欄位(pace/currency/…)並存為 legacy 鏡像，Phase 1/3 再逐步收斂。
  constraints?: TripConstraints;
  planningStatus?: 'draft' | 'booked' | 'ready';
  finalizedAt?: string;          // 🎟️ 規劃「定案」時間戳（ISO）；有值＝已定案（可撤章＝清空）。與 planningStatus='ready' 並存為就緒判定來源。
  // 🎟️ 準備臉「就緒」＝使用者明確確認，不靠行程結構偵測（flight 連接活動是自動生成的，會假陽性）
  readiness?: { flight?: boolean; hotel?: boolean; docs?: boolean; pack?: boolean; hasBooking?: boolean };   // hasBooking＝有任一訂位（規劃自動排定用）
  reminders?: Reminder[];
  startDate: string;
  endDate: string;
  coverImage: string;            // 顯示用：載入時填入 signed URL；舊資料為 base64/http
  coverImagePath?: string;       // 🖼️ 2.2 durable：Storage 路徑（DB 真正保存的來源）
  coverImagePositionY?: number;
  days: TripDay[];
  parked?: Activity[];           // 🎟️ Phase 4a：待安排托盤——對帳溢位的活動（只搬不刪，規劃臉常駐膠囊撈回）
  isDeleted?: boolean;
  currency?: string; 
  members?: Member[];
  linkedDocumentIds?: string[];
  todos?: TripTodoItem[];        // 🧱 3.2 行前待辦（原本以 (trip as any).todos 存取，改為正式欄位）

  stagedWishes?: WishItem[];
  memoryNote?: string;           // 🛂 批⑤b 旅程手記：回憶頁上寫給自己的一段話（隨 trip_data 持久化；未來餵旅風 v2/生成個人化）
  memoryPhotoPaths?: string[];   // 🛂 批⑤c 回憶照片：Storage 路徑（trip-media 私有桶；DB 真正保存的來源）
  memoryPhotos?: string[];       // 顯示用：載入時換成 signed URL（不持久化，serializeTripForDb 會清空）
  memoryPhotoThumbs?: string[];  // 顯示用：縮圖 signed URL（縮圖層；與 memoryPhotos 同長同序，缺縮圖＝同大圖 URL；不持久化）
  coverImageThumb?: string;      // 顯示用：封面縮圖 signed URL（封面縮圖小批；舊封面無影子檔＝undefined 退回大圖；不持久化）
  brief?: TripBrief;             // 🎫 旅程券：生成表單的答案（隨 trip_data 持久化；規劃臉可開可改，改了問要不要重排）
}

// 🎫 旅程券／TripBrief（生成表單重設計・資料層；docs E3 定案）
//   本質：使用者在六頁表單裡「說過的每一句話」的持久化形態——生成後**跟著行程走**，
//   規劃臉可隨時打開看「當初我選了什麼」、就地改（改了問要不要重排）。
//   同時是 **prompt 的 payload**：圈＝必含、劃除＝負面約束、度量衡數字＝硬約束、
//   心願盒收藏＝few-shot 範例、講究欄＝自由約束。
//   儲存：住在 trip_data（Trip.brief），**不動 DB schema**。
export type PaceLevel = 'relaxed' | 'standard' | 'packed' | 'deep';
export type VibeLevel = 'classic' | 'balanced' | 'culture' | 'hidden';
export type BudgetLevel = 'economy' | 'standard' | 'luxury';
export type LocalTransport = 'public' | 'car' | 'charter';
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'unset';   // unset＝「還沒訂」（預設值，零操作可過）
/** 重新安排的方向（速覽階段只給看得出來的四種；「換一批景點」＝盲換已刪） */
export type RearrangeMood = 'lighter' | 'tighter' | 'less-transit' | 'easy-first-day';

export interface TripBrief {
  version: 1;
  // ── 去哪（入口＋縮圈） ──
  destinations: string[];        // 使用者輸入/選定的地點（城市或國家）
  zones?: string[];              // 縮圈選的地帶（「關西 · 大阪＋京都」等；國家/區域級輸入才有）
  isDomestic: boolean;           // 由「目的地國家 === 居住國」推斷；表單永不提問
  // ── 什麼時候 ──
  datesUndecided: boolean;       // true＝只有月份/天數，無確切日期
  month?: number;                // 1–12（模糊層；跨年由 year 表達）
  year?: number;                 // 月份所屬年份（早於當前月＝自動進位次年）
  startDate?: string;            // YYYY-MM-DD（精確層）
  endDate?: string;
  daysCount: number;             // 天數（縮圈反哺預設；與日期雙向同步）
  arrivalSlot: TimeSlot;         // 第一天抵達（預設 unset）
  departureSlot: TimeSlot;       // 最後一天離開（預設 unset）
  // ── 想怎麼玩 ──
  companions: string[];          // 複選（獨旅/兩人/家人/長輩/寵物/同事/同學…）
  pace: PaceLevel;               // 度量衡：relaxed 2–3 站、standard 4–5、packed 6+、deep 站少待久
  vibe: VibeLevel;
  budgetLevel: BudgetLevel;
  /** 使用者親手輸入的每人每天上限（見 SoftPreferences.budgetCap；沒填＝undefined） */
  budgetCap?: number;
  currency: string;              // 由目的地推斷、可點改（旁註）
  localTransport: LocalTransport;
  // ── 你的講究 ──
  tagsWanted: string[];          // 圈起來＝必含
  tagsAvoided: string[];         // 劃掉＝負面約束（prompt 執行力最高的材料）
  notes: string;                 // 手打欄原文（永久保留）
  notesRefined?: string;         // 「整理一下」後的版本（使用者按「用這個」才生效；原文永遠可還原）
  // ── 產出後的歷程 ──
  createdAt: string;
  updatedAt: string;
  regenerations?: number;        // 整趟重排次數（第三次提示「進去手動調整可能更快」）
  lastMoods?: RearrangeMood[];   // 最近一次重排的方向（餵旅風學習）
}

// 🐘 垃圾桶輕量投影（lazy-load，Kelvin 定案；HAR 背書：垃圾桶佔冷啟 99% 重量）：
//   冷啟不抓已刪行程全量，保管箱列表只需這份「資料合約」——未來保管箱視覺重設計在此之上畫皮。
//   復原/永久刪除時才抓該趟全量（services/trashTrips.ts）。
export interface TrashSummary {
  id: string;
  destination: string;
  daysCount: number;        // 軟刪時由 days.length 記下；冷啟投影由起訖日推得（皆缺＝0，UI 不顯示天數）
  coverThumb?: string;      // 封面小圖（影子縮圖 signed URL / Pexels 小圖）；缺＝灰底
}

// 🧱 3.2 行前待辦清單項目（原本重複定義於 ItineraryView / TripRemindersModal，統一收斂於此）
export interface TripTodoItem {
  id: string;
  text: string;
  isCompleted: boolean;
  time?: string;
  date?: string;
  category?: 'tasks' | 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';
}

// ==========================================
// 4. 心願盒 (Wish Box) 資料結構
// ==========================================
export type WishItemType = 'place' | 'item' | 'link';

export interface WishItem {
  id: string;
  type: WishItemType;
  country: string;      // 國家（台灣/日本）
  city?: string;        // 🧱 C1-1 城市（台南/東京）
  title: string;
  area?: string;        // 分區（東區/澀谷區）
  url?: string;
  notes?: string;
  customImage?: string;       // 顯示用：載入時填 signed URL；舊資料為 base64
  customImagePath?: string;   // 🧱 C5 durable：Storage 路徑（DB 真正保存的來源）
  budget?: number;
  currency?: string;
  tags?: string[];
  createdAt: string;

  // 🧱 Phase C0：地理座標（存檔時 geocode 補上），供地圖圖釘與鄰近雷達使用
  lat?: number;
  lng?: number;
  placeId?: string;
  needsLocationConfirm?: boolean;   // 🧭 T1：座標來自弱信心來源，待使用者在地圖上確認（T3 用）
  isFavorite?: boolean;   // 🧱 C1-1 我的最愛（星星，置頂）
  preferredSlot?: 'morning' | 'afternoon' | 'evening';   // 🧱 C1-3 希望時段（選填，一鍵順路優先尊重）

  // 🛡️ 9.3 新增：行程內購物清單的獨立狀態追蹤
  isPurchased?: boolean;   // 標記是否已純勾選購買 (觸發金流移轉與刪除線)
  assignedDay?: number;    // 標記被排入至哪一天 (觸發下沉至影子區域)

  // 🛍️ 購物店家中心：對象（代購/自己）與數量
  forWhom?: string;        // 代購對象；空＝自己
  quantity?: number;       // 數量（預設 1）
  actualPrice?: number;    // 🧾 買到後的實付單價（結算用；未填則退回 budget 估價）
  isSettled?: boolean;     // 🧾 該代購項是否已結清
  tripId?: string;         // 🧾 這筆代購屬於哪一趟（選填；結算依行程分組，未綁退回國家+建立日）
  stopId?: string;         // 🛍️ 「在這裡要買」：釘到行程中的哪個 activity（activity.id）；空＝未綁任何站
  usedInTrips?: string[];  // 🧭 軟已訪連結：這個心願被拉進過哪些行程（餵學習、避免重複推薦；夢想不刪、可再訪）
  listId?: string;         // 📚 相簿：這個地點歸屬哪一本清單（空＝未分類）；一 wish 一主清單（v1 一對多）
  rating?: number;         // 🌟 D2② Google 平均評分（0–5）；存進心願盒時查一次 Details 存下
  ratingCount?: number;    // 🌟 D2② 評分人數（userRatingCount）
}

// 📚 相簿/清單（使用者自訂的板；最愛用 isFavorite 獨立、不佔 listId）
export interface WishList {
  id: string;
  name: string;
  coverImage?: string;       // 顯示用：signed URL（自訂封面才有；沒有時 UI 用相簿內地點照片拼貼）
  coverImagePath?: string;   // Storage 路徑（DB 真正保存）
  position: number;          // 手動排序（編輯模式拖曳寫入；預設 0）
  pinned: boolean;           // 釘選置頂
  createdAt: string;
}

// ==========================================
// 5. 其他功能 (檢查表/保管箱/API)
// ==========================================
export type ChecklistCategory = 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: ChecklistCategory;
}

export interface VaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  isPinned: boolean;
  isDeleted: boolean;
}

export interface VaultFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other'; 
  size: string;
  date: string;
  parentId: string | null;
  data?: string; 
  file_path?: string; 
  isDeleted: boolean;
  isPinned: boolean;
  category?: 'passport' | 'hotel' | 'flight' | 'other'; 
  documentNumber?: string;
  notes?: string;
}

export interface Document {
    id: string;
    title: string;
    type: 'passport' | 'hotel' | 'flight' | 'other';
    fileUrl?: string; 
    createdAt: string;
    isOffline?: boolean;
    documentNumber?: string; 
    notes?: string;          
}

export interface WeatherInfo {
  location: string;
  temperature: string;
  condition: string;
  humidity: string;
  wind: string;
  description?: string;
  clothingSuggestion?: string;
  activityTip?: string;
  sunrise?: string;
  sunset?: string;
  uvIndex?: string;
  hourly?: unknown[];   // 僅 gemini.ts 塞空陣列、無人讀取欄位內容 → unknown 即可（lint 舊債順手清）
}

export interface VoltageInfo {
  country?: string;
  voltage: string;
  frequency: string;
  plugTypes: string[];
  description: string;
}