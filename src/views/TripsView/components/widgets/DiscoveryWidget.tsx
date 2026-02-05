import React from 'react';
import { Compass, UserPlus, Sparkles } from 'lucide-react';

export const DiscoveryWidget: React.FC = () => {
    return (
        <div className="mx-1 mt-2 mb-6">
            <div className="bg-white/40 backdrop-blur-md border border-white/40 p-4 rounded-3xl shadow-sm flex items-center justify-between group cursor-pointer hover:bg-white/50 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#45846D] to-[#2C5E4B] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <Compass className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#1D1D1B] flex items-center gap-1">
                            探索靈感
                            <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">看看 Kelvin 剛發佈的東京遊記...</p>
                    </div>
                </div>
                
                <button className="w-9 h-9 rounded-full bg-[#1D1D1B]/5 flex items-center justify-center text-[#1D1D1B] hover:bg-[#1D1D1B] hover:text-white transition-colors">
                    <UserPlus className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};