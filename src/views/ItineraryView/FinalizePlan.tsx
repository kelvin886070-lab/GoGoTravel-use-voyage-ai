// src/views/ItineraryView/FinalizePlan.tsx
// 🎟️ 批 B：規劃臉「行程排定」——列表模式行程最下方的定案入口（樣式從簡，chrome 收斂輪再整）。
//   排定＝點亮首頁/準備臉五段中的「規劃」格（單一真相 isPlanFinalized，見 services/readiness）。
//   三態：未排定→虛線 CTA；手動排定→綠框✓＋撤銷；自動排定（已訂票/前夕）→綠框✓＋撤銷。
//   撤銷寫入 planningStatus='draft'（明確意圖），自動判定全部讓路——修「先訂票後排行程」的假陽性。
//   對話框（A 套文案）：空白日提醒但不擋（尊重自由日）。
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { Trip } from '../../types';
import { isPlanFinalized, isManuallyFinalized } from '../../services/readiness';

const GREEN = '#3F6B52', MUTE = '#8A8266', INK = '#232320';

export const FinalizePlan: React.FC<{ trip: Trip; onUpdateTrip: (t: Trip) => void }> = ({ trip, onUpdateTrip }) => {
    const [confirmOpen, setConfirmOpen] = useState(false);

    const finalized = isPlanFinalized(trip);
    const manual = isManuallyFinalized(trip);

    // 空白日＝沒有任何非交通活動的天（提醒不擋）
    const emptyDays = (trip.days || []).filter(d =>
        !(d.activities || []).some(a => (a.type || '').toLowerCase() !== 'transport')
    ).length;

    const doFinalize = () => {
        onUpdateTrip({ ...trip, planningStatus: 'ready', finalizedAt: new Date().toISOString() });
        setConfirmOpen(false);
    };
    const doRevoke = () => {
        onUpdateTrip({ ...trip, planningStatus: 'draft', finalizedAt: undefined });
    };

    // 自動排定的來源說明（不可撤——它是事實，不是選擇）
    const autoReason = trip.readiness?.hasBooking ? '已開始訂票，自動排定' : '出發在即，自動排定';
    const finalizedDate = (trip.finalizedAt || '').slice(0, 10).replace(/-/g, '.');

    return (
        <div className="px-1 pt-2">
            {finalized ? (
                <div className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: 'rgba(63,107,82,0.08)', border: `1.5px solid ${GREEN}` }}>
                    <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0" style={{ background: GREEN, color: '#fff' }}>
                        <Check className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="font-serif text-[15px] font-bold" style={{ color: GREEN }}>已排定</div>
                        <div className="font-mono text-[10px] mt-0.5" style={{ color: MUTE }}>
                            {manual ? `${finalizedDate} 排定 · 之後仍可修改行程` : autoReason}
                        </div>
                    </div>
                    <button onClick={doRevoke} className="text-[12px] underline shrink-0" style={{ color: MUTE }}>撤銷</button>
                </div>
            ) : (
                <button
                    onClick={() => setConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] py-3.5 active:scale-[0.99] transition-transform"
                    style={{ border: `1.5px dashed ${MUTE}` }}
                >
                    <Check className="w-[17px] h-[17px]" style={{ color: GREEN }} />
                    <span className="font-serif text-[15px] font-bold" style={{ color: INK }}>行程排定</span>
                    <span className="font-mono text-[10px] tracking-wide" style={{ color: MUTE }}>都排好了就按這裡</span>
                </button>
            )}

            {/* 對話框（A 套文案）：空白日提醒不擋 */}
            {confirmOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/45" onClick={() => setConfirmOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-[20px] bg-[#F6F1E7] p-6 shadow-2xl">
                        <h3 className="font-serif text-[19px] font-bold" style={{ color: INK }}>要將行程排定嗎？</h3>
                        <p className="text-[13px] leading-relaxed mt-2" style={{ color: '#5F5E5A' }}>
                            排定後，就緒進度會開始追蹤訂票與行前準備。之後仍可修改行程或撤銷排定。
                        </p>
                        {emptyDays > 0 && (
                            <p className="text-[12px] mt-3 rounded-lg px-3 py-2" style={{ background: 'rgba(186,117,23,0.10)', color: '#854F0B' }}>
                                尚有 {emptyDays} 天未安排，仍要排定嗎？
                            </p>
                        )}
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setConfirmOpen(false)} className="flex-1 py-3 rounded-full text-[13px] font-bold bg-white" style={{ color: MUTE, border: '1px solid rgba(0,0,0,0.08)' }}>
                                稍後再說
                            </button>
                            <button onClick={doFinalize} className="flex-1 py-3 rounded-full text-[13px] font-bold text-white" style={{ background: GREEN }}>
                                排定行程
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
