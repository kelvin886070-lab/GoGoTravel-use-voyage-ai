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

// 3. 使用者定義
export interface User {
  id: string;
  name: string;
  joinedDate: string;
  avatar: string;
  email?: string; // 補上 email 欄位以防萬一
}

// 4. 新增：交通詳細資訊 (用於副卡顯示)
export interface TransportDetail {
  mode: 'bus' | 'train' | 'subway' | 'walk' | 'taxi' | 'car' | 'tram' | 'flight'; // 交通方式
  duration: string;      // 預估時間 (例如: "15 min")
  fromStation?: string;  // 上車站/出發點
  toStation?: string;    // 下車站/抵達點
  instruction?: string;  // 簡短指引 (例如: "搭乘 206 號公車")
}

// 5. 行程細節相關
export interface Activity {
  id?: string;
  time: string;
  title: string;
  description: string;
  // 擴充 type 定義，加入 'transport'
  type: 'sightseeing' | 'food' | 'transport' | 'flight' | 'hotel' | 'cafe' | 'shopping' | 'relax' | 'bar' | 'culture' | 'activity' | 'other' | string;
  category?: string; 
  location?: string; 
  cost?: string | number;
  
  // 新增：交通詳細資訊 (若 type === 'transport' 則此欄位會有值)
  transportDetail?: TransportDetail; 
}

export interface TripDay {
  day: number;
  activities: Activity[];
}

export interface Trip {
  id: string;
  destination: string;
  
  // 新增：指定遊玩區域 (例如: "中西區, 安平")
  focusArea?: string; 
  
  // 新增：當地交通偏好 (public=大眾運輸, car=自駕, taxi=計程車)
  localTransportMode?: 'public' | 'car' | 'taxi'; 

  startDate: string;
  endDate: string;
  coverImage: string;
  days: TripDay[];
  isDeleted?: boolean;
  currency?: string; 
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