import React, { useState } from 'react';
import { ArrowRight, User as UserIcon, Sparkles, Lock, AlertCircle } from 'lucide-react';
import { IOSButton, MadeByFooter } from '../components/UI';
import type { User } from '../types';
import { supabase } from '../services/supabase';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  // 模式切換：login (登入) | register (註冊) | reset (忘記密碼)
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');

  // 輸入欄位
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 註冊用：確認密碼
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 魔法轉換：把暱稱轉成 Email (符合 Supabase 格式)
  const getEmail = (name: string) => `${name.trim().toLowerCase().replace(/\s+/g, '')}@kelvintrip.com`;

  // 處理送出
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // 1. 基礎驗證
    if (!inputName.trim()) { setError('請輸入您的暱稱'); return; }
    if (!inputPassword.trim()) { setError('請輸入密碼'); return; }
    
    if (mode === 'register') {
        if (inputPassword.length < 6) { setError('密碼長度至少需要 6 個字元'); return; }
        if (inputPassword !== confirmPassword) { setError('兩次密碼輸入不一致'); return; }
    }

    setLoading(true);
    const email = getEmail(inputName);

    try {
        if (mode === 'login') {
            // --- 登入模式 ---
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: inputPassword,
            });

            if (error) throw error;
            if (data.user) {
                // 讀取使用者原本設定的顯示名稱 (Metadata)
                const displayName = data.user.user_metadata?.full_name || inputName;
                completeLogin(data.user.id, displayName);
            }

        } else if (mode === 'register') {
            // --- 註冊模式 ---
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: inputPassword,
                options: {
                    data: { full_name: inputName } // 儲存顯示名稱
                }
            });

            if (error) throw error;
            if (data.user) {
                // 註冊成功，直接登入
                completeLogin(data.user.id, inputName);
            }
        } else if (mode === 'reset') {
             // --- 重置密碼模式 ---
             setError('請聯繫管理員 (Kelvin) 幫您重置密碼。');
             setLoading(false);
             return;
        }

    } catch (err: any) {
        console.error(err);
        if (err.message.includes('Invalid login')) {
            setError('帳號或密碼錯誤');
        } else if (err.message.includes('already registered')) {
            setError('此暱稱已被註冊，請切換到「登入」');
        } else {
            setError(err.message || '發生錯誤，請稍後再試');
        }
        setLoading(false);
    }
  };

  const completeLogin = (uid: string, name: string) => {
      const user: User = {
          id: uid,
          name: name,
          joinedDate: new Date().toLocaleDateString(),
          avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${name}&backgroundColor=e5e7eb`
      };
      onLogin(user);
  };

  return (
    // 修改 1: 背景色改為 brand-beige (米灰)
    <div className="min-h-screen bg-brand-beige flex flex-col items-center justify-center relative overflow-hidden pt-safe-top pb-safe text-brand-black">
        
        {/* 背景裝飾 (Optional: 可以留著增加層次，但顏色改淡一點) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/40 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-green/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="w-full max-w-md px-6 z-10 flex-1 flex flex-col justify-center">
            
            <div className="text-center mb-10">
                {/* 修改 2: Logo 區域 - 改用 SVG 圖片 */}
                <div className="w-24 h-24 mx-auto mb-6 relative">
                    {/* 請確保 public 資料夾有 favicon.svg，如果沒有請暫時用文字代替 */}
                    <img 
                        src="/favicon.svg" 
                        alt="Kelvin Trip Logo" 
                        className="w-full h-full object-contain drop-shadow-md"
                        onError={(e) => {
                            // 如果圖片載入失敗，顯示預設圖示 (開發時的保險措施)
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.classList.add('bg-brand-green', 'rounded-3xl', 'flex', 'items-center', 'justify-center', 'text-white');
                            e.currentTarget.parentElement!.innerHTML = '<span class="text-4xl font-bold">K</span>';
                        }} 
                    />
                </div>

                <h1 className="text-3xl font-bold text-brand-black tracking-tight font-serif">
                    Kelvin Trip.
                </h1>
                <p className="text-gray-500 text-sm mt-2 font-medium tracking-wide uppercase">
                    Design Your Memories
                </p>
            </div>

            {/* 修改 3: 卡片樣式 - 純白背景 + 柔和陰影 */}
            <div className="bg-white rounded-[32px] shadow-xl shadow-brand-black/5 overflow-hidden transition-all duration-300 border border-white">
                 
                {/* 上方切換標籤 */}
                <div className="flex p-1.5 m-4 bg-brand-input rounded-2xl">
                    <button 
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                            mode === 'login' 
                            ? 'bg-white text-brand-green shadow-sm' // 選中：白底綠字
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        登入
                    </button>
                    <button 
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                            mode === 'register' 
                            ? 'bg-white text-brand-green shadow-sm' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        註冊
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-10 pt-2 space-y-5">
                    
                    {/* 帳號 (暱稱) */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                            {mode === 'register' ? '設定暱稱 (帳號)' : '您的暱稱'}
                        </label>
                        {/* 修改 4: 輸入框 - 移除邊框，改用淺灰底 */}
                        <div className="bg-brand-input rounded-2xl p-4 flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-brand-green/20 focus-within:bg-white">
                            <UserIcon className="w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={inputName} 
                                onChange={e => setInputName(e.target.value)} 
                                placeholder="例：Kelvin" 
                                className="flex-1 text-sm bg-transparent outline-none text-brand-black placeholder-gray-400 font-medium" 
                            />
                        </div>
                    </div>

                    {/* 密碼 */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">密碼</label>
                        <div className="bg-brand-input rounded-2xl p-4 flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-brand-green/20 focus-within:bg-white">
                            <Lock className="w-5 h-5 text-gray-400" />
                            <input 
                                type="password" 
                                value={inputPassword} 
                                onChange={e => setInputPassword(e.target.value)} 
                                placeholder="••••••" 
                                className="flex-1 text-sm bg-transparent outline-none text-brand-black tracking-widest font-medium" 
                            />
                        </div>
                    </div>

                    {/* 確認密碼 (只有註冊時顯示) */}
                    {mode === 'register' && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">確認密碼</label>
                            <div className="bg-brand-input rounded-2xl p-4 flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-brand-green/20 focus-within:bg-white">
                                <Lock className="w-5 h-5 text-gray-400" />
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    placeholder="再次輸入密碼" 
                                    className="flex-1 text-sm bg-transparent outline-none text-brand-black tracking-widest font-medium" 
                                />
                            </div>
                        </div>
                    )}

                    {/* 錯誤/成功訊息 */}
                    {error && (
                        <div className="flex items-start gap-2 text-brand-red text-xs font-medium bg-red-50 p-3 rounded-xl animate-in fade-in">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-brand-green text-xs font-medium text-center bg-green-50 p-3 rounded-xl animate-in fade-in">
                            {successMsg}
                        </div>
                    )}

                    <div className="pt-2">
                        {/* 修改 5: 按鈕 - 使用 brand-green */}
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full h-14 bg-brand-green hover:bg-[#3A705C] text-white rounded-full font-bold text-base shadow-lg shadow-brand-green/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? '處理中...' : (mode === 'login' ? '登入' : '註冊並開始')} 
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* 忘記密碼連結 */}
                    {mode === 'login' && (
                        <button 
                            type="button" 
                            onClick={() => { setMode('reset'); setError(''); }}
                            className="w-full text-center text-xs text-gray-400 hover:text-brand-green transition-colors mt-2"
                        >
                            忘記密碼？
                        </button>
                    )}

                    {mode === 'reset' && (
                        <div className="text-center animate-in fade-in">
                            <p className="text-xs text-gray-500 mb-3">
                                請輸入您的暱稱，我們會嘗試協助您。<br/>(目前請直接聯繫 Kelvin 重置)
                            </p>
                            <button 
                                type="button" 
                                onClick={() => setMode('login')}
                                className="text-xs text-brand-green font-bold hover:underline"
                            >
                                返回登入
                            </button>
                        </div>
                    )}

                </form>
            </div>
            
            <div className="mt-10 flex justify-center gap-2 text-[10px] font-medium text-gray-400 opacity-60">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Powered by AI & Supabase</span>
            </div>
        </div>
        
        <div className="w-full z-10">
            {/* 這裡你可以選擇是否保留原本的 footer，或者為了簡潔隱藏它 */}
            <MadeByFooter /> 
        </div>
    </div>
  );
};