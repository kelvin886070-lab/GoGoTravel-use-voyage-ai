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

// 卡片版型定義
export type ActivityLayout = 'list' | 'polaroid';

// 活動類別定義
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
  expenseImage?: string; 
  imagePositionY?: number;
  items?: ExpenseItem[]; 
}

export interface TripDay {
  day: number;
  date?: string; 
  activities: Activity[];
}

// [New] 提醒事項介面 (用於行程 Header 的小鈴鐺功能)
export interface Reminder {
  id: string;
  text: string;
  time?: string; // 選填，例如 "14:00"
  isCompleted: boolean;
}

export interface Trip {
  id: string;
  destination: string;
  origin?: string; 
  focusArea?: string; 
  
  // 主要交通方式
  transportMode?: 'flight' | 'train' | 'time';

  // 當地交通方式
  localTransportMode?: 'public' | 'car' | 'taxi'; 
  
  // 行程規劃狀態 (配合設計思路 B 的邏輯預留)
  planningStatus?: 'draft' | 'booked' | 'ready';

  // [New] 提醒事項列表 (儲存使用者的待辦清單)
  reminders?: Reminder[];

  startDate: string;
  endDate: string;
  coverImage: string;
  days: TripDay[];
  isDeleted?: boolean;
  currency?: string; 
  members?: Member[];
  
  // 連結的憑證 ID 列表 (對應 VaultFile 的 id)
  linkedDocumentIds?: string[];
}

// ==========================================
// 4. 其他功能 (檢查表/保管箱/API)
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

// 升級版 VaultFile：整合了檔案屬性與業務屬性
export interface VaultFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other'; 
  size: string;
  date: string;
  parentId: string | null;
  data?: string; // Public URL
  file_path?: string; // Storage path
  isDeleted: boolean;
  isPinned: boolean;
  category?: 'passport' | 'hotel' | 'flight' | 'other'; 
  documentNumber?: string;
  notes?: string;
}

// [Deprecated] 舊的全域文件定義 
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