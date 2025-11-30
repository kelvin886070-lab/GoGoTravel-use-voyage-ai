
import React, { useState } from 'react';
import { Plane, ArrowRight, User as UserIcon, Sparkles } from 'lucide-react';
import { IOSButton, MadeByFooter } from '../components/UI';
import type { User } from '../types';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    // Simulate API delay for better UX
    setTimeout(() => {
      const user: User = {
        id: name.toLowerCase().replace(/\s+/g, '_'), // Simple ID generation
        name: name,
        joinedDate: new Date().toLocaleDateString(),
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${name}` // Generate cool avatar
      };
      onLogin(user);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center relative overflow-hidden pt-safe-top pb-safe">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/30 rounded-full blur-[100px] animate-pulse animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md px-6 z-10 flex-1 flex flex-col justify-center">
            {/* Logo Area */}
            <div className="text-center mb-12 space-y-4">
                <div className="w-24 h-24 bg-white rounded-[28px] shadow-xl mx-auto flex items-center justify-center mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Plane className="w-12 h-12 text-ios-blue" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Kelvin</h1>
                <p className="text-gray-500 text-lg">您的超給力旅遊伴侶</p>
            </div>

            {/* Login Card */}
            <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/50">
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1 tracking-wider">
                            姓名 / 暱稱
                        </label>
                        <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-ios-blue/20 transition-all">
                            <UserIcon className="w-5 h-5 text-gray-400" />
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="請輸入您的名字"
                                className="flex-1 bg-transparent outline-none text-lg font-medium text-gray-900 placeholder-gray-300"
                                autoFocus
                            />
                        </div>
                    </div>

                    <IOSButton 
                        type="submit" 
                        fullWidth 
                        isLoading={loading}
                        className="h-14 shadow-lg shadow-blue-200 text-lg"
                        disabled={!name.trim()}
                    >
                        {loading ? '準備登機...' : '開始旅程'} 
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </IOSButton>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200/50 text-center">
                    <p className="text-xs text-gray-400 leading-relaxed">
                        登入即代表您同意帶上 Kelvin 一起出去玩
                    </p>
                </div>
            </div>
            
             <div className="mt-8 flex justify-center gap-2 text-xs font-medium text-gray-400 opacity-60">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI 行程規劃</span>
                <span>•</span>
                <span>離線瀏覽</span>
                <span>•</span>
                <span>回憶保險箱</span>
            </div>
        </div>

        <div className="w-full z-10">
            <MadeByFooter />
        </div>
    </div>
  );
};
