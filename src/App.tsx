import React, { useState, useEffect } from 'react';
import { Home, Compass, Briefcase, FileText } from 'lucide-react';
import { AppView } from './types';
import type { Trip, User } from './types';
import { TripsView } from './views/TripsView';
import { ToolsView } from './views/ToolsView';
import { VaultView } from './views/VaultView';
import { ExploreView } from './views/ExploreView';
import { LoginView } from './views/LoginView';
import { supabase } from './services/supabase';
import { ItineraryView } from './views/ItineraryView';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- 核心邏輯：讀取使用者資料 ---
  const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
          const userName = session.user.user_metadata?.full_name || 'User';
          // 關鍵：每次都重新讀取 avatar_url，確保是最新上傳的
          const userAvatar = session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=e5e7eb`;
          
          setUser({
              id: session.user.id,
              name: userName,
              joinedDate: new Date(session.user.created_at).toLocaleDateString(),
              avatar: userAvatar
          });
          
          // 載入背景設定
          const savedBg = localStorage.getItem(`voyage_${session.user.id}_bg_image`);
          if (savedBg) setBgImage(savedBg);
          
          // 載入行程
          fetchTrips(session.user.id);
      } else {
          setUser(null);
          setTrips([]);
      }
  };

  // --- 核心修正：加入 Auth 監聽器 ---
  // 這會自動處理「登入成功」、「登出」的所有狀態變化
  useEffect(() => {
      // 1. 初始化檢查
      fetchUserData();

      // 2. 監聽登入/登出事件 (解決登出後再登入頭貼消失的問題)
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN') {
              console.log("偵測到登入，正在更新使用者資料...");
              fetchUserData(); // 登入後，立刻重抓最新資料 (包含新頭貼)
          } else if (event === 'SIGNED_OUT') {
              console.log("已登出");
              setUser(null);
              setCurrentView(AppView.TRIPS);
              setSelectedTrip(null);
          }
      });

      return () => {
          authListener.subscription.unsubscribe();
      };
  }, []);

  const fetchTrips = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      
      setIsSyncing(true);
      const { data } = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
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

  // handleLogin 改為空函式，因為我們現在靠 onAuthStateChange 自動處理
  const handleLogin = (newUser: User) => { 
      // 觸發 fetchUserData 來確保資料是最新的
      fetchUserData();
  };

  const handleLogout = async () => {
      if(confirm("確定要登出嗎？")) {
          await supabase.auth.signOut();
          // 狀態清除交給 onAuthStateChange 處理
      }
  };

  const handleUpdateBackground = (img: string) => {
      setBgImage(img);
      if(user) localStorage.setItem(`voyage_${user.id}_bg_image`, img);
  }
  
  const handleTripSelect = (trip: Trip) => setSelectedTrip(trip);
  
  const handleReorderTrips = (newTrips: Trip[]) => { setTrips(newTrips); };
  
  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setSelectedTrip(updatedTrip);
    saveTripToCloud(updatedTrip);
  };

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
      <ItineraryView 
        trip={selectedTrip} 
        onBack={() => setSelectedTrip(null)}
        onDelete={() => handleSoftDeleteTrip(selectedTrip.id)}
        onUpdateTrip={handleUpdateTrip}
      />
    );
  }

  return (
    // 修正: 使用 h-[100dvh] 解決手機網址列遮擋問題
    <div className="h-[100dvh] w-full font-sans text-gray-900 bg-gray-50/80 overflow-hidden fixed inset-0" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}
      
      <main className="max-w-md mx-auto h-full relative shadow-2xl overflow-hidden z-10 bg-gray-50/80 backdrop-blur-md flex flex-col">
        
        {isSyncing && (
            <div className="absolute top-4 right-4 z-50 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse pointer-events-none">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                同步中...
            </div>
        )}

        {/* 修正: 確保 overflow 正常運作 */}
        <div className="flex-1 min-h-0 relative w-full flex flex-col">
            {currentView === AppView.TRIPS && (
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
            )}
            
            {currentView === AppView.EXPLORE && (
                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in">
                    <ExploreView />
                </div>
            )}
            
            {currentView === AppView.TOOLS && (
                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in">
                    <ToolsView onUpdateBackground={handleUpdateBackground} />
                </div>
            )}
            
            {currentView === AppView.VAULT && (
                <VaultView 
                    deletedTrips={trips.filter(t => t.isDeleted)} 
                    onRestoreTrip={handleRestoreTrip} 
                    onPermanentDeleteTrip={handlePermanentDeleteTrip} 
                />
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

export default App;