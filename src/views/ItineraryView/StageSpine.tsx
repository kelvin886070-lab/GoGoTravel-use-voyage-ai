// src/views/ItineraryView/StageSpine.tsx
// 🎟️ 生命週期脊椎（簽名版）：規劃→準備→前夕→旅途→回憶。
//   時間驅動偵測當前段；走過段＝淺綠打勾、當前段＝ink 光暈、未到段依「可進 vs 上鎖」分兩種。
//   規劃/準備＝隨時可進（訂機票/房本來就早）→ outline 可點、無鎖；
//   前夕/旅途/回憶＝時間閘門，未到時上鎖，但點擊會回呼 onLockedTap（跳溫柔說明，不是靜默）。
//   selected＝正在看的段（可回逛過去段）；current＝時間定的當前段（留「現在」標記）。
import React from 'react';
import { ListChecks, Luggage, Hourglass, Footprints, Image, Lock } from 'lucide-react';

const INK = '#232320', PAPER = '#F6F1E7', GREEN = '#3F6B52', GREENLT = '#9FCAB4', MUTE = '#8A8266', TRACK = '#D6CDB8', BORDER = '#C9BFA6';

export const STAGES = [
    { key: 'plan', label: '規劃', Icon: ListChecks },
    { key: 'prepare', label: '準備', Icon: Luggage },
    { key: 'eve', label: '前夕', Icon: Hourglass },
    { key: 'trip', label: '旅途', Icon: Footprints },
    { key: 'memory', label: '回憶', Icon: Image },
] as const;
export type StageKey = typeof STAGES[number]['key'];

// 只有前夕(2)/旅途(3)/回憶(4)是「非到不可」的時間閘門；規劃/準備隨時可進。
export const LOCKABLE_FROM = 2;

// 時間驅動階段：回來後(4)｜旅途中(3)｜前夕≤3天(2)｜準備≤21天(1)｜規劃(>21天,0)
//   注意：階段分界(21天)與「脊椎啟動/變暗」門檻(30天,見 ItineraryView spineActivated)是兩件事。
//   時間軸：>30天整條變暗 → 30~21天規劃亮「現在」→ 21~3天準備亮 → ≤3天前夕。
export const computeStage = (trip: { startDate?: string; endDate?: string }): number => {
    const p = (s?: string) => { const [y, m, d] = (s || '').split('-').map(Number); if (!y) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt.getTime(); };
    const s = p(trip.startDate), e = p(trip.endDate);
    if (s == null) return 0;
    const t = new Date(); t.setHours(0, 0, 0, 0); const now = t.getTime();
    if (e != null && now > e) return 4;
    if (now >= s && (e == null || now <= e)) return 3;
    const days = Math.ceil((s - now) / 86400000);
    if (days <= 3) return 2;
    if (days <= 21) return 1;
    return 0;
};

// 脊椎「啟動」門檻：出發前 30 天內（或已在旅途/回憶）才點亮「現在」；更早整條變暗、只開放不施壓。
export const ACTIVATE_DAYS = 30;

interface Props {
    current: number;
    selected: number;
    onSelect: (i: number) => void;
    onLockedTap: (i: number) => void;
}

export const StageSpine: React.FC<Props> = ({ current, selected, onSelect, onLockedTap }) => {
    const pct = STAGES.length > 1 ? (Math.max(0, current) / (STAGES.length - 1)) * 100 : 0;
    return (
        <div className="relative px-1 py-1">
            <div className="absolute left-[30px] right-[30px] top-[13px] h-[2px]" style={{ background: TRACK }} />
            <div className="absolute left-[30px] top-[13px] h-[2px]" style={{ width: `calc(${pct}% - ${pct / 100 * 60}px)`, background: GREEN }} />
            <div className="flex justify-between relative">
                {STAGES.map((s, i) => {
                    const isSel = i === selected;
                    const isCurrent = i === current;
                    const done = i < current && !isSel;
                    const ahead = i > current;
                    const isLocked = ahead && i >= LOCKABLE_FROM;   // 前夕/旅途/回憶未到 → 上鎖（可點跳說明）
                    const isAvailable = ahead && i < LOCKABLE_FROM; // 規劃/準備未到 → 可進、無鎖
                    const { Icon } = s;
                    let circle: React.CSSProperties; let icon: React.ReactNode; let labelColor: string;
                    if (isSel) { circle = { background: INK, color: PAPER, boxShadow: `0 0 0 3px rgba(35,35,32,0.12)` }; icon = <Icon className="w-3 h-3" />; labelColor = INK; }
                    else if (done) { circle = { background: GREENLT, color: '#173d2b' }; icon = <Icon className="w-3 h-3" />; labelColor = GREEN; }
                    else if (isCurrent) { circle = { background: PAPER, color: GREEN, border: `2px solid ${GREEN}` }; icon = <Icon className="w-3 h-3" />; labelColor = GREEN; }
                    else if (isAvailable) { circle = { background: PAPER, color: MUTE, border: `1.5px solid ${BORDER}` }; icon = <Icon className="w-3 h-3" />; labelColor = MUTE; }
                    else { circle = { background: PAPER, color: MUTE, border: `1.5px dashed ${BORDER}`, opacity: 0.85 }; icon = <Lock className="w-2.5 h-2.5" />; labelColor = MUTE; }
                    return (
                        <button
                            key={s.key}
                            onClick={() => (isLocked ? onLockedTap(i) : onSelect(i))}
                            className="flex flex-col items-center gap-1 z-10 active:scale-95 transition-transform"
                        >
                            <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={circle}>{icon}</span>
                            <span className="text-[10px]" style={{ color: labelColor, fontWeight: isSel ? 700 : 400 }}>{s.label}</span>
                            {isCurrent && !isSel && <span className="font-mono text-[8px] tracking-wide" style={{ color: GREEN }}>現在</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
