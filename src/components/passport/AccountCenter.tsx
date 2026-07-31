// src/components/passport/AccountCenter.tsx
// 🛂 會員中心（批⑤a）：獨立整頁、右滑入、白底＝「離開書的世界」（護照＝情感物件、這裡＝工具管理）。
//   v1 只放真功能（無假入口鐵律）：身份列、編輯個人檔案、旅行證件·保管箱、回報問題、登出、版本。
//   上架批再加（docs 已記）：帳號與安全、刪除帳號（Apple 5.1.1 強制）、隱私權政策、服務條款、通知。
//   批⑥加：翻頁音效開關。未來擴大＝頁內分節＋搜尋（不升分頁——Kelvin 定案）。
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, UserPen, FileText, Mail, LogOut } from 'lucide-react';
import type { User } from '../../types';
import { friendCodeOf } from '../../services/passportStats';
import { EditProfileModal } from './EditProfileModal';

const MUTE = '#8A8266';

const Row: React.FC<{ icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void; href?: string }> =
    ({ icon, label, danger, onClick, href }) => {
        const inner = (
            <>
                <span style={{ color: danger ? '#A23B2E' : MUTE }}>{icon}</span>
                <span className="font-serif flex-1 text-left text-[14px] font-bold" style={{ color: danger ? '#A23B2E' : '#232320' }}>{label}</span>
                {!danger && <ChevronRight className="w-4 h-4" style={{ color: '#C9BFA6' }} />}
            </>
        );
        const cls = 'w-full flex items-center gap-3 py-3.5 border-b border-black/5 active:bg-black/5';
        return href
            ? <a href={href} className={cls}>{inner}</a>
            : <button onClick={onClick} className={cls}>{inner}</button>;
    };

export const AccountCenter: React.FC<{
    open: boolean;
    user: User;
    onClose: () => void;
    onLogout: () => void;
    onGoVault: () => void;
    onAvatarChange: (url: string) => void;
}> = ({ open, user, onClose, onLogout, onGoVault, onAvatarChange }) => {
    const [editOpen, setEditOpen] = useState(false);
    return (
        <div
            className="absolute inset-0 z-40 flex flex-col"
            style={{
                background: '#FAFAF8',
                transform: open ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 300ms cubic-bezier(.22,.61,.36,1)',
                pointerEvents: open ? 'auto' : 'none',
            }}
            aria-hidden={!open}
        >
            <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                <button onClick={onClose} aria-label="返回" className="p-1 -m-1">
                    <ChevronLeft className="w-5 h-5" style={{ color: '#5F5E5A' }} />
                </button>
                <span className="font-serif text-[17px] font-bold text-[#232320]">會員中心</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5">
                {/* 身份列 */}
                <div className="flex items-center gap-3 py-4 border-b border-black/5">
                    <img src={user.avatar} alt={user.name} className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div>
                        <div className="font-serif text-[15px] font-bold text-[#232320]">{user.name}</div>
                        <div className="font-mono text-[9px] tracking-[0.1em]" style={{ color: MUTE }}>{friendCodeOf(user.id)}</div>
                    </div>
                </div>

                <Row icon={<UserPen className="w-[17px] h-[17px]" />} label="編輯個人檔案" onClick={() => setEditOpen(true)} />
                <Row icon={<FileText className="w-[17px] h-[17px]" />} label="旅行證件 · 保管箱" onClick={onGoVault} />
                <Row icon={<Mail className="w-[17px] h-[17px]" />} label="回報問題" href="mailto:kelvin886070@gmail.com?subject=Kelvin%20Trip%20%E5%95%8F%E9%A1%8C%E5%9B%9E%E5%A0%B1" />
                <Row icon={<LogOut className="w-[17px] h-[17px]" />} label="登出" danger onClick={onLogout} />

                <div className="font-mono text-center" style={{ fontSize: 9, letterSpacing: '0.14em', color: '#B4B2A9', padding: '14px 0' }}>KELVIN TRIP · v1.0</div>
            </div>

            {editOpen && <EditProfileModal user={user} onAvatarChange={onAvatarChange} onClose={() => setEditOpen(false)} />}
        </div>
    );
};
