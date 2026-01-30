//這是所有小編輯視窗的基礎框架
import React from 'react';
import { X } from 'lucide-react';

export const LightweightModal: React.FC<{ title: string, onClose: () => void, onSave: () => void, children: React.ReactNode }> = ({ title, onClose, onSave, children }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="bg-white w-[85vw] max-w-xs rounded-[32px] p-6 relative z-10 shadow-2xl animate-in zoom-in-95 scale-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[#1D1D1B] flex-1 text-center pl-6">{title}</h3>
                <button onClick={onClose} className="bg-gray-100 p-1.5 rounded-full text-gray-400 hover:bg-gray-200 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <div className="mb-6 space-y-4">
                {children}
            </div>
            
            <button onClick={onSave} className="w-full h-14 rounded-2xl bg-[#45846D] text-white font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                儲存變更
            </button>
        </div>
    </div>
);