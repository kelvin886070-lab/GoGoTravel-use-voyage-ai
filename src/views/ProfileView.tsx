// src/views/ProfileView.tsx
// 🛂 個人檔案＝一本可以翻的護照（批②：骨架組裝）。
//   結構：封面（深綠燙金）→ 個資頁（批③換完整版，現為過渡內容＋登出）→ 空白頁（下一枚章鉤子）。
//   翻頁引擎見 components/passport/PassportBook（T2 跟手＋A+B 開啟）。
//   批③：個資頁完整版＋profiles 表；批④：內頁回憶卡；批⑤：照片；批⑥：蓋章儀式＋音效。
import React, { useEffect, useMemo, useState } from 'react';
import type { Trip, User } from '../types';
import { PassportBook } from '../components/passport/PassportBook';
import { PassportCover } from '../components/passport/PassportCover';
import { DataPage } from '../components/passport/DataPage';
import { MemoryPage } from '../components/passport/MemoryPage';
import { completedTrips } from '../services/passportStats';
import { ensureProfile } from '../services/profile';

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

// 空白頁：回憶的盡頭接期待（結構性空狀態，Kelvin 定案保留為最後一頁）
const BlankPage: React.FC<{ pageNo: string; onPlanNew: () => void; onGoWishbox: () => void }> = ({ pageNo, onPlanNew, onGoWishbox }) => (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-4 px-8" style={{ ...PAPER_TEXTURE, border: '1px solid #E0D8C6', borderRadius: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px dashed #C9BFA6' }} />
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px dashed #C9BFA6', opacity: 0.6, transform: 'translateX(40px) rotate(8deg)', marginTop: -10 }} />
        <div className="font-serif text-[18px] font-bold text-[#5F5E5A] mt-2">下一枚章，會蓋在哪？</div>
        <button onClick={onPlanNew} className="h-10 px-5 rounded-full bg-[#232320] text-white text-[13px] font-bold font-serif active:scale-95 transition-transform">規劃新的一趟</button>
        <button onClick={onGoWishbox} className="font-serif text-[12px] text-[#8A8266] underline">去心願盒看看</button>
        {/* 頁碼：內頁才有（封面/個資頁不編號，Kelvin 定案）；回憶內頁（批④）沿用同款 */}
        <span className="font-mono absolute bottom-3 inset-x-0 text-center" style={{ fontSize: 10, letterSpacing: '0.3em', color: '#B4B2A9' }}>{pageNo}</span>
    </div>
);

// 🛂 批④：回憶內頁組頁（純函式）——已完成旅程按「年份新→舊」分組、組內按出發日新→舊、一頁一張卡（照片同旅途中 hero 高度）。
//   內頁編號 01 起連號（封面/個資頁不編號，Kelvin 定案），空白頁接在最後一號。
interface MemorySheet { year: number; trips: Trip[] }
const buildMemorySheets = (trips: Trip[]): MemorySheet[] => {
    const done = completedTrips(trips).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const byYear = new Map<number, Trip[]>();
    for (const t of done) {
        const y = Number((t.endDate || '').slice(0, 4)) || new Date().getFullYear();
        byYear.set(y, [...(byYear.get(y) || []), t]);
    }
    const sheets: MemorySheet[] = [];
    for (const [year, list] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
        for (const t of list) sheets.push({ year, trips: [t] });
    }
    return sheets;
};
const pad2 = (n: number) => String(n).padStart(2, '0');

export const ProfileView: React.FC<{
    user: User;
    trips: Trip[];
    onLogout: () => void;
    onPlanNew: () => void;
    onGoWishbox: () => void;
    onGoVault: () => void;
    onAvatarChange: (url: string) => void;
    onOpenTrip: (t: Trip) => void;   // 點回憶卡 → 該趟行程頁（computeStage=4 自動落回憶臉）
}> = ({ user, trips, onLogout, onPlanNew, onGoWishbox, onGoVault, onAvatarChange, onOpenTrip }) => {
    const [pageIdx, setPageIdx] = useState(0);
    // profiles 列 best-effort 同步（表未建/離線皆靜默，見 services/profile.ts）
    useEffect(() => { void ensureProfile(user.id, user.name); }, [user.id, user.name]);

    const memorySheets = useMemo(() => buildMemorySheets(trips), [trips]);
    const labels = useMemo(() => ([
        { zh: '封面', en: 'COVER' },
        { zh: '個人資料頁', en: 'DATA PAGE' },
        ...memorySheets.map(sh => ({ zh: '回憶', en: `MEMORIES ${sh.year}` })),
        { zh: '空白頁', en: 'BLANK' },
    ]), [memorySheets]);
    return (
        <div className="h-full w-full bg-[#E4E2DD] flex flex-col items-center justify-center px-3">
            {/* B+C 定案：比例 1:1.52（口袋書感，介於真護照與螢幕之間，上下空白減半）；
                下方留白交給頁碼指示（有工作的留白）；上方留白＝書上方的空氣，保持乾淨。 */}
            <div className="w-full" style={{ aspectRatio: '1 / 1.52', maxHeight: 'calc(100% - 58px)', maxWidth: 420 }}>
                <PassportBook
                    cover={<PassportCover />}
                    onPageChange={setPageIdx}
                    pages={[
                        <DataPage key="data" user={user} trips={trips} active={pageIdx === 1} onLogout={onLogout} onGoVault={onGoVault} onAvatarChange={onAvatarChange} />,
                        ...memorySheets.map((sh, i) => (
                            <MemoryPage key={`mem-${sh.year}-${i}`} year={sh.year} trips={sh.trips} pageNo={pad2(i + 1)} onOpenTrip={onOpenTrip} />
                        )),
                        <BlankPage key="blank" pageNo={pad2(memorySheets.length + 1)} onPlanNew={onPlanNew} onGoWishbox={onGoWishbox} />,
                    ]}
                />
            </div>
            {/* 頁碼指示：mono 標籤＋小點，翻頁跟著變（同時解「不知道在第幾頁」的洞） */}
            <div className="flex flex-col items-center gap-2 pt-3.5 pb-1">
                <div className="flex gap-1.5">
                    {labels.map((_, i) => (
                        <span key={i} className="rounded-full transition-all duration-300"
                            style={{ width: i === pageIdx ? 17 : 6, height: 6, background: i === pageIdx ? '#3F6B52' : '#C9BFA6' }} />
                    ))}
                </div>
                <span className="text-[#8A8266]"><span className="font-serif text-[13px]">{labels[pageIdx]?.zh}</span><span className="font-mono text-[11px] tracking-[0.18em]"> · {labels[pageIdx]?.en}</span></span>
            </div>
        </div>
    );
};
