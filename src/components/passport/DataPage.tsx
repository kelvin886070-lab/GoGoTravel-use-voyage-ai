// src/components/passport/DataPage.tsx
// 🛂 個資頁定稿（批③ · 與 Kelvin 逐項收斂的最終版）：
//   防偽底紋｜證件照白框＋鋼印壓角｜NAME｜會員碼（複製→toast 教學文案）｜
//   旅風/旅伴/最常去（三欄，深色一致；空狀態＝首趟後揭曉/養成中 N/3）｜簽名（暱稱斜體）｜
//   統計三格（只算已完成；首次翻到本頁 count-up）｜MRZ 44 字 TD3（更淡；含彩蛋 EST）｜
//   全新簽發態橫幅（0 趟時）｜右上 setting 選單（旅行證件→保管箱／登出——無假按鈕）。
import React, { useEffect, useRef, useState } from 'react';
import { Settings, Copy, LogOut, FileText } from 'lucide-react';
import { animate } from 'framer-motion';
import type { Trip, User } from '../../types';
import { toast } from '../Toast';
import {
    passportStats, travelStyle, companionType, mostVisited, friendCodeOf, mrzLines,
} from '../../services/passportStats';

const INK = '#232320', MUTE = '#8A8266', PAPER_EDGE = '#E0D8C6';
const EMPTY_STYLE: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#A89F8A', fontStyle: 'italic' };
const VALUE_STYLE: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: INK };

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="font-mono" style={{ fontSize: 8, letterSpacing: '0.16em', color: MUTE, marginBottom: 2 }}>{children}</div>
);

// 統計數字：首次「翻到本頁」時 0 → 實值滾動（active 才觸發；0 值直接顯示不演）
const CountUp: React.FC<{ value: number; active: boolean }> = ({ value, active }) => {
    const [display, setDisplay] = useState(active ? 0 : value);
    const played = useRef(false);
    useEffect(() => {
        if (!active || played.current) { setDisplay(value); return; }
        played.current = true;
        if (value <= 0) { setDisplay(0); return; }
        const controls = animate(0, value, {
            duration: 0.7, ease: 'easeOut',
            onUpdate: v => setDisplay(Math.round(v)),
        });
        return () => controls.stop();
    }, [active, value]);
    return <>{display}</>;
};

export const DataPage: React.FC<{
    user: User;
    trips: Trip[];
    active: boolean;               // 目前翻到本頁（count-up 觸發用）
    onLogout: () => void;
    onGoVault: () => void;
}> = ({ user, trips, active, onLogout, onGoVault }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const stats = passportStats(trips);
    const style = travelStyle(trips);
    const companion = companionType(trips);
    const visited = mostVisited(trips);
    const code = friendCodeOf(user.id);
    const estYear = String(new Date().getFullYear());   // v1：無註冊時間欄位，以當年顯示；profiles.created_at 建立後改讀真值
    const [mrz1, mrz2] = mrzLines(user.name, code, stats, estYear);
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
                <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.26em', color: MUTE }}>旅人護照 · PASSPORT</span>
                <button onClick={() => setMenuOpen(v => !v)} aria-label="設定" className="p-1 -m-1">
                    <Settings className="w-[18px] h-[18px]" style={{ color: '#5F5E5A' }} />
                </button>
            </div>

            {/* setting 選單：只放真功能（旅行證件→保管箱／登出），無假按鈕 */}
            {menuOpen && (
                <div className="absolute right-3 top-10 z-20 rounded-xl bg-white shadow-lg border border-black/5 py-1 w-44">
                    <button onClick={() => { setMenuOpen(false); onGoVault(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-[#232320] active:bg-black/5 text-left">
                        <FileText className="w-4 h-4" style={{ color: MUTE }} /> 旅行證件 · 保管箱
                    </button>
                    <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-[#A23B2E] active:bg-black/5 text-left">
                        <LogOut className="w-4 h-4" /> 登出
                    </button>
                </div>
            )}

            {/* 全新簽發態橫幅（0 完成趟；有第一枚章後永久消失） */}
            {fresh && (
                <div className="mx-4 mt-2.5 font-mono text-center" style={{ padding: '6px 10px', border: '1px dashed #C9BFA6', borderRadius: 8, fontSize: 9.5, letterSpacing: '0.12em', color: MUTE }}>
                    護照已簽發 · 等待第一枚章
                </div>
            )}

            {/* 證件照＋姓名/會員碼 */}
            <div className="flex gap-3.5 px-4" style={{ paddingTop: fresh ? 12 : 16 }}>
                <div className="relative shrink-0">
                    <div style={{ width: 80, height: 98, borderRadius: 5, background: '#fff', padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
                    </div>
                    {/* 鋼印壓角（防偽膜） */}
                    <div style={{ position: 'absolute', right: -9, bottom: -9, width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(63,107,82,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-14deg)', pointerEvents: 'none' }}>
                        <span className="font-mono" style={{ fontSize: 5.5, letterSpacing: '0.1em', color: 'rgba(63,107,82,0.45)', textAlign: 'center', lineHeight: 1.5 }}>KELVIN<br />TRIP</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className="mb-2.5">
                        <FieldLabel>姓名 / NAME</FieldLabel>
                        <div className="font-serif" style={{ fontSize: 19, fontWeight: 700, color: INK }}>{user.name}</div>
                    </div>
                    <div>
                        <FieldLabel>會員碼 / NO</FieldLabel>
                        <button onClick={copyCode} className="font-mono flex items-center gap-1.5 py-1 -my-1" style={VALUE_STYLE} aria-label="複製會員碼">
                            {code} <Copy className="w-[13px] h-[13px]" style={{ color: MUTE }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 旅風／旅伴／最常去（三欄，同深色；空值＝設計過的退位） */}
            <div className="flex px-4 font-mono" style={{ paddingTop: 12 }}>
                <button onClick={explainStyle} className="flex-1 text-left" aria-label="旅風說明">
                    <FieldLabel>旅風 / STYLE</FieldLabel>
                    {style.ready
                        ? <div style={VALUE_STYLE}>{style.label}</div>
                        : <div style={EMPTY_STYLE}>養成中 {style.progress}/{style.threshold}</div>}
                </button>
                <div className="flex-1">
                    <FieldLabel>旅伴 / COMPANION</FieldLabel>
                    {companion ? <div style={VALUE_STYLE}>{companion}</div> : <div style={EMPTY_STYLE}>首趟後揭曉</div>}
                </div>
                <div className="flex-1">
                    <FieldLabel>最常去 / VISITED</FieldLabel>
                    {visited ? <div style={VALUE_STYLE}>{visited}</div> : <div style={EMPTY_STYLE}>首趟後揭曉</div>}
                </div>
            </div>

            {/* 簽名欄（暱稱斜體；手寫簽名板＝未來批，docs 已記） */}
            <div className="px-4" style={{ paddingTop: 12 }}>
                <FieldLabel>持照人簽名 / SIGNATURE</FieldLabel>
                <div className="font-serif" style={{ fontStyle: 'italic', fontSize: 18, color: '#3d3a33', padding: '1px 4px 4px', borderBottom: '1px solid #C9BFA6', display: 'inline-block', minWidth: 150 }}>
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
                        <div style={{ fontSize: 9, color: MUTE, marginTop: 1 }}>{it.label}</div>
                    </div>
                ))}
            </div>

            {/* MRZ（TD3 44 字 ×2，淡到只是紙的一部分；彩蛋：姓名/會員碼/統計/EST） */}
            <div className="font-mono mt-auto" style={{ padding: '9px 12px', borderTop: `1px solid #E8E1D0`, background: 'rgba(241,235,221,0.6)', fontSize: 9, letterSpacing: '0.6px', color: 'rgba(95,94,90,0.55)', lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {mrz1}<br />{mrz2}
            </div>
        </div>
    );
};
