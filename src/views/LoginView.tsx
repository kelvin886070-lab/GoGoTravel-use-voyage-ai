import React, { useState } from 'react';
import { ArrowRight, User as UserIcon, Sparkles, Lock, AlertCircle } from 'lucide-react';
import type { User } from '../types';
import { supabase } from '../services/supabase';
// 確保引用正確的 Footer 元件
import { MadeByFooter } from '../components/UI';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const getEmail = (name: string) => `${name.trim().toLowerCase().replace(/\s+/g, '')}@kelvintrip.com`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

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
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: inputPassword,
            });
            if (error) throw error;
            if (data.user) {
                const displayName = data.user.user_metadata?.full_name || inputName;
                completeLogin(data.user.id, displayName);
            }
        } else if (mode === 'register') {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: inputPassword,
                options: { data: { full_name: inputName } }
            });
            if (error) throw error;
            if (data.user) {
                completeLogin(data.user.id, inputName);
            }
        } else if (mode === 'reset') {
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
    // 外層容器：使用 Flexbox 佈局，min-h-screen 確保佔滿畫面
    <div className="min-h-screen bg-[#E4E2DD] flex flex-col relative overflow-hidden text-[#1D1D1B]">
        
        {/* 背景裝飾 */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/40 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#45846D]/5 rounded-full blur-[120px]"></div>
        </div>

        {/* 內容區塊 (Flex-1)：這會佔據中間所有剩餘空間，自然把 Footer 推到底部 */}
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-6 z-10">
            
            <div className="text-center mb-10 w-full">
                {/* Logo */}
                <div className="w-24 h-24 mx-auto mb-6 relative flex items-center justify-center">
                    <img 
                        src="/favicon.svg" 
                        alt="Kelvin Trip Logo" 
                        className="w-full h-full object-contain drop-shadow-md"
                        onError={(e) => {
                             e.currentTarget.style.display = 'none';
                             const parent = e.currentTarget.parentElement!;
                             parent.innerHTML = '<span class="text-6xl font-black text-[#45846D] font-serif">K</span>';
                        }} 
                    />
                </div>

                <h1 className="text-3xl font-bold text-[#1D1D1B] tracking-tight font-serif">
                    Kelvin Trip.
                </h1>
                <p className="text-gray-500 text-sm mt-2 font-medium tracking-wide uppercase">
                    Design Your Memories
                </p>
            </div>

            {/* 卡片本體 */}
            <div className="w-full bg-white rounded-[32px] shadow-xl shadow-black/5 overflow-hidden transition-all duration-300 border border-white">
                 
                {/* 模式切換 */}
                <div className="flex p-1.5 m-4 bg-[#F5F5F4] rounded-2xl">
                    <button 
                        type="button"
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                            mode === 'login' 
                            ? 'bg-white text-[#1D1D1B] shadow-sm' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        登入
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                            mode === 'register' 
                            ? 'bg-white text-[#1D1D1B] shadow-sm' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        註冊
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-10 pt-2 space-y-5">
                    
                    {/* 暱稱輸入框 */}
                    <div className="space-y-1.5 group">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-[#45846D] transition-colors">
                            {mode === 'register' ? '設定暱稱 (帳號)' : '您的暱稱'}
                        </label>
                        <div className="bg-[#F5F5F4] rounded-2xl p-4 flex items-center gap-3 transition-all group-focus-within:ring-2 group-focus-within:ring-[#45846D]/20 group-focus-within:bg-white">
                            <UserIcon className="w-5 h-5 text-gray-400 group-focus-within:text-[#45846D] transition-colors" />
                            <input 
                                type="text" 
                                value={inputName} 
                                onChange={e => setInputName(e.target.value)} 
                                placeholder="例：Kelvin" 
                                className="flex-1 text-sm bg-transparent outline-none text-[#1D1D1B] placeholder-gray-400 font-medium caret-[#45846D]" 
                            />
                        </div>
                    </div>

                    {/* 密碼輸入框 */}
                    <div className="space-y-1.5 group">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-[#45846D] transition-colors">密碼</label>
                        <div className="bg-[#F5F5F4] rounded-2xl p-4 flex items-center gap-3 transition-all group-focus-within:ring-2 group-focus-within:ring-[#45846D]/20 group-focus-within:bg-white">
                            <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-[#45846D] transition-colors" />
                            <input 
                                type="password" 
                                value={inputPassword} 
                                onChange={e => setInputPassword(e.target.value)} 
                                placeholder="••••••" 
                                className="flex-1 text-sm bg-transparent outline-none text-[#1D1D1B] tracking-widest font-medium caret-[#45846D]" 
                            />
                        </div>
                    </div>

                    {/* 確認密碼 */}
                    {mode === 'register' && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in group">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-[#45846D] transition-colors">確認密碼</label>
                            <div className="bg-[#F5F5F4] rounded-2xl p-4 flex items-center gap-3 transition-all group-focus-within:ring-2 group-focus-within:ring-[#45846D]/20 group-focus-within:bg-white">
                                <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-[#45846D] transition-colors" />
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    placeholder="再次輸入密碼" 
                                    className="flex-1 text-sm bg-transparent outline-none text-[#1D1D1B] tracking-widest font-medium caret-[#45846D]" 
                                />
                            </div>
                        </div>
                    )}

                    {/* 訊息顯示 */}
                    {error && (
                        <div className="flex items-start gap-2 text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl animate-in fade-in">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-[#45846D] text-xs font-medium text-center bg-green-50 p-3 rounded-xl animate-in fade-in">
                            {successMsg}
                        </div>
                    )}

                    <div className="pt-2">
                        {/* 🟢 關鍵修正：直接寫死 Hex 色碼 bg-[#45846D] 與 text-white */}
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full h-14 bg-[#45846D] text-white hover:bg-[#3A705C] rounded-full font-bold text-base shadow-lg shadow-[#45846D]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? '處理中...' : (mode === 'login' ? '登入' : '註冊並開始')} 
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </div>

                    {mode === 'login' && (
                        <button 
                            type="button" 
                            onClick={() => { setMode('reset'); setError(''); }}
                            className="w-full text-center text-xs text-gray-400 hover:text-[#45846D] transition-colors mt-2"
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
                                className="text-xs text-[#45846D] font-bold hover:underline"
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
        
        {/* Footer: 放在最外層容器的底部 */}
        <div className="w-full z-10 pb-6 relative">
             <MadeByFooter /> 
        </div>
    </div>
  );
};