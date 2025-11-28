
import React, { useState, useEffect } from 'react';
import { Home, Compass, Briefcase, FileText, ArrowLeft, List, Map, Trash2 } from 'lucide-react';
import { AppView } from './types';
import type { Trip, TripDay, User } from './types';
import { TripsView } from './views/TripsView';
import { ToolsView } from './views/ToolsView';
import { VaultView } from './views/VaultView';
import { ExploreView } from './views/ExploreView';
import { LoginView } from './views/LoginView';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  
  // Data State
  const [trips, setTrips] = useState<Trip[]>([]);

  // 1. Initial Load: Check for User Session
  useEffect(() => {
      const savedUser = localStorage.getItem('voyage_current_user');
      if (savedUser) {
          try {
              setUser(JSON.parse(savedUser));
          } catch (e) {
              console.error("Failed to parse user", e);
          }
      }
  }, []);

  // 2. Data Sync: Load data SPECIFIC TO USER when user changes
  useEffect(() => {
      if (!user) {
          setTrips([]);
          setBgImage('');
          return;
      }

      // Load User's Trips
      try {
        const savedTrips = localStorage.getItem(`voyage_${user.id}_trips`);
        setTrips(savedTrips ? JSON.parse(savedTrips) : []);
      } catch (e) {
        console.error("Failed to load user trips", e);
        setTrips([]);
      }

      // Load User's Background
      const savedBg = localStorage.getItem(`voyage_${user.id}_bg_image`);
      if (savedBg) setBgImage(savedBg);

  }, [user]);

  // 3. Import Logic (Handles deep link even if not logged in initially)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('import');
    
    if (importData && user) { // Only process import if user is logged in
        try {
            const jsonString = decodeURIComponent(escape(atob(importData)));
            const tripData = JSON.parse(jsonString);
            if (window.confirm(`是否匯入分享的行程：「${tripData.destination}」？`)) {
                handleImportTrip(tripData);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (e) {
            console.error("Import failed", e);
            alert("匯入連結無效或已過期");
        }
    }
  }, [user]); // Re-run when user logs in

  // 4. Persistence: Save data to User-Scoped Keys
  useEffect(() => {
    if (!user) return;
    try {
        localStorage.setItem(`voyage_${user.id}_trips`, JSON.stringify(trips));
    } catch (e) {
        console.error("Quota exceeded for trips", e);
    }
  }, [trips, user]);

  const handleLogin = (newUser: User) => {
      setUser(newUser);
      localStorage.setItem('voyage_current_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
      if(confirm("確定要登出嗎？您的資料將保留在裝置上。")) {
          setUser(null);
          localStorage.removeItem('voyage_current_user');
          setCurrentView(AppView.TRIPS);
          setSelectedTrip(null);
      }
  };

  const handleUpdateBackground = (image: string) => {
      setBgImage(image);
      if (user) {
        try {
            localStorage.setItem(`voyage_${user.id}_bg_image`, image);
        } catch (e) {
            console.error("Image too large", e);
            alert("圖片過大，無法永久儲存，僅本次使用有效。");
        }
      }
  };

  const handleTripSelect = (trip: Trip) => {
    setSelectedTrip(trip);
  };

  // Reorder Trips
  const handleReorderTrips = (newTrips: Trip[]) => {
      setTrips(newTrips);
  };

  // Soft Delete
  const handleSoftDeleteTrip = (id: string) => {
    if(confirm('確定要刪除此行程嗎？它將被移動到保管箱的垃圾桶中。')) {
        setTrips(trips.map(t => t.id === id ? { ...t, isDeleted: true } : t));
        if (selectedTrip?.id === id) {
            setSelectedTrip(null);
        }
    }
  }

  // Restore Trip
  const handleRestoreTrip = (id: string) => {
      setTrips(trips.map(t => t.id === id ? { ...t, isDeleted: false } : t));
  };

  // Permanent Delete
  const handlePermanentDeleteTrip = (id: string) => {
      if(confirm('確定要永久刪除嗎？此動作無法復原。')) {
          setTrips(trips.filter(t => t.id !== id));
      }
  };

  // Import Trip
  const handleImportTrip = (tripData: Trip) => {
      // Ensure unique ID to avoid conflicts
      const newTrip = { ...tripData, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, isDeleted: false };
      
      // If cover image is missing (stripped for URL share), add a placeholder
      if (!newTrip.coverImage || newTrip.coverImage.length < 100) {
          newTrip.coverImage = `https://picsum.photos/seed/${newTrip.destination}/800/600`;
      }
      
      setTrips(prev => [newTrip, ...prev]);
  };

  // --- RENDER ---

  // 1. Not Logged In -> Show Login View
  if (!user) {
      return <LoginView onLogin={handleLogin} />;
  }

  // 2. Detail View (Itinerary)
  if (selectedTrip) {
    return (
      <ItineraryDetailView 
        trip={selectedTrip} 
        onBack={() => setSelectedTrip(null)}
        onDelete={() => handleSoftDeleteTrip(selectedTrip.id)}
      />
    );
  }

  // 3. Main App View
  return (
    <div 
        className="min-h-screen font-sans text-gray-900 antialiased selection:bg-ios-blue/30 bg-cover bg-center transition-all duration-500"
        style={{ 
            backgroundImage: bgImage ? `url(${bgImage})` : 'none',
            backgroundColor: bgImage ? 'transparent' : '#F2F2F7'
        }}
    >
      {/* Overlay */}
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}

      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl overflow-hidden z-10 bg-gray-50/80 backdrop-blur-md">
        
        {/* View Content */}
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
        {currentView === AppView.EXPLORE && (
            <div className="animate-in fade-in duration-300">
                <ExploreView />
            </div>
        )}
        {currentView === AppView.TOOLS && (
             <div className="animate-in fade-in duration-300">
                <ToolsView onUpdateBackground={handleUpdateBackground} />
            </div>
        )}
        {currentView === AppView.VAULT && (
             <div className="animate-in fade-in duration-300">
                <VaultView 
                    deletedTrips={trips.filter(t => t.isDeleted)}
                    onRestoreTrip={handleRestoreTrip}
                    onPermanentDeleteTrip={handlePermanentDeleteTrip}
                />
            </div>
        )}

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50">
            {/* Glass Background Layer */}
            <div className="absolute inset-0 bg-white/85 backdrop-blur-xl border-t border-gray-200/50" />
            
            {/* Tab Buttons Container */}
            <div className="relative flex justify-between items-center pb-safe pt-2 px-6 h-[calc(60px+env(safe-area-inset-bottom))]">
                <TabButton 
                    active={currentView === AppView.TRIPS} 
                    onClick={() => setCurrentView(AppView.TRIPS)} 
                    icon={<Home />} 
                    label="行程" 
                />
                <TabButton 
                    active={currentView === AppView.EXPLORE} 
                    onClick={() => setCurrentView(AppView.EXPLORE)} 
                    icon={<Compass />} 
                    label="探索" 
                />
                <TabButton 
                    active={currentView === AppView.TOOLS} 
                    onClick={() => setCurrentView(AppView.TOOLS)} 
                    icon={<Briefcase />} 
                    label="小工具" 
                />
                <TabButton 
                    active={currentView === AppView.VAULT} 
                    onClick={() => setCurrentView(AppView.VAULT)} 
                    icon={<FileText />} 
                    label="保管箱" 
                />
            </div>
        </div>
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1 transition-colors duration-200 ${active ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-600'}`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6', strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// --- Sub-View: Itinerary Detail ---

import { MapPin, DollarSign } from 'lucide-react';

const ItineraryDetailView: React.FC<{ trip: Trip; onBack: () => void; onDelete: () => void }> = ({ trip, onBack, onDelete }) => {
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    return (
        <div className="bg-white min-h-screen max-w-md mx-auto relative animate-in slide-in-from-right duration-300 pb-10">
            {/* Header Image */}
            <div className="h-64 relative">
                <img src={trip.coverImage} className="w-full h-full object-cover" alt="Cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
                
                <button 
                    onClick={onBack}
                    className="absolute top-12 left-5 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <button 
                    onClick={onDelete}
                    className="absolute top-12 right-5 w-10 h-10 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-10"
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                <div className="absolute bottom-6 left-5 text-white">
                    <h1 className="text-3xl font-bold">{trip.destination}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium">
                            {trip.days.length} 天行程
                        </span>
                        <span className="text-sm opacity-90">{trip.startDate}</span>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="px-5 mt-4">
                 <div className="bg-gray-100 p-1 rounded-xl flex">
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        <List className="w-4 h-4" /> 列表
                    </button>
                    <button 
                        onClick={() => setViewMode('map')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        <Map className="w-4 h-4" /> 地圖
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 py-6 space-y-10">
                {trip.days.map((day, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-dashed border-gray-200">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-ios-blue border-4 border-white shadow-sm" />
                        <h2 className="text-xl font-bold text-gray-900 mb-4 -mt-1">第 {day.day} 天</h2>
                        
                        {viewMode === 'list' ? (
                            <div className="space-y-4">
                                {day.activities.length === 0 ? (
                                    <div className="text-gray-400 text-sm italic">尚無活動</div>
                                ) : (
                                    day.activities.map((act, j) => (
                                        <div key={j} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex gap-4">
                                            <div className="flex flex-col items-center pt-1 min-w-[50px]">
                                                <span className="text-xs font-bold text-gray-400">{act.time}</span>
                                                <div className="h-full w-px bg-gray-100 mt-2" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="font-semibold text-gray-900 leading-tight">{act.title}</h3>
                                                    <Tag type={act.type} />
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{act.description}</p>
                                                <div className="flex gap-3 text-xs text-gray-400">
                                                    {act.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {act.location}</span>}
                                                    {act.cost && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {act.cost}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            // Simple Route Visualization
                            <RouteVisualization day={day} destination={trip.destination} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// A simplified visual representation of a route map with a link to Google Maps
const RouteVisualization: React.FC<{ day: TripDay, destination: string }> = ({ day, destination }) => {
    // Construct Google Maps Directions URL
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
            {/* Abstract visual route connecting dots */}
            <div className="relative h-40 w-full mb-4 bg-white rounded-xl overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                {/* SVG Route Line */}
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
