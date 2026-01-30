//新增行程的彈窗
import React, { useState } from 'react';
import { IOSInput } from '../../../components/UI'; // 引用原本的 UI 檔
import { CATEGORIES } from '../shared';
import type { Activity } from '../../../types';

export const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('09:00'); 
    const [type, setType] = useState<string>('sightseeing');
    
    const handleSubmit = () => { 
        if (!title) return;
        onAdd({ time, title, description: '', type, location: '' }); 
    };
    
    // 只顯示非系統類型
    const validCategories = CATEGORIES.filter(c => !c.isSystem);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 relative z-10">
                <h3 className="text-xl font-bold mb-6">新增第 {day} 天</h3>
                <div className="space-y-5">
                    <IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" />
                    <div className="flex gap-3">
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold text-center" />
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#F5F5F4] rounded-2xl py-4 px-3 font-bold">
                            {validCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>
                    <button className="w-full py-4 rounded-2xl bg-[#45846D] text-white font-bold" onClick={handleSubmit}>確認</button>
                </div>
            </div>
        </div>
    );
};