// src/types.ts

// 1. App 視圖切換
export const AppView = {
  TRIPS: 'trips',
  EXPLORE: 'explore',
  TOOLS: 'tools',
  VAULT: 'vault',
  LOGIN: 'login'
} as const;
export type AppView = typeof AppView[keyof typeof AppView];

// 2. 小工具類型
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

// 3. 使用者定義 (登入者本人)
export interface User {
  id: string;
  name: string;
  joinedDate: string;
  avatar: string;
  email?: string;
}

// 3.5 旅伴成員定義 (用於分帳)
export interface Member {
  id: string;
  name: string;
  avatar?: string; // 預留給未來大頭貼功能
  isHost?: boolean; // 是否為行程建立者
}

// [新增] 3.6 記帳明細項目 (用於單一品項指定)
export interface ExpenseItem {
  id: string;
  name: string;       // 品項名稱 (如: 牛肉麵)
  amount: number;     // 單項金額
  assignedTo?: string[]; // 指定分攤的人 (Member ID 列表)。若為空，則視為「公費/平分」
}

// 4. 交通詳細資訊
export interface TransportDetail {
  mode: 'bus' | 'train' | 'subway' | 'walk' | 'taxi' | 'car' | 'tram' | 'flight';
  duration: string;      
  fromStation?: string;  
  toStation?: string;    
  instruction?: string;  
}

// 5. 行程細節相關
export interface Activity {
  id?: string;
  time: string;
  title: string;
  description: string;
  type: 'sightseeing' | 'food' | 'transport' | 'flight' | 'hotel' | 'cafe' | 'shopping' | 'relax' | 'bar' | 'culture' | 'activity' | 'note' | 'expense' | 'process' | 'other' | string;
  category?: string; 
  location?: string; 
  cost?: string | number;
  
  // 交通詳細資訊
  transportDetail?: TransportDetail; 

  // 記帳相關欄位
  payer?: string;        // 先墊錢的人 (Member ID)
  splitWith?: string[];  // 預設分攤者 (Member ID 列表)，若明細沒有指定人，就用這個設定
  expenseImage?: string; // 拍立得照片/收據圖片 (Base64)
  
  // [新增] 消費明細列表 (AI 辨識或手動輸入)
  items?: ExpenseItem[]; 
}

export interface TripDay {
  day: number;
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
  currency?: string; 

  // 行程成員名單
  members?: Member[]; 
}

// 6. 檢查表相關
export type ChecklistCategory = 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: ChecklistCategory;
}

// 7. 保管箱相關
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

// 8. 小工具 API 資料相關
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