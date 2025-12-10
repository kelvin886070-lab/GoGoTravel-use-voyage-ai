// src/types.ts

// 1. App 視圖切換 (修正：使用 const 取代 enum，解決紅底錯誤)
export const AppView = {
  TRIPS: 'trips',
  EXPLORE: 'explore',
  TOOLS: 'tools',
  VAULT: 'vault',
  LOGIN: 'login'
} as const;
export type AppView = typeof AppView[keyof typeof AppView];

// 2. 小工具類型 (修正：使用 const 取代 enum)
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

// 3. 使用者定義
export interface User {
  id: string;
  name: string;
  joinedDate: string;
  avatar: string;
}

// 4. 行程細節相關
export interface Activity {
  id?: string; // 確保有 id
  time: string;
  title: string;
  description: string;
  type: string;      
  category?: string; 
  location: string;
  cost?: string; 
}

export interface TripDay {
  day: number;
  activities: Activity[];
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  days: TripDay[];
  isDeleted?: boolean;
  currency?: string; 
}

// 5. 檢查表相關
export type ChecklistCategory = 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: ChecklistCategory;
}

// 6. 保管箱相關
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
  isDeleted: boolean;
  isPinned: boolean;
}

// 7. 小工具 API 資料相關
export interface WeatherInfo {
  location: string;
  temperature: string;
  condition: string;
  humidity: string;
  wind: string;
  description: string;
  clothingSuggestion: string;
  activityTip: string;
  sunrise: string;
  sunset: string;
  uvIndex: string;
  hourly: any[];
}

export interface VoltageInfo {
  country: string;
  voltage: string;
  frequency: string;
  plugTypes: string[];
  description: string;
}