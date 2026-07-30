// src/services/profile.ts
// 🛂 批③：profiles 列的建立/同步（best-effort）。
//   首次打開個資頁時 upsert 自己的列（user_id、friend_code、display_name）。
//   靜默失敗原則：表還沒建（Kelvin 尚未跑 profiles.sql）或離線時，個資頁照常顯示
//   （會員碼本來就由 uuid 決定性導出，不依賴 DB 回讀）。
import { supabase } from './supabase';
import { friendCodeOf } from './passportStats';

let _ensured = false;   // 每次 App 生命週期只 upsert 一次

export async function ensureProfile(userId: string, displayName: string): Promise<void> {
    if (_ensured || !userId) return;
    _ensured = true;
    try {
        await supabase.from('profiles').upsert(
            { user_id: userId, friend_code: friendCodeOf(userId), display_name: displayName },
            { onConflict: 'user_id' },
        );
    } catch { /* 靜默：不影響個資頁顯示 */ }
}
