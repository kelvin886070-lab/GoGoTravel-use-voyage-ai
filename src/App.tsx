import React, { useState, useEffect, useRef } from 'react';
import { Home, Compass, Briefcase, FileText, ArrowLeft, List, Map, Trash2, Plus, GripVertical, Clock, X, MapPin, DollarSign, Tag as TagIcon, Camera } from 'lucide-react';
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

  // 用來更新單一行程資料
  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setSelectedTrip(updatedTrip);
  };
  
  // 1. 初始化檢查 (關鍵修改！)
  useEffect(() => {
      // 檢查是否有「登入中」的標記
      const sessionActive = localStorage.getItem('voyage_session_active');
      // 讀取「帳號資料」
      const savedAccount = localStorage.getItem('voyage_user_account');

      // 只有當「帳號存在」且「上次是登入狀態」時，才自動登入
      // 如果你希望每次重新整理都要輸入密碼，可以把 sessionActive 的判斷拿掉
      if (sessionActive === 'true' && savedAccount) {
          try { 
              setUser(JSON.parse(savedAccount)); 
          } catch (e) { 
              console.error(e); 
          }
      }
  }, []);

  // 2. 載入使用者資料
  useEffect(() => {
      if (!user) { setTrips([]); setBgImage(''); return; }
      try {
        const savedTrips = localStorage.getItem(`voyage_${user.id}_trips`);
        setTrips(savedTrips ? JSON.parse(savedTrips) : []);
      } catch (e) { console.error(e); setTrips([]); }
      const savedBg = localStorage.getItem(`voyage_${user.id}_bg_image`);
      if (savedBg) setBgImage(savedBg);
  }, [user]);

  // 3. 儲存行程資料
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`voyage_${user.id}_trips`, JSON.stringify(trips));
  }, [trips, user]);

  // 4. 登入處理 (關鍵修改！)
  const handleLogin = (newUser: User) => {
      setUser(newUser);
      // 儲存帳號資料 (永久)
      localStorage.setItem('voyage_user_account', JSON.stringify(newUser));
      // 標記為登入狀態
      localStorage.setItem('voyage_session_active', 'true');
  };

  // 5. 登出處理 (關鍵修改！)
  const handleLogout = () => {
      if(confirm("確定要登出嗎？資料會保留在手機上。")) {
          setUser(null);
          // 只移除「登入狀態」，不移除「帳號資料」
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

  // ... (Main App View Render 保持不變) ...
  return (
    <div className="min-h-screen font-sans text-gray-900 bg-gray-50/80" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover' }}>
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl overflow-hidden z-10 bg-gray-50/80 backdrop-blur-md">
        
        {currentView === AppView.TRIPS && (
          <div className="animate-in fade-in duration-300">
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
        {currentView === AppView.EXPLORE && <div className="animate-in fade-in"><ExploreView /></div>}
        {currentView === AppView.TOOLS && <div className="animate-in fade-in"><ToolsView onUpdateBackground={handleUpdateBackground} /></div>}
        {currentView === AppView.VAULT && <div className="animate-in fade-in"><VaultView deletedTrips={trips.filter(t => t.isDeleted)} onRestoreTrip={handleRestoreTrip} onPermanentDeleteTrip={handlePermanentDeleteTrip} /></div>}

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50">
            <div className="absolute inset-0 bg-white/85 backdrop-blur-xl border-t border-gray-200/50" />
            <div className="relative flex justify-between items-center pb-safe pt-2 px-6 h-[calc(60px+env(safe-area-inset-bottom))]">
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
// 🔥 ItineraryDetailView (保持原樣，僅為了完整性列出)
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImage = reader.result as string;
                const updatedTrip = { ...trip, coverImage: newImage };
                onUpdateTrip(updatedTrip);
            };
            reader.readAsDataURL(file);
        }
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination } = result;
        const sourceDayIndex = parseInt(source.droppableId.replace('day-', '')) - 1;
        const destDayIndex = parseInt(destination.droppableId.replace('day-', '')) - 1;

        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const [movedActivity] = newTrip.days[sourceDayIndex].activities.splice(source.index, 1);
        newTrip.days[destDayIndex].activities.splice(destination.index, 0, movedActivity);
        onUpdateTrip(newTrip);
    };

    const handleAddActivity = (newActivity: Activity) => {
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        const dayIndex = activeDayForAdd - 1;
        if (newTrip.days[dayIndex]) {
            newTrip.days[dayIndex].activities.push(newActivity);
            newTrip.days[dayIndex].activities.sort((a, b) => a.time.localeCompare(b.time));
            onUpdateTrip(newTrip);
        }
        setIsAddModalOpen(false);
    };

    const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
        if(!confirm("確定要刪除這個活動嗎？")) return;
        const newTrip = JSON.parse(JSON.stringify(trip)) as Trip;
        newTrip.days[dayIndex].activities.splice(activityIndex, 1);
        onUpdateTrip(newTrip);
    }

    const openAddModal = (day: number) => {
        setActiveDayForAdd(day);
        setIsAddModalOpen(true);
    };

    return (
        <div className="bg-white min-h-screen max-w-md mx-auto relative animate-in slide-in-from-right duration-300 pb-10">
            
            <div className="h-64 relative group">
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
                    title="更換封面"
                >
                    <Camera className="w-5 h-5" />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleCoverChange} 
                    className="hidden" 
                    accept="image/*" 
                />

                <div className="absolute bottom-6 left-5 text-white pr-14">
                    <h1 className="text-3xl font-bold drop-shadow-md">{trip.destination}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium">{trip.days.length} 天行程</span>
                        <span className="text-sm opacity-90">{trip.startDate}</span>
                    </div>
                </div>
            </div>

            <div className="px-5 mt-4">
                 <div className="bg-gray-100 p-1 rounded-xl flex">
                    <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        <List className="w-4 h-4" /> 列表 (可排序)
                    </button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        <Map className="w-4 h-4" /> 地圖
                    </button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="px-5 py-6 space-y-10">
                    {trip.days.map((day, dayIndex) => (
                        <div key={day.day} className="relative pl-6 border-l-2 border-dashed border-gray-200">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-ios-blue border-4 border-white shadow-sm" />
                            
                            <div className="flex justify-between items-center mb-4 -mt-1">
                                <h2 className="text-xl font-bold text-gray-900">第 {day.day} 天</h2>
                                
                                {viewMode === 'list' && (
                                    <button 
                                        onClick={() => openAddModal(day.day)}
                                        className="text-ios-blue bg-blue-50 hover:bg-blue-100 p-1.5 rounded-full transition-colors active:scale-90"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {viewMode === 'list' ? (
                                <Droppable droppableId={`day-${day.day}`}>
                                    {(provided) => (
                                        <div 
                                            ref={provided.innerRef} 
                                            {...provided.droppableProps}
                                            className="space-y-3 min-h-[50px]"
                                        >
                                            {day.activities.length === 0 && (
                                                <div className="text-gray-400 text-sm italic py-2">點擊右上方 + 新增活動</div>
                                            )}

                                            {day.activities.map((act, index) => (
                                                <Draggable key={`${day.day}-${index}`} draggableId={`${day.day}-${index}`} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{ ...provided.draggableProps.style }}
                                                            className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex gap-3 group relative ${snapshot.isDragging ? 'shadow-lg ring-2 ring-ios-blue/50 z-50' : ''}`}
                                                        >
                                                            <div className="flex flex-col items-center pt-1 min-w-[45px]">
                                                                <span className="text-xs font-bold text-gray-400">{act.time}</span>
                                                                <button 
                                                                    onClick={() => handleDeleteActivity(dayIndex, index)}
                                                                    className="mt-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <h3 className="font-semibold text-gray-900 leading-tight truncate pr-2">{act.title}</h3>
                                                                    <Tag type={act.type} />
                                                                </div>
                                                                {act.description && <p className="text-xs text-gray-500 line-clamp-2 mb-1.5">{act.description}</p>}
                                                                <div className="flex gap-2 text-[10px] text-gray-400">
                                                                    {act.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {act.location}</span>}
                                                                </div>
                                                            </div>

                                                            <div 
                                                                {...provided.dragHandleProps}
                                                                className="flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing px-1"
                                                            >
                                                                <GripVertical className="w-5 h-5" />
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
                </div>
            </DragDropContext>

            {isAddModalOpen && (
                <AddActivityModal 
                    day={activeDayForAdd} 
                    onClose={() => setIsAddModalOpen(false)} 
                    onAdd={handleAddActivity} 
                />
            )}
        </div>
    );
};

// ... (AddActivityModal, RouteVisualization, Tag 保持不變，但為了完整性建議一起複製上方的完整代碼) ...
const AddActivityModal: React.FC<{ 
    day: number; 
    onClose: () => void; 
    onAdd: (act: Activity) => void;
}> = ({ day, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('09:00');
    const [type, setType] = useState<Activity['type']>('sightseeing');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');

    const handleSubmit = () => {
        if (!title) return;
        const newActivity: Activity = {
            id: Date.now().toString(),
            time,
            title,
            description,
            type,
            location
        };
        onAdd(newActivity);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="bg-white w-full max-w-sm sm:rounded-3xl rounded-t-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">新增第 {day} 天活動</h3>
                    <button onClick={onClose} className="p-1 bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">活動名稱</label>
                        <IOSInput value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：清水寺參拜" />
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">時間</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="time" 
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/50"
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">類型</label>
                            <select 
                                value={type} 
                                onChange={e => setType(e.target.value as any)}
                                className="w-full bg-gray-100 rounded-xl py-3 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/50 appearance-none"
                            >
                                <option value="sightseeing">景點</option>
                                <option value="food">美食</option>
                                <option value="transport">交通</option>
                                <option value="flight">航班</option>
                                <option value="hotel">住宿</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">地點 (選填)</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <IOSInput value={location} onChange={e => setLocation(e.target.value)} placeholder="地址或地標名稱" style={{paddingLeft: '2.5rem'}} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">備註 / 描述</label>
                        <textarea 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="門票資訊、注意事項..."
                            className="w-full bg-gray-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/50 resize-none h-24"
                        />
                    </div>

                    <div className="pt-2">
                        <IOSButton fullWidth onClick={handleSubmit}>確認新增</IOSButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RouteVisualization: React.FC<{ day: TripDay, destination: string }> = ({ day, destination }) => {
    const locations = day.activities.filter(a => a.location || a.title).map(a => a.location || a.title);
    let mapUrl = '';
    if (locations.length >= 2) {
        const origin = encodeURIComponent(locations[0]);
        const dest = encodeURIComponent(locations[locations.length - 1]);
        const waypoints = locations.slice(1, -1).map(l => encodeURIComponent(l)).join('|');
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}`;
    } else if (locations.length === 1) {
         mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`;
    } else {
         mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    }

    return (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <div className="relative h-40 w-full mb-4 bg-white rounded-xl overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                <svg className="absolute inset-0 w-full h-full p-8" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <polyline 
                        points="10,25 30,10 50,40 70,15 90,25" 
                        fill="none" 
                        stroke="#007AFF" 
                        strokeWidth="2" 
                        strokeDasharray="4"
                        className="opacity-50"
                    />
                    <circle cx="10" cy="25" r="3" fill="#007AFF" />
                     <circle cx="30" cy="10" r="3" fill="#007AFF" />
                     <circle cx="50" cy="40" r="3" fill="#007AFF" />
                     <circle cx="70" cy="15" r="3" fill="#007AFF" />
                     <circle cx="90" cy="25" r="3" fill="#007AFF" />
                </svg>
                <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold shadow-sm z-10 text-gray-500">
                    路線預覽
                </span>
            </div>
            
            <div className="space-y-3">
                 <div className="flex flex-wrap gap-2">
                    {locations.map((loc, idx) => (
                        <div key={idx} className="flex items-center text-xs text-gray-600 bg-white border px-2 py-1 rounded-md">
                            <span className="w-4 h-4 rounded-full bg-ios-blue text-white flex items-center justify-center text-[8px] mr-1">{idx + 1}</span>
                            {loc}
                        </div>
                    ))}
                 </div>
                 
                 <a 
                    href={mapUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block w-full bg-ios-blue text-white text-center font-semibold py-3 rounded-xl active:opacity-90 transition-opacity flex items-center justify-center gap-2"
                 >
                    <Map className="w-4 h-4" />
                    在 Google 地圖中查看路線
                 </a>
            </div>
        </div>
    );
}

const Tag: React.FC<{ type: string }> = ({ type }) => {
    const colors: Record<string, string> = {
        food: 'bg-orange-100 text-orange-600',
        sightseeing: 'bg-blue-100 text-blue-600',
        transport: 'bg-gray-100 text-gray-600',
        flight: 'bg-purple-100 text-purple-600',
        hotel: 'bg-indigo-100 text-indigo-600'
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${colors[type] || colors.sightseeing}`}>
            {type}
        </span>
    );
};

export default App;