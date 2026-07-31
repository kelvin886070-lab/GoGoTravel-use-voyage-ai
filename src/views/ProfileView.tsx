// src/views/ProfileView.tsx
// 🛂 個人檔案＝一本可以翻的護照（批②：骨架組裝）。
//   結構：封面（深綠燙金）→ 個資頁（批③換完整版，現為過渡內容＋登出）→ 空白頁（下一枚章鉤子）。
//   翻頁引擎見 components/passport/PassportBook（T2 跟手＋A+B 開啟）。
//   批③：個資頁完整版＋profiles 表；批④：內頁回憶卡；批⑤：照片；批⑥：蓋章儀式＋音效。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Trip, User } from '../types';
import { PassportBook, type PassportBookHandle } from '../components/passport/PassportBook';
import { PassportCover } from '../components/passport/PassportCover';
import { DataPage } from '../components/passport/DataPage';
import { MemoryPage } from '../components/passport/MemoryPage';
import { completedTrips } from '../services/passportStats';
import { ensureProfile } from '../services/profile';
import { AccountCenter } from '../components/passport/AccountCenter';

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
    onUpdateTrip: (t: Trip) => void; // 安靜更新（手記存檔；App 端不動 selectedTrip）
}> = ({ user, trips, onLogout, onPlanNew, onGoWishbox, onGoVault, onAvatarChange, onOpenTrip, onUpdateTrip }) => {
    const [pageIdx, setPageIdx] = useState(0);
    const [tocOpen, setTocOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const bookRef = useRef<PassportBookHandle>(null);
    // profiles 列 best-effort 同步（表未建/離線皆靜默，見 services/profile.ts）
    useEffect(() => { void ensureProfile(user.id, user.name); }, [user.id, user.name]);

    const memorySheets = useMemo(() => buildMemorySheets(trips), [trips]);
    const labels = useMemo(() => ([
        { zh: '封面', en: 'COVER' },
        { zh: '個人資料頁', en: 'DATA PAGE' },
        ...memorySheets.map(sh => ({ zh: '回憶', en: `MEMORIES ${sh.year}` })),
        { zh: '空白頁', en: 'BLANK' },
    ]), [memorySheets]);

    // 目錄項：封面/個資頁 → 年份節標 → 每趟回憶（頁碼）→ 空白頁
    interface TocEntry { key: string; label: string; idx?: number; pageNo?: string; section?: boolean; muted?: boolean }
    const tocEntries = useMemo<TocEntry[]>(() => {
        const out: TocEntry[] = [
            { key: 'cover', label: '封面', idx: 0 },
            { key: 'data', label: '個人資料頁', idx: 1 },
        ];
        let lastYear: number | null = null;
        memorySheets.forEach((sh, i) => {
            if (sh.year !== lastYear) { out.push({ key: `y-${sh.year}`, label: String(sh.year), section: true }); lastYear = sh.year; }
            out.push({ key: `m-${i}`, label: sh.trips[0]?.destination || '旅程', idx: 2 + i, pageNo: pad2(i + 1) });
        });
        out.push({ key: 'blank', label: '空白頁', idx: 2 + memorySheets.length, pageNo: pad2(memorySheets.length + 1), muted: true });
        return out;
    }, [memorySheets]);
    return (
        <div className="h-full w-full bg-[#E4E2DD] flex flex-col items-center justify-center px-3 relative overflow-hidden">
            {/* B+C 定案：比例 1:1.52（口袋書感，介於真護照與螢幕之間，上下空白減半）；
                下方留白交給頁碼指示（有工作的留白）；上方留白＝書上方的空氣，保持乾淨。 */}
            <div className="w-full" style={{ aspectRatio: '1 / 1.52', maxHeight: 'calc(100% - 58px)', maxWidth: 420 }}>
                <PassportBook
                    ref={bookRef}
                    cover={<PassportCover />}
                    onPageChange={setPageIdx}
                    pages={[
                        <DataPage key="data" user={user} trips={trips} active={pageIdx === 1} onAvatarChange={onAvatarChange} />,
                        ...memorySheets.map((sh, i) => (
                            <MemoryPage key={`mem-${sh.year}-${i}`} year={sh.year} trips={sh.trips} pageNo={pad2(i + 1)} onOpenTrip={onOpenTrip} onUpdateTrip={onUpdateTrip} />
                        )),
                        <BlankPage key="blank" pageNo={pad2(memorySheets.length + 1)} onPlanNew={onPlanNew} onGoWishbox={onGoWishbox} />,
                    ]}
                />
            </div>
            {/* 書下工具列：頁點（可點跳，iPhone 桌布式）＋頁名＋「目錄／帳戶」底線字（批⑤a 定案，無膠囊） */}
            <div className="flex flex-col items-center gap-1.5 pt-3 pb-1">
                <div className="flex">
                    {labels.map((_, i) => (
                        <button key={i} onClick={() => bookRef.current?.goTo(i)} aria-label={`跳到${labels[i]?.zh}`}
                            className="flex items-center justify-center" style={{ width: 24, height: 24 }}>
                            <span className="rounded-full transition-all duration-300"
                                style={{ width: i === pageIdx ? 17 : 6, height: 6, background: i === pageIdx ? '#3F6B52' : '#C9BFA6' }} />
                        </button>
                    ))}
                </div>
                <span className="text-[#8A8266]"><span className="font-serif text-[13px]">{labels[pageIdx]?.zh}</span><span className="font-mono text-[11px] tracking-[0.18em]"> · {labels[pageIdx]?.en}</span></span>
            </div>

            {/* 「目錄／帳戶」沉到畫面底部（Kelvin 定案）：書＋頁碼一組置中、工具連結一組貼底，中段留呼吸 */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-9">
                <button onClick={() => setTocOpen(true)} className="font-serif text-[13px] font-bold underline underline-offset-4 decoration-[#B4B2A9] decoration-1 py-1.5" style={{ color: '#5F5E5A' }}>目錄</button>
                <button onClick={() => setAccountOpen(true)} className="font-serif text-[13px] font-bold underline underline-offset-4 decoration-[#B4B2A9] decoration-1 py-1.5" style={{ color: '#5F5E5A' }}>帳戶</button>
            </div>

            {/* 目錄抽屜：紙色、蓋在書上（書仍在後方變暗）；點列＝riffle 跳頁 */}
            {tocOpen && (
                <div className="absolute inset-0 z-30" onClick={() => setTocOpen(false)}>
                    <div className="absolute inset-0" style={{ background: 'rgba(35,35,32,0.28)' }} />
                    <div className="absolute inset-x-0 bottom-0 rounded-t-[18px] px-5 pt-3 pb-5" onClick={e => e.stopPropagation()}
                        style={{ ...PAPER_TEXTURE, boxShadow: '0 -8px 22px rgba(0,0,0,0.16)', maxHeight: '70%', overflowY: 'auto' }}>
                        <div style={{ width: 34, height: 4, borderRadius: 2, background: '#D6CDB8', margin: '0 auto 10px' }} />
                        <div className="font-serif text-[15px] font-bold mb-1">目錄 <span className="font-mono text-[9px] text-[#8A8266] tracking-[0.16em]">CONTENTS</span></div>
                        {tocEntries.map(entry => (
                            entry.section
                                ? <div key={entry.key} className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', color: '#8A8266', padding: '8px 2px 2px' }}>{entry.label}</div>
                                : (
                                    <button key={entry.key} onClick={() => { setTocOpen(false); bookRef.current?.goTo(entry.idx!); }}
                                        className="w-full flex items-center gap-3 py-3 px-2 text-left border-b border-black/5 rounded-lg"
                                        style={entry.idx === pageIdx ? { background: 'rgba(63,107,82,0.07)' } : undefined}>
                                        <span className="font-serif flex-1 text-[14px] font-bold" style={{ color: entry.idx === pageIdx ? '#3F6B52' : entry.muted ? '#8A8266' : '#232320' }}>{entry.label}</span>
                                        {entry.pageNo && <span className="font-mono text-[10px] text-[#8A8266]">{entry.pageNo}</span>}
                                    </button>
                                )
                        ))}
                    </div>
                </div>
            )}

            {/* 會員中心：整頁右滑入（白底＝離開書的世界） */}
            <AccountCenter
                open={accountOpen}
                user={user}
                onClose={() => setAccountOpen(false)}
                onLogout={onLogout}
                onGoVault={() => { setAccountOpen(false); onGoVault(); }}
                onAvatarChange={onAvatarChange}
            />
        </div>
    );
};
