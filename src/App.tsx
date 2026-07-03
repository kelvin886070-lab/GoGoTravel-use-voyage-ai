// src/App.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Compass, Briefcase, FileText, Sparkles } from 'lucide-react';
import { AppView } from './types';
import type { Trip, User, Document, VaultFolder, VaultFile, WishItem } from './types';
import type { TripRow, VaultFolderRow, VaultFileRow, WishItemRow } from './db-types';
import { confirmDialog } from './components/ConfirmDialog';
import { toast } from './components/Toast';
import { geocodeWish, geocodeItems } from './services/geo';
import type { ParsedWish } from './services/gemini';
import { TripsView } from './views/TripsView/TripsView';
import { ToolsView } from './views/ToolsView';
import { VaultView } from './views/VaultView';
import { ExploreView } from './views/ExploreView';
import { LoginView } from './views/LoginView';
import { supabase } from './services/supabase';
import { signPaths, collectTripImagePaths, deleteTripImages, resolveTripImages, serializeTripForDb } from './services/storage';
import ItineraryView from './views/ItineraryView/ItineraryView';
import { WishBoxView } from './views/WishBoxView';
import { PasteImportModal } from './views/PasteImportModal';
import { WishItemEditModal } from './views/ItineraryView/modals/WishItemEditModal';

const DEFAULT_FOLDERS_CONFIG = [
    { name: '機票憑證', isPinned: true },
    { name: '住宿憑證', isPinned: true },
    { name: '保險單', isPinned: true },
    { name: '行程參考圖', isPinned: true },
];

// 🧱 Phase C0：心願盒改雲端（wish_items 表）。以下為 DB 列 ↔ 前端模型的對映。
const rowToWish = (r: WishItemRow): WishItem => ({
    id: r.id,
    type: (r.type as WishItem['type']) || 'place',
    country: r.country || '',
    title: r.title,
    area: r.area || undefined,
    url: r.url || undefined,
    notes: r.note || undefined,
    customImage: r.custom_image_path || undefined,
    budget: r.budget ?? undefined,
    currency: r.currency || undefined,
    tags: r.tags || undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    placeId: r.place_id || undefined,
    createdAt: r.created_at,
});

const wishToRow = (w: WishItem, userId: string) => ({
    id: w.id,
    user_id: userId,
    type: w.type,
    title: w.title,
    note: w.notes ?? null,
    country: w.country || null,
    area: w.area ?? null,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
    place_id: w.placeId ?? null,
    url: w.url ?? null,
    custom_image_path: w.customImage ?? null,
    budget: w.budget ?? null,
    currency: w.currency ?? null,
    tags: w.tags ?? [],
    created_at: w.createdAt,
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  
  const [wishItems, setWishItems] = useState<WishItem[]>([]);
  const [editingWishItem, setEditingWishItem] = useState<WishItem | null | undefined>(undefined);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitializingVaultRef = useRef(false);

  const allDocuments = useMemo<Document[]>(() => {
      return vaultFiles.map(f => ({
          id: f.id,
          title: f.name,
          type: f.category || (f.type === 'image' || f.type === 'pdf' ? 'other' : 'other'),
          fileUrl: f.data,
          createdAt: f.date,
          isOffline: false, 
          documentNumber: f.documentNumber,
          notes: f.notes
      } as Document));
  }, [vaultFiles]);

  const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
          const userName = session.user.user_metadata?.full_name || 'User';
          const userAvatar = session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=e5e7eb`;
          
          setUser({
              id: session.user.id,
              name: userName,
              joinedDate: new Date(session.user.created_at).toLocaleDateString(),
              avatar: userAvatar
          });
          const savedBg = localStorage.getItem(`voyage_${session.user.id}_bg_image`);
          if (savedBg) setBgImage(savedBg);
          
          fetchTrips(session.user.id);
          fetchVaultData(session.user.id);
          fetchWishItems(session.user.id);
      } else {
          setUser(null);
          setTrips([]);
          setVaultFolders([]);
          setVaultFiles([]);
          setWishItems([]);
      }
  };

  useEffect(() => {
      fetchUserData();
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN') {
              fetchUserData(); 
          } else if (event === 'SIGNED_OUT') {
              setUser(null);
              setCurrentView(AppView.TRIPS);
              setSelectedTrip(null);
              setVaultFolders([]);
              setVaultFiles([]);
          }
      });
      return () => {
          authListener.subscription.unsubscribe();
      };
  }, []);

  // 🚀 2.3 關閉/重新整理前，盡力把尚未寫出的編輯補存（最後防線）
  useEffect(() => {
      const handler = () => flushTripSave();
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // 🔔 3.4 告訴全域 Toast 目前底部導覽列高度：主分頁有列(70px)→Toast 抬到列上方；行程頁無列→0
  useEffect(() => {
      document.documentElement.style.setProperty('--bottom-nav-h', selectedTrip ? '0px' : '70px');
  }, [selectedTrip]);

  const fetchTrips = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      
      setIsSyncing(true);
      const { data } = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
      if (data) {
          const loadedTrips: Trip[] = (data as TripRow[]).map((row) => ({
              ...row.trip_data,
              id: row.id,
              isDeleted: row.trip_data.isDeleted || false
          }));
          // 🖼️ 2.2 收集所有圖片路徑（封面 + 記帳照片），一次批次換成 signed URL（顯示端零改動）
          const allPaths = loadedTrips.flatMap(collectTripImagePaths);
          const urlMap = await signPaths(allPaths);
          const resolved = loadedTrips.map(t => resolveTripImages(t, urlMap));
          setTrips(resolved);
      }
      setIsSyncing(false);
  };

  const fetchVaultData = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;

      const { data: folderData } = await supabase.from('vault_folders').select('*').order('created_at', { ascending: false });
      if (folderData && folderData.length === 0) {
          if (!isInitializingVaultRef.current) {
              isInitializingVaultRef.current = true;
              const defaultFolders = DEFAULT_FOLDERS_CONFIG.map(f => ({
                  user_id: currentUserId,
                  name: f.name,
                  parent_id: null,
                  is_pinned: f.isPinned,
                  is_deleted: false
              }));
              const { error } = await supabase.from('vault_folders').insert(defaultFolders);
              if (!error) {
                  const { data: newFolders } = await supabase.from('vault_folders').select('*').order('created_at', { ascending: false });
                  if (newFolders) {
                      setVaultFolders((newFolders as VaultFolderRow[]).map((row) => ({
                          id: row.id,
                          name: row.name,
                          parentId: row.parent_id || null,
                          isPinned: !!row.is_pinned,
                          isDeleted: !!row.is_deleted
                      })));
                  }
              }
              isInitializingVaultRef.current = false;
          }
      } else if (folderData) {
          setVaultFolders((folderData as VaultFolderRow[]).map((row) => ({
              id: row.id,
              name: row.name,
              parentId: row.parent_id || null,
              isPinned: !!row.is_pinned,
              isDeleted: !!row.is_deleted
          })));
      }

      const { data: fileData } = await supabase.from('vault_files').select('*').order('created_at', { ascending: false });
      if (fileData) {
          const rows = fileData as VaultFileRow[];
          const activeFiles = rows.filter((f) => !f.is_deleted);
          const signedUrlMap: Record<string, string> = {};

          if (activeFiles.length > 0) {
              const { data: signedData } = await supabase
                  .storage
                  .from('vault')
                  .createSignedUrls(activeFiles.map((f) => f.file_path), 60 * 60 * 24);
              if (signedData) {
                  signedData.forEach(item => {
                      if (item.path && item.signedUrl) {
                          signedUrlMap[item.path] = item.signedUrl;
                      }
                  });
              }
          }

          setVaultFiles(rows.map((row) => ({
              id: row.id,
              name: row.name,
              type: row.type as VaultFile['type'],
              size: row.size,
              date: new Date(row.created_at).toLocaleDateString(),
              parentId: row.parent_id || null,
              data: signedUrlMap[row.file_path] || '',
              file_path: row.file_path,
              isDeleted: !!row.is_deleted,
              isPinned: !!row.is_pinned,
              category: row.category as VaultFile['category'],
              documentNumber: row.document_number,
              notes: row.notes
          })));
      }
  };

  const handleLocalFileUpdate = (updatedFile: Partial<VaultFile>) => {
      setVaultFiles(prevFiles => prevFiles.map(file => 
          file.id === updatedFile.id ? { ...file, ...updatedFile } : file
      ));
  };

  // 🚀 2.3 防抖（debounce）儲存
  //   - 本地 state 即時更新（畫面不延遲）
  //   - 雲端寫入延後 800ms 合併，連續編輯只寫一次，大幅減少 DB 寫入與「同步中」閃爍
  const saveTimerRef = useRef<number | null>(null);
  const pendingTripRef = useRef<Trip | null>(null);

  const saveTripToCloud = async (trip: Trip) => {
      if (!user) return;
      setIsSyncing(true);
      // 🖼️ 2.2 存 DB 前序列化：把有 Storage 路徑的封面/記帳照片「顯示值」清空，不寫入暫時的 signed URL
      const tripForDb = serializeTripForDb(trip);
      const { error } = await supabase.from('trips').upsert({
              id: trip.id,
              user_id: user.id,
              trip_data: tripForDb,
              updated_at: new Date().toISOString()
          });
      if (error) console.error("上傳失敗", error);
      setIsSyncing(false);
  };

  // 取消尚未寫出的排程（用於刪除等「不該被舊版覆蓋」的情境）
  const cancelPendingSave = () => {
      if (saveTimerRef.current !== null) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
      }
      pendingTripRef.current = null;
  };

  // 立即把待儲存的行程寫出（換頁、登出、關閉前呼叫，避免遺失最後編輯）
  const flushTripSave = () => {
      if (saveTimerRef.current !== null) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
      }
      const pending = pendingTripRef.current;
      if (pending) {
          pendingTripRef.current = null;
          saveTripToCloud(pending);
      }
  };

  // 排程一次延後儲存；期間若有新編輯則重新計時
  const scheduleTripSave = (trip: Trip) => {
      pendingTripRef.current = trip;
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null;
          flushTripSave();
      }, 800);
  };

  const deleteTripFromCloud = async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) console.error("刪除失敗", error);
  };

  const handleLogin = (newUser: User) => { 
      fetchUserData();
  };
  
  const handleLogout = async () => {
      const ok = await confirmDialog({ title: '確定要登出嗎？', message: '你隨時可以再次登入這個帳號。', confirmText: '登出' });
      if (ok) {
          flushTripSave(); // 登出前補存最後編輯
          await supabase.auth.signOut();
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
    scheduleTripSave(updatedTrip); // 🚀 2.3 改為防抖儲存
  };

  const handleSoftDeleteTrip = async (id: string) => {
    const ok = await confirmDialog({ title: '移至保管箱？', message: '行程會移到保管箱，之後可再還原。', confirmText: '移至保管箱' });
    if (ok) {
        cancelPendingSave(); // 避免尚未寫出的舊版覆蓋掉刪除狀態
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

  const handlePermanentDeleteTrip = async (id: string) => {
      const ok = await confirmDialog({ title: '永久刪除這個行程？', message: '刪除後將無法復原，資料會永久消失。', confirmText: '刪除', tone: 'danger' });
      if (ok) {
          cancelPendingSave(); // 取消殘留排程，避免覆蓋刪除
          const target = trips.find(t => t.id === id);
          if (target) deleteTripImages(collectTripImagePaths(target)); // 🖼️ 2.2 連帶刪除該行程所有圖（封面+記帳照片）
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

  // 🧱 Phase C0：心願盒雲端讀取
  const fetchWishItems = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      const { data } = await supabase.from('wish_items').select('*').order('created_at', { ascending: false });
      if (data) setWishItems((data as WishItemRow[]).map(rowToWish));
  };

  // 新增/編輯心願（樂觀更新 + upsert；place 類自動 geocode 補座標）
  const saveWishItem = async (wish: WishItem, isNew: boolean) => {
      if (!user) return;
      let toSave = wish;
      // 🧭 C0-4：place 類且尚無座標 → geocode 補上（失敗不擋存檔）
      if (wish.type === 'place' && (wish.lat === undefined || wish.lng === undefined)) {
          const query = [wish.title, wish.area, wish.country].filter(Boolean).join(' ');
          const geo = await geocodeWish(query, wish.country);
          if (geo) toSave = { ...wish, lat: geo.lat, lng: geo.lng, placeId: geo.placeId };
      }
      setWishItems(prev => isNew ? [toSave, ...prev] : prev.map(w => w.id === toSave.id ? toSave : w));
      const { error } = await supabase.from('wish_items').upsert(wishToRow(toSave, user.id));
      if (error) { console.error('心願儲存失敗', error); toast('心願儲存失敗，請再試一次。'); fetchWishItems(); }
  };

  const deleteWishItem = async (id: string) => {
      setWishItems(prev => prev.filter(w => w.id !== id));
      const { error } = await supabase.from('wish_items').delete().eq('id', id);
      if (error) { console.error('心願刪除失敗', error); fetchWishItems(); }
  };

  // 🧱 Phase C1-0：貼上匯入。批次 geocode（地址，一次呼叫走全域快取）→ 一次寫入 wish_items。
  const importWishItems = async (rows: ParsedWish[]) => {
      if (!user || rows.length === 0) return;
      const geoQuery = (r: ParsedWish) => (r.address || [r.title, r.area, r.country].filter(Boolean).join(' ')).trim();

      // 只對「地點」批次地理編碼
      let geoMap: Record<string, { lat: number; lng: number; placeId?: string } | null> = {};
      const placeQueries = Array.from(new Set(rows.filter(r => r.type === 'place').map(geoQuery).filter(Boolean)));
      if (placeQueries.length > 0) {
          try {
              geoMap = await geocodeItems(placeQueries.map(q => ({ location: q })));
          } catch (e) { console.error('批次 geocode 失敗', e); }
      }

      const now = Date.now();
      const items: WishItem[] = rows.map((r, i) => {
          const geo = r.type === 'place' ? geoMap[geoQuery(r)] : null;
          return {
              id: crypto.randomUUID(),
              type: r.type,
              title: r.title,
              country: r.country || '',
              area: r.area || undefined,
              url: r.url || undefined,
              notes: r.note || undefined,
              budget: r.budget ?? undefined,
              currency: r.currency || undefined,
              tags: r.tags && r.tags.length > 0 ? r.tags : undefined,
              lat: geo?.lat,
              lng: geo?.lng,
              placeId: geo?.placeId,
              createdAt: new Date(now - i).toISOString(),
          };
      });

      setWishItems(prev => [...items, ...prev]);
      const { error } = await supabase.from('wish_items').insert(items.map(w => wishToRow(w, user.id)));
      if (error) { console.error('匯入失敗', error); toast('匯入失敗，請再試一次。'); fetchWishItems(); return; }
      toast(`已匯入 ${items.length} 個${rows[0]?.type === 'item' ? '項目' : '地點'}`, 'success');
  };

  // 🛡️ 9.2 升級：實作將心願推入至特定行程暫存區的函式
  const handleAddWishToTrip = (wish: WishItem, tripId: string) => {
      const targetTrip = trips.find(t => t.id === tripId);
      if (!targetTrip) return;

      // 檢查是否已在該行程的暫存區內，防禦重複點擊
      const isAlreadyStaged = targetTrip.stagedWishes?.some(w => w.id === wish.id);
      if (isAlreadyStaged) return;

      const updatedTrip = {
          ...targetTrip,
          stagedWishes: [...(targetTrip.stagedWishes || []), wish]
      };
      
      // 更新行程，系統會自動儲存至 DB 並更新 State
      handleUpdateTrip(updatedTrip);
  };

  if (!user) return <LoginView onLogin={handleLogin} />;

  if (selectedTrip) {
    return (
      <ItineraryView 
        trip={selectedTrip} 
        documents={allDocuments} 
        folders={vaultFolders}
        files={vaultFiles}
        user={user} 
        onBack={() => { flushTripSave(); setSelectedTrip(null); }}
        onDelete={() => handleSoftDeleteTrip(selectedTrip.id)}
        onUpdateTrip={handleUpdateTrip}
        onLocalFileUpdate={handleLocalFileUpdate}
        onRefreshVault={() => fetchVaultData()} 
      />
    );
  }

  return (
    <div className="w-full font-sans text-[#1D1D1B] bg-[#E4E2DD] overflow-hidden fixed inset-0" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {bgImage && <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-0 pointer-events-none" />}
      
      <main className="max-w-md mx-auto h-full relative shadow-2xl overflow-hidden z-10 bg-[#E4E2DD]/80 backdrop-blur-md flex flex-col">
        {isSyncing && (
            <div className="absolute top-4 right-4 z-50 bg-[#1D1D1B]/80 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 animate-pulse pointer-events-none shadow-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                同步中...
            </div>
        )}

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
                  onUpdateTrip={handleUpdateTrip}
                />
            )}
            
            {currentView === AppView.EXPLORE && (
                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in">
                    <ExploreView />
                </div>
            )}

            {/* 心願盒主視覺 */}
            {currentView === AppView.WISHBOX && (
                <WishBoxView
                    wishItems={wishItems}
                    trips={trips.filter(t => !t.isDeleted)} // 🛡️ 9.2 傳入活躍行程名單
                    onAddWishToTrip={handleAddWishToTrip}   // 🛡️ 9.2 傳入注入回呼函式
                    onAddClick={() => setEditingWishItem(null)}
                    onEditClick={(item) => setEditingWishItem(item)}
                    onOpenImport={() => setShowImportModal(true)}
                />
            )}

            {/* 🧱 C1-0 貼上匯入 */}
            <PasteImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={importWishItems}
            />

            {/* 心願編輯抽屜 (Modal) */}
            {editingWishItem !== undefined && (
                <WishItemEditModal 
                    item={editingWishItem}
                    allWishItems={wishItems}
                    onSave={(savedItem) => {
                        saveWishItem(savedItem, editingWishItem === null);
                        setEditingWishItem(undefined);
                    }}
                    onDelete={(id) => {
                        deleteWishItem(id);
                        setEditingWishItem(undefined);
                    }}
                    onClose={() => setEditingWishItem(undefined)}
                />
            )}
            
            {currentView === AppView.TOOLS && (
                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in">
                    <ToolsView onUpdateBackground={handleUpdateBackground} />
                </div>
            )}
            
            {currentView === AppView.VAULT && (
                <VaultView 
                    deletedTrips={trips.filter(t => t.isDeleted)} 
                    folders={vaultFolders}
                    files={vaultFiles}
                    onRefresh={() => fetchVaultData()} 
                    onRestoreTrip={handleRestoreTrip} 
                    onPermanentDeleteTrip={handlePermanentDeleteTrip} 
                />
            )}
        </div>

        <div className="flex-shrink-0 z-50 relative w-full bg-white/90 backdrop-blur-xl border-t border-white/50 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center pb-safe pt-4 px-5 h-[calc(70px+env(safe-area-inset-bottom))]">
                <TabButton active={currentView === AppView.TRIPS} onClick={() => setCurrentView(AppView.TRIPS)} icon={<Home />} label="首頁" />
                <TabButton active={currentView === AppView.EXPLORE} onClick={() => setCurrentView(AppView.EXPLORE)} icon={<Compass />} label="探索" />
                <TabButton active={currentView === AppView.WISHBOX} onClick={() => setCurrentView(AppView.WISHBOX)} icon={<Sparkles />} label="靈感" />
                <TabButton active={currentView === AppView.TOOLS} onClick={() => setCurrentView(AppView.TOOLS)} icon={<Briefcase />} label="小工具" />
                <TabButton active={currentView === AppView.VAULT} onClick={() => setCurrentView(AppView.VAULT)} icon={<FileText />} label="保管箱" />
            </div>
        </div>
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-[#45846D] scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6', strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

export default App;