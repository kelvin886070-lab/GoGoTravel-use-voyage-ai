// src/services/profile.ts
// 🛂 批③：profiles 列的建立/同步（best-effort）。
//   首次打開個資頁時 upsert 自己的列（user_id、friend_code、display_name）。
//   靜默失敗原則：表還沒建（Kelvin 尚未跑 profiles.sql）或離線時，個資頁照常顯示
//   （會員碼本來就由 uuid 決定性導出，不依賴 DB 回讀）。
import { supabase } from './supabase';
import { friendCodeOf } from './passportStats';
import { signPaths } from './storage';

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

/** 寫入頭貼路徑（換頭貼流程的持久化步驟）。
 *  ⚠️ supabase-js 出錯不 throw、回傳 {error}——必須自己檢查並拋出，否則「寫入失敗」會被誤報成功
 *  （批③微調修的真 bug：profiles 表/欄位未建時，頭貼顯示更新成功、重整後消失）。 */
export async function updateAvatarPath(userId: string, path: string): Promise<void> {
    const { error } = await supabase.from('profiles').upsert(
        { user_id: userId, friend_code: friendCodeOf(userId), avatar_path: path },
        { onConflict: 'user_id' },
    );
    if (error) throw error;
}

/** 讀自訂頭貼的簽名 URL；沒設定/表未建/離線 → null（呼叫端維持現有頭像）。 */
export async function fetchProfileAvatarUrl(userId: string): Promise<string | null> {
    try {
        const { data } = await supabase.from('profiles').select('avatar_path').eq('user_id', userId).maybeSingle();
        const path = (data?.avatar_path as string) || '';
        if (!path) return null;
        const map = await signPaths([path]);
        return map[path] || null;
    } catch {
        return null;
    }
}
