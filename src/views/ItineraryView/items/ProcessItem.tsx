import React from 'react';
import { UserCheck, GripVertical } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';

export const ProcessItem: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`relative flex items-center py-1 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative"><div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div></div>
            <div className="flex-1 flex items-center">
                <div className="bg-slate-100 border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer hover:bg-slate-200">
                    <UserCheck className="w-4 h-4 text-slate-500" /><span className="text-xs font-bold text-slate-700">{act.title}</span><div className="w-px h-3 bg-slate-300 mx-1"></div><span className="text-xs font-mono text-slate-500">{detail?.duration || '60 min'}</span>
                </div>
                <div {...provided.dragHandleProps} className="text-transparent group-hover:text-gray-300 p-2 ml-auto" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
            </div>
        </div>
    );
};