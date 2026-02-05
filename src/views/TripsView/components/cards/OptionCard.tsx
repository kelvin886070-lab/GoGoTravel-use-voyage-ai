import React from 'react';

interface OptionCardProps { 
    selected: boolean; 
    onClick: () => void; 
    icon: any; 
    label: string; 
    sub?: string; 
}

export const OptionCard: React.FC<OptionCardProps> = ({ selected, onClick, icon, label, sub }) => ( 
    <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all duration-200 h-20 w-full ${
            selected 
                ? 'bg-[#45846D] text-white shadow-md scale-[1.02] border-[#45846D]' 
                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
        }`}
    >
        <div className={`mb-1.5 ${selected ? 'text-white' : 'text-[#1D1D1B]'}`}>
            {React.cloneElement(icon, { size: 22, strokeWidth: selected ? 2.5 : 1.5 })}
        </div>
        <span className={`text-[11px] font-bold ${selected ? 'text-white' : 'text-gray-600'}`}>{label}</span>
        {sub && <span className={`text-[9px] mt-0.5 ${selected ? 'text-white/80' : 'text-gray-400'}`}>{sub}</span>}
    </button> 
);