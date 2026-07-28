import React from 'react';
import { Train, Footprints, Car, TramFront, Plane, Bus, GripVertical } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';

const TransportConnectorItemImpl: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot }> = ({ act, onClick, provided, snapshot }) => {
    const detail = act.transportDetail;
    const getIcon = () => {
        const m = detail?.mode || 'bus';
        if (m.includes('train') || m.includes('subway')) return <Train className="w-3.5 h-3.5" />;
        if (m.includes('walk')) return <Footprints className="w-3.5 h-3.5" />;
        if (m.includes('car') || m.includes('taxi')) return <Car className="w-3.5 h-3.5" />;
        if (m.includes('tram')) return <TramFront className="w-3.5 h-3.5" />;
        if (m.includes('flight')) return <Plane className="w-3.5 h-3.5" />;
        return <Bus className="w-3.5 h-3.5" />;
    };
    const modeLabel = (detail?.mode || 'transport').toUpperCase();
    const duration = detail?.duration || '15 分';

    // 🎟️ 連接卡 A：軌道節點 + mono「MODE · N」瘦條。呼吸感 > 緊湊；細節點入卡片再看。
    return (
        <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
            className={`relative flex items-center gap-3 py-1.5 group ${snapshot.isDragging ? 'opacity-80 z-50' : ''}`}
            onClick={onClick}
        >
            <div className="w-[55px] flex justify-center flex-shrink-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#EFEADD', border: '1px solid #D8CFBB', color: '#8A8266' }}>{getIcon()}</div>
            </div>
            <span className="font-mono text-[11px] tracking-wider" style={{ color: '#8A8266' }}>{modeLabel} · {duration}</span>
            <div {...provided.dragHandleProps} className="ml-auto p-1" style={{ color: '#E0D8C6' }} onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
        </div>
    );
};

// 🚀 3.3 memo：忽略 onClick
export const TransportConnectorItem = React.memo(TransportConnectorItemImpl, (prev, next) =>
    prev.act === next.act &&
    prev.provided === next.provided &&
    prev.snapshot === next.snapshot
);
