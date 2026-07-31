// src/components/passport/MemoryPage.tsx
// 🛂 批④：護照內頁——回憶卡（混血定稿：護照紙頁骨架 × 照片回憶卡內容）。
//   一年一組內頁、一頁一張卡（照片與旅途中 hero 同高 208，一頁一段回憶——Kelvin 定案）；
//   卡＝封面照＋白色 PASS 章（蓋「回國日」，PASS=通關完成的定案語意）
//   ＋serif 名＋日期區間＋輕統計（N 天 · M 個地方）。點卡→該趟行程頁（computeStage=4 自動落回憶臉）。
//   無催促元素（沒有進度/倒數/警示色）——回憶卡的工作是「帶我回去一下」，不是叫我做事。
//   照片集播放/新增照片＝批⑤（memoryPhotoPaths），本批不放假按鈕。
import React from 'react';
import type { Trip } from '../../types';

const MUTE = '#8A8266';

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

// 回國日（endDate）→ 章上的日期
const stampDate = (s?: string): string => (s || '').slice(0, 10).replace(/-/g, '.');
// 日期區間：2026.07.21 – 07.24（同年省略年份）
const rangeLabel = (start?: string, end?: string): string => {
    const a = (start || '').slice(0, 10).replace(/-/g, '.');
    const b = (end || '').slice(0, 10).replace(/-/g, '.');
    if (!a || !b) return a || b;
    return a.slice(0, 5) === b.slice(0, 5) ? `${a} – ${b.slice(5)}` : `${a} – ${b}`;
};
const stopsOf = (t: Trip): number =>
    (t.days || []).reduce((n, d) => n + (d.activities || []).filter(a => (a.type || '').toLowerCase() !== 'transport').length, 0);

// 白色 PASS 章（迷你版：外點線圈＋PASS＋回國日）——蓋在照片右上
const MiniPass: React.FC<{ date: string }> = ({ date }) => (
    <div style={{ position: 'absolute', top: 10, right: 10, transform: 'rotate(-10deg)', width: 62, height: 62, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.95)' }}>
            <span className="font-serif" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }}>PASS</span>
            <span className="font-mono" style={{ fontSize: 6, letterSpacing: 0.5 }}>{date.slice(5) || date}</span>
        </div>
    </div>
);

const MemoryCard: React.FC<{ trip: Trip; onOpen: () => void }> = ({ trip, onOpen }) => (
    <button onClick={onOpen} className="w-full text-left rounded-[14px] overflow-hidden bg-white active:scale-[0.99] transition-transform" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="relative" style={{ height: 208 }}>
            {trip.coverImage ? (
                <img src={trip.coverImage} alt={trip.destination} className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }} />
            ) : (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
            )}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: 84, background: 'linear-gradient(transparent, rgba(20,22,26,0.78))' }} />
            <MiniPass date={stampDate(trip.endDate)} />
            <div className="absolute left-3 bottom-2 text-white">
                <div className="font-serif" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{trip.destination}</div>
                <div className="font-mono" style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{rangeLabel(trip.startDate, trip.endDate)}</div>
            </div>
        </div>
        <div className="flex items-center px-3 py-2">
            <span className="font-mono" style={{ fontSize: 10, color: MUTE }}>{(trip.days || []).length} 天 · {stopsOf(trip)} 個地方</span>
        </div>
    </button>
);

/** 一頁回憶內頁：年份抬頭＋最多 2 張卡＋頁碼。 */
export const MemoryPage: React.FC<{
    year: number;
    trips: Trip[];               // 本頁的趟（一頁一張）
    pageNo: string;              // 內頁編號（01 起；封面/個資頁不編號）
    onOpenTrip: (t: Trip) => void;
}> = ({ year, trips, pageNo, onOpenTrip }) => (
    <div className="w-full h-full relative flex flex-col" style={{ ...PAPER_TEXTURE, border: '1px solid #E0D8C6', borderRadius: 16 }}>
        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
            <span className="font-serif" style={{ fontSize: 17, fontWeight: 700, color: '#232320' }}>回憶</span>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', color: MUTE }}>MEMORIES · {year}</span>
        </div>
        <div className="flex-1 min-h-0 px-3 space-y-3 overflow-hidden">
            {trips.map(t => <MemoryCard key={t.id} trip={t} onOpen={() => onOpenTrip(t)} />)}
        </div>
        <span className="font-mono text-center" style={{ fontSize: 10, letterSpacing: '0.3em', color: '#B4B2A9', padding: '8px 0 10px' }}>{pageNo}</span>
    </div>
);
