import React from 'react';
import { Banknote, Camera, GripVertical } from 'lucide-react';
import type { Activity, Member } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { CATEGORIES, getMemberName, getMemberAvatarColor } from '../shared';

export const ExpensePolaroid: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot, currencySymbol: string, members?: Member[] }> = ({ act, onClick, provided, snapshot, currencySymbol, members }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : '0';
    const payerName = getMemberName(members, act.payer);
    const avatarColor = getMemberAvatarColor(payerName);
    const category = CATEGORIES.find(c => c.id === act.type) || CATEGORIES.find(c => c.id === 'expense');

    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`flex gap-3 py-1 group ${snapshot.isDragging ? 'z-50 scale-[1.02]' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative pt-2">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-200 left-1/2 -ml-[1px] -z-10"></div>
                {/* 根據類別顯示不同的左側圖示 */}
                <div className={`w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm z-10 text-xs font-bold ${category?.tagClass.replace('bg-', 'text-').replace('100', '500')}`}>
                    {category?.icon ? <category.icon className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                </div>
            </div>
            <div className="flex-1 bg-white p-3 pb-4 rounded-sm shadow-md border border-gray-100 rotate-1 transition-transform hover:rotate-0 active:scale-[0.98] cursor-pointer relative overflow-hidden group/card">
                <div {...provided.dragHandleProps} className="absolute top-2 left-2 z-20 text-white/80 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 bg-black/20 backdrop-blur-sm rounded-full" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
                
                {/* 照片顯示區塊 */}
                <div className="h-40 w-full bg-gray-100 mb-3 rounded-sm overflow-hidden relative border border-gray-100">
                    {act.expenseImage ? 
                        <img 
                            src={act.expenseImage} 
                            alt="Receipt" 
                            className="w-full h-full object-cover" 
                            style={{ objectPosition: `center ${act.imagePositionY ?? 50}%` }} // 讀取裁切位置
                        /> : 
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 pattern-dots"><Camera className="w-8 h-8 opacity-30 mb-1" /><span className="text-[10px] font-bold opacity-30">無照片</span></div>
                    }
                    {/* 右上角顯示付款人 */}
                    <div className={`absolute top-2 right-2 ${avatarColor} text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border border-white transform rotate-6`}>{payerName} 付款</div>
                </div>

                <div className="flex justify-between items-end px-1">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="font-handwriting font-bold text-gray-800 text-lg leading-none mb-1 truncate">{act.title || category?.label || '新項目'}</div>
                        <div className="flex items-center gap-2">
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">{act.time} {act.items && act.items.length > 0 && <span className="bg-gray-100 px-1 rounded text-gray-500">{act.items.length} 筆明細</span>}</div>
                            {category && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${category.tagClass}`}>{category.label}</span>}
                        </div>
                    </div>
                    <div className="text-right"><div className="font-mono font-bold text-xl text-green-600">{currencySymbol}{displayCost}</div></div>
                </div>
            </div>
        </div>
    );
};