// src/components/passport/DataPage.tsx
// 🛂 個資頁定稿（批③ · 與 Kelvin 逐項收斂的最終版）：
//   防偽底紋｜證件照白框＋鋼印壓角｜NAME｜會員碼（複製→toast 教學文案）｜
//   旅風/旅伴/最常去（三欄，深色一致；空狀態＝首趟後揭曉/養成中 N/3）｜簽名（暱稱斜體）｜
//   統計三格（只算已完成；首次翻到本頁 count-up）｜MRZ 44 字 TD3（更淡；含彩蛋 EST）｜
//   全新簽發態橫幅（0 趟時）｜右上「鋼筆」＝編輯這本護照（換頭貼；批⑤a 定案——
//   保管箱/回報問題/登出已遷居會員中心，護照回歸純情感物件）。
import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Copy } from 'lucide-react';
import { animate } from 'framer-motion';
import type { Trip, User } from '../../types';
import { toast } from '../Toast';
import { EditProfileModal } from './EditProfileModal';
import { toYmd, type ProfileMeta } from '../../services/profile';
import {
    passportStats, travelStyle, companionType, mostVisited, friendCodeOf, mrzLines,
} from '../../services/passportStats';

const INK = '#232320', MUTE = '#8A8266', PAPER_EDGE = '#E0D8C6';
const EMPTY_STYLE: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#A89F8A', fontStyle: 'italic' };
const VALUE_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: INK };

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

// 欄位標籤：中文＝serif（與 hero 卡同字體）、英文＝mono——全 App 中文統一規則（Kelvin 定案）
const FieldLabel: React.FC<{ zh: string; en: string }> = ({ zh, en }) => (
    <div style={{ marginBottom: 2 }}>
        <span className="font-serif" style={{ fontSize: 10, color: MUTE }}>{zh}</span>
        <span className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: MUTE }}> / {en}</span>
    </div>
);

// 統計數字：首次「翻到本頁」時 0 → 實值滾動（active 才觸發；0 值直接顯示不演）。
// shown＝null 表示「顯示實值」，只在演出期間接管——effect 內不做同步 setState
// （react-hooks/set-state-in-effect；動畫 onUpdate/onComplete 是非同步回呼，合規）。
const CountUp: React.FC<{ value: number; active: boolean }> = ({ value, active }) => {
    const [shown, setShown] = useState<number | null>(() => (active && value > 0 ? 0 : null));
    const played = useRef(false);
    useEffect(() => {
        if (!active || played.current || value <= 0) return;
        played.current = true;
        const controls = animate(0, value, {
            duration: 0.7, ease: 'easeOut',
            onUpdate: v => setShown(Math.round(v)),
            onComplete: () => setShown(null),
        });
        return () => controls.stop();
    }, [active, value]);
    return <>{shown ?? value}</>;
};

export const DataPage: React.FC<{
    user: User;
    trips: Trip[];
    active: boolean;               // 目前翻到本頁（count-up 觸發用）
    meta?: ProfileMeta | null;     // DB meta（會員碼覆寫/role/加入年）；null＝載入中或離線，各欄有退位
    onAvatarChange: (url: string) => void;   // 換頭貼成功 → App 更新 user.avatar（全站同步）
}> = ({ user, trips, active, meta, onAvatarChange }) => {
    const [editOpen, setEditOpen] = useState(false);

    const stats = passportStats(trips);
    const style = travelStyle(trips);
    const companion = companionType(trips);
    const visited = mostVisited(trips);
    const code = meta?.friendCode || friendCodeOf(user.id);          // DB 覆寫（Founder 序號碼）優先
    const joinDate = meta?.joinDate || toYmd(new Date()) || '';      // 退位：今天（表未建/離線）
    const [mrz1, mrz2] = mrzLines(user.name, code, stats, joinDate);
    const fresh = stats.trips === 0;

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast('會員碼已複製，分享給旅伴吧', 'success');
        } catch {
            toast('複製失敗，長按自行選取', 'error');
        }
    };

    const explainStyle = () => {
        if (style.ready) toast(`你的行程裡，${style.label.slice(0, 2)}類佔了 ${style.sharePct}%`, 'info');
        else toast(`再完成 ${style.threshold - style.progress} 趟旅程，旅風就會揭曉`, 'info');
    };

    return (
        <div className="w-full h-full relative flex flex-col overflow-hidden" style={{ ...PAPER_TEXTURE, border: `1px solid ${PAPER_EDGE}`, borderRadius: 16 }}>
            {/* 頂列 */}
            <div className="flex items-center justify-between px-4 pt-3.5">
                <span><span className="font-serif" style={{ fontSize: 11, color: MUTE }}>旅人護照</span><span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.26em', color: MUTE }}> · PASSPORT</span></span>
                <button onClick={() => setEditOpen(true)} aria-label="編輯這本護照" className="p-1 -m-1">
                    <PenLine className="w-[18px] h-[18px]" style={{ color: '#5F5E5A' }} />
                </button>
            </div>

            {/* 全新簽發態橫幅（0 完成趟；有第一枚章後永久消失） */}
            {fresh && (
                <div className="mx-4 mt-2.5 font-serif text-center" style={{ padding: '6px 10px', border: '1px dashed #C9BFA6', borderRadius: 8, fontSize: 11, letterSpacing: '0.12em', color: MUTE }}>
                    護照已簽發 · 等待第一枚章
                </div>
            )}

            {/* 證件照＋姓名/會員碼 */}
            <div className="flex gap-3.5 px-4" style={{ paddingTop: fresh ? 12 : 16 }}>
                <button className="relative shrink-0 text-left" onClick={() => setEditOpen(true)} aria-label="編輯頭貼">
                    <div style={{ width: 108, height: 132, borderRadius: 5, background: '#fff', padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
                    </div>
                    {/* 鋼印壓角（防偽膜） */}
                    {/* 鋼印：舊款細圈字樣（Kelvin 定案；原始檔存 brand-assets/kt-seal-emboss.svg） */}
                    <img src="/brand/kt-seal.svg" alt="" width={56} height={56} draggable={false}
                        style={{ position: 'absolute', right: -13, bottom: -13, transform: 'rotate(-14deg)', pointerEvents: 'none' }} />
                </button>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className="mb-2.5">
                        <FieldLabel zh="姓名" en="NAME" />
                        <div className="font-serif" style={{ fontSize: 19, fontWeight: 700, color: INK }}>{user.name}</div>
                    </div>
                    {/* 會員碼＋身份同列（Kelvin 定案）；身份 / TYPE 只有 DB role 有值才渲染
                        （Founder/團隊職稱；一般使用者這欄不存在，版面零影響） */}
                    <div className="flex items-start gap-4">
                        <div>
                            <FieldLabel zh="會員碼" en="NO" />
                            <button onClick={copyCode} className="font-mono flex items-center gap-1.5 py-1 -my-1" style={VALUE_STYLE} aria-label="複製會員碼">
                                {code} <Copy className="w-[13px] h-[13px]" style={{ color: MUTE }} />
                            </button>
                        </div>
                        {meta?.role && (
                            <div>
                                <FieldLabel zh="身份" en="TYPE" />
                                <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#3F6B52', paddingTop: 2 }}>{meta.role}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 旅風／旅伴／最常去（三欄，同深色；空值＝設計過的退位） */}
            <div className="flex px-4 font-mono" style={{ paddingTop: 12 }}>
                <button onClick={explainStyle} className="flex-1 text-left" aria-label="旅風說明">
                    <FieldLabel zh="旅風" en="STYLE" />
                    {style.ready
                        ? <div className="font-serif" style={VALUE_STYLE}>{style.label}</div>
                        : <div className="font-serif" style={EMPTY_STYLE}>養成中 {style.progress}/{style.threshold}</div>}
                </button>
                <div className="flex-1">
                    <FieldLabel zh="旅伴" en="COMPANION" />
                    {companion ? <div className="font-serif" style={VALUE_STYLE}>{companion}</div> : <div className="font-serif" style={EMPTY_STYLE}>首趟後揭曉</div>}
                </div>
                <div className="flex-1">
                    <FieldLabel zh="最常去" en="VISITED" />
                    {visited ? <div className="font-serif" style={VALUE_STYLE}>{visited}</div> : <div className="font-serif" style={EMPTY_STYLE}>首趟後揭曉</div>}
                </div>
            </div>

            {/* 簽名欄——手寫變體（Kelvin 定案：拉開「印刷資料」與「本人筆跡」的視覺距離）：
                iOS/macOS 用系統手寫體（Snell Roundhand→Savoye LET→Bradley Hand），Android 退 cursive/斜體 serif；
                微傾 -2° ＝ 筆跡的不工整。真手寫簽名板＝未來批（docs 已記）。 */}
            <div className="px-4" style={{ paddingTop: 12 }}>
                <FieldLabel zh="持照人簽名" en="SIGNATURE" />
                <div style={{
                    fontFamily: "'Snell Roundhand', 'Savoye LET', 'Bradley Hand', 'Segoe Script', cursive, serif",
                    fontStyle: 'italic', fontSize: 21, color: '#3d3a33', transform: 'rotate(-2deg)', transformOrigin: 'left bottom',
                    padding: '1px 4px 4px', borderBottom: '1px solid #C9BFA6', display: 'inline-block', minWidth: 150,
                }}>
                    {user.name}
                </div>
            </div>

            {/* 統計三格（只算已完成；首次翻到本頁 count-up） */}
            <div className="flex mx-4 font-mono" style={{ marginTop: 13, borderTop: '1px dashed #D6CDB8', paddingTop: 11 }}>
                {[
                    { v: stats.trips, label: '趟旅程' },
                    { v: stats.cities, label: '座城市' },
                    { v: stats.days, label: '總旅遊天數' },
                ].map((it, i) => (
                    <div key={it.label} className="flex-1 text-center" style={i > 0 ? { borderLeft: '1px solid #EAE3D2' } : undefined}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: fresh ? MUTE : INK }}><CountUp value={it.v} active={active} /></div>
                        <div className="font-serif" style={{ fontSize: 10, color: MUTE, marginTop: 1 }}>{it.label}</div>
                    </div>
                ))}
            </div>

            {/* 編輯這本護照（鋼筆）：共用 EditProfileModal（會員中心同款） */}
            {editOpen && <EditProfileModal user={user} onAvatarChange={onAvatarChange} onClose={() => setEditOpen(false)} />}

            {/* MRZ（TD3 44 字 ×2，淡到只是紙的一部分；彩蛋：姓名/會員碼/統計/JOINED 加入年） */}
            <div className="font-mono mt-auto" style={{ padding: '9px 12px', borderTop: `1px solid #E8E1D0`, background: 'rgba(241,235,221,0.6)', fontSize: 9, letterSpacing: '0.6px', color: 'rgba(95,94,90,0.55)', lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {mrz1}<br />{mrz2}
            </div>
        </div>
    );
};
