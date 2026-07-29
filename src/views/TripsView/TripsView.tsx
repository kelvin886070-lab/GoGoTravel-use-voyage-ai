// src/views/TripsView/TripsView.tsx
// 🏠 首頁骨架：產品身份＝「掌控為優先」的規劃工具。一進來就回答「哪一趟＋還有幾天＋下一步」。
//   結構：Header（戳章字標＋頭像）→ 旅途中捷徑（若在途中）→ 開新旅程 CTA（上移，統一風格）
//         → 下一趟 主 hero（最近出發）→ 其他計畫 次 hero（較遠、矮一號、同結構可展開）。
//   排序：按出發日（最近的當主角），取代手動拖曳。旅途中的行程只出現在捷徑、不重複進清單。
//   「從分享連結匯入」已移入 CreateTripModal（暫存），保持首頁乾淨。精彩回憶移出（改個人頁）。
import React, { useState, useMemo } from 'react';
import { Navigation, ArrowRight, ChevronRight } from 'lucide-react';

import type { Trip, User, WishItem } from '../../types';
import { MadeByFooter } from '../../components/UI';
import { BrandStamp, BrandWordmark } from '../../components/brand/BrandLogo';

import { TripHeroCard } from './components/cards/TripHeroCard';

// --- Modals ---
import { CreateTripModal } from './modals/CreateTripModal';
import { ImportTripModal } from './modals/ImportTripModal';
import { ProfileModal } from './modals/ProfileModal';
import { EditTripModal } from './modals/EditTripModal';

interface TripsViewProps {
  trips: Trip[];
  user: User;
  wishItems?: WishItem[];
  activeTrip?: Trip | null;              // 🧭 旅途中的行程（顯示捷徑卡；不重複進清單）
  onOpenActiveTrip?: () => void;
  onLogout: () => void;
  onAddTrip: (trip: Trip) => void;
  onImportTrip: (trip: Trip) => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onReorderTrips: (trips: Trip[]) => void;
  onUpdateTrip?: (trip: Trip) => void;
}

// 本地日期字串（YYYY-MM-DD）轉當地 00:00 timestamp；避免 UTC 位移。
const dayTs = (dateStr: string): number => {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const TripsView: React.FC<TripsViewProps> = ({
    trips, user, activeTrip, onOpenActiveTrip, onLogout, onAddTrip, onImportTrip, onSelectTrip,
    onUpdateTrip,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  // 即將出發＝endDate ≥ 今天、且非「旅途中那趟」（去重）；按出發日升冪（最近的在前）。
  const upcomingTrips = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTs = now.getTime();
    return trips
      .filter(t => dayTs(t.endDate) >= todayTs && t.id !== activeTrip?.id)
      .sort((a, b) => dayTs(a.startDate) - dayTs(b.startDate));
  }, [trips, activeTrip]);

  // 主 hero＝最近出發那趟；其餘進「接下來」次 hero 清單。
  const heroTrip = upcomingTrips[0] ?? null;
  const restTrips = useMemo(() => upcomingTrips.slice(1), [upcomingTrips]);

  // 🕰️ 回憶（過渡版）：完全結束的行程，按出發日新→舊。正式回憶卡/個人頁做好後整區替換。
  const pastTrips = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTs = now.getTime();
    return trips
      .filter(t => !!t.endDate && dayTs(t.endDate) < todayTs)
      .sort((a, b) => dayTs(b.startDate) - dayTs(a.startDate));
  }, [trips]);

  // 🧭 旅途中捷徑卡：今天是該行程第幾天
  const activeDayN = useMemo(() => {
    if (!activeTrip?.startDate) return 1;
    const s = dayTs(activeTrip.startDate);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.floor((t.getTime() - s) / 86400000) + 1;
  }, [activeTrip]);

  return (
    <div className="h-full flex flex-col w-full bg-transparent">

      {/* Header：戳章 + 字標 ＋ 頭像 */}
      <div className="flex-shrink-0 pt-9 pb-2 px-6 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 border-b border-black/5 w-full sticky top-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandStamp size={66} />
          <BrandWordmark size={22} />
        </div>
        <button
          onClick={() => setShowProfile(true)}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md active:scale-90 transition-transform"
          aria-label="會員"
        >
          <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto w-full scroll-smooth no-scrollbar pb-24">

        {/* 🧭 旅途中捷徑卡 */}
        {activeTrip && (
          <div className="px-5 pt-4">
            <button onClick={onOpenActiveTrip} className="w-full bg-[#232320] rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" /></span>
                  <span className="text-[10px] font-bold tracking-widest text-white/70">旅途中</span>
                </div>
                <p className="text-lg font-bold font-serif text-white mt-1 truncate">{activeTrip.destination}</p>
                <p className="text-[11px] font-mono text-white/60 tracking-widest mt-0.5">DAY {activeDayN} · 開啟今天</p>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#45846D] text-white flex items-center justify-center shrink-0"><Navigation className="w-5 h-5" /></div>
            </button>
          </div>
        )}

        {/* 🎟️ 開新旅程 CTA（票根式）：上移統一風格。匯入入口已移入建立流程 */}
        <div className="px-5 pt-4">
          <button
            onClick={() => setIsCreating(true)}
            className="w-full h-[66px] bg-white border border-black/[0.08] rounded-2xl flex items-stretch p-0 overflow-hidden active:scale-[0.99] transition-transform"
          >
            <span className="flex-1 flex flex-col justify-center items-start pl-[18px]">
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#3F6B52] mb-0.5">START A NEW TRIP</span>
              <span className="font-serif text-[19px] font-bold text-[#232320]">規劃新的一趟</span>
            </span>
            <span className="w-[66px] border-l-2 border-dashed border-[#D6CDB8] flex items-center justify-center relative">
              <span className="absolute -left-[7px] -top-[7px] w-3.5 h-3.5 rounded-full bg-[#E4E2DD]" />
              <span className="absolute -left-[7px] -bottom-[7px] w-3.5 h-3.5 rounded-full bg-[#E4E2DD]" />
              <span className="w-11 h-11 rounded-full bg-[#232320] text-white flex items-center justify-center"><ArrowRight className="w-5 h-5" /></span>
            </span>
          </button>
        </div>

        {/* 下一趟：主 hero（最近出發） */}
        {heroTrip ? (
          <div className="px-5 pt-6">
            <div className="flex items-end justify-between mb-3 px-1">
              <h2 className="text-xl font-bold font-serif tracking-wide text-[#232320]">下一趟</h2>
              <span className="font-mono text-[11px] text-[#8A8266]">{upcomingTrips.length} 趟計畫中</span>
            </div>
            <TripHeroCard trip={heroTrip} onSelect={() => onSelectTrip(heroTrip)} variant="primary" />
          </div>
        ) : (
          <div className="px-5 pt-8">
            <div className="py-14 text-center border-2 border-dashed border-black/10 rounded-[32px] bg-white/30">
              <p className="text-sm font-bold text-[#8A8266]">還沒有計畫，用上面的票券開一趟吧</p>
            </div>
          </div>
        )}

        {/* 其他計畫：次 hero（較遠、矮一號、同結構可展開），按出發日排序 */}
        {restTrips.length > 0 && (
          <div className="mt-8 px-5">
            <div className="mb-3 px-1">
              <span className="block font-mono text-[10px] tracking-[0.18em] text-[#8A8266] mb-0.5">COMING UP</span>
              <h3 className="text-lg font-bold font-serif tracking-wide text-[#232320]">接下來</h3>
            </div>
            <div className="space-y-4">
              {restTrips.map(trip => (
                <TripHeroCard key={trip.id} trip={trip} onSelect={() => onSelectTrip(trip)} variant="secondary" />
              ))}
            </div>
          </div>
        )}

        {/* 🕰️ 回憶（過渡版）：刻意樸素的純文字列——灰字降飽和＝過去的，不與現役行程搶戲。
            無過去行程時整區不顯示。正式「精彩回憶卡／個人頁回憶區」完成後整區替換。 */}
        {pastTrips.length > 0 && (
          <div className="mt-10 px-6">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="block font-mono text-[10px] tracking-[0.18em] text-[#8A8266] mb-0.5">MEMORIES</span>
                <h3 className="text-base font-bold font-serif tracking-wide text-[#8A8266]">回憶</h3>
              </div>
              <span className="font-mono text-[11px] text-[#8A8266]">{pastTrips.length} 趟</span>
            </div>
            <div className="border-t border-[#232320]/10">
              {pastTrips.map((trip, i) => (
                <button
                  key={trip.id}
                  onClick={() => onSelectTrip(trip)}
                  className={`w-full flex items-center justify-between py-3 px-0.5 text-left active:opacity-60 transition-opacity ${i < pastTrips.length - 1 ? 'border-b border-[#232320]/5' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-serif text-[14px] font-bold text-[#5F5E5A] truncate">{trip.destination}</div>
                    <div className="font-mono text-[10px] text-[#8A8266] mt-0.5">{(trip.startDate || '').replace(/-/g, '.')} · {trip.days.length} 天</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#B4B2A9] shrink-0" />
                </button>
              ))}
            </div>
            <div className="font-mono text-[10px] text-[#B4B2A9] text-center mt-2">過渡版 · 正式回憶卡設計後將取代</div>
          </div>
        )}

        <MadeByFooter />
      </div>

      {/* Modals */}
      {isCreating && (
        <CreateTripModal
          onClose={() => setIsCreating(false)}
          onAddTrip={onAddTrip}
          onImport={() => { setIsCreating(false); setIsImporting(true); }}
        />
      )}
      {isImporting && <ImportTripModal onClose={() => setIsImporting(false)} onImportTrip={onImportTrip} />}
      {showProfile && <ProfileModal user={user} tripCount={trips.length} onClose={() => setShowProfile(false)} onLogout={onLogout} />}

      {editingTrip && onUpdateTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onUpdate={(updated) => {
            onUpdateTrip(updated);
            setEditingTrip(null);
          }}
        />
      )}
    </div>
  );
};
