import React, { useState, useMemo } from 'react';
import { Plus, Download, Bell, ChevronRight, LayoutGrid } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

import type { Trip, User } from '../../types';
import { MadeByFooter } from '../../components/UI';

// --- Components ---
import { DashboardWidgets } from './components/widgets/DashboardWidgets';
import { DiscoveryWidget } from './components/widgets/DiscoveryWidget';
import { TripCard } from './components/cards/TripCard';

// --- Modals ---
import { CreateTripModal } from './modals/CreateTripModal';
import { ImportTripModal } from './modals/ImportTripModal';
import { ProfileModal } from './modals/ProfileModal';
import { EditTripModal } from './modals/EditTripModal';

interface TripsViewProps {
  trips: Trip[];
  user: User;
  onLogout: () => void;
  onAddTrip: (trip: Trip) => void;
  onImportTrip: (trip: Trip) => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onReorderTrips: (trips: Trip[]) => void;
  onUpdateTrip?: (trip: Trip) => void;
}

export const TripsView: React.FC<TripsViewProps> = ({ 
    trips, user, onLogout, onAddTrip, onImportTrip, onSelectTrip, 
    onDeleteTrip, onReorderTrips, onUpdateTrip 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  // --- 1. 日期分類邏輯 (Logic Fix) ---
  const { upcomingTrips, pastTrips } = useMemo(() => {
    // 基準點：今天的凌晨 00:00:00 (排除時分秒干擾)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTimestamp = now.getTime();

    const getTripEndTimestamp = (dateStr: string) => {
        if (!dateStr) return 0;
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).getTime();
    };

    const upcoming: Trip[] = [];
    const past: Trip[] = [];

    trips.forEach(trip => {
        const tripEnd = getTripEndTimestamp(trip.endDate);
        
        // 嚴格判定：只有當行程「完全結束」(EndDate < Today) 才算回憶
        // 只要今天還在行程範圍內，或是未來，都算 Upcoming
        if (tripEnd < todayTimestamp) {
            past.push(trip);
        } else {
            upcoming.push(trip);
        }
    });

    // 排序邏輯：
    // 即將出發：不強制 Sort，保留使用者拖曳後的順序 (或依原始資料順序)
    // 精彩回憶：強制依日期降序 (最新的回憶在最前面)
    past.sort((a, b) => b.startDate.localeCompare(a.startDate));

    return { upcomingTrips: upcoming, pastTrips: past };
  }, [trips]);


  // --- 2. 拖曳邏輯 (Drag Logic) ---
  const onDragEnd = (result: DropResult) => {
      // 只有「即將出發」支援拖曳
      if (!result.destination || result.source.droppableId !== 'upcoming-list') return;

      const newUpcoming = Array.from(upcomingTrips);
      const [movedItem] = newUpcoming.splice(result.source.index, 1);
      newUpcoming.splice(result.destination.index, 0, movedItem);

      // 更新全域狀態：將排序後的 Upcoming 與原本的 Past 合併
      // 確保資料庫中的順序也是 Upcoming 在前
      onReorderTrips([...newUpcoming, ...pastTrips]);
  };

  return (
    <div className="h-full flex flex-col w-full bg-transparent">
      
      {/* Header: Kelvin Trip */}
      <div className="flex-shrink-0 pt-16 pb-2 px-6 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 border-b border-gray-200/30 w-full sticky top-0 flex justify-between items-center transition-all">
         <h1 className="text-3xl font-black tracking-tighter text-[#1D1D1B] font-serif">
            Kelvin Trip
         </h1>
         <div className="flex gap-3">
             <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 active:scale-95 transition-all text-gray-600 hover:text-[#1D1D1B]">
                <Bell className="w-5 h-5" />
             </button>
             <button onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md active:scale-90 transition-transform">
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
             </button>
         </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto w-full scroll-smooth no-scrollbar pb-24">
        
        {/* Dashboard & Discovery */}
        <div className="px-5 pt-2 space-y-4">
            <DashboardWidgets />
            <DiscoveryWidget />
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
            
            {/* Section: 即將出發 (Upcoming) - 垂直列表 + 拖曳 */}
            <div className="mt-6 px-5">
                <div className="flex justify-between items-end mb-4 px-1">
                    <h2 className="text-xl font-black font-serif tracking-wide text-[#1D1D1B]">即將出發</h2>
                    <button onClick={() => setIsCreating(true)} className="flex items-center gap-1 text-xs font-bold bg-[#1D1D1B] text-white px-3 py-1.5 rounded-full shadow-lg active:scale-90 transition-all">
                        <Plus className="w-3.5 h-3.5" /> 新增行程
                    </button>
                </div>

                <Droppable droppableId="upcoming-list">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-5">
                            {upcomingTrips.length === 0 ? (
                                <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-[32px] opacity-50 bg-white/30">
                                    <p className="text-sm font-bold text-gray-400">尚無計畫，準備出發了嗎？</p>
                                </div>
                            ) : (
                                upcomingTrips.map((trip, index) => (
                                    <Draggable key={trip.id} draggableId={trip.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{ ...provided.draggableProps.style }}
                                                className={`transition-all duration-300 ${snapshot.isDragging ? 'z-50 scale-105 shadow-2xl rotate-1' : ''}`}
                                            >
                                                <TripCard 
                                                    trip={trip} 
                                                    onSelect={() => onSelectTrip(trip)} 
                                                    dragHandleProps={provided.dragHandleProps}
                                                    isPast={false}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))
                            )}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </div>

            {/* Section: 精彩回憶 (Memories) - 橫向捲動 + View All */}
            {pastTrips.length > 0 && (
                <div className="mt-10 mb-6">
                    <div className="flex items-center justify-between mb-4 px-6">
                         <h2 className="text-xl font-black font-serif tracking-wide text-[#1D1D1B] opacity-40">精彩回憶</h2>
                         {/* View All 按鈕 (目前僅為視覺，未來可連接到檔案館頁面) */}
                         <button className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-[#1D1D1B] transition-colors">
                             查看全部 <ChevronRight className="w-3 h-3" />
                         </button>
                    </div>

                    {/* 橫向捲動容器 */}
                    <div className="flex overflow-x-auto px-6 pb-8 gap-4 no-scrollbar snap-x snap-mandatory">
                        {/* 只顯示最近 5 筆 */}
                        {pastTrips.slice(0, 5).map((trip) => (
                            <div key={trip.id} className="min-w-[85vw] sm:min-w-[300px] snap-center">
                                {/* 這裡直接復用 TripCard，但設為 isPast 模式 */}
                                <TripCard 
                                    trip={trip} 
                                    onSelect={() => onSelectTrip(trip)} 
                                    isPast={true}
                                />
                            </div>
                        ))}
                        
                        {/* More Card (當超過 5 筆時顯示) */}
                        {pastTrips.length > 5 && (
                            <div className="min-w-[120px] flex items-center justify-center snap-center">
                                <button className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:scale-110 transition-transform">
                                    <LayoutGrid className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </DragDropContext>

        <MadeByFooter />
      </div>

      {/* Modals */}
      {isCreating && <CreateTripModal onClose={() => setIsCreating(false)} onAddTrip={onAddTrip} />}
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