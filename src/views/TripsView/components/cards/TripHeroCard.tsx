// src/views/TripsView/components/cards/TripHeroCard.tsx
// 🎟️ 首頁 hero 卡（滑出存根版 · 主/次兩型）：封面照＋標題＋滑出明細；倒數改「V1 大數字」放狀態條、封面留乾淨。
//   primary（下一趟，最近出發）＝大；secondary（其他計畫，較遠）＝矮一號、同結構同可展開。
//   兩維度分「即將開始 vs 慢慢準備」：大小＝位置（誰最近）、倒數/就緒條顏色＝時間升溫（近熱遠冷）。
//   點 ▽ 時紙色存根從狀態條往上滑出、覆蓋封面下半（上緣留一截照片），外框尺寸不變。
//   資料只讀 readinessSummary(trip)（單一真相）。
import React, { useState } from 'react';
import { ChevronDown, Check, Plane, BedDouble, FileText, Luggage, ListChecks, ArrowRight } from 'lucide-react';
import type { Trip } from '../../../../types';
import { readinessSummary, type ReadinessKey, type ReadinessSegment } from '../../../../services/readiness';
import { countdownV1 } from './countdown';

const KEY_ICON: Record<ReadinessKey, React.ComponentType<{ className?: string }>> = {
    plan: ListChecks, flight: Plane, hotel: BedDouble, docs: FileText, pack: Luggage,
};
const KEY_ACTION: Record<ReadinessKey, string> = {
    plan: '去定案', flight: '去補機票', hotel: '去補住宿', docs: '去備文件', pack: '去打包',
};

const toneAccent = (tone: string): string =>
    tone === 'urgent' ? '#A23B2E' : tone === 'active' ? '#BA7517' : tone === 'ready' ? '#3F6B52' : '#8A8266';
const statusColor = (tone: string): string =>
    tone === 'urgent' ? '#A32D2D' : tone === 'active' ? '#854F0B' : tone === 'ready' ? '#3F6B52' : '#5F5E5A';

const EASE = 'cubic-bezier(.22,.61,.36,1)';

export const TripHeroCard: React.FC<{ trip: Trip; onSelect: () => void; variant?: 'primary' | 'secondary' }> = ({ trip, onSelect, variant = 'primary' }) => {
    const [expanded, setExpanded] = useState(false);
    const summary = readinessSummary(trip);
    const cd = countdownV1(trip);
    const accent = toneAccent(summary.tone);
    const formattedDate = (trip.startDate || '').replace(/-/g, '.');
    const sec = variant === 'secondary';

    const nextPending: ReadinessSegment | undefined =
        summary.segments.find(s => s.critical && !s.done)
        ?? summary.segments.find(s => !s.critical && s.key !== 'plan' && !s.done)
        ?? summary.segments.find(s => !s.done);

    const actionLabel = summary.allReady || summary.tone === 'quiet'
        ? '查看行程'
        : (nextPending ? KEY_ACTION[nextPending.key] : '查看行程');

    const segStyle = (seg: ReadinessSegment): React.CSSProperties => {
        if (seg.done) return { background: '#3F6B52' };
        if (summary.tone === 'quiet') return { border: '1.5px dashed #C7C3BA' };
        if (nextPending && seg.key === nextPending.key) return { background: accent };
        return { background: '#D8D5CE' };
    };
    const isNextSeg = (seg: ReadinessSegment): boolean =>
        !seg.done && summary.tone !== 'quiet' && nextPending?.key === seg.key;

    return (
        <div className="rounded-[22px] overflow-hidden bg-white border border-black/5 shadow-sm select-none">
            {/* 封面（固定高度、裁切）；存根從底部滑出覆蓋，外框尺寸不變 */}
            <div className={`relative ${sec ? 'h-40' : 'h-52'} overflow-hidden`}>
                <button onClick={onSelect} className="absolute inset-0 w-full h-full text-left" aria-label={`開啟 ${trip.destination}`}>
                    {trip.coverImage ? (
                        <img src={trip.coverImage} alt={trip.destination}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }} />
                    ) : (
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
                    )}
                    <div className="absolute inset-x-0 top-0 h-12 pointer-events-none" style={{ background: 'linear-gradient(rgba(0,0,0,0.28), transparent)' }} />
                    <div className={`absolute inset-x-0 bottom-0 h-24 pointer-events-none transition-opacity duration-200 ${expanded ? 'opacity-0' : 'opacity-100'}`} style={{ background: 'linear-gradient(transparent, rgba(24,28,32,0.72))' }} />

                    {/* PASS 章不放這裡：PASS＝通關完成，屬於「玩過的行程」（回憶卡印記，蓋回國日）。
                        未出發的就緒用全綠分段條＋狀態句表達即可（Kelvin 定案，見 docs）。 */}
                    <div className={`absolute inset-x-0 bottom-0 p-4 transition-opacity duration-200 ${expanded ? 'opacity-0' : 'opacity-100'}`}>
                        <h2 className={`font-serif ${sec ? 'text-[21px]' : 'text-[30px]'} font-bold text-white leading-[1.12]`} style={{ textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
                            {trip.destination}
                        </h2>
                        <div className="font-mono text-[12px] mt-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.78)' }}>
                            {formattedDate} · {trip.days.length} 天
                        </div>
                    </div>
                </button>

                {/* 明細存根：紙色，從底部往上滑出 */}
                <div
                    className={`absolute inset-x-0 bottom-0 bg-[#F6F4EF] rounded-t-2xl px-4 pt-2.5 pb-4 will-change-transform ${expanded ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
                    style={{ transition: `transform 340ms ${EASE}`, boxShadow: '0 -6px 16px rgba(0,0,0,0.10)' }}
                >
                    <div className="w-9 h-1 rounded-full bg-[#D6CDB8] mx-auto mb-3" />
                    <div className="flex">
                        {summary.segments.map(seg => {
                            const Icon = KEY_ICON[seg.key];
                            const next = isNextSeg(seg);
                            return (
                                <div key={seg.key} className="flex-1 flex flex-col items-center gap-1.5">
                                    <div className="relative w-7 h-7 rounded-full flex items-center justify-center"
                                        style={seg.done
                                            ? { background: '#3F6B52', color: '#fff' }
                                            : next
                                                ? { background: 'rgba(186,117,23,0.12)', color: accent, border: `1.5px solid ${accent}` }
                                                : { background: '#EDEBE5', color: '#B4B2A9' }}>
                                        {next && <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-60" style={{ border: `2px solid ${accent}` }} />}
                                        {seg.done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="text-[11px]" style={{ color: seg.done ? '#8A8266' : next ? accent : '#8A8266', fontWeight: next ? 700 : 400 }}>{seg.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={onSelect} className="w-full mt-3.5 h-10 rounded-[12px] bg-[#232320] text-white text-[13px] font-bold flex items-center justify-center gap-1.5">
                        {actionLabel}<ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 狀態條：V1 大數字倒數 ＋ 分段就緒條 ＋ 墨色狀態句 ＋ ▽ */}
            <div className="flex items-center gap-3 px-4 py-3">
                {/* V1 倒數（數字隨時間升溫） */}
                <div className="text-center leading-none shrink-0" style={{ minWidth: 34 }}>
                    {cd.onTrip ? (
                        <div className="font-mono text-[13px] font-bold" style={{ color: cd.color }}>旅途中</div>
                    ) : (
                        <>
                            <div className="font-mono font-bold" style={{ fontSize: sec ? 21 : 26, color: cd.color, lineHeight: 1 }}>{cd.days}</div>
                            <div className="font-mono text-[10px] text-[#8A8266] mt-0.5">天</div>
                        </>
                    )}
                </div>
                <div className="w-px h-8 bg-[#EAE7DE] shrink-0" />

                <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 mb-2">
                        {summary.segments.map(seg => (
                            <div key={seg.key} className="flex-1 relative">
                                <div className="h-[7px] rounded-[4px]" style={segStyle(seg)} />
                                {isNextSeg(seg) && <span className="absolute left-1/2 -translate-x-1/2 top-[9px] text-[9px] leading-none" style={{ color: accent }}>▲</span>}
                            </div>
                        ))}
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: statusColor(summary.tone) }}>{summary.nextLabel}</span>
                </div>
                <button
                    onClick={() => setExpanded(v => !v)}
                    aria-label={expanded ? '收合就緒明細' : '展開就緒明細'}
                    className={`${sec ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${expanded ? 'bg-[#232320] text-white rotate-180' : 'bg-[#F1EFE8] text-[#5F5E5A]'}`}
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
