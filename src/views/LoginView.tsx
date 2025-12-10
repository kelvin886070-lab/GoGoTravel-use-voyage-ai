import React, { useState } from 'react';
import { Plane, ArrowRight, User as UserIcon, Sparkles, Lock, AlertCircle, Mail } from 'lucide-react';
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
             setError('由於使用虛擬帳號，請聯繫管理員 (Kelvin) 幫您重置密碼。');
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
          // 移除 password 欄位，因為 User 型別定義中沒有它
          joinedDate: new Date().toLocaleDateString(),
          avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${name}&backgroundColor=e5e7eb`
      };
      onLogin(user);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center relative overflow-hidden pt-safe-top pb-safe">
        {/* 背景動畫 */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/30 rounded-full blur-[100px] animate-pulse animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md px-6 z-10 flex-1 flex flex-col justify-center">
            
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-white rounded-[24px] shadow-xl mx-auto flex items-center justify-center mb-4">
                    <Plane className="w-10 h-10 text-ios-blue" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Kelvin Trip</h1>
                <p className="text-gray-500 text-sm mt-1 font-medium">雲端同步您的旅程</p>
            </div>

            {/* 玻璃擬態卡片 */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/60 overflow-hidden transition-all duration-300">
                
                {/* 上方切換標籤 (Segmented Control) */}
                <div className="flex p-1.5 m-4 bg-gray-100/50 rounded-2xl">
                    <button 
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        登入
                    </button>
                    <button 
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        註冊
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-4">
                    
                    {/* 帳號 (暱稱) */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                            {mode === 'register' ? '設定暱稱 (帳號)' : '您的暱稱'}
                        </label>
                        <div className="bg-white/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20 transition-all">
                            <UserIcon className="w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={inputName} 
                                onChange={e => setInputName(e.target.value)} 
                                placeholder="例：Kelvin" 
                                className="text-xs bg-transparent outline-none text-base text-gray-900 placeholder-gray-400 font-medium" 
                            />
                        </div>
                    </div>

                    {/* 密碼 */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">密碼</label>
                        <div className="bg-white/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20 transition-all">
                            <Lock className="w-5 h-5 text-gray-400" />
                            <input 
                                type="password" 
                                value={inputPassword} 
                                onChange={e => setInputPassword(e.target.value)} 
                                placeholder="" 
                                className="text-xs bg-transparent outline-none text-base text-gray-900 tracking-widest font-medium" 
                            />
                        </div>
                    </div>

                    {/* 確認密碼 (只有註冊時顯示) */}
                    {mode === 'register' && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 fade-in">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">確認密碼</label>
                            <div className="bg-white/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20 transition-all">
                                <Lock className="w-5 h-5 text-gray-400" />
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    placeholder="再次輸入密碼" 
                                    className="text-xs bg-transparent outline-none text-base text-gray-900 tracking-widest font-medium" 
                                />
                            </div>
                        </div>
                    )}

                    {/* 錯誤/成功訊息 */}
                    {error && (
                        <div className="flex items-start gap-2 text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl animate-in fade-in">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-green-600 text-xs font-medium text-center bg-green-50 p-3 rounded-xl animate-in fade-in">
                            {successMsg}
                        </div>
                    )}

                    <div className="pt-2">
                        <IOSButton type="submit" fullWidth isLoading={loading} className="h-12 shadow-lg shadow-blue-200/50 text-base font-bold">
                            {loading ? '處理中...' : (mode === 'login' ? '登入' : '註冊並開始')} 
                            {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
                        </IOSButton>
                    </div>

                    {/* 忘記密碼連結 (只有登入時顯示) */}
                    {mode === 'login' && (
                        <button 
                            type="button" 
                            onClick={() => { setMode('reset'); setError(''); }}
                            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2"
                        >
                            忘記密碼？
                        </button>
                    )}

                    {/* 忘記密碼模式的提示 */}
                    {mode === 'reset' && (
                        <div className="text-center animate-in fade-in">
                            <p className="text-xs text-gray-500 mb-3">
                                請輸入您的暱稱，我們會嘗試協助您。<br/>
                                (目前請直接聯繫 Kelvin 重置)
                            </p>
                            <button 
                                type="button" 
                                onClick={() => setMode('login')}
                                className="text-xs text-ios-blue font-bold"
                            >
                                返回登入
                            </button>
                        </div>
                    )}

                </form>
            </div>
            
            <div className="mt-8 flex justify-center gap-2 text-[10px] font-medium text-gray-400 opacity-60">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Supabase 雲端技術支援</span>
            </div>
        </div>
        <div className="w-full z-10"><MadeByFooter /></div>
    </div>
  );
};