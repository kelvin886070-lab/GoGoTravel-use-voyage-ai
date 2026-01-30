//簡單的天數修改彈窗
import React, { useState } from 'react';
import { LightweightModal } from '../../../components/common/LightweightModal';

export const SimpleDaysEditModal: React.FC<{ days: number, onClose: () => void, onSave: (newDays: number) => void }> = ({ days, onClose, onSave }) => {
    const [val, setVal] = useState(days);
    return (
        <LightweightModal title="修改天數" onClose={onClose} onSave={() => onSave(val)}>
            <div className="flex items-center justify-center gap-4 h-14">
                <button onClick={() => setVal(Math.max(1, val - 1))} className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">-</button>
                <span className="text-3xl font-black text-[#1D1D1B] w-12 text-center">{val}</span>
                <button onClick={() => setVal(val + 1)} className="w-10 h-10 rounded-full bg-[#1D1D1B] flex items-center justify-center font-bold text-white">+</button>
            </div>
        </LightweightModal>
    );
};