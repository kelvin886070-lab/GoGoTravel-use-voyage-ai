import React from 'react';
import { StickyNote, GripVertical } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';

export const NoteItem: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot }> = ({ act, onClick, provided, snapshot }) => {
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`flex gap-3 py-0.5 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] pt-2"><StickyNote className="w-4 h-4 text-yellow-400" /></div>
            <div className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-100 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                <div className="min-w-0"><h4 className="font-bold text-yellow-800 text-sm truncate">{act.title || '備註'}</h4><p className="text-xs text-yellow-600/80 truncate">{act.description || '點擊編輯內容...'}</p></div>
                <div {...provided.dragHandleProps} className="text-yellow-300 p-1" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
            </div>
        </div>
    );
};