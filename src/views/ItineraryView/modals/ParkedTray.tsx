// src/views/ItineraryView/modals/ParkedTray.tsx
// 🎟️ Phase 4a：待安排托盤——規劃臉常駐膠囊點開。列出對帳溢位的活動（只搬不刪、看得見撿得回），
//   讓使用者挑一天把它放回去。point 1：複用心願盒 geo（suggestDayIndex）建議「最順」的天，其他天照樣可選。
import React from 'react';
import { Inbox, X, Navigation } from 'lucide-react';
import type { Activity, Trip } from '../../../types';
import { suggestDayIndex } from '../../../services/scheduler';

const INK = '#232320', PAPER = '#F6F1E7', GREEN = '#3F6B52', MUTE = '#8A8266', BORDER = '#E0D8C6';

interface Props {
  open: boolean;
  onClose: () => void;
  parked: Activity[];
  trip: Trip;
  onMoveToDay: (activity: Activity, dayIndex: number) => void;   // dayIndex 從 0 起算
}

export const ParkedTray: React.FC<Props> = ({ open, onClose, parked, trip, onMoveToDay }) => {
  if (!open) return null;
  const days = trip.days;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-in fade-in" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in"
        style={{ background: PAPER, borderRadius: 20, boxShadow: '0 -10px 40px rgba(35,35,32,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'Georgia, serif', fontSize: 16, color: INK }}>
            <Inbox className="w-4 h-4" style={{ color: '#8A6A2B' }} /> 待安排
          </span>
          <button onClick={onClose} aria-label="關閉" style={{ color: MUTE }}><X className="w-5 h-5" /></button>
        </div>

        <div style={{ padding: '12px 16px 18px', overflowY: 'auto' }}>
          {parked.length === 0 ? (
            <p style={{ margin: '18px 0', textAlign: 'center', fontSize: 13, color: MUTE }}>目前沒有待安排的行程。</p>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.6, color: MUTE }}>這些之前排不下，先幫你收在這。挑一天放回去，標「順路」的是離現有行程最近的。</p>
              {parked.map((a, i) => {
                const recIdx = suggestDayIndex(trip, a);   // 建議「最順」的天（有座標才算得出）
                return (
                  <div key={a.id ?? i} style={{ background: '#FFFFFF', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 12px', marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 14.5, color: INK }}>{a.title}</div>
                    {a.location && <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{a.location}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                      <span style={{ fontSize: 11, color: MUTE, alignSelf: 'center', marginRight: 2 }}>放到</span>
                      {days.map((d, di) => {
                        const recommended = di === recIdx && a.lat != null && a.lng != null;
                        return (
                          <button
                            key={di}
                            onClick={() => onMoveToDay(a, di)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 8, fontSize: 11.5,
                              border: `${recommended ? 1 : 0.5}px solid ${GREEN}`,
                              background: recommended ? '#E1EBE4' : 'transparent',
                              color: GREEN, fontWeight: recommended ? 700 : 400,
                            }}
                          >
                            {recommended && <Navigation className="w-3 h-3" />}
                            Day {d.day}{recommended ? '·順路' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
