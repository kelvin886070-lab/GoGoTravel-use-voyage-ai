//這是 Header 上的透明膠囊按鈕

import React from 'react';
export const GlassCapsule: React.FC<{ 
    onClick?: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    className?: string;
}> = ({ onClick, isActive, children, className = '' }) => {
    const activeClass = isActive 
        ? 'bg-[#45846D] text-white border-transparent shadow-md transform scale-105' 
        : 'bg-black/30 backdrop-blur-md border-white/20 text-white hover:bg-black/40'; 

    return (
        <button 
            onClick={onClick} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border active:scale-95 ${activeClass} ${className}`}
        >
            {children}
        </button>
    );
};