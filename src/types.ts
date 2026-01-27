// src/types.ts

// ==========================================
// 1. App 基礎設定
// ==========================================
export const AppView = {
  TRIPS: 'trips',
  EXPLORE: 'explore',
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

// 旅伴成員 (用於分帳)
export interface Member {
  id: string;
  name: string;
  avatar?: string;
  isHost?: boolean;
}

// ==========================================
// 3. 行程與活動 (核心結構)
// ==========================================

// [新增] 卡片版型定義
// list: 條列式 (一般行程預設)
// polaroid: 拍立得樣式 (快速記帳/強調回憶用)
export type ActivityLayout = 'list' | 'polaroid';

// [新增] 活動類別定義 (包含一般消費與系統功能)
export type ActivityType = 
  // 一般消費類
  | 'food' | 'shopping' | 'sightseeing' | 'hotel' | 'gift' | 'bar' | 'activity' 
  | 'tickets' | 'snacks' | 'health' | 'cafe' | 'relax' | 'culture' | 'other'
  // 記帳專用
  | 'expense' | 'commute'
  // 系統功能類
  | 'transport' | 'flight' | 'note' | 'process'
  // 容錯用 (避免舊資料報錯)
  | string;

// [新增] 交通模式定義
export type TransportMode = 'bus' | 'train' | 'subway' | 'walk' | 'taxi' | 'car' | 'tram' | 'flight';

// 交通詳細資訊
export interface TransportDetail {
  mode: TransportMode;
  duration: string;      
  fromStation?: string;  
  toStation?: string;    
  instruction?: string;  
}

// 記帳明細項目 (單一品項)
export interface ExpenseItem {
  id: string;
  name: string;       // 品項名稱
  amount: number;     // 金額
  assignedTo?: string[]; // 指定分攤成員 ID (空值代表全員平分)
}

// 行程活動單元
export interface Activity {
  id?: string;
  time: string;
  title: string;
  description: string;
  type: ActivityType; // 使用定義好的型別
  
  // [新增] 視覺呈現設定 (重要修改)
  layout?: ActivityLayout; 

  category?: string; 
  location?: string; 
  cost?: string | number; // 建議統一轉為 number，但保留 string 相容性
  
  // 交通資訊
  transportDetail?: TransportDetail; 

  // 記帳與分帳
  payer?: string;        // 付款人 Member ID
  splitWith?: string[];  // (舊版欄位，保留相容)
  expenseImage?: string; // Base64 圖片
  
  // 消費明細列表
  items?: ExpenseItem[]; 
}

export interface TripDay {
  day: number;
  date?: string; // 可選：具體日期
  activities: Activity[];
}

export interface Trip {
  id: string;
  destination: string;
  origin?: string; 
  
  focusArea?: string; 
  localTransportMode?: 'public' | 'car' | 'taxi'; 

  startDate: string;
  endDate: string;
  coverImage: string;
  days: TripDay[];
  isDeleted?: boolean;
  currency?: string; // e.g., 'JPY', 'TWD'

  // 成員名單
  members?: Member[]; 
}

// ==========================================
// 4. 其他功能 (檢查表/保管箱/API)
// ==========================================

// 檢查表
export type ChecklistCategory = 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: ChecklistCategory;
}

// 保管箱
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
}

// 小工具 API
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