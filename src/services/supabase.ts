import { createClient } from '@supabase/supabase-js';

// 讀取環境變數
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 建立並匯出 client
export const supabase = createClient(supabaseUrl, supabaseKey);