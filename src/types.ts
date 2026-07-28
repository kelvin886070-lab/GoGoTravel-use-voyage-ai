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
  
  image?: string;
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
  pace?: 'relaxed' | 'standard' | 'packed' | 'deep';
  vibe?: string;
  budgetLevel?: string;
  customBudget?: string;
  interests?: { tag: string; detail?: string }[];
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
  // 🎟️ 準備臉「就緒」＝使用者明確確認，不靠行程結構偵測（flight 連接活動是自動生成的，會假陽性）
  readiness?: { flight?: boolean; hotel?: boolean; docs?: boolean; pack?: boolean };
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
  hourly?: any[];
}

export interface VoltageInfo {
  country?: string;
  voltage: string;
  frequency: string;
  plugTypes: string[];
  description: string;
}