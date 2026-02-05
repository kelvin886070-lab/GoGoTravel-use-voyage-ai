import React, { useState } from 'react';
import { X } from 'lucide-react';
import { IOSButton } from '../../../components/UI';
import type { Trip } from '../../../types';

export const ImportTripModal: React.FC<{ onClose: () => void, onImportTrip: (t: Trip) => void }> = ({ onClose, onImportTrip }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const handleImport = () => { 
        try { 
            if (!code.trim()) return; 
            const jsonString = decodeURIComponent(escape(atob(code.trim())));
            const tripData = JSON.parse(jsonString); 
            if (tripData && tripData.destination && tripData.days) { 
                onImportTrip(tripData); onClose(); 
            } else { 
                setError('無效的行程連結');
            } 
        } catch (e) { setError('連結解析失敗，請確認連結是否完整'); } 
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white rounded-[32px] w-full max-w-sm p-6 relative z-10 shadow-xl animate-in zoom-in-95"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button><h3 className="text-xl font-bold mb-1 text-[#1D1D1B]">匯入行程</h3><p className="text-sm text-gray-500 mb-4">貼上家人分享的行程連結</p><textarea className="w-full h-32 bg-[#F5F5F4] rounded-2xl p-4 text-sm border-none outline-none focus:ring-2 focus:ring-[#45846D]/50 mb-4 resize-none" placeholder="在此貼上連結..." value={code} onChange={e => { setCode(e.target.value); setError(''); }} />{error && <p className="text-red-500 text-xs font-medium mb-3">{error}</p>}<IOSButton fullWidth onClick={handleImport}>匯入</IOSButton></div></div>);
};