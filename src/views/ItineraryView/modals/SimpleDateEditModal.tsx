//簡單的日期修改彈窗
import React, { useState } from 'react';
import { LightweightModal } from '../../../components/common/LightweightModal';

export const SimpleDateEditModal: React.FC<{ date: string, onClose: () => void, onSave: (newDate: string) => void }> = ({ date, onClose, onSave }) => {
    const [val, setVal] = useState(date);
    return (
        <LightweightModal title="修改開始日期" onClose={onClose} onSave={() => onSave(val)}>
            <input 
                type="date" 
                value={val} 
                onChange={(e) => setVal(e.target.value)} 
                className="w-full h-14 bg-gray-50 p-0 rounded-2xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-[#45846D] box-border appearance-none border-none" 
            />
        </LightweightModal>
    );
};