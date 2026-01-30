//這是列表間隙的隱形加號按鈕
import React from 'react';
import { Plus } from 'lucide-react';

export const GhostInsertButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="h-2 -my-1 relative group z-10 flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <div className="absolute inset-0 bg-transparent" />
        <div className="w-[2px] h-full bg-[#45846D] opacity-0 group-hover:opacity-100 transition-opacity absolute left-[26px]" />
        <div className="w-6 h-6 rounded-full bg-[#45846D] text-white flex items-center justify-center shadow-md transform scale-0 group-hover:scale-100 transition-all absolute left-[15px]">
            <Plus className="w-4 h-4" />
        </div>
    </div>
);