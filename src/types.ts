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
  expenseImage?: string;       
  imagePositionY?: number;
  items?: ExpenseItem[]; 
  
  image?: string;              
  wishItemId?: string;         
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
  
  stagedWishes?: WishItem[]; 
}

// ==========================================
// 4. 心願盒 (Wish Box) 資料結構
// ==========================================
export type WishItemType = 'place' | 'item';

export interface WishItem {
  id: string;
  type: WishItemType;      
  country: string;         
  title: string;           
  location?: string;       
  area?: string;           
  url?: string;            
  notes?: string;          
  customImage?: string;    
  budget?: number;         
  currency?: string;       
  tags?: string[];         
  createdAt: string;       

  // 🛡️ 9.3 新增：行程內購物清單的獨立狀態追蹤
  isPurchased?: boolean;   // 標記是否已純勾選購買 (觸發金流移轉與刪除線)
  assignedDay?: number;    // 標記被排入至哪一天 (觸發下沉至影子區域)
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