import React, { useState } from 'react';
import { X, Camera, PenTool, Lock, CheckCircle, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import type { User } from '../../../types';

export const ProfileModal: React.FC<{ user: User, tripCount: number, onClose: () => void, onLogout: () => void }> = ({ user, tripCount, onClose, onLogout }) => {
    const [newPassword, setNewPassword] = useState('');
    const [isChanging, setIsChanging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');
    
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        try { 
            setUploading(true); 
            if (!e.target.files || e.target.files.length === 0) return;
            const file = e.target.files[0]; 
            if (file.size > 2 * 1024 * 1024) { alert('圖片太大了！請上傳小於 2MB 的照片。'); return; } 
            const fileExt = file.name.split('.').pop(); 
            const fileName = `avatar_${Date.now()}.${fileExt}`; 
            const filePath = `${user.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true }); 
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath); 
            const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            if (updateError) throw updateError; 
            alert('頭貼更新成功！'); window.location.reload(); 
        } catch (error: any) { 
            console.error(error); alert('上傳失敗：' + error.message); 
        } finally { setUploading(false); } 
    };

    const handleChangePassword = async () => { 
        if (newPassword.length < 6) { alert("密碼長度至少需要 6 碼"); return; } 
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword }); 
        setLoading(false); 
        if (error) { 
            alert("修改失敗：" + error.message);
        } else { 
            setMsg("密碼修改成功！"); setNewPassword(''); setTimeout(() => { setIsChanging(false); setMsg(''); }, 1500); 
        } 
    };

    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white/90 backdrop-blur-xl rounded-[32px] w-full max-w-sm p-6 relative z-10 shadow-2xl animate-in zoom-in-95 border border-white/50"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"><X className="w-5 h-5" /></button><div className="flex flex-col items-center mb-6 pt-2"><div className="relative group cursor-pointer"><div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white mb-4 relative bg-gray-200"><img src={user.avatar} alt={user.name} className="w-full h-full object-cover transition-opacity group-hover:opacity-80" /><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">{uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white drop-shadow-md" />}</div></div><input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full" /><div className="absolute bottom-4 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-100 pointer-events-none text-gray-500"><PenTool className="w-3 h-3" /></div></div><h2 className="text-2xl font-bold text-[#1D1D1B]">{user.name}</h2><p className="text-sm text-gray-500 font-medium">Kelvin 會員  {user.joinedDate} 加入</p></div><div className="bg-white/60 rounded-2xl p-4 mb-4 flex justify-around border border-gray-100 shadow-sm"><div className="text-center"><span className="block text-xl font-bold text-[#1D1D1B]">{tripCount}</span><span className="text-xs text-gray-500 uppercase tracking-wide">規劃行程</span></div><div className="w-px bg-gray-200"></div><div className="text-center opacity-50"><span className="block text-xl font-bold text-[#1D1D1B]">0</span><span className="text-xs text-gray-500 uppercase tracking-wide">分享次數</span></div></div><div className="mb-4">{!isChanging ? (<button onClick={() => setIsChanging(true)} className="w-full py-3 rounded-xl bg-white text-gray-600 text-sm font-bold shadow-sm border border-gray-100 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><Lock className="w-4 h-4" /> 修改密碼</button>) : (<div className="bg-white/80 rounded-2xl p-3 border border-gray-200 animate-in slide-in-from-top-2">{msg ? (<div className="text-green-600 text-center text-sm font-bold flex items-center justify-center gap-2 py-2"><CheckCircle className="w-5 h-5" /> {msg}</div>) : (<div className="flex gap-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="輸入新密碼" className="flex-1 bg-gray-100 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50" autoFocus /><button onClick={handleChangePassword} disabled={loading || !newPassword} className="bg-[#45846D] text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">{loading ? '...' : '儲存'}</button></div>)}</div>)}</div><button onClick={onLogout} className="w-full py-3.5 rounded-xl bg-[#FEE2E2] text-red-500 font-bold text-base hover:bg-[#FECACA] active:scale-95 transition-all flex items-center justify-center gap-2"><LogOut className="w-5 h-5" /> 登出帳號</button></div></div>);
};