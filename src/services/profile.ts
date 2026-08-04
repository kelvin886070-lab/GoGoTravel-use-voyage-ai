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
        // ignoreDuplicates：只補建缺列，「絕不覆寫既有列」——friend_code/role 可能被 DB 端
        // 手動改過（Founder 序號碼），client 的導出值不得蓋回去（個資頁細節批修的隱患）。
        await supabase.from('profiles').upsert(
            { user_id: userId, friend_code: friendCodeOf(userId), display_name: displayName },
            { onConflict: 'user_id', ignoreDuplicates: true },
        );
    } catch { /* 靜默：不影響個資頁顯示 */ }
}

/** 寫入頭貼路徑（換頭貼流程的持久化步驟）。
 *  ⚠️ supabase-js 出錯不 throw、回傳 {error}——必須自己檢查並拋出，否則「寫入失敗」會被誤報成功
 *  （批③微調修的真 bug：profiles 表/欄位未建時，頭貼顯示更新成功、重整後消失）。
 *  ⚠️ 只 update avatar_path、不 upsert 整列——避免蓋掉 DB 端手動改過的 friend_code/role；
 *  列不存在（極端時序）才 insert 補建。 */
export async function updateAvatarPath(userId: string, path: string): Promise<void> {
    const { data, error } = await supabase.from('profiles')
        .update({ avatar_path: path }).eq('user_id', userId).select('user_id');
    if (error) throw error;
    if (!data || data.length === 0) {
        const { error: insErr } = await supabase.from('profiles')
            .insert({ user_id: userId, friend_code: friendCodeOf(userId), avatar_path: path });
        if (insErr) throw insErr;
    }
}

export interface ProfileMeta {
    friendCode: string | null;   // DB 版會員碼（Founder 序號碼優先；null＝退回 uuid 導出）
    role: string | null;         // 內部身份（'FOUNDER' 等；一般使用者 null → 不顯示 TYPE 欄）
    joinDate: string | null;     // 加入日 YYYYMMDD（created_at；MRZ 的 JOINED 彩蛋，Kelvin 定案含年月日）
    residenceCountry: string;    // 居住國 ISO alpha-2（生成表單批A：國內外由此推斷；缺值＝裝置語系推得）
    residenceCity: string | null;// 常用出發地（登機證顯示；表單永不問）
}

// 裝置語系 → 居住國預設（註冊時選國家上線前的過渡；zh-TW→TW、ja-JP→JP…）
export const localeCountry = (): string => {
    try {
        const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
        for (const t of tags) {
            const region = (t || '').split('-')[1];
            if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
        }
    } catch { /* ignore */ }
    return 'TW';   // 最終保底（第一批使用者在台灣）
};

/** Date → YYYYMMDD（MRZ 用；無效日期回 null）。 */
export const toYmd = (d: Date): string | null => {
    if (Number.isNaN(d.getTime())) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

/** 讀個資頁 meta（會員碼覆寫/身份/加入日/居住地）。表未建/離線 → 各欄有退位（居住地退回裝置語系）。 */
export async function fetchProfileMeta(userId: string): Promise<ProfileMeta> {
    try {
        const { data } = await supabase.from('profiles')
            .select('friend_code, role, created_at, residence_country, residence_city')
            .eq('user_id', userId).maybeSingle();
        return {
            friendCode: (data?.friend_code as string) || null,
            role: (data?.role as string) || null,
            joinDate: data?.created_at ? toYmd(new Date(data.created_at as string)) : null,
            residenceCountry: ((data?.residence_country as string) || '').toUpperCase() || localeCountry(),
            residenceCity: (data?.residence_city as string) || null,
        };
    } catch {
        return { friendCode: null, role: null, joinDate: null, residenceCountry: localeCountry(), residenceCity: null };
    }
}

/** 寫入居住地（註冊選國家／個人檔案修改；只 update 不 upsert 整列，避免蓋掉 friend_code/role）。 */
export async function updateResidence(userId: string, country: string, city?: string): Promise<void> {
    const patch: Record<string, string> = { residence_country: country.toUpperCase() };
    if (city !== undefined) patch.residence_city = city;
    const { data, error } = await supabase.from('profiles')
        .update(patch).eq('user_id', userId).select('user_id');
    if (error) throw error;
    if (!data || data.length === 0) {
        const { error: insErr } = await supabase.from('profiles')
            .insert({ user_id: userId, friend_code: friendCodeOf(userId), ...patch });
        if (insErr) throw insErr;
    }
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
