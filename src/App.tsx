import React, { useState, useEffect, useRef } from 'react';
import { Home, Compass, Briefcase, FileText, Camera, ArrowLeft, List, Map, Trash2, Plus, GripVertical, Clock, X, MapPin, DollarSign, Tag as TagIcon, Wallet, TrendingUp, PieChart } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { AppView } from './types';
import type { Trip, TripDay, User, Activity } from './types';
import { TripsView } from './views/TripsView';
import { ToolsView } from './views/ToolsView';
import { VaultView } from './views/VaultView';
import { ExploreView } from './views/ExploreView';
import { LoginView } from './views/LoginView';
import { IOSButton, IOSInput } from './components/UI';
import { supabase } from './services/supabase';

// Helper: 時間加法
const addMinutes = (timeStr: string, minutes: number): string => {
    try {
        if (!timeStr) return "09:00";
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h || 0, m || 0, 0, 0);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return timeStr;
    }
};

// Helper: 解析費用 (將 "300", "$300", "300元" 轉為數字)
const parseCost = (costStr?: string): number => {
    if (!costStr) return 0;
    // 只留下數字和小數點
    const num = parseFloat(costStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Supabase 核心邏輯 ---
  const fetchTrips = async () => {
      if (!user) return;
      setIsSyncing(true);
      const { data, error } = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
      if (data) {
          const loadedTrips = data.map((row: any) => ({ 
              ...row.trip_data, 
              id: row.id, 
              isDeleted: row.trip_data.isDeleted || false 
          }));
          setTrips(loadedTrips);
      }
      setIsSyncing(false);
  };

  const saveTripToCloud = async (trip: Trip) => {
      if (!user) return;
      setIsSyncing(true);
      const { error } = await supabase.from('trips').upsert({
              id: trip.id,
              user_id: user.id,
              trip_data: trip,
              updated_at: new Date().toISOString()
          });
      if (error) console.error("上傳失敗", error);
      setIsSyncing(false);
  };

  const deleteTripFromCloud = async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) console.error("刪除失敗", error);
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setSelectedTrip(updatedTrip);
    saveTripToCloud(updatedTrip);
  };
  
  useEffect(() => {
      const checkUser = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
              const userName = session.user.user_metadata?.full_name || 'User';
              setUser({
                  id: session.user.id,
                  name: userName,
                  joinedDate: new Date(session.user.created_at).toLocaleDateString(),
                  avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=e5e7eb`
              });
          }
      };
      checkUser();
  }, []);

  useEffect(() => {
      if (user) {
          fetchTrips();
          const savedBg = localStorage.getItem(`voyage_${user.id}_bg_image`);
          if (savedBg) setBgImage(savedBg);
      } else {
          setTrips([]);
      }
  }, [user]);

  const handleLogin = (newUser: User) => { setUser(newUser); };

  const handleLogout = async () => {
      if(confirm("確定要登出嗎？")) {
          await supabase.auth.signOut();
          setUser(null);
          setCurrentView(AppView.TRIPS);
          setSelectedTrip(null);
      }
  };

  const handleUpdateBackground = (img: string) => {
      setBgImage(img);
      if(user) localStorage.setItem(`voyage_${user.id}_bg_image`, img);
  }
  const handleTripSelect = (trip: Trip) => setSelectedTrip(trip);
  const handleReorderTrips = (newTrips: Trip[]) => { setTrips(newTrips); };
  
  const handleSoftDeleteTrip = (id: string) => {
    if(confirm('確定要將此行程移至保管箱嗎？')) {
        const targetTrip = trips.find(t => t.id === id);
        if (targetTrip) {
            const deletedTrip = { ...targetTrip, isDeleted: true };
            setTrips(prev => prev.map(t => t.id === id ? deletedTrip : t));
            if (selectedTrip?.id === id) setSelectedTrip(null);
            saveTripToCloud(deletedTrip); 
        }
    }
  }
  const handleRestoreTrip = (id: string) => {
      const targetTrip = trips.find(t => t.id === id);
      if (targetTrip) {
          const restoredTrip = { ...targetTrip, isDeleted: false };
          setTrips(prev => prev.map(t => t.id === id ? restoredTrip : t));
          saveTripToCloud(restoredTrip);
      }
  }; 

  const handlePermanentDeleteTrip = (id: string) => {
      if(confirm('確定要永久刪除嗎？此動作無法復原。')) {
          setTrips(prev => prev.filter(t => t.id !== id));
          deleteTripFromCloud(id);
      }
  };

  const handleImportTrip = (tripData: Trip) => {
      const newTrip = { ...tripData, id: crypto.randomUUID(), isDeleted: false };
      if (!newTrip.coverImage || newTrip.coverImage.length < 100) {
          newTrip.coverImage = `https://picsum.photos/seed/${newTrip.destination}/800/600`;
      }
      setTrips(prev => [newTrip, ...prev]);
      saveTripToCloud(newTrip);
  };

  const handleAddTrip = (newTrip: Trip) => {
      const tripWithUuid = { ...newTrip, id: crypto.randomUUID() };
      setTrips(prev => [...prev, tripWithUuid]);
      saveTripToCloud(tripWithUuid);
  }

  if (!user) return <LoginView onLogin={handleLogin} />;

  if (selectedTrip) {
    return (
      <ItineraryDetailView 
        trip={selectedTrip} 
        onBack={() => setSelectedTrip(null)}
        onDelete={() => handleSoftDeleteTrip(selectedTrip.id)}
        onUpdateTrip={handleUpdateTrip}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full font-sans text-gray-900 bg-gray-50/80 overflow-hidden fixed inset-0" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}
      
      <main className="max-w-md mx-auto h-full relative shadow-2xl overflow-hidden z-10 bg-gray-50/80 backdrop-blur-md flex flex-col">
        
        {isSyncing && (
            <div className="absolute top-4 right-4 z-50 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse pointer-events-none">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                同步中...
            </div>
        )}

        <div className="flex-1 overflow-hidden relative w-full no-scrollbar">
            {currentView === AppView.TRIPS && (
              <div className="h-full w-full">
                <TripsView 
                  trips={trips.filter(t => !t.isDeleted)} 
                  user={user}
                  onLogout={handleLogout}
                  onAddTrip={handleAddTrip} 
                  onImportTrip={handleImportTrip}
                  onSelectTrip={handleTripSelect}
                  onDeleteTrip={handleSoftDeleteTrip}
                  onReorderTrips={handleReorderTrips}
                />
              </div>
            )}
            {currentView === AppView.EXPLORE && <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in"><ExploreView /></div>}
            {currentView === AppView.TOOLS && <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in"><ToolsView onUpdateBackground={handleUpdateBackground} /></div>}
            {currentView === AppView.VAULT && (
                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in">
                    <VaultView 
                        deletedTrips={trips.filter(t => t.isDeleted)} 
                        onRestoreTrip={handleRestoreTrip} 
                        onPermanentDeleteTrip={handlePermanentDeleteTrip} 
                    />
                </div>
            )}
        </div>

        <div className="flex-shrink-0 z-50 relative w-full bg-white/85 backdrop-blur-xl border-t border-gray-200/50">
            <div className="flex justify-between items-center pb-safe pt-4 px-8 h-[calc(70px+env(safe-area-inset-bottom))]">
                <TabButton active={currentView === AppView.TRIPS} onClick={() => setCurrentView(AppView.TRIPS)} icon={<Home />} label="行程" />
                <TabButton active={currentView === AppView.EXPLORE} onClick={() => setCurrentView(AppView.EXPLORE)} icon={<Compass />} label="探索" />
                <TabButton active={currentView === AppView.TOOLS} onClick={() => setCurrentView(AppView.TOOLS)} icon={<Briefcase />} label="小工具" />
                <TabButton active={currentView === AppView.VAULT} onClick={() => setCurrentView(AppView.VAULT)} icon={<FileText />} label="保管箱" />
            </div>
        </div>
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors duration-200 ${active ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6', strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// --------------------------------------------------------------------------
// ✨ 費用儀表板組件 (ExpenseDashboard)
// --------------------------------------------------------------------------
const ExpenseDashboard: React.FC<{ trip: Trip }> = ({ trip }) => {
    // 1. 計算總花費與分類統計
    const stats = trip.days.reduce((acc, day) => {
        day.activities.forEach(act => {
            const cost = parseCost(act.cost);
            if (cost > 0) {
                acc.total += cost;
                acc.byCategory[act.type] = (acc.byCategory[act.type] || 0) + cost;
            }
        });
        return acc;
    }, { total: 0, byCategory: {} as Record<string, number> });

    const categories = [
        { type: 'flight', label: '機票', color: 'bg-purple-500' },
        { type: 'hotel', label: '住宿', color: 'bg-indigo-500' },
        { type: 'transport', label: '交通', color: 'bg-gray-500' },
        { type: 'food', label: '美食', color: 'bg-orange-500' },
        { type: 'sightseeing', label: '景點', color: 'bg-blue-500' },
    ];

    return (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-end justify-between mb-4">
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">總預算花費</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-1">
                        <span className="text-lg align-top mr-1">$</span>
                        {stats.total.toLocaleString()}
                    </h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-full text-ios-blue">
                    <TrendingUp className="w-6 h-6" />
                </div>
            </div>

            {/* 比例條 */}
            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-gray-100">
                {categories.map(cat => {
                    const amount = stats.byCategory[cat.type] || 0;
                    const percent = stats.total > 0 ? (amount / stats.total) * 100 : 0;
                    if (percent === 0) return null;
                    return <div key={cat.type} style={{ width: `${percent}%` }} className={cat.color} title={cat.label} />;
                })}
            </div>

            {/* 分類列表 */}
            <div className="grid grid-cols-2 gap-3">
                {categories.map(cat => {
                    const amount = stats.byCategory[cat.type] || 0;
                    if (amount === 0) return null;
                    return (
                        <div key={cat.type} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                                <span className="text-gray-600">{cat.label}</span>
                            </div>
                            <span className="font-bold text-gray-900">${amount.toLocaleString()}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --------------------------------------------------------------------------
// 可編輯文字組件
// --------------------------------------------------------------------------
const EditableText: React.FC<{ value: string, onSave: (val: string) => void, className?: string }> = ({ value, onSave, className }) => {
    const [text, setText] = useState(value);
    useEffect(() => { setText(value); }, [value]);
    return (
        <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => { if (text !== value) onSave(text); }}
            className={`bg-transparent outline-none min-w-0 ${className}`}
        />
    );
};

// --------------------------------------------------------------------------
// ItineraryDetailView
// --------------------------------------------------------------------------

const ItineraryDetailView: React.FC<{ 
    trip: Trip; 
    onBack: () => void; 
    onDelete: () => void; 
    onUpdateTrip: (t: Trip) => void; 
}> = ({ trip, onBack, onDelete, onUpdateTrip }) => {
    
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const [editingTitle, setEditingTitle] = useState(trip.destination);
    const [showExpenses, setShowExpenses] = useState(false); // ✨ 控制是否顯示記帳面板

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setEditingTitle(trip.destination); }, [trip.destination]);

    const handleTitleBlur = () => {
        if (editingTitle !== trip.destination && editingTitle.trim() !== "") {
            onUpdateTrip({ ...trip, destination: editingTitle });
        } else if (editingTitle.trim() === "") {
             setEditingTitle(trip.destination);
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImage = reader.result as string;
                onUpdateTrip({ ...trip, coverImage: newImage });
            };
            reader.readAsDataURL(file);
        }
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        
        const sourceDayIndex = parseInt(result.source.droppableId.replace('day-', '')) - 1;
        const destDayIndex = parseInt(result.destination.droppableId.replace('day-', '')) - 1;

        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        
        const [movedActivity] = newTrip.days[sourceDayIndex].activities.splice(result.source.index, 1);
        newTrip.days[destDayIndex].activities.splice(result.destination.index, 0, movedActivity);

        const dayActivities = newTrip.days[destDayIndex].activities;
        if (dayActivities.length > 0) {
            let currentTime = dayActivities[0].time;
            for (let i = 1; i < dayActivities.length; i++) {
                currentTime = addMinutes(currentTime, 90);
                dayActivities[i].time = currentTime;
            }
        }

        onUpdateTrip(newTrip);
    };

    const handleActivityUpdate = (dayIndex: number, actIndex: number, field: keyof Activity, value: string) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        // @ts-ignore
        newTrip.days[dayIndex].activities[actIndex][field] = value;
        onUpdateTrip(newTrip);
    };

    const handleAddActivity = (newActivity: Activity) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[activeDayForAdd - 1].activities.push(newActivity);
        newTrip.days[activeDayForAdd - 1].activities.sort((a: any, b: any) => a.time.localeCompare(b.time));
        onUpdateTrip(newTrip);
        setIsAddModalOpen(false);
    };

    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        if(!confirm("確定要刪除？")) return;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[dayIndex].activities.splice(activityIndex, 1);
        onUpdateTrip(newTrip);
    }

    const openAddModal = (day: number) => { setActiveDayForAdd(day); setIsAddModalOpen(true); };

    return (
        <div className="bg-white h-full w-full flex flex-col relative animate-in slide-in-from-right duration-300">
            
            {/* Header Image */}
            <div className="flex-shrink-0 h-64 relative group z-10 shadow-sm">
                <img src={trip.coverImage} className="w-full h-full object-cover" alt="Cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
                
                <button onClick={onBack} className="absolute top-12 left-5 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <button onClick={onDelete} className="absolute top-12 right-5 w-10 h-10 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10">
                    <Trash2 className="w-5 h-5" />
                </button>

                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-6 right-5 w-9 h-9 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-20 shadow-sm"
                >
                    <Camera className="w-5 h-5" />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleCoverChange} className="hidden" accept="image/*" />

                <div className="absolute bottom-6 left-5 text-white pr-14 w-full">
                    <input 
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        className="text-3xl font-bold drop-shadow-md bg-transparent border-none outline-none text-white placeholder-white/70 w-full p-0 m-0 focus:ring-0"
                    />
                    <div className="flex items-center gap-3 mt-2">
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium">{trip.days.length} 天行程</span>
                        {/* ✨ 錢包按鈕 */}
                        <button 
                            onClick={() => setShowExpenses(!showExpenses)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${showExpenses ? 'bg-ios-blue text-white' : 'bg-white/20 backdrop-blur-md text-white'}`}
                        >
                            <Wallet className="w-3 h-3" />
                            {showExpenses ? '隱藏花費' : '旅費統計'}
                        </button>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex-shrink-0 px-5 pt-4 pb-2 bg-white z-10 border-b border-gray-100">
                <div className="bg-gray-100 p-1 rounded-xl flex">
                    <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        <List className="w-4 h-4" /> 列表
                    </button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        <Map className="w-4 h-4" /> 地圖
                    </button>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto px-5 pb-safe w-full scroll-smooth no-scrollbar">
                
                {/* ✨ 費用儀表板 (可切換顯示) */}
                {showExpenses && <ExpenseDashboard trip={trip} />}

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="py-4 space-y-10">
                        {trip.days.map((day, dayIndex) => (
                            <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-gray-200">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-ios-blue border-4 border-white shadow-sm" />
                                <div className="flex justify-between items-center mb-4 -mt-1">
                                    <h2 className="text-xl font-bold text-gray-900">第 {day.day} 天</h2>
                                    {viewMode === 'list' && (
                                        <button onClick={() => openAddModal(day.day)} className="text-ios-blue bg-blue-50 hover:bg-blue-100 p-1.5 rounded-full transition-colors active:scale-90">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>

                                {viewMode === 'list' ? (
                                    <Droppable droppableId={`day-${day.day}`}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 min-h-[50px]">
                                                {day.activities.map((act, index) => (
                                                    <Draggable key={`${day.day}-${index}`} draggableId={`${day.day}-${index}`} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style }} className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col gap-2 group relative ${snapshot.isDragging ? 'shadow-lg z-50' : ''}`}>
                                                                
                                                                <div className="flex gap-3">
                                                                    {/* 時間軸 */}
                                                                    <div className="flex flex-col items-center pt-1 min-w-[55px]">
                                                                        <input 
                                                                            type="time" 
                                                                            value={act.time}
                                                                            onChange={(e) => handleActivityUpdate(dayIndex, index, 'time', e.target.value)}
                                                                            className="text-xs font-bold text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-ios-blue focus:text-ios-blue outline-none w-full text-center cursor-pointer transition-colors"
                                                                        />
                                                                        <button onClick={() => handleDeleteActivity(dayIndex, index)} className="mt-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                                                                    </div>
                                                                    
                                                                    {/* 活動內容 */}
                                                                    <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                                        <EditableText 
                                                                            value={act.title} 
                                                                            onSave={(val) => handleActivityUpdate(dayIndex, index, 'title', val)}
                                                                            className="font-semibold text-gray-900 truncate w-full hover:bg-gray-50 rounded px-1 -ml-1"
                                                                        />
                                                                        <div className="flex items-center justify-between mt-1">
                                                                            <Tag type={act.type} />
                                                                            
                                                                            {/* ✨ 費用輸入 (快速記帳) */}
                                                                            <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors">
                                                                                <DollarSign className="w-3 h-3" />
                                                                                <input 
                                                                                    type="text"
                                                                                    placeholder="0"
                                                                                    value={act.cost || ''}
                                                                                    onChange={(e) => handleActivityUpdate(dayIndex, index, 'cost', e.target.value)}
                                                                                    className="w-10 bg-transparent outline-none text-right text-gray-600 font-medium"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">{act.description}</p>
                                                                    </div>
                                                                    
                                                                    <div {...provided.dragHandleProps} className="flex items-center text-gray-300 px-1 cursor-grab active:cursor-grabbing hover:text-gray-500 transition-colors">
                                                                        <GripVertical className="w-5 h-5" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                ) : (
                                    <RouteVisualization day={day} destination={trip.destination} />
                                )}
                            </div>
                        ))}
                        <div className="h-10"></div>
                    </div>
                </DragDropContext>
            </div>

            {isAddModalOpen && <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />}
        </div>
    );
};

// ... (後面的組件請保持原樣，務必複製回原本的代碼) ...
const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState(''); const [time, setTime] = useState('09:00'); const [type, setType] = useState<Activity['type']>('sightseeing'); const [description, setDescription] = useState(''); const [location, setLocation] = useState('');
    const handleSubmit = () => { if (!title) return; onAdd({ id: Date.now().toString(), time, title, description, type, location }); };
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-3xl rounded-t-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">新增第 {day} 天</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="space-y-4"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-gray-100 rounded-xl py-3 px-3" /><select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-gray-100 rounded-xl py-3 px-3"><option value="sightseeing">景點</option><option value="food">美食</option><option value="transport">交通</option><option value="flight">航班</option><option value="hotel">住宿</option></select></div><IOSButton fullWidth onClick={handleSubmit}>確認</IOSButton></div></div></div>
    );
};
const RouteVisualization: React.FC<{ day: TripDay; destination: string }> = ({ day, destination }) => {
    const stops = day.activities.filter(a => a.title || a.location).map(a => a.location || a.title);
    let mapUrl = '';
    if (stops.length === 0) mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    else if (stops.length === 1) mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
    else {
        const origin = encodeURIComponent(stops[0]);
        const dest = encodeURIComponent(stops[stops.length - 1]);
        const waypoints = stops.slice(1, -1).map(s => encodeURIComponent(s)).join('|');
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`;
    }
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mt-2">
            <div className="h-24 bg-blue-50 relative overflow-hidden flex items-center justify-center"><div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div><Map className="w-8 h-8 text-ios-blue opacity-50" />{stops.length > 1 && (<div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[10px] text-ios-blue font-bold uppercase tracking-widest z-10"><span className="bg-white/80 backdrop-blur px-1.5 rounded">START</span><div className="h-[2px] flex-1 bg-ios-blue/20 mx-2 relative flex items-center"><div className="w-1 h-1 rounded-full bg-ios-blue/40 ml-1"></div><div className="w-1 h-1 rounded-full bg-ios-blue/40 ml-2"></div><div className="absolute right-0 -top-[3px] w-2 h-2 rounded-full bg-ios-blue"></div></div><span className="bg-white/80 backdrop-blur px-1.5 rounded">END</span></div>)}</div>
            <div className="p-5">
                {stops.length === 0 ? <div className="text-center text-gray-400 text-sm py-4">今天還沒有安排行程地點<br/>點擊上方「+」開始規劃</div> : (
                    <><div className="space-y-0 mb-6 pl-2">{stops.map((stop, index) => (<div key={index} className="flex gap-4 relative"><div className="flex flex-col items-center w-4"><div className={`w-3 h-3 rounded-full border-2 z-10 box-content ${index === 0 ? 'bg-ios-blue border-white shadow-sm' : index === stops.length - 1 ? 'bg-red-500 border-white shadow-sm' : 'bg-gray-200 border-white'}`}></div>{index !== stops.length - 1 && <div className="w-[2px] flex-1 bg-gray-100 my-0.5"></div>}</div><div className="pb-5 -mt-1 flex-1"><p className={`text-sm ${index === 0 || index === stops.length - 1 ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>{stop}</p>{index === 0 && <span className="inline-block mt-1 text-[10px] text-ios-blue bg-blue-50 px-1.5 py-0.5 rounded font-medium">起點</span>}{index === stops.length - 1 && <span className="inline-block mt-1 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">終點</span>}</div></div>))}</div><a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-ios-blue text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-blue-200 hover:bg-blue-600"><Map className="w-5 h-5" />開啟 Google Maps 導航</a><p className="text-center text-[10px] text-gray-400 mt-3">將自動帶入所有途經點規劃最佳路線</p></>
                )}
            </div>
        </div>
    );
};
const Tag: React.FC<{ type: string }> = ({ type }) => { const colors: any = { food: 'bg-orange-100 text-orange-600', sightseeing: 'bg-blue-100 text-blue-600', transport: 'bg-gray-100 text-gray-600', flight: 'bg-purple-100 text-purple-600', hotel: 'bg-indigo-100 text-indigo-600' }; return <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${colors[type] || colors.sightseeing}`}>{type}</span>; };

export default App;