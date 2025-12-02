import React, { useState, useEffect } from 'react';
import { Plane, ArrowRight, User as UserIcon, Sparkles, Lock, RotateCcw, AlertCircle, ChevronLeft } from 'lucide-react';
import { IOSButton, MadeByFooter } from '../components/UI';
import type { User } from '../types';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  // --- 狀態管理 ---
  const [existingUser, setExistingUser] = useState<User | null>(null);
  
  // 步驟: 0 = 輸入暱稱, 1 = 輸入密碼
  const [step, setStep] = useState<0 | 1>(0);
  
  // 輸入欄位
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  
  // 介面狀態
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. 初始化：讀取手機裡的舊資料
  useEffect(() => {
    const saved = localStorage.getItem('voyage_user_account');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.password) {
            setExistingUser(user);
            // 這裡不自動填入名字，讓使用者自己輸入，體驗比較像一般 App
        } else {
            localStorage.removeItem('voyage_user_account');
        }
      } catch (e) {
        localStorage.removeItem('voyage_user_account');
      }
    }
  }, []);

  // 2. 處理「下一步」 (驗證暱稱)
  const handleNextStep = () => {
      setError('');
      if (!inputName.trim()) {
          setError('請輸入您的稱呼');
          return;
      }

      setLoading(true);
      
      // 模擬查找延遲
      setTimeout(() => {
          setLoading(false);
          
          if (existingUser) {
              // --- 有舊資料，檢查名字是否吻合 ---
              if (existingUser.name.toLowerCase() === inputName.trim().toLowerCase()) {
                  // ✅ 名字對了 (這是本人) -> 進入登入模式
                  setStep(1);
              } else {
                  // ❌ 名字不對 (可能是別人想登入，或是打錯字)
                  setError('此裝置已有綁定帳號，名稱不符。');
              }
          } else {
              // --- 沒資料 (這是新用戶) ---
              // ✅ 直接進入註冊模式
              setStep(1);
          }
      }, 500);
  };

  // 3. 處理「登入/註冊」 (驗證密碼)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) {
        handleNextStep();
        return;
    }

    setError('');
    if (!inputPassword.trim()) { setError('請輸入密碼'); return; }

    setLoading(true);

    setTimeout(() => {
      if (existingUser) {
          // 🔴 登入模式：檢查密碼
          if (inputPassword === existingUser.password) {
              onLogin(existingUser);
          } else {
              setError('密碼錯誤');
              setLoading(false);
              setInputPassword('');
          }
      } else {
          // 🟢 註冊模式：建立新帳號
          // (這時候 inputName 已經在第一步填好了，不會是空的)
          const newUser: User = {
            id: inputName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
            name: inputName.trim(),
            password: inputPassword.trim(),
            joinedDate: new Date().toLocaleDateString(),
            avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${inputName.trim()}&backgroundColor=e5e7eb`
          };
          onLogin(newUser);
      }
    }, 800);
  };

  // 4. 重置 / 忘記密碼
  const handleReset = () => {
      if (confirm("⚠️ 重置警告：\n這將清除此裝置上的所有資料並允許您重新註冊。\n確定要繼續嗎？")) {
          localStorage.clear();
          setExistingUser(null);
          setInputName('');
          setInputPassword('');
          setStep(0); // 重置後回到第一步
          setError('');
          setIsResetting(false);
          alert("裝置已重置，請重新註冊。");
      }
  };

  // 5. 註冊新帳號 (手動清除舊資料)
  const handleManualRegister = () => {
      if (confirm("這會清除目前裝置上的舊帳號資料，讓您註冊新帳號。\n確定嗎？")) {
          localStorage.clear();
          setExistingUser(null);
          setInputName('');     // 清空名字
          setInputPassword(''); // 清空密碼
          setStep(0);           // ✨ 關鍵修正：回到第一步 (設定暱稱)
          setError('');
      }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center relative overflow-hidden pt-safe-top pb-safe">
        {/* 背景動畫 */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/30 rounded-full blur-[100px] animate-pulse animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md px-6 z-10 flex-1 flex flex-col justify-center">
            
            {/* Logo 區塊 */}
            <div className="text-center mb-10 space-y-4 transition-all duration-500 ease-out" style={{ transform: step === 1 ? 'scale(0.9) translateY(-20px)' : 'scale(1)' }}>
                <div className="relative w-24 h-24 mx-auto">
                    <div className="w-24 h-24 bg-white rounded-[28px] shadow-xl flex items-center justify-center overflow-hidden">
                        {step === 1 && existingUser ? (
                            // 登入模式顯示頭像
                            <img src={existingUser.avatar} alt="Avatar" className="w-full h-full object-cover animate-in fade-in zoom-in duration-500" />
                        ) : (
                            // 註冊模式或第一步顯示飛機
                            <Plane className="w-12 h-12 text-ios-blue animate-in fade-in duration-500" />
                        )}
                    </div>
                </div>
                
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        {/* 標題根據狀態改變 */}
                        {step === 0 ? 'Kelvin' : (existingUser ? `哈囉 ${existingUser.name}` : '歡迎新朋友')}
                    </h1>
                    <p className="text-gray-500 text-base mt-2 font-medium">
                        {step === 0 
                            ? '您的超給力旅遊伴侶' 
                            : (existingUser ? '請輸入密碼以解鎖' : '請設定您的登入密碼')}
                    </p>
                </div>
            </div>

            {/* 卡片主體 */}
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/60 transition-all duration-500 relative overflow-hidden">
                
                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    
                    {/* 步驟 0: 輸入暱稱 (只有在 Step 0 顯示) */}
                    {step === 0 && (
                        <div className="space-y-2 animate-in slide-in-from-left duration-300">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 tracking-wider">
                                姓名/暱稱
                            </label>
                            <div className="bg-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20 transition-all">
                                <UserIcon className="w-5 h-5 text-gray-400" />
                                <input 
                                    type="text"
                                    value={inputName}
                                    onChange={(e) => {
                                        setInputName(e.target.value);
                                        if(error) setError('');
                                    }}
                                    placeholder="例如：Kelvin"
                                    className="flex-1 bg-transparent outline-none text-xs font-medium text-gray-900 placeholder-gray-400"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {/* 步驟 1: 輸入密碼 (只有在 Step 1 顯示) */}
                    {step === 1 && (
                        <div className="space-y-2 animate-in slide-in-from-right duration-300">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1 tracking-wider">
                                    {existingUser ? '輸入密碼' : '設定新密碼'}
                                </label>
                                {!existingUser && <span className="text-[10px] text-ios-blue bg-blue-50 px-2 py-0.5 rounded-md">註冊中：{inputName}</span>}
                            </div>
                            <div className={`bg-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm border transition-all ${error ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20'}`}>
                                <Lock className={`w-5 h-5 ${error ? 'text-red-400' : 'text-gray-400'}`} />
                                <input 
                                    type="password"
                                    value={inputPassword}
                                    onChange={(e) => {
                                        setInputPassword(e.target.value);
                                        if(error) setError('');
                                    }}
                                    placeholder={existingUser ? "••••••" : "請設定一組密碼"}
                                    className="flex-1 bg-transparent outline-none text-xs font-medium text-gray-900 placeholder-gray-400 tracking-widest"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {/* 錯誤訊息 */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-xs font-medium justify-center bg-red-50 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* 按鈕區 */}
                    <div className="pt-2 flex gap-3">
                        {/* 只有在 Step 1 才顯示返回按鈕 */}
                        {step === 1 && (
                            <button 
                                type="button"
                                onClick={() => {
                                    setStep(0);
                                    setError('');
                                    setInputPassword('');
                                    if (!existingUser) setInputName(''); // 如果是註冊中返回，也可以選擇保留名字
                                }}
                                className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors active:scale-95"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}
                        <IOSButton 
                            type="submit" 
                            fullWidth 
                            isLoading={loading}
                            className="h-14 shadow-lg shadow-blue-200/50 text-lg font-bold"
                            disabled={loading || (step === 0 ? !inputName.trim() : !inputPassword.trim())}
                        >
                            {loading ? '處理中...' : (step === 0 ? '下一步' : (existingUser ? '登入' : '確認註冊'))} 
                            {!loading && <ArrowRight className="w-5 h-5 ml-1" />}
                        </IOSButton>
                    </div>
                </form>
            </div>
            
            {/* 底部功能連結 */}
            <div className="mt-8 flex flex-col items-center space-y-4">
                {!isResetting ? (
                    <div className="flex gap-6 text-sm font-medium text-gray-400">
                        {/* 只有在 Step 0 且有舊帳號時，才顯示「註冊新帳號」按鈕 */}
                        {step === 0 && existingUser && (
                            <>
                                <button onClick={handleManualRegister} className="hover:text-ios-blue transition-colors">
                                    註冊新帳號
                                </button>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <button onClick={() => setIsResetting(true)} className="hover:text-red-500 transition-colors">
                            忘記密碼？
                        </button>
                    </div>
                ) : (
                    <div className="w-full max-w-xs bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-xs text-gray-600 mb-3 text-center">
                            忘記密碼只能 <span className="text-red-500 font-bold">重置 APP</span>，這將會清除所有行程資料。
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsResetting(false)}
                                className="flex-1 py-2 rounded-xl bg-white text-gray-600 text-xs font-bold shadow-sm"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleReset}
                                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1"
                            >
                                <RotateCcw className="w-3 h-3" />
                                確認重置
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-center gap-2 text-[10px] font-medium text-gray-300 opacity-60 mt-4">
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI 行程規劃</span>
                    <span>•</span>
                    <span>本機加密</span>
                </div>
            </div>
        </div>

        <div className="w-full z-10">
            <MadeByFooter />
        </div>
    </div>
  );
};