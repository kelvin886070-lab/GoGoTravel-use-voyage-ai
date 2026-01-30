import React from 'react';
import { GripVertical } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { CATEGORIES, Tag } from '../shared';

export const ActivityItem: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : null;
    const category = CATEGORIES.find(c => c.id === act.type);

    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col gap-2 group relative cursor-pointer active:scale-[0.98] transition-all hover:shadow-md ${snapshot.isDragging ? 'shadow-lg z-50 scale-[1.02]' : ''}`} onClick={onClick}>
            <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1 min-w-[55px]"><span className="text-xs font-bold text-[#1D1D1B] bg-gray-100 px-2 py-1 rounded-md">{act.time}</span></div>
                <div className="flex-1 min-w-0 border-l border-gray-100 pl-4">
                    <h4 className="font-bold text-[#1D1D1B] truncate text-base leading-tight">{act.title}</h4>
                    <div className="flex items-center justify-between mt-2">
                        {category ? <Tag type={act.type} /> : <Tag type="other" />}
                        {displayCost !== null && Number(displayCost) > 0 && <span className="text-xs text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded-md">{currencySymbol} {displayCost}</span>}
                    </div>
                    
                    {/* List View 保持乾淨，不顯示連結 */}
                    
                    {act.description && <p className="text-xs text-gray-500 mt-2 font-medium line-clamp-2 leading-relaxed">{act.description}</p>}
                </div>
                <div {...provided.dragHandleProps} className="flex flex-col justify-between items-end pl-1" onClick={(e) => e.stopPropagation()}><div className="text-gray-300 p-1"><GripVertical className="w-5 h-5" /></div></div>
            </div>
        </div>
    );
};