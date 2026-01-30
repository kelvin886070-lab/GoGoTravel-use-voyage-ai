import React from 'react';
import { Train, Footprints, Car, TramFront, Plane, Bus, Clock, ArrowLeftRight, ChevronRight, GripVertical } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';

export const TransportConnectorItem: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    const getIcon = () => {
        const m = detail?.mode || 'bus';
        if (m.includes('train') || m.includes('subway')) return <Train className="w-4 h-4" />;
        if (m.includes('walk')) return <Footprints className="w-4 h-4" />;
        if (m.includes('car') || m.includes('taxi')) return <Car className="w-4 h-4" />;
        if (m.includes('tram')) return <TramFront className="w-4 h-4" />;
        if (m.includes('flight')) return <Plane className="w-4 h-4" />;
        return <Bus className="w-4 h-4" />;
    };
    return (
        <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }} className={`relative flex items-center gap-3 py-0.5 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`} onClick={onClick}>
            <div className="flex flex-col items-center w-[55px] self-stretch relative">
                <div className="absolute top-0 bottom-0 w-[2px] border-r-2 border-dashed border-gray-300 left-1/2 -ml-[1px]"></div>
                <div className="relative z-10 bg-gray-100 border-2 border-white text-gray-500 rounded-full p-1.5 shadow-sm mt-2">{getIcon()}</div>
            </div>
            <div className="flex-1 bg-gray-50/80 rounded-xl p-3 border border-gray-200/50 flex items-center justify-between gap-3 backdrop-blur-sm active:scale-[0.98] transition-transform cursor-pointer hover:bg-gray-100/80 overflow-hidden">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{detail?.mode || 'Transport'}</span>
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />{detail?.duration || '15 min'}</span>
                    </div>
                    {(detail?.fromStation || detail?.toStation) ? (
                        <div className="text-xs text-gray-800 font-bold flex flex-wrap items-center gap-1 min-w-0">
                            <span className="truncate max-w-[40%]">{detail.fromStation || '起點'}</span><ArrowLeftRight className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="truncate max-w-[40%]">{detail.toStation || '終點'}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-800 font-medium truncate">{detail?.instruction || act.description || '移動至下個地點'}</div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0"><ChevronRight className="w-4 h-4 text-gray-300" /><div {...provided.dragHandleProps} className="text-gray-300 p-1" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div></div>
            </div>
        </div>
    );
};