import React from 'react';
import { GripVertical, Moon } from 'lucide-react';
import type { Activity } from '../../../types';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { CATEGORIES, Tag } from '../shared';

const ActivityItemImpl: React.FC<{ act: Activity, onClick: () => void, provided: DraggableProvided, snapshot: DraggableStateSnapshot, currencySymbol: string }> = ({ act, onClick, provided, snapshot, currencySymbol }) => {
    const displayCost = act.cost !== undefined && act.cost !== null ? Number(act.cost).toLocaleString() : null;
    const category = CATEGORIES.find(c => c.id === act.type);
    // 🌙 point 2：過午夜（>= 24:00）→ 時間繞回隔日 + 掛小月亮（細節提示、不囉唆）
    const tm = /^(\d{1,2}):(\d{2})/.exec(act.time || '');
    const tMin = tm ? (+tm[1]) * 60 + (+tm[2]) : null;
    const pastMidnight = tMin != null && tMin >= 24 * 60;
    const shownTime = pastMidnight
        ? `${String(Math.floor((tMin % 1440) / 60)).padStart(2, '0')}:${String(tMin % 60).padStart(2, '0')}`
        : act.time;

    return (
        <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{ ...provided.draggableProps.style, touchAction: 'pan-y', borderColor: '#E0D8C6' }}
            className={`bg-white rounded-2xl p-3 border shadow-sm flex gap-3 group relative cursor-pointer active:scale-[0.98] transition-all hover:shadow-md ${snapshot.isDragging ? 'shadow-lg z-50 scale-[1.02]' : ''}`}
            onClick={onClick}
        >
            {/* 🎟️ 簽名：縮圖在左（有 image 才顯示，無資料時優雅退場、不放空佔位） */}
            {act.image && (
                <div className="w-[60px] h-[60px] rounded-[10px] overflow-hidden flex-shrink-0 border" style={{ borderColor: '#E0D8C6' }}>
                    <img
                        src={act.image}
                        className="w-full h-full object-cover"
                        alt=""
                        style={{ objectPosition: `center ${act.imagePositionY ?? 50}%` }}
                    />
                </div>
            )}

            <div className="flex-1 min-w-0">
                {/* 時間在前（紅 mono） */}
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] tracking-wide" style={{ color: '#A23B2E' }}>{shownTime}</span>
                    {pastMidnight && <span className="flex items-center gap-0.5 text-[9px]" style={{ color: '#8A8266' }} title="玩到隔日凌晨"><Moon className="w-2.5 h-2.5" />隔日</span>}
                </div>
                {/* 地點襯線 */}
                <h4 className="font-serif truncate text-[16px] leading-tight mt-0.5" style={{ color: '#232320' }}>{act.title}</h4>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {category ? <Tag type={act.type} /> : <Tag type="other" />}
                    {displayCost !== null && Number(displayCost) > 0 && <span className="font-mono text-[11px] px-2 py-0.5 rounded-md" style={{ color: '#8A8266', background: '#F6F1E7' }}>{currencySymbol} {displayCost}</span>}
                </div>
                {act.description && <p className="text-[11px] mt-1.5 line-clamp-2 leading-relaxed" style={{ color: '#8A8266' }}>{act.description}</p>}
            </div>

            <div {...provided.dragHandleProps} className="flex items-start pl-1" onClick={(e) => e.stopPropagation()}><div className="p-1" style={{ color: '#D8CFBB' }}><GripVertical className="w-5 h-5" /></div></div>
        </div>
    );
};

// 🚀 3.3 memo：忽略每次都變的 onClick
export const ActivityItem = React.memo(ActivityItemImpl, (prev, next) =>
    prev.act === next.act &&
    prev.provided === next.provided &&
    prev.snapshot === next.snapshot &&
    prev.currencySymbol === next.currencySymbol
);
