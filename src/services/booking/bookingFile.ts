// src/services/booking/bookingFile.ts
// 原始訂位檔上傳保管箱（vault bucket，比照 VaultView）。DB 只存路徑（booking.file_url）。
// 安全 seam：進與其他保管箱檔案同一個 RLS bucket，未來安全任務統一涵蓋。
import { supabase } from '../supabase';

export async function uploadBookingFile(file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('尚未登入');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/bookings/${crypto.randomUUID()}.${ext || 'bin'}`;
    const { error } = await supabase.storage.from('vault').upload(path, file, {
        contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
}
