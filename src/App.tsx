import React, { useState, useEffect, useRef } from 'react';
import { Home, Compass, Briefcase, FileText, Camera, ArrowLeft, List, Map, Trash2, Plus, GripVertical, Clock, X, MapPin, DollarSign, Tag as TagIcon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { AppView } from './types';
import type { Trip, TripDay, User, Activity } from './types';
import { TripsView } from './views/TripsView';
import { ToolsView } from './views/ToolsView';
import { VaultView } from './views/VaultView';
import { ExploreView } from './views/ExploreView';
import { LoginView } from './views/LoginView';
import { IOSButton, IOSInput } from './components/UI';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);

  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setSelectedTrip(updatedTrip);
  };
  
  useEffect(() => {
      const sessionActive = localStorage.getItem('voyage_session_active');
      const savedAccount = localStorage.getItem('voyage_user_account');
      if (sessionActive === 'true' && savedAccount) {
          try { setUser(JSON.parse(savedAccount)); } catch (e) { console.error(e); }
      }
  }, []);

  useEffect(() => {
      if (!user) { setTrips([]); setBgImage(''); return; }
      try {
        const savedTrips = localStorage.getItem(`voyage_${user.id}_trips`);
        setTrips(savedTrips ? JSON.parse(savedTrips) : []);
      } catch (e) { console.error(e); setTrips([]); }
      const savedBg = localStorage.getItem(`voyage_${user.id}_bg_image`);
      if (savedBg) setBgImage(savedBg);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`voyage_${user.id}_trips`, JSON.stringify(trips));
  }, [trips, user]);

  const handleLogin = (newUser: User) => {
      setUser(newUser);
      localStorage.setItem('voyage_user_account', JSON.stringify(newUser));
      localStorage.setItem('voyage_session_active', 'true');
  };

  const handleLogout = () => {
      if(confirm("確定要登出嗎？資料會保留在手機上。")) {
          setUser(null);
          localStorage.removeItem('voyage_session_active');
          setCurrentView(AppView.TRIPS);
          setSelectedTrip(null);
      }
  };

  const handleUpdateBackground = (img: string) => {
      setBgImage(img);
      if(user) localStorage.setItem(`voyage_${user.id}_bg_image`, img);
  }
  const handleTripSelect = (trip: Trip) => setSelectedTrip(trip);
  const handleReorderTrips = (newTrips: Trip[]) => setTrips(newTrips);
  
  const handleSoftDeleteTrip = (id: string) => {
    if(confirm('確定要刪除此行程嗎？')) {
        setTrips(trips.map(t => t.id === id ? { ...t, isDeleted: true } : t));
        if (selectedTrip?.id === id) setSelectedTrip(null);
    }
  }
  const handleRestoreTrip = (id: string) => setTrips(trips.map(t => t.id === id ? { ...t, isDeleted: false } : t));
  const handlePermanentDeleteTrip = (id: string) => {
      if(confirm('確定要永久刪除嗎？')) setTrips(trips.filter(t => t.id !== id));
  };
  const handleImportTrip = (tripData: Trip) => {
      const newTrip = { ...tripData, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, isDeleted: false };
      if (!newTrip.coverImage || newTrip.coverImage.length < 100) {
          newTrip.coverImage = `https://picsum.photos/seed/${newTrip.destination}/800/600`;
      }
      setTrips(prev => [newTrip, ...prev]);
  };

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

  // 🔥 佈局大改造：
  // 1. h-[100dvh]：強制高度等於螢幕視窗，不讓網址列影響。
  // 2. flex-col：垂直排列 (內容在上，導覽列在下)。
  // 3. overflow-hidden：禁止整頁捲動，只讓中間區域捲動。
  return (
    <div className="h-[100dvh] w-full font-sans text-gray-900 bg-gray-50/80 overflow-hidden fixed inset-0" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}
      
      <main className="max-w-md mx-auto h-full relative shadow-2xl overflow-hidden z-10 bg-gray-50/80 backdrop-blur-md flex flex-col">
        
        {/* [中段] 內容顯示區：flex-1 讓它自動填滿剩餘空間 */}
        <div className="flex-1 overflow-hidden relative w-full">
            {currentView === AppView.TRIPS && (
              <div className="h-full w-full">
                <TripsView 
                  trips={trips.filter(t => !t.isDeleted)} 
                  user={user}
                  onLogout={handleLogout}
                  onAddTrip={(t) => setTrips([...trips, t])} 
                  onImportTrip={handleImportTrip}
                  onSelectTrip={handleTripSelect}
                  onDeleteTrip={handleSoftDeleteTrip}
                  onReorderTrips={handleReorderTrips}
                />
              </div>
            )}
            {/* 其他頁面加上 overflow-y-auto 讓它們可以自己捲動 */}
            {currentView === AppView.EXPLORE && <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in"><ExploreView /></div>}
            {currentView === AppView.TOOLS && <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in"><ToolsView onUpdateBackground={handleUpdateBackground} /></div>}
            {currentView === AppView.VAULT && <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in"><VaultView deletedTrips={trips.filter(t => t.isDeleted)} onRestoreTrip={handleRestoreTrip} onPermanentDeleteTrip={handlePermanentDeleteTrip} /></div>}
        </div>

        {/* [下段] 底部導覽列：flex-shrink-0 固定高度 */}
        <div className="flex-shrink-0 z-50 relative w-full bg-white/85 backdrop-blur-xl border-t border-gray-200/50">
            <div className="flex justify-between items-center pb-safe pt-2 px-6 h-[calc(60px+env(safe-area-inset-bottom))]">
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

// --- ItineraryDetailView (也加入固定 Header 邏輯) ---

const ItineraryDetailView: React.FC<{ 
    trip: Trip; 
    onBack: () => void; 
    onDelete: () => void; 
    onUpdateTrip: (t: Trip) => void; 
}> = ({ trip, onBack, onDelete, onUpdateTrip }) => {
    
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeDayForAdd, setActiveDayForAdd] = useState<number>(1);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const [moved] = newTrip.days[parseInt(result.source.droppableId.split('-')[1])-1].activities.splice(result.source.index, 1);
        newTrip.days[parseInt(result.destination.droppableId.split('-')[1])-1].activities.splice(result.destination.index, 0, moved);
        onUpdateTrip(newTrip);
    };

    const handleAddActivity = (newActivity: Activity) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[activeDayForAdd - 1].activities.push(newActivity);
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

    // 🔥 這裡也改成 Flexbox 佈局，讓 Header 固定
    return (
        <div className="bg-white h-full w-full flex flex-col relative animate-in slide-in-from-right duration-300">
            
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
                
                {/* Header Image */}
                <div className="h-64 relative group flex-shrink-0">
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

                    <div className="absolute bottom-6 left-5 text-white pr-14">
                        <h1 className="text-3xl font-bold drop-shadow-md">{trip.destination}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium">{trip.days.length} 天行程</span>
                            <span className="text-sm opacity-90">{trip.startDate}</span>
                        </div>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="px-5 mt-4">
                    <div className="bg-gray-100 p-1 rounded-xl flex">
                        <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                            <List className="w-4 h-4" /> 列表
                        </button>
                        <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                            <Map className="w-4 h-4" /> 地圖
                        </button>
                    </div>
                </div>

                {/* Content */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="px-5 py-6 space-y-10">
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
                                                            <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style }} className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex gap-3 group relative ${snapshot.isDragging ? 'shadow-lg z-50' : ''}`}>
                                                                <div className="flex flex-col items-center pt-1 min-w-[45px]">
                                                                    <span className="text-xs font-bold text-gray-400">{act.time}</span>
                                                                    <button onClick={() => handleDeleteActivity(dayIndex, index)} className="mt-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-gray-900 truncate">{act.title}</h3>
                                                                    <Tag type={act.type} />
                                                                    <p className="text-xs text-gray-500 line-clamp-1">{act.description}</p>
                                                                </div>
                                                                <div {...provided.dragHandleProps} className="flex items-center text-gray-300 px-1"><GripVertical className="w-5 h-5" /></div>
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
                    </div>
                </DragDropContext>
            </div>

            {isAddModalOpen && <AddActivityModal day={activeDayForAdd} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddActivity} />}
        </div>
    );
};

// ... (Modal 和其他組件保持不變，直接複製下方代碼) ...
const AddActivityModal: React.FC<{ day: number; onClose: () => void; onAdd: (act: Activity) => void; }> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState(''); const [time, setTime] = useState('09:00'); const [type, setType] = useState<Activity['type']>('sightseeing'); const [description, setDescription] = useState(''); const [location, setLocation] = useState('');
    const handleSubmit = () => { if (!title) return; onAdd({ id: Date.now().toString(), time, title, description, type, location }); };
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="bg-white w-full max-w-sm sm:rounded-3xl rounded-t-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">新增第 {day} 天</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="space-y-4"><IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="活動名稱" /><div className="flex gap-3"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-gray-100 rounded-xl py-3 px-3" /><select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-gray-100 rounded-xl py-3 px-3"><option value="sightseeing">景點</option><option value="food">美食</option><option value="transport">交通</option><option value="flight">航班</option><option value="hotel">住宿</option></select></div><IOSButton fullWidth onClick={handleSubmit}>確認</IOSButton></div></div></div>
    );
};
const RouteVisualization: React.FC<any> = () => <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-400 text-xs">地圖預覽</div>;
const Tag: React.FC<{ type: string }> = ({ type }) => { const colors: any = { food: 'bg-orange-100 text-orange-600', sightseeing: 'bg-blue-100 text-blue-600', transport: 'bg-gray-100 text-gray-600', flight: 'bg-purple-100 text-purple-600', hotel: 'bg-indigo-100 text-indigo-600' }; return <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${colors[type] || colors.sightseeing}`}>{type}</span>; };

export default App;