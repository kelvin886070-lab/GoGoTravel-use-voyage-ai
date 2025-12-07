export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  currency?: string; // ✨ 新增：例如 'TWD', 'KRW', 'JPY', 'USD'
  days: TripDay[];
  isDeleted?: boolean;
}

export interface TripDay {
  day: number;
  date?: string;
  activities: Activity[];
}

export interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'sightseeing' | 'food' | 'transport' | 'flight' | 'hotel';
  location?: string;
  cost?: string;
  bookingRef?: string; // For bookings
  latitude?: number;
  longitude?: number;
}

export type ChecklistCategory = 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: ChecklistCategory;
}

// Replaced enum with const object + type for better compatibility
export const AppView = {
  TRIPS: 'TRIPS',
  EXPLORE: 'EXPLORE',
  TOOLS: 'TOOLS',
  VAULT: 'VAULT',
} as const;

export type AppView = typeof AppView[keyof typeof AppView];

export const ToolType = {
  TRANSLATE: 'TRANSLATE',
  CURRENCY: 'CURRENCY',
  LOCAL_TRANSPORT: 'LOCAL_TRANSPORT',
  EMERGENCY: 'EMERGENCY',
  UNIT_CONVERT: 'UNIT_CONVERT',
  BACKGROUND: 'BACKGROUND',
  VOLTAGE: 'VOLTAGE',
  PACKING_LIST: 'PACKING_LIST',
} as const;

export type ToolType = typeof ToolType[keyof typeof ToolType];

export interface Booking {
  id: string;
  type: 'flight' | 'hotel' | 'car' | 'activity';
  title: string;
  date: string;
  status: 'confirmed' | 'pending';
  price: string;
}

export interface User {
  id: string;
  name: string;
  password?: string; // ✨ 這一行非常重要！問號 ? 代表它是可選的（為了相容舊帳號）
  avatar?: string;
  joinedDate: string;
}

// --- Structured Tool Responses ---

export interface WeatherHourly {
  time: string; // e.g., "14:00"
  temp: string; // e.g., "24°"
  icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
}

export interface WeatherInfo {
  location: string;
  temperature: string; // e.g. "24°C"
  condition: string;   // e.g. "晴朗"
  humidity: string;    // e.g. "60%"
  wind: string;        // e.g. "15 km/h"
  description: string; // Short summary
  clothingSuggestion: string; // New: What to wear
  activityTip: string; // New: Best for indoor/outdoor
  sunrise: string;     // e.g. "06:30"
  sunset: string;      // e.g. "18:45"
  uvIndex: string;     // e.g. "High"
  hourly: WeatherHourly[];
}

export interface VoltageInfo {
  country: string;
  voltage: string;     // e.g. "220V"
  frequency: string;   // e.g. "60Hz"
  plugTypes: string[]; // e.g. ["A", "C"]
  description: string; // Brief advice
}

// --- Vault Types ---

export interface VaultFolder {
    id: string;
    name: string;
    parentId: string | null;
    isPinned?: boolean;
    isDeleted?: boolean;
}

export interface VaultFile {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'other';
    size: string;
    date: string;
    parentId: string | null;
    data?: string;
    isDeleted?: boolean; // Soft delete flag
    isPinned?: boolean;
}

// ... (保留原本的內容)

// --- Vault Types ---

export interface VaultFolder {
    id: string;
    name: string;
    parentId: string | null; // null 代表在最外層
}

export interface VaultFile {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'other';
    size: string;
    date: string;
    parentId: string | null;
    data?: string; // 暫存 Base64 (真實專案建議存 URL)
    isDeleted?: boolean; // 軟刪除標記
    isPinned?: boolean; // 置頂標記
}