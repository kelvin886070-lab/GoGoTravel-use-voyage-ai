// src/views/TripsView/TripsView.tsx
// 🏠 首頁骨架：產品身份＝「掌控為優先」的規劃工具。一進來就回答「哪一趟＋還有幾天＋下一步」。
//   結構（骨架恆定，hero 槽位 adaptive 變臉＝批4）：Header → 開新旅程 CTA（恆在頂）
//         → Hero 槽位（旅途中 OnTripHeroCard ＞ 下一趟 TripHeroCard ＞ 空狀態）
//         → 接下來（次 hero，按出發日）。回憶已遷居個人檔案護照內頁（批④）。
//   排序：按出發日（最近的當主角），取代手動拖曳。旅途中的行程只出現在捷徑、不重複進清單。
//   「從分享連結匯入」已移入 CreateTripModal（暫存），保持首頁乾淨。精彩回憶移出（改個人頁）。
import React, { useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';

import type { Trip, User, WishItem } from '../../types';
import { MadeByFooter } from '../../components/UI';
import { BrandWordmark } from '../../components/brand/BrandLogo';

import { TripHeroCard } from './components/cards/TripHeroCard';
import { OnTripHeroCard } from './components/cards/OnTripHeroCard';

// --- Modals ---
import { CreateTripModal } from './modals/CreateTripModal';
import { ImportTripModal } from './modals/ImportTripModal';
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

  // 🧭 批4臉1：旅途中時，hero 槽位讓給旅途中那趟；其餘 upcoming 全部進「接下來」。骨架不動（CTA 恆在頂）。
  const comingUpTrips = activeTrip ? upcomingTrips : restTrips;

  return (
    <div className="h-full flex flex-col w-full bg-transparent">

      <div className="flex-1 min-h-0 overflow-y-auto w-full scroll-smooth no-scrollbar pb-24">

        {/* 刊頭：純字標置中，隨內容一起捲動（不固定）；戳章退場——品牌已有四個主場 */}
        <div className="pt-7 pb-3 flex items-center justify-center">
          <BrandWordmark size={24} />
        </div>

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

        {/* 🧭 Hero 槽位（adaptive）：旅途中＞下一趟＞空狀態。骨架不變，變的是內容（Kelvin 定案）。 */}
        {activeTrip ? (
          <div className="px-5 pt-6">
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <h2 className="text-xl font-bold font-serif tracking-wide text-[#3F6B52]">旅途中</h2>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3F6B52] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3F6B52]" />
              </span>
            </div>
            <OnTripHeroCard trip={activeTrip} onOpen={onOpenActiveTrip} />
          </div>
        ) : heroTrip ? (
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
        {comingUpTrips.length > 0 && (
          <div className="mt-8 px-5">
            <div className="mb-3 px-1">
              <span className="block font-mono text-[10px] tracking-[0.18em] text-[#8A8266] mb-0.5">COMING UP</span>
              <h3 className="text-lg font-bold font-serif tracking-wide text-[#232320]">接下來</h3>
            </div>
            <div className="space-y-4">
              {comingUpTrips.map(trip => (
                <TripHeroCard key={trip.id} trip={trip} onSelect={() => onSelectTrip(trip)} variant="secondary" />
              ))}
            </div>
          </div>
        )}

        {/* 🕰️ 回憶已正式遷居「個人檔案 → 護照內頁」（批④）；首頁專注現在與未來，過渡列表退役。 */}

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
