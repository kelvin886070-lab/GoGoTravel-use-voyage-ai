// src/views/TripsView/TripsView.tsx
// 🏠 首頁骨架：產品身份＝「掌控為優先」的規劃工具。一進來就回答「哪一趟＋還有幾天＋下一步」。
//   結構（骨架恆定，hero 槽位 adaptive 變臉＝批4）：Header → 開新旅程 CTA（恆在頂）
//         → Hero 槽位（旅途中 OnTripHeroCard ＞ 下一趟 TripHeroCard ＞ 空狀態）
//         → 接下來（次 hero，按出發日）。回憶已遷居個人檔案護照內頁（批④）。
//   排序：按出發日（最近的當主角），取代手動拖曳。旅途中的行程只出現在捷徑、不重複進清單。
//   「從分享連結匯入」已移入 CreateTripModal（暫存），保持首頁乾淨。精彩回憶移出（改個人頁）。
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

import type { Trip, User, WishItem } from '../../types';
import { MadeByFooter } from '../../components/UI';
import { BrandWordmark } from '../../components/brand/BrandLogo';

import { TripHeroCard } from './components/cards/TripHeroCard';
import { OnTripHeroCard } from './components/cards/OnTripHeroCard';

// --- Modals ---
import { CreateTripModal } from './modals/CreateTripModal';
import { EntryPage, type EntryResult } from '../create/EntryPage';
import { ZonePage, type ZoneResult } from '../create/ZonePage';
import { WhenPage, type WhenResult } from '../create/WhenPage';
import { HowPage, type HowResult } from '../create/HowPage';
import { NotesPage, type NotesResult } from '../create/NotesPage';
import { ConfirmPage, type EditStep } from '../create/ConfirmPage';
import { needsZoneStep } from '../../services/destinationIntel';
import { playPageSound, hapticTap } from '../../services/sounds';
import { fetchProfileMeta, localeCountry } from '../../services/profile';
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
    trips, user, wishItems, activeTrip, onOpenActiveTrip, onAddTrip, onImportTrip, onSelectTrip,
    onUpdateTrip,
}) => {
  // 🎫 生成表單重設計：新入口頁（EntryPage）取代舊步驟①②；下一步交棒 CreateTripModal（帶入目的地與國內外）
  const [entryOpen, setEntryOpen] = useState(false);
  // 🎫 撕票：**直接撕真的那顆 CTA**（不做座標分身）。
  //   先前用 getBoundingClientRect() 在入口頁擺一個分身，但外層容器有自己的座標系與縮放，
  //   `fixed` 的座標與視窗不一致 → 分身一出現就整張票位移＋放大（Kelvin 錄影逐格量到 +65px）。
  //   讓真按鈕自己演，座標永遠正確，也不可能出現兩張票。
  const [tearing, setTearing] = useState(false);
  const tearTimer = useRef<number | null>(null);
  useEffect(() => () => { if (tearTimer.current) window.clearTimeout(tearTimer.current); }, []);
  const openEntry = () => {
    if (tearing || entryOpen) return;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (reduce) { setEntryOpen(true); return; }   // 無障礙：不演出，直接開
    setTearing(true);
    playPageSound('tear');
    hapticTap();
    tearTimer.current = window.setTimeout(() => setEntryOpen(true), 620);   // 票根落到一半就交棒，不空等
  };
  /** 入口頁關閉（任何出口）＝票根回到票上，下次還能再撕一次 */
  const endTear = () => { setEntryOpen(false); setTearing(false); };
  const [entryResult, setEntryResult] = useState<EntryResult | null>(null);
  // 🗺️ 縮圈頁：只有國家／區域級目的地才插進來（城市級＝已回答，直接跳過）
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneResult, setZoneResult] = useState<ZoneResult | null>(null);
  const [whenOpen, setWhenOpen] = useState(false);
  const [whenResult, setWhenResult] = useState<WhenResult | null>(null);
  // 🎴 ⑥想怎麼玩：和誰同行／步調／預算（複選的同行者以 howResult.companions 為準）
  const [howOpen, setHowOpen] = useState(false);
  const [howResult, setHowResult] = useState<HowResult | null>(null);
  // ✍️ ⑦你的講究：標籤雲（圈＝想要／紅筆劃除＝不要）＋手寫欄
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesResult, setNotesResult] = useState<NotesResult | null>(null);
  // 📜 ⑧確認與生成（六拍；生成邏輯在 ConfirmPage 內，不再經過 CreateTripModal）
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 從確認書點「改」回去修的那一頁：該頁的票券鈕變「改好了」、onNext 直接回 ⑧（不重走後面的頁） */
  const [editFrom, setEditFrom] = useState<EditStep | null>(null);
  /** 入口頁交棒：需要縮圈就先進縮圈，否則直接進建立流程 */
  const afterEntry = (r: EntryResult) => {
    // 🔁 從確認書回來改目的地：
    //   **目的地沒變 → 直接回 ⑧**（他只是回去看看，不重走）；
    //   **變了 → 縮圈必須重來**（zoneResult 掛在舊目的地上，已失效），
    //   但 when/how/notes 保留——那些仍然是他的答案，換目的地不會讓「有長輩同行」失效。
    if (editFrom === 'entry') {
      const prev = entryResult?.destinations ?? [];
      const same = r.destinations.length === prev.length && r.destinations.every((d, i) => d === prev[i]);
      setEntryResult(r);
      endTear();
      if (same) { setEditFrom(null); setConfirmOpen(true); return; }
      setZoneResult(null);
      if (needsZoneStep(r.intel)) { setZoneOpen(true); return; }   // editFrom 保持 'entry'：縮圈完直接回 ⑧
      setEditFrom(null);
      setConfirmOpen(true);
      return;
    }
    setEntryResult(r);
    setZoneResult(null);
    endTear();
    setWhenResult(null);
    setHowResult(null);
    setNotesResult(null);
    if (needsZoneStep(r.intel)) setZoneOpen(true);
    else setWhenOpen(true);
  };
  /** 交給下游的目的地：縮圈選了地帶就把地帶短名接在後面（原始資料留在 zoneResult，不遺失） */
  const flowDestinations = (): string[] => {
    const base = entryResult?.destinations || [];
    const labels = zoneResult?.labels || [];
    return Array.from(new Set([...base, ...labels]));
  };
  const [residenceCountry, setResidenceCountry] = useState<string>(localeCountry());
  // 櫥窗素材（三層個人化）：心願盒收藏照 → 護照回憶照 → 空（EntryPage 退回主題色底）。
  //   label＝地名，可點直接加入（淡季鉤子閉環：看到收藏 → 一步出發）
  const showcaseItems = useMemo(() => {
      const wish = (wishItems || [])
          .filter(w => !!w.customImage && w.customImage.startsWith('http'))
          .map(w => {
              const place = (w.city || '').trim();
              return { url: w.customImage as string, caption: place ? `你收藏的 · ${place}` : undefined, place: place || undefined };
          });
      // 回憶照：caption 說明「這張照片來自哪一趟」；趟名不一定是地名，故不給 place（不可點加入）
      const memories = trips
          .filter(t => !t.isDeleted)
          .flatMap(t => (t.memoryPhotoThumbs || t.memoryPhotos || []).slice(0, 2)
              .map(url => ({ url, caption: `照片來自 · ${t.destination}` })));
      return [...wish, ...memories].slice(0, 6);
  }, [wishItems, trips]);

  // 「再去一次」：過去去過的地方（去重、最近優先）——回頭客的高頻捷徑
  const recentPlaces = useMemo(() => {
      const seen = new Set<string>();
      return trips
          .filter(t => !t.isDeleted && !!t.destination)
          .sort((a, b) => dayTs(b.startDate) - dayTs(a.startDate))
          .map(t => t.destination.trim())
          .filter(d => d && !seen.has(d) && (seen.add(d), true))
          .slice(0, 4);
  }, [trips]);
  React.useEffect(() => {
      let alive = true;
      void fetchProfileMeta(user.id).then(m => { if (alive) setResidenceCountry(m.residenceCountry); });
      return () => { alive = false; };
  }, [user.id]);
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
          {/* 🎫 撕票：靜止時是**一張卡**（白底＋圓角在 button 上）；撕的瞬間變成**兩張各自帶白底的紙**——
              否則飛走的只是一顆圓鈕、票身也沒有撕痕，讀起來像「按鈕掉了」而不是「票被撕下」。
              ⚠️ 撕票期間必須解除 overflow-hidden（票根要飛出卡外）與 active:scale（票身零位移）。 */}
          <button
            onClick={openEntry}
            className={`w-full h-[66px] rounded-2xl flex items-stretch p-0 transition-transform ${
              tearing ? 'bg-transparent' : 'bg-white border border-black/[0.08] overflow-hidden active:scale-[0.99]'
            }`}
          >
            {/* 票身：撕票時自帶白紙與右緣齒孔虛線（＝撕痕留在票上），全程零位移 */}
            <span className="flex-1 flex flex-col justify-center items-start pl-[18px] relative"
              style={tearing ? {
                backgroundColor: '#fff',
                borderRadius: '16px 3px 3px 16px',
                border: '1px solid rgba(0,0,0,.08)',
                borderRight: '2px dashed #D6CDB8',
              } : undefined}>
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#3F6B52] mb-0.5">START A NEW TRIP</span>
              <span className="font-serif text-[19px] font-bold text-[#232320]">規劃新的一趟</span>
              {/* 齒孔缺口：留在票身上（缺口是撕痕，不會跟著票根走） */}
              <span aria-hidden className="absolute -right-[7px] -top-[7px] w-3.5 h-3.5 rounded-full bg-[#E4E2DD]" />
              <span aria-hidden className="absolute -right-[7px] -bottom-[7px] w-3.5 h-3.5 rounded-full bg-[#E4E2DD]" />
            </span>
            {/* 票根：撕票時自帶白紙與右圓角，繞左下角由上而下掀起 → 隨重力墜離 */}
            <span className={`w-[66px] flex items-center justify-center relative ${tearing ? '' : 'border-l-2 border-dashed border-[#D6CDB8]'}`}
              style={tearing ? {
                backgroundColor: '#fff',
                borderRadius: '3px 16px 16px 3px',
                border: '1px solid rgba(0,0,0,.08)',
                borderLeft: 'none',
                transformOrigin: 'left bottom',
                animation: 'ktCtaStub .68s cubic-bezier(.34,.05,.5,1) forwards',
                boxShadow: '0 6px 14px rgba(0,0,0,.18)',
                zIndex: 1,
              } : undefined}>
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
      {entryOpen && (
        <EntryPage
          residenceCountry={residenceCountry}
          showcaseItems={showcaseItems}
          recentPlaces={recentPlaces}
          initialDestinations={entryResult?.destinations}
          initialCoverUrl={entryResult?.coverUrl}
          nextLabel={editFrom === 'entry' ? '改好了' : undefined}
          onClose={endTear}
          onNext={afterEntry}
          onManualCreate={() => { endTear(); setEntryResult(null); setIsCreating(true); }}
          onImport={() => { endTear(); setIsImporting(true); }}
        />
      )}
      {zoneOpen && entryResult && (
        <ZonePage
          destinationName={entryResult.intel?.name || entryResult.destinations[0] || '這個地方'}
          query={entryResult.destinations[entryResult.destinations.length - 1] || ''}
          coverUrl={entryResult.coverUrl}
          isDomestic={entryResult.isDomestic}
          initial={zoneResult ?? undefined}
          onBack={(z) => { setZoneResult(z); setZoneOpen(false); setEntryOpen(true); }}
          onClose={() => { setZoneOpen(false); setEntryResult(null); setZoneResult(null); setTearing(false); }}
          onNext={(z) => {
            setZoneResult(z); setZoneOpen(false);
            // 🔁 改目的地引發的重新縮圈：縮圈完直接回 ⑧（when/how/notes 都還是他的答案）
            if (editFrom === 'entry') { setEditFrom(null); setConfirmOpen(true); return; }
            setWhenOpen(true);
          }}
        />
      )}
      {whenOpen && entryResult && (
        <WhenPage
          breadcrumb={flowDestinations().join(' · ')}
          query={entryResult.destinations[entryResult.destinations.length - 1] || ''}
          coverUrl={entryResult.coverUrl}
          isDomestic={entryResult.isDomestic}
          suggestedDaysHint={zoneResult?.suggestedDays ?? 0}
          placeCount={Math.max(1, flowDestinations().length)}
          initial={whenResult ?? undefined}
          nextLabel={editFrom === 'when' ? '改好了' : undefined}
          onBack={(w) => {
            if (w) setWhenResult(w);   // 還沒圈月份就沒有可存的答案（w 為 null）
            setWhenOpen(false);
            // 改到一半按上一步＝放棄修改、帶著已存的狀態回 ⑧（不把他丟進正常流程）
            if (editFrom === 'when') { setEditFrom(null); setConfirmOpen(true); return; }
            if (needsZoneStep(entryResult.intel)) setZoneOpen(true); else setEntryOpen(true);
          }}
          onClose={() => { setWhenOpen(false); setEntryResult(null); setZoneResult(null); setWhenResult(null); setEditFrom(null); setTearing(false); }}
          onNext={(w) => {
            setWhenResult(w); setWhenOpen(false);
            if (editFrom === 'when') { setEditFrom(null); setConfirmOpen(true); return; }
            setHowOpen(true);
          }}
        />
      )}
      {howOpen && entryResult && (
        <HowPage
          breadcrumb={flowDestinations().join(' · ')}
          query={entryResult.destinations[entryResult.destinations.length - 1] || ''}
          coverUrl={entryResult.coverUrl}
          isDomestic={entryResult.isDomestic}
          initial={howResult ?? undefined}
          nextLabel={editFrom === 'how' ? '改好了' : undefined}
          onBack={(h) => {
            setHowResult(h); setHowOpen(false);
            if (editFrom === 'how') { setEditFrom(null); setConfirmOpen(true); return; }
            setWhenOpen(true);
          }}
          onClose={() => {
            setHowOpen(false); setEntryResult(null); setZoneResult(null);
            setWhenResult(null); setHowResult(null); setEditFrom(null); setTearing(false);
          }}
          onNext={(h) => {
            setHowResult(h); setHowOpen(false);
            if (editFrom === 'how') { setEditFrom(null); setConfirmOpen(true); return; }
            setNotesOpen(true);
          }}
        />
      )}
      {notesOpen && entryResult && (
        <NotesPage
          breadcrumb={flowDestinations().join(' · ')}
          query={entryResult.destinations[entryResult.destinations.length - 1] || ''}
          coverUrl={entryResult.coverUrl}
          isDomestic={entryResult.isDomestic}
          initial={notesResult ?? undefined}
          nextLabel={editFrom === 'notes' ? '改好了' : undefined}
          onBack={(n) => {
            setNotesResult(n); setNotesOpen(false);
            if (editFrom === 'notes') { setEditFrom(null); setConfirmOpen(true); return; }
            setHowOpen(true);
          }}
          onClose={() => {
            setNotesOpen(false); setEntryResult(null); setZoneResult(null);
            setWhenResult(null); setHowResult(null); setNotesResult(null); setEditFrom(null); setTearing(false);
          }}
          onNext={(n) => {
            setNotesResult(n); setNotesOpen(false);
            if (editFrom === 'notes') setEditFrom(null);
            setConfirmOpen(true);   // ⑦ 之後＝⑧確認與生成（CreateTripModal 已退出生成流程）
          }}
        />
      )}
      {confirmOpen && entryResult && whenResult && (
        <ConfirmPage
          destinations={flowDestinations()}
          destinationName={entryResult.intel?.name || entryResult.destinations[0] || '這一趟'}
          coverUrl={entryResult.coverUrl}
          isDomestic={entryResult.isDomestic}
          country={entryResult.intel?.country}
          when={whenResult}
          how={howResult}
          notes={notesResult}
          onEditStep={(step) => {
            setConfirmOpen(false);
            setEditFrom(step);
            if (step === 'entry') setEntryOpen(true);
            else if (step === 'when') setWhenOpen(true);
            else if (step === 'how') setHowOpen(true);
            else setNotesOpen(true);
          }}
          onClose={() => {
            setConfirmOpen(false); setEntryResult(null); setZoneResult(null);
            setWhenResult(null); setHowResult(null); setNotesResult(null); setEditFrom(null); setTearing(false);
          }}
          onDone={({ trip }) => {
            onAddTrip(trip);
            setConfirmOpen(false); setEntryResult(null); setZoneResult(null);
            setWhenResult(null); setHowResult(null); setNotesResult(null); setEditFrom(null); setTearing(false);
          }}
        />
      )}
      {/* 🎫 生成流程已全面走 ①–⑧ 新頁（ConfirmPage 內含生成）；
          CreateTripModal 從此**只服務「手動建立空白行程」**（入口頁的安靜出口）。
          ⚠️ 它內部的 initial* props 與步驟③④⑤的條件隱藏已成死碼——留給「舊 UI 清理批」一次拆。 */}
      {isCreating && (
        <CreateTripModal
          onClose={() => { setIsCreating(false); setEntryResult(null); setZoneResult(null); setWhenResult(null); setHowResult(null); setNotesResult(null); }}
          onAddTrip={onAddTrip}
          onImport={() => { setIsCreating(false); setIsImporting(true); }}
          onBackToEntry={() => { setIsCreating(false); setEntryOpen(true); }}
        />
      )}
      {isImporting && <ImportTripModal onClose={() => setIsImporting(false)} onImportTrip={onImportTrip} />}

      {/* 撕票：票根繞左下角掀起（上緣先離＝齒孔由上而下斷開）→ 脫離後隨重力墜落。票身零位移。 */}
      <style>{`
        @keyframes ktCtaStub {
          0%{transform:translate(0,0) rotate(0deg);opacity:1}
          14%{transform:translate(2px,0) rotate(-1.5deg)}
          34%{transform:translate(3px,0) rotate(4deg)}
          54%{transform:translate(6px,1px) rotate(9deg)}
          64%{transform:translate(12px,8px) rotate(12deg);opacity:1}
          100%{transform:translate(38px,140px) rotate(24deg);opacity:0}
        }
      `}</style>

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
