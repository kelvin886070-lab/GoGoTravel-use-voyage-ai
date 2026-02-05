import React, { useState } from 'react';
import { X, Calendar, MapPin, Clock } from 'lucide-react';
import { IOSButton, IOSInput } from '../../../components/UI';
import type { Trip } from '../../../types';

interface EditTripModalProps {
    trip: Trip;
    onClose: () => void;
    onUpdate: (updatedTrip: Trip) => void;
}

export const EditTripModal: React.FC<EditTripModalProps> = ({ trip, onClose, onUpdate }) => {
    // 初始化狀態
    const [destination, setDestination] = useState(trip.destination);
    const [startDate, setStartDate] = useState(trip.startDate);
    const [daysCount, setDaysCount] = useState(trip.days.length);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!destination || !startDate || daysCount < 1) {
            alert("請檢查輸入內容是否完整");
            return;
        }

        setIsLoading(true);

        try {
            // 1. [Critical Fix] 強制重新計算結束日期 (End Date)
            // 這是解決「日期分類錯亂」的核心邏輯
            const calculateEndDate = (startStr: string, duration: number) => {
                const [y, m, d] = startStr.split('-').map(Number);
                
                // 使用本地時間構造日期物件 (避免 UTC 時區偏差)
                const date = new Date(y, m - 1, d);
                
                // 結束日期 = 開始日期 + (天數 - 1)
                // 例如：1/1 開始，玩 1 天 -> 結束日期還是 1/1
                date.setDate(date.getDate() + (duration - 1));
                
                const newY = date.getFullYear();
                const newM = String(date.getMonth() + 1).padStart(2, '0');
                const newD = String(date.getDate()).padStart(2, '0');
                
                return `${newY}-${newM}-${newD}`;
            };

            const newEndDate = calculateEndDate(startDate, daysCount);

            // 2. 處理天數變更後的 days 陣列
            // 如果天數變多 -> 補上空白天
            // 如果天數變少 -> 切除多餘天 (危險操作，但編輯模式下通常是這樣處理)
            let newDays = [...trip.days];
            
            if (daysCount > trip.days.length) {
                // 補上新的空白天
                for (let i = trip.days.length + 1; i <= daysCount; i++) {
                    newDays.push({ day: i, activities: [] });
                }
            } else if (daysCount < trip.days.length) {
                // 截斷多餘的天數
                newDays = newDays.slice(0, daysCount);
            }

            // 3. 組裝新的 Trip 物件
            const updatedTrip: Trip = {
                ...trip,
                destination,
                startDate,
                endDate: newEndDate, // 這裡寫入正確計算後的結束日期
                days: newDays,
            };

            // 4. 執行更新
            onUpdate(updatedTrip);
            onClose();

        } catch (error) {
            console.error("Failed to update trip:", error);
            alert("更新失敗，請稍後再試");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div 
                className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-md transition-opacity" 
                onClick={onClose} 
            />
            
            {/* Modal 本體 */}
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="pt-6 px-6 pb-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
                    <h2 className="text-xl font-bold text-[#1D1D1B] font-serif tracking-wide">
                        編輯行程資訊
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    
                    {/* Destination Input */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                            <MapPin className="w-3.5 h-3.5" /> 目的地
                        </label>
                        <IOSInput 
                            value={destination} 
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="例如：東京" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Start Date Input */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                                <Calendar className="w-3.5 h-3.5" /> 出發日期
                            </label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="w-full bg-[#F5F5F4] p-4 rounded-2xl outline-none text-sm font-bold text-[#1D1D1B] focus:ring-2 focus:ring-[#45846D]/20 transition-all appearance-none" 
                            />
                        </div>

                        {/* Days Input */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                                <Clock className="w-3.5 h-3.5" /> 天數
                            </label>
                            <IOSInput 
                                type="number" 
                                min={1} 
                                max={30} 
                                value={daysCount} 
                                onChange={(e) => setDaysCount(Number(e.target.value))}
                                placeholder="4" 
                            />
                        </div>
                    </div>

                    {/* Hint */}
                    <div className="bg-yellow-50/80 p-4 rounded-2xl border border-yellow-100/50">
                        <p className="text-xs text-yellow-700 font-medium leading-relaxed">
                            ⚠️ 修改天數可能會影響已安排的行程內容。如果減少天數，多出的日程內容將會被刪除。
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 pt-2 border-t border-gray-50 bg-white">
                    <IOSButton 
                        fullWidth 
                        onClick={handleSave} 
                        isLoading={isLoading}
                    >
                        儲存變更
                    </IOSButton>
                </div>
            </div>
        </div>
    );
};