// src/components/passport/EditProfileModal.tsx
// 🛂 編輯個人檔案（批⑤a 從 DataPage 抽出，供「鋼筆」與會員中心共用）。
//   v1 只開放換頭貼；暱稱鎖定（改名將隨帳號系統升級＝登入頁 2-2 一起開放，docs 已記）。
//   換頭貼：既有壓縮上傳管線（trip-media 私有桶）→ profiles.avatar_path（錯誤必 throw，見 services/profile）→ 簽名 URL 回拋。
import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { User } from '../../types';
import { toast } from '../Toast';
import { uploadTripImage, signPaths } from '../../services/storage';
import { updateAvatarPath } from '../../services/profile';

const MUTE = '#8A8266';

export const EditProfileModal: React.FC<{
    user: User;
    onAvatarChange: (url: string) => void;
    onClose: () => void;
}> = ({ user, onAvatarChange, onClose }) => {
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const onPickAvatar = async (f: File | undefined) => {
        if (!f || uploading) return;
        setUploading(true);
        try {
            const path = await uploadTripImage(f);
            await updateAvatarPath(user.id, path);
            const url = (await signPaths([path]))[path];
            if (url) { onAvatarChange(url); toast('頭貼已更新', 'success'); }
        } catch {
            toast('頭貼上傳失敗，稍後再試', 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-8" style={{ background: 'rgba(35,35,32,0.35)' }} onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
                <div className="font-serif text-[16px] font-bold text-[#232320] mb-4">編輯個人檔案</div>
                <div className="flex flex-col items-center gap-3">
                    <div style={{ width: 108, height: 132, borderRadius: 5, background: '#F5F5F4', padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
                    </div>
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="h-9 px-4 rounded-full text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-60"
                        style={{ border: '1.5px solid #3F6B52', color: '#3F6B52' }}>
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span className="font-serif">{uploading ? '上傳中…' : '更換照片'}</span>
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void onPickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
                <div className="mt-4">
                    <div style={{ marginBottom: 3 }}><span className="font-serif" style={{ fontSize: 10, color: MUTE }}>暱稱</span><span className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: MUTE }}> / NAME</span></div>
                    <div className="rounded-xl px-3 py-2.5 text-[14px] font-bold" style={{ background: '#F5F5F4', color: '#B4B2A9' }}>{user.name}</div>
                    <div className="font-serif text-[11px] mt-1.5" style={{ color: MUTE }}>暱稱修改將隨帳號系統升級開放</div>
                </div>
                <button onClick={onClose} className="w-full mt-5 h-10 rounded-full bg-[#232320] text-white text-[13px] font-bold font-serif">完成</button>
            </div>
        </div>
    );
};
