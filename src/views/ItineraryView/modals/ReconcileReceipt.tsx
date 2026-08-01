// src/views/ItineraryView/modals/ReconcileReceipt.tsx
// 🎟️ Phase 4a：「行程調整收據」——匯入/改日期後跳一次，票根風，安心口吻、時間開頭。
//   只承接「剛剛發生什麼」；待安排的再安置交給規劃臉常駐膠囊。文案鐵律：安心陳述、去工程味、不用箭頭。
import React from 'react';
import { PlaneLanding, Lock, ArrowDown, Inbox, AlertTriangle, Sparkles, X } from 'lucide-react';
import type { ReconcileChange } from '../../../services/reconcile/applyReconcile';
import type { Conflict } from '../../../services/reconcile/reconcile';

const INK = '#232320', PAPER = '#F6F1E7', GREEN = '#3F6B52', MUTE = '#8A8266', BORDER = '#E0D8C6', GOLD = '#C9B98F';

interface Props {
  open: boolean;
  onClose: () => void;
  flightLabel?: string;          // 例：JX800 · 12:30
  changes: ReconcileChange[];
  conflicts: Conflict[];
  onReoptimize?: () => void;     // 4b：付費 opt-in；4a 不傳 → 只顯示「好，我知道了」
}

export const ReconcileReceipt: React.FC<Props> = ({ open, onClose, flightLabel, changes, conflicts, onReoptimize }) => {
  if (!open) return null;

  const anchors = changes.filter(c => c.kind === 'anchor');
  const moved = changes.filter(c => c.kind === 'moved');
  const parked = changes.filter(c => c.kind === 'parked');
  // out-of-range / 錨互撞 才進「提醒」區；parked 已在下方列出，不重複。
  const notices = conflicts.filter(c => c.kind === 'booking-out-of-range' || c.kind === 'anchor-collision');

  const intro: string[] = [];
  if (anchors.length) intro.push('訂位已加進行程。');
  if (moved.length) intro.push(`有 ${moved.length} 個安排幫你往後挪了，時間都接得上。`);
  if (parked.length) intro.push(`有 ${parked.length} 個景點這天排不下，先放進待安排。`);
  const introText = intro.join('') || '行程已為你更新。';

  const Row = ({ time, title, note, dim }: { time: string; title: string; note: React.ReactNode; dim?: boolean }) => (
    <div style={{ display: 'flex', gap: 10, marginBottom: 11, alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: dim ? '#B4B0A4' : INK, width: 42, flexShrink: 0 }}>{time}</span>
      <div style={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.5 }}>{title}{'\u3000'}<span style={{ fontSize: 11 }}>{note}</span></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-in fade-in" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in"
        style={{ background: PAPER, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, boxShadow: '0 -10px 40px rgba(35,35,32,0.18)' }}
      >
        {/* ink stub header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: INK, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: PAPER, fontFamily: 'Georgia, serif', fontSize: 15 }}>
            <PlaneLanding className="w-4 h-4" style={{ color: GOLD }} /> 行程已更新
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {flightLabel && <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.5, color: GOLD }}>{flightLabel}</span>}
            <button onClick={onClose} aria-label="關閉" style={{ color: 'rgba(255,255,255,0.55)' }}><X className="w-4 h-4" /></button>
          </div>
        </div>
        {/* perforation */}
        <div style={{ position: 'relative', height: 14, background: INK }}>
          <div style={{ position: 'absolute', left: -7, top: 0, width: 14, height: 14, background: PAPER, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', right: -7, top: 0, width: 14, height: 14, background: PAPER, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', left: 12, right: 12, top: '50%', borderTop: '1px dashed rgba(201,185,143,0.5)' }} />
        </div>

        <div style={{ padding: '13px 16px 6px', maxHeight: '52vh', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 13px', fontSize: 12.5, lineHeight: 1.7, color: '#5A564C' }}>{introText}</p>

          {anchors.map((c, i) => (
            <Row key={`a${i}`} time={c.time || '—'} title={c.title}
              note={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: GREEN }}><Lock className="w-3 h-3" /> 這個時間已為你固定</span>} />
          ))}
          {moved.map((c, i) => (
            <Row key={`m${i}`} time={c.time || '—'} title={c.title}
              note={<span style={{ color: MUTE }}><ArrowDown className="w-3 h-3 inline" style={{ verticalAlign: -2 }} /> 原本 {c.from}，幫你往後挪</span>} />
          ))}
          {parked.map((c, i) => (
            <Row key={`p${i}`} time="— —" title={c.title} dim
              note={<span style={{ color: '#8A6A2B' }}><Inbox className="w-3 h-3 inline" style={{ verticalAlign: -2 }} /> 這天排不下，先放進待安排</span>} />
          ))}

          {notices.map((c, i) => (
            <div key={`n${i}`} style={{ display: 'flex', gap: 8, marginTop: 4, padding: '9px 11px', background: '#FBF3E4', border: '0.5px solid #E7D9BE', borderRadius: 10 }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#8A6A2B', marginTop: 1 }} />
              <span style={{ fontSize: 12, lineHeight: 1.55, color: '#7A5E24' }}>{c.message}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 16px 16px', borderTop: `0.5px solid ${BORDER}`, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, border: 'none', borderRadius: 10, background: INK, color: PAPER, fontSize: 13 }}>好，我知道了</button>
          {onReoptimize && (
            <button onClick={onReoptimize} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 11, border: `1px solid ${GREEN}`, borderRadius: 10, background: 'transparent', color: GREEN, fontSize: 13 }}>
              <Sparkles className="w-4 h-4" /> 重新優化這天
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
