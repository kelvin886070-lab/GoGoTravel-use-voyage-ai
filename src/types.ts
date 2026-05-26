// src/types.ts

// ==========================================
// 1. App 基礎設定
// ==========================================
export const AppView = {
  TRIPS: 'trips',
  EXPLORE: 'explore',
  WISHBOX: 'wishbox', // 第五分頁：心願盒
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
  expenseImage?: string;       // 用於實體記帳收據
  imagePositionY?: number;
  items?: ExpenseItem[]; 
  
  // 🛡️ 9.2 新增：心願盒高階視覺與溯源擴充
  image?: string;              // 景點/活動的精美形象圖 (與記帳的 expenseImage 徹底區隔)
  wishItemId?: string;         // 記錄此活動是否由心願盒轉換而來 (溯源 ID)
}

export interface TripDay {
  day: number;
  date?: string;
  vibeTag?: string;
  activities: Activity[];
}

export interface Reminder {
  id: string;
  text: string;
  time?: string;
  isCompleted: boolean;
}

export interface Trip {
  id: string;
  destination: string;
  origin?: string; 
  focusArea?: string;
  transportMode?: 'flight' | 'train' | 'time';
  localTransportMode?: 'public' | 'car' | 'taxi';
  planningStatus?: 'draft' | 'booked' | 'ready';
  reminders?: Reminder[];
  startDate: string;
  endDate: string;
  coverImage: string;
  coverImagePositionY?: number; 
  days: TripDay[];
  isDeleted?: boolean;
  currency?: string; 
  members?: Member[];
  linkedDocumentIds?: string[];
  
  // 🛡️ 9.2 新增：專屬靈感暫存區，存放從心願盒被「推入 (Push)」等待排程的心願項目
  stagedWishes?: WishItem[]; 
}

// ==========================================
// 4. 心願盒 (Wish Box) 資料結構
// ==========================================
export type WishItemType = 'place' | 'item';

export interface WishItem {
  id: string;
  type: WishItemType;      // 地點 或 物品
  country: string;         // 國家 (用於第一層便當盒分類)
  title: string;           // 名稱
  location?: string;       // 🛡️ 9.2 新增：精確地點 (地址或地標)，以利未來無損轉換為 Activity.location
  area?: string;           // 手動分區 (例如：中西區、澀谷區，用於驅動濾鏡)
  url?: string;            // Google Map 或 IG 連結
  notes?: string;          // 備註 (漸進式展開)
  customImage?: string;    // 自訂圖片 Base64 (優雅降級防破圖)
  budget?: number;         // 預算 (購物專用)
  currency?: string;       // 幣別 (購物專用)
  tags?: string[];         // 風格標籤 (例如：#藥妝、#精品)
  createdAt: string;       // 加入時間 (用於排序)
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