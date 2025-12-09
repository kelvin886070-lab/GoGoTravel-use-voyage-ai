import { createClient } from '@supabase/supabase-js';

// 讀取環境變數
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 檢查是否缺少變數
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("缺少 Supabase 環境變數！請檢查 .env 檔案");
}

// 建立並匯出 supabase 客戶端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);