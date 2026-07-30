// src/views/ProfileView.tsx
// 🛂 個人檔案＝一本可以翻的護照（批②：骨架組裝）。
//   結構：封面（深綠燙金）→ 個資頁（批③換完整版，現為過渡內容＋登出）→ 空白頁（下一枚章鉤子）。
//   翻頁引擎見 components/passport/PassportBook（T2 跟手＋A+B 開啟）。
//   批③：個資頁完整版＋profiles 表；批④：內頁回憶卡；批⑤：照片；批⑥：蓋章儀式＋音效。
import React, { useEffect, useState } from 'react';
import type { Trip, User } from '../types';
import { PassportBook } from '../components/passport/PassportBook';
import { PassportCover } from '../components/passport/PassportCover';
import { DataPage } from '../components/passport/DataPage';
import { ensureProfile } from '../services/profile';

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

// 空白頁：回憶的盡頭接期待（結構性空狀態，Kelvin 定案保留為最後一頁）
const BlankPage: React.FC<{ onPlanNew: () => void; onGoWishbox: () => void }> = ({ onPlanNew, onGoWishbox }) => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-8" style={{ ...PAPER_TEXTURE, border: '1px solid #E0D8C6', borderRadius: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px dashed #C9BFA6' }} />
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px dashed #C9BFA6', opacity: 0.6, transform: 'translateX(40px) rotate(8deg)', marginTop: -10 }} />
        <div className="font-serif text-[18px] font-bold text-[#5F5E5A] mt-2">下一枚章，會蓋在哪？</div>
        <button onClick={onPlanNew} className="h-10 px-5 rounded-full bg-[#232320] text-white text-[13px] font-bold active:scale-95 transition-transform">規劃新的一趟</button>
        <button onClick={onGoWishbox} className="text-[12px] text-[#8A8266] underline">去心願盒看看</button>
    </div>
);

const PAGE_LABELS = ['封面 · COVER', '個資頁 · 01', '空白頁 · 02'];

export const ProfileView: React.FC<{
    user: User;
    trips: Trip[];
    onLogout: () => void;
    onPlanNew: () => void;
    onGoWishbox: () => void;
    onGoVault: () => void;
}> = ({ user, trips, onLogout, onPlanNew, onGoWishbox, onGoVault }) => {
    const [pageIdx, setPageIdx] = useState(0);
    // profiles 列 best-effort 同步（表未建/離線皆靜默，見 services/profile.ts）
    useEffect(() => { void ensureProfile(user.id, user.name); }, [user.id, user.name]);
    return (
        <div className="h-full w-full bg-[#E4E2DD] flex flex-col items-center justify-center px-3">
            {/* B+C 定案：比例 1:1.52（口袋書感，介於真護照與螢幕之間，上下空白減半）；
                下方留白交給頁碼指示（有工作的留白）；上方留白＝書上方的空氣，保持乾淨。 */}
            <div className="w-full" style={{ aspectRatio: '1 / 1.52', maxHeight: 'calc(100% - 58px)', maxWidth: 420 }}>
                <PassportBook
                    cover={<PassportCover />}
                    onPageChange={setPageIdx}
                    pages={[
                        <DataPage key="data" user={user} trips={trips} active={pageIdx === 1} onLogout={onLogout} onGoVault={onGoVault} />,
                        <BlankPage key="blank" onPlanNew={onPlanNew} onGoWishbox={onGoWishbox} />,
                    ]}
                />
            </div>
            {/* 頁碼指示：mono 標籤＋小點，翻頁跟著變（同時解「不知道在第幾頁」的洞） */}
            <div className="flex flex-col items-center gap-2 pt-3.5 pb-1">
                <div className="flex gap-1.5">
                    {PAGE_LABELS.map((_, i) => (
                        <span key={i} className="rounded-full transition-all duration-300"
                            style={{ width: i === pageIdx ? 14 : 5, height: 5, background: i === pageIdx ? '#3F6B52' : '#C9BFA6' }} />
                    ))}
                </div>
                <span className="font-mono text-[9px] tracking-[0.22em] text-[#8A8266]">{PAGE_LABELS[pageIdx]}</span>
            </div>
        </div>
    );
};
