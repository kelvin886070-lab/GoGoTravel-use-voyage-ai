// src/App.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, FileText, Sparkles, User as UserIcon } from 'lucide-react';
import { AppView } from './types';
import type { Trip, User, Document, VaultFolder, VaultFile, WishItem, WishList } from './types';
import type { TripRow, VaultFolderRow, VaultFileRow, WishItemRow, WishListRow } from './db-types';
import { confirmDialog } from './components/ConfirmDialog';
import { toast } from './components/Toast';
import { resolvePlace, resolvePlaces, coordsFromMapsUrl, fetchPlaceDetails, lookupPlaceByText } from './services/geo';
import { enrichTripCover, smallCoverUrl } from './services/coverPhoto';
import { fetchProfileAvatarUrl } from './services/profile';
import { haversineKm } from './hooks/useNearby';
import { looksLikeMapsUrl } from './utils/mapsUrl';
import { ensureTripActivityIds } from './utils/activityId';
import type { ParsedWish } from './services/gemini';
import { TripsView } from './views/TripsView/TripsView';
import { VaultView } from './views/VaultView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { supabase } from './services/supabase';
import { signPaths, collectTripImagePaths, deleteTripImages, resolveTripImages, serializeTripForDb, isStoragePath, clearSignedUrlCache } from './services/storage';
import { tripNeedsSlimming, buildSlimPatch, applySlimPatch } from './services/tripSlimming';
import { fetchTrashSummaries, fetchTrashTripFull } from './services/trashTrips';
import type { TrashSummary } from './types';
import ItineraryView from './views/ItineraryView/ItineraryView';
import { WishBoxView } from './views/WishBoxView';
import { PasteImportModal } from './views/PasteImportModal';
import { WishItemEditModal } from './views/ItineraryView/modals/WishItemEditModal';
import { fetchAllBookings, upsertBooking, deleteBooking } from './services/booking/bookingStore';
import { fetchTravelers, upsertTraveler } from './services/booking/travelerStore';
import type { StoredBooking, Traveler, PaxType } from './types/booking';

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
    city: r.city || undefined,
    title: r.title,
    area: r.area || undefined,
    url: r.url || undefined,
    notes: r.note || undefined,
    // 🧱 C5 舊 base64/http 直接顯示；真正的 Storage 路徑另存 customImagePath，稍後換 signed URL
    customImage: (r.custom_image_path && !isStoragePath(r.custom_image_path)) ? r.custom_image_path : undefined,
    customImagePath: (r.custom_image_path && isStoragePath(r.custom_image_path)) ? r.custom_image_path : undefined,
    budget: r.budget ?? undefined,
    currency: r.currency || undefined,
    tags: r.tags || undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    placeId: r.place_id || undefined,
    needsLocationConfirm: !!r.needs_location_confirm,
    isFavorite: !!r.is_favorite,
    isPurchased: !!r.is_purchased,
    forWhom: r.for_whom || undefined,
    quantity: r.quantity ?? undefined,
    actualPrice: r.actual_price ?? undefined,
    isSettled: !!r.is_settled,
    tripId: r.trip_id || undefined,
    stopId: r.stop_id || undefined,
    preferredSlot: (r.preferred_slot as WishItem['preferredSlot']) || undefined,
    usedInTrips: r.used_in_trips ?? undefined,
    listId: r.list_id ?? undefined,
    rating: r.rating ?? undefined,
    ratingCount: r.rating_count ?? undefined,
    createdAt: r.created_at,
});

const wishToRow = (w: WishItem, userId: string) => ({
    id: w.id,
    user_id: userId,
    type: w.type,
    title: w.title,
    note: w.notes ?? null,
    country: w.country || null,
    city: w.city ?? null,
    area: w.area ?? null,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
    place_id: w.placeId ?? null,
    needs_location_confirm: !!w.needsLocationConfirm,
    is_favorite: !!w.isFavorite,
    is_purchased: !!w.isPurchased,
    for_whom: w.forWhom ?? null,
    quantity: w.quantity ?? null,
    actual_price: w.actualPrice ?? null,
    is_settled: !!w.isSettled,
    trip_id: w.tripId ?? null,
    stop_id: w.stopId ?? null,
    preferred_slot: w.preferredSlot ?? null,
    url: w.url ?? null,
    // 🧱 C5 優先存 Storage 路徑；舊 base64 保留；不存會過期的 signed URL
    custom_image_path: w.customImagePath ?? (w.customImage?.startsWith('data:') ? w.customImage : null),
    budget: w.budget ?? null,
    currency: w.currency ?? null,
    tags: w.tags ?? [],
    used_in_trips: w.usedInTrips ?? [],
    list_id: w.listId ?? null,
    rating: w.rating ?? null,
    rating_count: w.ratingCount ?? null,
    created_at: w.createdAt,
});

// 🌟 D2②-A：補地點的 placeId＋評分。無 placeId→用名稱+座標偏置查一次拿回（含 rating）；
//   有 placeId 但無 rating→查 details 補上。失敗一律不擋存檔/匯入。
async function enrichPlaceRating(w: WishItem): Promise<WishItem> {
    if (w.type !== 'place') return w;
    let out = w;
    // 1) 先試現有 placeId 的 details（行程頁搜尋加的＝商家 POI，一次就中）
    if (out.placeId && out.rating === undefined) {
        const d = await fetchPlaceDetails(out.placeId);
        if (d && (d.rating !== undefined || d.ratingCount !== undefined)) {
            out = { ...out, rating: d.rating, ratingCount: d.ratingCount };
        }
    }
    // 2) 仍無評分且有名稱 → 用名稱＋座標偏置做 Text Search 拿「商家 POI」的 placeId＋評分。
    //    解決：匯入用 Geocoding 常給到「地址級」placeId（無評分），需改抓真正的商家。
    if (out.rating === undefined && out.title) {
        const bias = (out.lat != null && out.lng != null) ? { lat: out.lat, lng: out.lng } : undefined;
        const hit = await lookupPlaceByText(out.title, bias);
        if (hit?.placeId) {
            out = { ...out, placeId: hit.placeId, rating: hit.rating, ratingCount: hit.ratingCount, lat: out.lat ?? hit.lat, lng: out.lng ?? hit.lng };
        }
    }
    return out;
}

// 📚 相簿 row → object（封面 signed URL 在 fetchWishLists 補）
const rowToWishList = (r: WishListRow): WishList => ({
    id: r.id,
    name: r.name,
    coverImagePath: r.cover_image_path || undefined,
    position: r.position ?? 0,
    pinned: r.pinned ?? false,
    createdAt: r.created_at,
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.TRIPS);

  // 🛂 自訂頭貼：登入後讀 profiles.avatar_path（簽名 URL）覆蓋預設頭像；沒設定/表未建＝維持現狀（靜默）
  const avatarLoadedFor = useRef<string | null>(null);
  useEffect(() => {
      const uid = user?.id;
      if (!uid || avatarLoadedFor.current === uid) return;
      avatarLoadedFor.current = uid;
      let alive = true;
      void fetchProfileAvatarUrl(uid).then(url => {
          if (alive && url) setUser(prev => (prev && prev.id === uid ? { ...prev, avatar: url } : prev));
      });
      return () => { alive = false; };
  }, [user?.id]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);                    // 🐘 lazy-load 後：只含「未刪除」行程
  const [trashTrips, setTrashTrips] = useState<TrashSummary[]>([]);  // 垃圾桶輕量投影（保管箱列表用）
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  
  const [wishItems, setWishItems] = useState<WishItem[]>([]);
  const [wishLists, setWishLists] = useState<WishList[]>([]);
  const [bookings, setBookings] = useState<StoredBooking[]>([]);   // 🎟️ 訂位（user 層級，行程頁只是視圖）
  const [travelers, setTravelers] = useState<Traveler[]>([]);      // 🧑‍🤝‍🧑 我的旅伴（user 層級，跨行程重用）
  const [editingWishItem, setEditingWishItem] = useState<WishItem | null | undefined>(undefined);
  const [showImportModal, setShowImportModal] = useState(false);   // 🧭 貼上匯入純自動分類（不前置選類型）

  // 🧭 旅途中偵測：今天落在某趟行程日期內（首頁顯示捷徑卡跳進走模式）
  const activeTrip = useMemo(() => {
      const t0 = new Date(); t0.setHours(0, 0, 0, 0); const ts = t0.getTime();
      const ms = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
      return trips.find(t => !t.isDeleted && t.startDate && t.endDate && ms(t.startDate) <= ts && ts <= ms(t.endDate)) || null;
  }, [trips]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitializingVaultRef = useRef(false);
  // 🐘 冷啟雙抓去重（HAR 量測抓到：掛載 fetchUserData ＋ auth SIGNED_IN 各跑一次 → trips 4.7MB 搬兩遍）
  //   同一使用者本 App 生命週期只完整抓一次；SIGNED_OUT 歸零（換帳號登入要重抓）。
  const fetchedForUserRef = useRef<string | null>(null);
  // 🔄 前景對帳（resume-stale 修復）：上次抓 trips 的時刻——iOS PWA resume 是凍結復原不重抓，
  //   回前景且資料超齡（>5 分鐘）就背景重抓（瘦身後一次僅 ~45KB，使用者無感）
  const lastTripsFetchRef = useRef(0);

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

          // 雙抓去重：同一使用者已抓過＝跳過整批 fetch（setUser 等輕量狀態照設，冪等無害）
          if (fetchedForUserRef.current === session.user.id) return;
          fetchedForUserRef.current = session.user.id;

          fetchTrips(session.user.id);
          fetchVaultData(session.user.id);
          fetchWishItems(session.user.id);
          fetchWishLists(session.user.id);
          fetchBookings();
          loadTravelers(session.user.id, userName);
      } else {
          setUser(null);
          setTrips([]);
          setVaultFolders([]);
          setVaultFiles([]);
          setWishItems([]);
          setBookings([]);
          setTravelers([]);
      }
  };

  useEffect(() => {
      fetchUserData();
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
          if (event === 'SIGNED_IN') {
              fetchUserData(); 
          } else if (event === 'SIGNED_OUT') {
              fetchedForUserRef.current = null;   // 換帳號重登要重抓
              clearSignedUrlCache();              // ② 換帳號不撿到上一位的照片鑰匙
              void import('./services/destinationIntel').then(m => m.clearIntelCache());   // 目的地情報快取同理
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

  // 🔬 DEV：座標稽核。登入後於 Console 執行 `await __geoAudit()`（量測完可移除本區塊）
  useEffect(() => {
      if (!import.meta.env.DEV) return;
      (window as unknown as { __geoAudit?: () => Promise<unknown> }).__geoAudit =
          async () => (await import('./dev/geoAudit')).runGeoAudit(wishItems);
      (window as unknown as { __geoBench?: () => Promise<unknown> }).__geoBench =
          async () => (await import('./dev/geoBenchmark')).runGeoBenchmark(wishItems);
      // 🧹 Storage 孤兒檔清理（dry-run 預設；true 才刪；詳見 dev/storageOrphans.ts）
      (window as unknown as { __storageOrphans?: (remove?: boolean) => Promise<unknown> }).__storageOrphans =
          async (remove?: boolean) => (await import('./dev/storageOrphans')).runStorageOrphans(!!remove);
  }, [wishItems]);

  const fetchTrips = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      
      setIsSyncing(true);
      lastTripsFetchRef.current = Date.now();
      // 🐘 垃圾桶 lazy-load：冷啟只抓「未刪除」全量（HAR 實測垃圾桶佔 99% 重量）；
      //   垃圾桶另抓輕量投影（平行、不阻塞主載入）。JSON 過濾失敗＝防禦性退回全抓（寧慢勿空）。
      let { data } = await supabase.from('trips').select('*')
          .or('trip_data->>isDeleted.is.null,trip_data->>isDeleted.neq.true')
          .order('updated_at', { ascending: false });
      if (!data) {
          const fallback = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
          data = fallback.data ? (fallback.data as TripRow[]).filter(r => !r.trip_data?.isDeleted) : null;
      }
      void fetchTrashSummaries().then(setTrashTrips);
      if (data) {
          const loadedTrips: Trip[] = (data as TripRow[]).map((row) => ({
              ...row.trip_data,
              id: row.id,
              isDeleted: row.trip_data.isDeleted || false
          }));
          // 🖼️ 2.2 收集所有圖片路徑（封面 + 記帳照片），一次批次換成 signed URL（顯示端零改動）
          const allPaths = loadedTrips.flatMap(collectTripImagePaths);
          const urlMap = await signPaths(allPaths);
          // 🧱 F1：載入既有資料時 backfill 活動 id（舊資料多半沒有），確保全站活動都有穩定身分
          const resolved = loadedTrips.map(t => ensureTripActivityIds(resolveTripImages(t, urlMap)));
          setTrips(resolved);
          // 🖼️ 封面B backfill：既有行程缺封面 → 背景補抓（每次載入最多 3 趟，節制、抓到即存雲）
          resolved
              .filter(t => !t.isDeleted && !(t.coverImage || '').trim() && !(t.coverImagePath || '').trim())
              .slice(0, 3)
              .forEach(t => enrichCoverInBackground(t));
          // 🐘 trips 瘦身（一次性遷移，見 services/tripSlimming）：base64 殘留 → Storage 路徑。
          //   背景逐趟序跑（不搶冷啟頻寬）；patch 以當下 state 合併＋逐欄位再驗（不覆蓋使用者期間的編輯）；
          //   冪等：換完路徑下次載入不再命中；單圖失敗＝下次冷啟續跑。
          void slimTripsInBackground(resolved.filter(tripNeedsSlimming));
      }
      setIsSyncing(false);
  };

  // 🐘 trips 瘦身背景執行器（fire-and-forget；一次一趟，避免同時大量上傳）
  const slimTripsInBackground = async (list: Trip[]) => {
      for (const snapshot of list) {
          try {
              const patch = await buildSlimPatch(snapshot);
              if (!patch) continue;
              setTrips(prev => prev.map(t => {
                  if (t.id !== patch.tripId) return t;
                  const next = applySlimPatch(t, patch);
                  if (next !== t) saveTripToCloud(next);   // 有真變更才存雲（serializeTripForDb 會把 base64 顯示值清掉）
                  return next;
              }));
          } catch { /* 靜默：遷移是背景福利，任何失敗不影響使用 */ }
      }
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
      // ⚠️ 不能只看 user state：背景路徑（trips 瘦身/封面 enrich）在 setUser 同一輪就啟動，
      // 閉包裡的 user 還是 null → 舊寫法 `if (!user) return` 會「靜默吞掉存檔」
      // （test02/03 HAR 實錘：遷移上傳 13 檔全成功、存檔零筆＝孤兒檔）。退位：直接問 auth session。
      let uid = user?.id;
      if (!uid) {
          try { uid = (await supabase.auth.getSession()).data.session?.user?.id; } catch { /* ignore */ }
      }
      if (!uid) return;
      setIsSyncing(true);
      // 🖼️ 2.2 存 DB 前序列化：把有 Storage 路徑的封面/記帳照片「顯示值」清空，不寫入暫時的 signed URL
      const tripForDb = serializeTripForDb(trip);
      const { error } = await supabase.from('trips').upsert({
              id: trip.id,
              user_id: uid,
              trip_data: tripForDb,
              updated_at: new Date().toISOString()
          });
      if (error) console.error("上傳失敗", error);
      setIsSyncing(false);
  };

  // 🔄 前景對帳：App 回前景（PWA resume/切分頁回來）→ 資料超過 5 分鐘沒抓就背景重抓。
  //   有待寫出的編輯（pendingTripRef）＝這輪跳過——先讓防抖存檔落地，避免「refetch 比 save 先回來」
  //   把畫面倒回舊版（下次回前景再對）。photos/封面/手記都住在 trips 裡，一次對帳全更新。
  useEffect(() => {
      const REVALIDATE_MS = 5 * 60 * 1000;
      const onVisible = () => {
          if (document.visibilityState !== 'visible') return;
          if (!user?.id) return;
          if (pendingTripRef.current) return;
          if (Date.now() - lastTripsFetchRef.current < REVALIDATE_MS) return;
          void fetchTrips(user.id);
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const handleLogin = (_newUser: User) => { 
      fetchUserData();
  };
  
  const handleLogout = async () => {
      const ok = await confirmDialog({ title: '確定要登出嗎？', message: '你隨時可以再次登入這個帳號。', confirmText: '登出' });
      if (ok) {
          flushTripSave(); // 登出前補存最後編輯
          await supabase.auth.signOut();
      }
  };

  const handleTripSelect = (trip: Trip) => setSelectedTrip(trip);
  const handleReorderTrips = (newTrips: Trip[]) => { setTrips(newTrips); };
  
  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setSelectedTrip(updatedTrip);
    scheduleTripSave(updatedTrip); // 🚀 2.3 改為防抖儲存
  };

  // 🛂 安靜更新：不動 selectedTrip（護照存手記等場景——用 handleUpdateTrip 會誤開行程頁）
  const handleUpdateTripQuiet = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    scheduleTripSave(updatedTrip);
  };

  // 🐘 lazy-load 後的三段流（Kelvin 定案）：
  //   軟刪＝從 trips 移出＋在地生成投影塞進 trashTrips（手上有全量，天數用 days.length 最準）；
  //   復原＝點了才抓該趟全量（簽名圖、補活動 id）→ 回 trips；
  //   永刪＝先抓全量蒐集圖片路徑（連帶清 Storage）→ 再刪 DB 列；抓不到就中止（不做半套，避免孤兒圖）。
  const handleSoftDeleteTrip = async (id: string) => {
    const ok = await confirmDialog({ title: '移至保管箱？', message: '行程會移到保管箱，之後可再還原。', confirmText: '移至保管箱' });
    if (ok) {
        cancelPendingSave(); // 避免尚未寫出的舊版覆蓋掉刪除狀態
        const targetTrip = trips.find(t => t.id === id);
        if (targetTrip) {
            const deletedTrip = { ...targetTrip, isDeleted: true };
            setTrips(prev => prev.filter(t => t.id !== id));
            setTrashTrips(prev => [{
                id,
                destination: (targetTrip.destination || '').trim() || '未命名行程',
                daysCount: (targetTrip.days || []).length,
                coverThumb: targetTrip.coverImageThumb || smallCoverUrl(targetTrip.coverImage) || undefined,
            }, ...prev.filter(s => s.id !== id)]);
            if (selectedTrip?.id === id) setSelectedTrip(null);
            saveTripToCloud(deletedTrip);
        }
    }
  }

  const handleRestoreTrip = async (id: string) => {
      const full = await fetchTrashTripFull(id);
      if (!full) { toast('復原失敗，請檢查網路後再試', 'error'); return; }
      const restoredRaw = { ...full, isDeleted: false };
      // 顯示解析：簽名圖 URL＋活動 id backfill（與冷啟載入同管線）
      const urlMap = await signPaths(collectTripImagePaths(restoredRaw));
      const restored = ensureTripActivityIds(resolveTripImages(restoredRaw, urlMap));
      setTrips(prev => [restored, ...prev.filter(t => t.id !== id)]);
      setTrashTrips(prev => prev.filter(s => s.id !== id));
      saveTripToCloud(restored);
      toast('行程已復原', 'success');
  };

  const handlePermanentDeleteTrip = async (id: string) => {
      const ok = await confirmDialog({ title: '永久刪除這個行程？', message: '刪除後將無法復原，資料會永久消失。', confirmText: '刪除', tone: 'danger' });
      if (ok) {
          cancelPendingSave(); // 取消殘留排程，避免覆蓋刪除
          const full = await fetchTrashTripFull(id);
          if (!full) { toast('刪除失敗，請檢查網路後再試', 'error'); return; }   // 不做半套：抓不到就不刪列（避免 Storage 孤兒圖）
          deleteTripImages(collectTripImagePaths(full)); // 🖼️ 2.2 連帶刪除該行程所有圖（封面+記帳+回憶+影子縮圖）
          setTrashTrips(prev => prev.filter(s => s.id !== id));
          deleteTripFromCloud(id);
      }
  };

  // 🖼️ 封面B：背景補「目的地嚮往照」（fire-and-forget）。抓到才更新+存雲；抓不到維持深色 fallback（寧素勿錯）。
  //   用 setTrips 函式型更新比對現值：若期間使用者已自訂封面，放棄套用（自訂永遠優先）。
  const enrichCoverInBackground = (trip: Trip) => {
      void enrichTripCover(trip).then(enriched => {
          if (enriched === trip || !enriched.coverImage) return;
          setTrips(prev => prev.map(t => {
              if (t.id !== trip.id) return t;
              if ((t.coverImage || '').trim() || (t.coverImagePath || '').trim()) return t;   // 已被使用者設了 → 不覆蓋
              const next = { ...t, coverImage: enriched.coverImage };
              saveTripToCloud(next);
              return next;
          }));
      });
  };

  const handleImportTrip = (tripData: Trip) => {
      const newTrip = { ...tripData, id: crypto.randomUUID(), isDeleted: false };
      // 🎟️ A：不再套寫死的預設圖（picsum/巴黎）；沒設封面＝空 → 深色票根 fallback，背景再補目的地照（封面B）。
      if (!newTrip.coverImage || newTrip.coverImage.length < 100) {
          newTrip.coverImage = '';
      }
      setTrips(prev => [newTrip, ...prev]);
      saveTripToCloud(newTrip);
      enrichCoverInBackground(newTrip);
  };

  const handleAddTrip = (newTrip: Trip) => {
      const tripWithUuid = { ...newTrip, id: crypto.randomUUID() };
      setTrips(prev => [...prev, tripWithUuid]);
      saveTripToCloud(tripWithUuid);
      enrichCoverInBackground(tripWithUuid);
  }

  // 🧱 Phase C0：心願盒雲端讀取
  const fetchWishItems = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      const { data } = await supabase.from('wish_items').select('*').order('created_at', { ascending: false });
      if (data) {
          const wishes = (data as WishItemRow[]).map(rowToWish);
          // 🧱 C5 把 Storage 路徑一次批次換成 signed URL 供顯示
          const urlMap = await signPaths(wishes.map(w => w.customImagePath));
          setWishItems(wishes.map(w => (w.customImagePath && urlMap[w.customImagePath]) ? { ...w, customImage: urlMap[w.customImagePath] } : w));
      }
  };

  // 🎟️ 載入訂位（RLS 已綁 user；跨行程都拿回來，行程頁再依 tripId 過濾成視圖）
  //   載入時去重清理：同 tripId+dedupKey 只留最新一筆，其餘持久化刪除（根治「重整復活」）。
  const fetchBookings = async () => {
      try {
          const all = await fetchAllBookings();
          const groups = new Map<string, StoredBooking[]>();
          for (const b of all) {
              const k = `${b.tripId ?? 'none'}|${bookingDedupKey(b)}`;
              (groups.get(k) ?? groups.set(k, []).get(k)!).push(b);
          }
          const keep: StoredBooking[] = [];
          const removeIds: string[] = [];
          for (const arr of groups.values()) {
              arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));  // 新的在前
              keep.push(arr[0]);
              for (let i = 1; i < arr.length; i++) removeIds.push(arr[i].id);
          }
          setBookings(keep);
          for (const id of removeIds) deleteBooking(id).catch(e => console.error('去重清理刪除失敗', e));
      } catch (e) { console.error('讀取訂位失敗', e); }
  };

  // 核對表確認後：寫進 bookings 表（單一真相）＋樂觀更新本地狀態
  // 去重鍵：同趟同筆＝同一訂位。刻意「不含日期」——改日期是更新、不是新增。
  //   有 pnr 用 (kind,pnr)；否則機票用航班號、住宿用飯店名。
  const bookingDedupKey = (b: StoredBooking): string => {
      if (b.pnr) return `${b.kind}|pnr:${b.pnr.trim().toUpperCase()}`;
      if (b.kind === 'flight') return `flight|${b.segments[0]?.flightNo ?? ''}`;
      return `hotel|${(b.property ?? '').trim()}`;
  };

  const handleImportBooking = async (booking: StoredBooking) => {
      // upsert-in-place：同趟同款就更新那一筆（不新增、不刪兄弟）。載入時的去重清理負責收斂舊污染。
      const key = bookingDedupKey(booking);
      const match = bookings.find(b => b.tripId === booking.tripId && bookingDedupKey(b) === key);
      const finalB = match ? { ...booking, id: match.id } : booking;
      setBookings(prev => [...prev.filter(b => b.id !== finalB.id), finalB]);
      try {
          await upsertBooking(finalB);
          toast('匯入完成，已加進行程', 'success');
      } catch (e) { console.error('訂位匯入失敗', e); toast('訂位匯入失敗，請再試一次。'); fetchBookings(); }
  };

  // 刪除一筆訂位（匯錯/取消）——樂觀更新 + 持久化刪除
  const handleDeleteBooking = async (id: string) => {
      setBookings(prev => prev.filter(b => b.id !== id));
      try { await deleteBooking(id); } catch (e) { console.error('訂位刪除失敗', e); toast('刪除失敗，請再試一次。'); fetchBookings(); }
  };

  // 🧑‍🤝‍🧑 載入「我的旅伴」；首次沒有本人就 bootstrap 一位 isSelf
  const loadTravelers = async (userId: string, selfName: string) => {
      try {
          let list = await fetchTravelers();
          if (!list.some(t => t.isSelf)) {
              const self: Traveler = { id: crypto.randomUUID(), userId, legalName: selfName || '我', nickname: '我', paxType: 'adult', aliases: [], isSelf: true, createdAt: new Date().toISOString() };
              upsertTraveler(self).catch(e => console.error('本人建立失敗', e));
              list = [self, ...list];
          }
          setTravelers(list);
      } catch (e) { console.error('讀取旅伴失敗', e); }
  };

  // 新增一位旅伴（樂觀更新 + upsert），回傳給呼叫端串進 memberMap
  const handleCreateTraveler = async (legalName: string, paxType: PaxType = 'adult'): Promise<Traveler> => {
      const t: Traveler = { id: crypto.randomUUID(), userId: user?.id || '', legalName, paxType, aliases: [], isSelf: false, createdAt: new Date().toISOString() };
      setTravelers(prev => [...prev, t]);
      try { await upsertTraveler(t); } catch (e) { console.error('旅伴建立失敗', e); }
      return t;
  };

  // 更新旅伴（暱稱、小朋友…）；暱稱/兒童存旅伴、跟著人跨行程走
  const handleUpdateTraveler = async (id: string, patch: Partial<Traveler>) => {
      let updated: Traveler | undefined;
      setTravelers(prev => prev.map(t => (t.id === id ? (updated = { ...t, ...patch }) : t)));
      if (updated) { try { await upsertTraveler(updated); } catch (e) { console.error('旅伴更新失敗', e); } }
  };

  // 新增/編輯心願（樂觀更新 + upsert；place 類自動 geocode 補座標）
  // 📚 相簿 CRUD ─────────────────────────────（批 1：建好，後批接 UI）
  const fetchWishLists = async (userId?: string) => {
      const currentUserId = userId || user?.id;
      if (!currentUserId) return;
      const { data } = await supabase.from('wish_lists').select('*')
          .order('pinned', { ascending: false })
          .order('position', { ascending: true })
          .order('created_at', { ascending: false });
      if (data) {
          const lists = (data as WishListRow[]).map(rowToWishList);
          const urlMap = await signPaths(lists.map(l => l.coverImagePath));
          setWishLists(lists.map(l => (l.coverImagePath && urlMap[l.coverImagePath]) ? { ...l, coverImage: urlMap[l.coverImagePath] } : l));
      }
  };

  const createWishList = async (name: string): Promise<WishList | null> => {
      if (!user) return null;
      const { data, error } = await supabase.from('wish_lists').insert({ name, user_id: user.id }).select().single();
      if (error || !data) { console.error('建立清單失敗', error); toast('建立清單失敗，請再試一次。'); return null; }
      const list = rowToWishList(data as WishListRow);
      setWishLists(prev => [list, ...prev]);
      return list;
  };

  const renameWishList = async (id: string, name: string) => {
      setWishLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
      const { error } = await supabase.from('wish_lists').update({ name }).eq('id', id);
      if (error) { console.error('清單改名失敗', error); fetchWishLists(); }
  };

  const deleteWishList = async (id: string) => {
      setWishLists(prev => prev.filter(l => l.id !== id));
      setWishItems(prev => prev.map(w => w.listId === id ? { ...w, listId: undefined } : w));   // DB on delete set null；本地同步為未分類
      const { error } = await supabase.from('wish_lists').delete().eq('id', id);
      if (error) { console.error('清單刪除失敗', error); fetchWishLists(); fetchWishItems(); }
  };

// （lint 欠債清理：assignWishToList 未被任何 UI 使用，已移除——清單指派走 WishItemEditModal 的 saveWishItem 路徑）

  const setWishListCover = async (id: string, path: string | null) => {
      let coverImage: string | undefined;
      if (path) { const m = await signPaths([path]); coverImage = m[path]; }
      setWishLists(prev => prev.map(l => l.id === id ? { ...l, coverImagePath: path ?? undefined, coverImage: path ? coverImage : undefined } : l));
      const { error } = await supabase.from('wish_lists').update({ cover_image_path: path }).eq('id', id);
      if (error) { console.error('封面更新失敗', error); fetchWishLists(); }
  };

  // 📚 編輯模式：拖曳排序 → 依新順序把 position 寫回（0..n-1）。樂觀更新，失敗回滾。
  const reorderWishLists = async (orderedIds: string[]) => {
      const posById = new Map(orderedIds.map((id, i) => [id, i]));
      setWishLists(prev => [...prev].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (posById.get(a.id) ?? a.position) - (posById.get(b.id) ?? b.position);
      }).map(l => posById.has(l.id) ? { ...l, position: posById.get(l.id)! } : l));
      const results = await Promise.all(orderedIds.map((id, i) =>
          supabase.from('wish_lists').update({ position: i }).eq('id', id)));
      if (results.some(r => r.error)) { console.error('排序儲存失敗'); toast('排序儲存失敗，請再試一次。'); fetchWishLists(); }
  };

  // 📚 編輯模式：釘選/取消釘選（置頂）。樂觀更新，失敗回滾。
  const setWishListPinned = async (id: string, pinned: boolean) => {
      setWishLists(prev => prev.map(l => l.id === id ? { ...l, pinned } : l));
      const { error } = await supabase.from('wish_lists').update({ pinned }).eq('id', id);
      if (error) { console.error('釘選失敗', error); toast('釘選失敗，請再試一次。'); fetchWishLists(); }
  };

  // 🔖 取消收藏：依 placeId 找到那筆心願並刪除（搜尋結果「已存 ✓ → 再點取消」用）
  const deleteWishByPlaceId = async (placeId: string) => {
      const w = wishItems.find(x => x.placeId === placeId);
      if (!w) return;
      setWishItems(prev => prev.filter(x => x.id !== w.id));
      const { error } = await supabase.from('wish_items').delete().eq('id', w.id);
      if (error) { console.error('取消收藏失敗', error); fetchWishItems(); }
  };

  const saveWishItem = async (wish: WishItem, isNew: boolean) => {
      if (!user) return;
      let toSave = wish;
      // 🧭 place 類且尚無座標 → 補座標（失敗不擋存檔）
      if (wish.type === 'place' && (wish.lat === undefined || wish.lng === undefined)) {
          // 🧭 T0：優先從 Google Maps 連結抽座標（最高信心、免費）；沒有再走 T1 cascade
          let done = false;
          if (wish.url && looksLikeMapsUrl(wish.url)) {
              const c = await coordsFromMapsUrl(wish.url);
              if (c) { toSave = { ...wish, lat: c.lat, lng: c.lng, needsLocationConfirm: false }; done = true; }
          }
          if (!done) {
              const query = wish.title;
              const context = [wish.area, wish.city, wish.country].filter(Boolean).join(' ') || undefined;
              const res = await resolvePlace(query, context);
              if (res) toSave = { ...wish, lat: res.lat, lng: res.lng, placeId: res.placeId, needsLocationConfirm: res.needsConfirm };
          }
      }
      // 🌟 D2②-A：補 placeId＋評分（無 placeId 先查一次拿回；有 placeId 無 rating 補 details）；失敗不擋存檔
      toSave = await enrichPlaceRating(toSave);
      setWishItems(prev => isNew ? [toSave, ...prev] : prev.map(w => w.id === toSave.id ? toSave : w));
      const { error } = await supabase.from('wish_items').upsert(wishToRow(toSave, user.id));
      if (error) { console.error('心願儲存失敗', error); toast('心願儲存失敗，請再試一次。'); fetchWishItems(); }
  };

  // 🧾 代購結算：把某對象的所有代購項一次標記（未）結清
  const settleWishesFor = async (name: string, settled: boolean) => {
      const ids = wishItems.filter(w => w.type === 'item' && (w.forWhom || '').trim() === name).map(w => w.id);
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setWishItems(prev => prev.map(w => idSet.has(w.id) ? { ...w, isSettled: settled } : w));
      const { error } = await supabase.from('wish_items').update({ is_settled: settled }).in('id', ids);
      if (error) { console.error('結清更新失敗', error); toast('更新失敗，請再試一次。'); fetchWishItems(); return; }
      toast(settled ? `已標記「${name}」結清` : `已取消「${name}」結清`, 'success');
  };

  // 🧭 T3：使用者在地圖上確認/校正座標 → 寫回並清掉「待確認」旗標
  const confirmWishLocation = async (id: string, lat: number, lng: number) => {
      setWishItems(prev => prev.map(w => w.id === id ? { ...w, lat, lng, needsLocationConfirm: false } : w));
      const { error } = await supabase.from('wish_items')
          .update({ lat, lng, needs_location_confirm: false }).eq('id', id);
      if (error) { console.error('位置更新失敗', error); toast('位置更新失敗，請再試一次。'); fetchWishItems(); return; }
      toast('位置已更新', 'success');
  };

  // 🧭 Round2b：批次確認（維持現有座標，只清「待確認」旗標）
  const confirmWishLocations = async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setWishItems(prev => prev.map(w => idSet.has(w.id) ? { ...w, needsLocationConfirm: false } : w));
      const { error } = await supabase.from('wish_items')
          .update({ needs_location_confirm: false }).in('id', ids);
      if (error) { console.error('批次位置確認失敗', error); toast('批次確認失敗，請再試一次。'); fetchWishItems(); return; }
      toast(`已確認 ${ids.length} 個位置`, 'success');
  };

  const deleteWishItem = async (id: string) => {
      setWishItems(prev => prev.filter(w => w.id !== id));
      const { error } = await supabase.from('wish_items').delete().eq('id', id);
      if (error) { console.error('心願刪除失敗', error); fetchWishItems(); }
  };

  // 🗂️ 多選：批次刪除（樂觀更新 + 單次 .in 刪除）
  const deleteWishItems = async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setWishItems(prev => prev.filter(w => !idSet.has(w.id)));
      const { error } = await supabase.from('wish_items').delete().in('id', ids);
      if (error) { console.error('批次刪除失敗', error); toast('刪除失敗，請再試一次。'); fetchWishItems(); return; }
      toast(`已刪除 ${ids.length} 個收藏`, 'success');
  };

  // 🧱 C1-1 切換「我的最愛」（星星，置頂）
  const toggleWishFavorite = async (id: string) => {
      let next = false;
      setWishItems(prev => prev.map(w => { if (w.id === id) { next = !w.isFavorite; return { ...w, isFavorite: next }; } return w; }));
      const { error } = await supabase.from('wish_items').update({ is_favorite: next }).eq('id', id);
      if (error) { console.error('最愛切換失敗', error); fetchWishItems(); }
  };

  // 🧱 C2-2 切換購物「已買完」
  const toggleWishPurchased = async (id: string) => {
      let next = false;
      setWishItems(prev => prev.map(w => { if (w.id === id) { next = !w.isPurchased; return { ...w, isPurchased: next }; } return w; }));
      const { error } = await supabase.from('wish_items').update({ is_purchased: next }).eq('id', id);
      if (error) { console.error('已買切換失敗', error); fetchWishItems(); }
  };

  // 🧱 Phase C1-0：貼上匯入。批次 geocode（地址，一次呼叫走全域快取）→ 一次寫入 wish_items。
  const importWishItems = async (rows: ParsedWish[]) => {
      if (!user || rows.length === 0) return;
      const geoQuery = (r: ParsedWish) => (r.address || [r.title, r.area, r.city, r.country].filter(Boolean).join(' ')).trim();

      // 🧭 T1：只對「地點」批次 cascade（Geocoding 主 → 弱信心升級 Places）
      let geoMap: Record<string, { lat: number; lng: number; placeId?: string; needsConfirm: boolean } | null> = {};
      const placeQueries = Array.from(new Set(rows.filter(r => r.type === 'place').map(geoQuery).filter(Boolean)));
      if (placeQueries.length > 0) {
          try {
              geoMap = await resolvePlaces(placeQueries.map(q => ({ location: q })));

              // 🧭 Round2 consensus：可信點取「中位重心」，把 null/弱信心點以座標偏置重查一次（自動修回離群）
              const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
              const confident = placeQueries.map(q => geoMap[q]).filter((g): g is NonNullable<typeof g> => !!g && !g.needsConfirm);
              if (confident.length >= 3) {
                  const center = { lat: median(confident.map(c => c.lat)), lng: median(confident.map(c => c.lng)) };
                  // 弱點＝查不到、或需確認、或雖「可信」但幾何上明顯離群（同名撈到別國）
                  const weak = placeQueries.filter(q => {
                      const g = geoMap[q];
                      if (!g || g.needsConfirm) return true;
                      return haversineKm(center, { lat: g.lat, lng: g.lng }) > 300;
                  });
                  if (weak.length > 0) {
                      const rebiased = await resolvePlaces(weak.map(q => ({ location: q, bias: center })));
                      weak.forEach(q => { const r = rebiased[q]; if (r) geoMap[q] = r; });
                  }
              }
          } catch (e) { console.error('批次 resolve-place 失敗', e); }
      }

      const now = Date.now();
      const items: WishItem[] = rows.map((r, i) => {
          const geo = r.type === 'place' ? geoMap[geoQuery(r)] : null;
          return {
              id: crypto.randomUUID(),
              type: r.type,
              title: r.title,
              country: r.country || '',
              city: r.city || undefined,
              area: r.area || undefined,
              url: r.url || undefined,
              notes: r.note || undefined,
              budget: r.budget ?? undefined,
              currency: r.currency || undefined,
              tags: r.tags && r.tags.length > 0 ? r.tags : undefined,
              lat: geo?.lat,
              lng: geo?.lng,
              placeId: geo?.placeId,
              needsLocationConfirm: geo?.needsConfirm || undefined,
              forWhom: r.forWhom || undefined,
              quantity: r.quantity ?? undefined,
              createdAt: new Date(now - i).toISOString(),
          };
      });

      // 🧭 2a 幾何離群偵測：把明顯脫離群集的地點標成「位置待確認」，不靜默亂放。
      //    用中位數中心 + MAD 穩健門檻；點太少（<4）不判、交回 server 的 needsConfirm。
      const geoPts = items.filter(w => w.type === 'place' && w.lat != null && w.lng != null);
      if (geoPts.length >= 4) {
          const median = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
          const center = { lat: median(geoPts.map(w => w.lat!)), lng: median(geoPts.map(w => w.lng!)) };
          const dists = geoPts.map(w => haversineKm(center, { lat: w.lat!, lng: w.lng! }));
          const medDist = median(dists);
          const mad = median(dists.map(d => Math.abs(d - medDist)));
          const threshold = Math.max(100, medDist + 4 * mad);   // 100km 絕對下限，避免緊密群集過度誤標
          geoPts.forEach(w => {
              if (haversineKm(center, { lat: w.lat!, lng: w.lng! }) > threshold) w.needsLocationConfirm = true;
          });
      }

      // 🌟 D2②-A：批次補 placeId＋評分（受每日限額擋著；失敗不擋匯入）
      const enriched = await Promise.all(items.map(w => w.type === 'place' ? enrichPlaceRating(w) : Promise.resolve(w)));

      setWishItems(prev => [...enriched, ...prev]);
      const { error } = await supabase.from('wish_items').insert(enriched.map(w => wishToRow(w, user.id)));
      if (error) { console.error('匯入失敗', error); toast('匯入失敗，請再試一次。'); fetchWishItems(); return; }
      const nPlace = items.filter(w => w.type === 'place').length;
      const nItem = items.filter(w => w.type === 'item').length;
      const parts = [nPlace ? `${nPlace} 地點` : '', nItem ? `${nItem} 購物` : ''].filter(Boolean).join(' · ');
      toast(`已匯入 ${parts || `${items.length} 筆`}`, 'success');
  };

  // 🛡️ 9.2 升級：實作將心願推入至特定行程暫存區的函式
  // 🧾 購物改「參照」：把心願設 trip_id（不複製到 staging），批次
  const tagWishesToTrip = async (ids: string[], tripId: string | null) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setWishItems(prev => prev.map(w => idSet.has(w.id) ? { ...w, tripId: tripId ?? undefined } : w));
      const { error } = await supabase.from('wish_items').update({ trip_id: tripId }).in('id', ids);
      if (error) { console.error('行程關聯更新失敗', error); fetchWishItems(); }
  };

  // 🛍️「在這裡要買」：把購物項綁定 / 解綁到某個 activity（stopId）。綁定同時確保 tripId 正確。
  const setWishStop = async (ids: string[], stopId: string | null, tripId?: string) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setWishItems(prev => prev.map(w => idSet.has(w.id)
          ? { ...w, stopId: stopId ?? undefined, tripId: stopId ? (tripId ?? w.tripId) : w.tripId }
          : w));
      const patch: { stop_id: string | null; trip_id?: string } = { stop_id: stopId };
      if (stopId && tripId) patch.trip_id = tripId;
      const { error } = await supabase.from('wish_items').update(patch).in('id', ids);
      if (error) { console.error('綁定購物站失敗', error); fetchWishItems(); }
  };

  const handleAddWishToTrip = (wish: WishItem, tripId: string) => {
      const targetTrip = trips.find(t => t.id === tripId);
      if (!targetTrip) return;

      // 🧾 購物：改用參照（設 tripId），不複製到 staging
      if (wish.type === 'item') { tagWishesToTrip([wish.id], tripId); return; }

      // 地點：維持複製到暫存區（排時間流程不變）
      const isAlreadyStaged = targetTrip.stagedWishes?.some(w => w.id === wish.id);
      if (isAlreadyStaged) return;
      handleUpdateTrip({ ...targetTrip, stagedWishes: [...(targetTrip.stagedWishes || []), wish] });

      // 🧭 軟已訪連結：記錄此地點心願被拉進這趟（餵學習、之後避免重複推薦；全域原件不刪、可再訪）
      if (!(wish.usedInTrips || []).includes(tripId)) {
          const nextUsed = [...(wish.usedInTrips || []), tripId];
          setWishItems(prev => prev.map(w => w.id === wish.id ? { ...w, usedInTrips: nextUsed } : w));
          supabase.from('wish_items').update({ used_in_trips: nextUsed }).eq('id', wish.id)
              .then(({ error }) => { if (error) { console.error('軟已訪連結寫入失敗', error); fetchWishItems(); } });
      }
  };

  if (!user) return <LoginView onLogin={handleLogin} />;

  if (selectedTrip) {
    return (
      <ItineraryView
        trip={selectedTrip}
        documents={allDocuments}
        folders={vaultFolders}
        files={vaultFiles}
        wishItems={wishItems}
        user={user}
        onBack={() => { flushTripSave(); setSelectedTrip(null); }}
        onDelete={() => handleSoftDeleteTrip(selectedTrip.id)}
        onUpdateTrip={handleUpdateTrip}
        bookings={bookings.filter(b => b.tripId === selectedTrip.id)}
        onImportBooking={handleImportBooking}
        onDeleteBooking={handleDeleteBooking}
        travelers={travelers}
        onCreateTraveler={handleCreateTraveler}
        onUpdateTraveler={handleUpdateTraveler}
        onTagWishesToTrip={tagWishesToTrip}
        onTogglePurchased={toggleWishPurchased}
        onSetWishStop={setWishStop}
        wishLists={wishLists}
        onCreateWishList={createWishList}
        onUnsaveWish={deleteWishByPlaceId}
        onSaveWish={(p, opts) => saveWishItem({
          id: crypto.randomUUID(),
          type: 'place',
          country: '',
          city: p.city,
          title: p.name,
          area: p.address,
          lat: p.lat,
          lng: p.lng,
          placeId: p.placeId,
          tags: [],
          listId: opts?.listId ?? undefined,
          isFavorite: opts?.favorite ?? false,
          createdAt: new Date().toISOString(),
        }, true)}
        tripDestById={Object.fromEntries(trips.filter(t => !t.isDeleted).map(t => [t.id, t.destination]))}
        onLocalFileUpdate={handleLocalFileUpdate}
        onRefreshVault={() => fetchVaultData()}
      />
    );
  }

  return (
    // 📱 safe-area（上架前🔴）：根容器是 fixed inset-0——body 的 safe-area padding 對 fixed 元素無效
    //（Kelvin 實測內容頂進動態島的真因），inset 必須加在這一層；底部由 tab bar 的 calc(70px+inset) 承擔
    <div className="w-full font-sans text-[#1D1D1B] bg-[#E4E2DD] overflow-hidden fixed inset-0" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', paddingTop: 'env(safe-area-inset-top)' }}>
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
                  wishItems={wishItems}
                  activeTrip={activeTrip}
                  onOpenActiveTrip={() => activeTrip && handleTripSelect(activeTrip)}
                  onLogout={handleLogout}
                  onAddTrip={handleAddTrip}
                  onImportTrip={handleImportTrip}
                  onSelectTrip={handleTripSelect}
                  onDeleteTrip={handleSoftDeleteTrip}
                  onReorderTrips={handleReorderTrips}
                  onUpdateTrip={handleUpdateTrip}
                />
            )}
            
            {/* 心願盒主視覺 */}
            {currentView === AppView.WISHBOX && (
                <WishBoxView
                    wishItems={wishItems}
                    trips={trips.filter(t => !t.isDeleted)} // 🛡️ 9.2 傳入活躍行程名單
                    onAddWishToTrip={handleAddWishToTrip}   // 🛡️ 9.2 傳入注入回呼函式
                    onEditClick={(item) => setEditingWishItem(item)}
                    onOpenImport={() => setShowImportModal(true)}
                    onToggleFavorite={toggleWishFavorite}
                    onTogglePurchased={toggleWishPurchased}
                    onConfirmLocation={confirmWishLocation}
                    onConfirmLocations={confirmWishLocations}
                    onDeleteWishes={deleteWishItems}
                    onSettlePerson={settleWishesFor}
                    wishLists={wishLists}
                    onCreateList={createWishList}
                    onRenameList={renameWishList}
                    onDeleteList={deleteWishList}
                    onSetListCover={setWishListCover}
                    onReorderLists={reorderWishLists}
                    onSetListPinned={setWishListPinned}
                />
            )}

            {/* 🧱 C1-0 貼上匯入 */}
            <PasteImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={importWishItems}
                onManual={() => { setShowImportModal(false); setEditingWishItem(null); }}
            />

            {/* 心願編輯抽屜 (Modal) */}
            {editingWishItem !== undefined && (
                <WishItemEditModal
                    item={editingWishItem}
                    allWishItems={wishItems}
                    trips={trips.filter(t => !t.isDeleted)}
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
            
            {currentView === AppView.VAULT && (
                <VaultView 
                    deletedTrips={trashTrips}
                    folders={vaultFolders}
                    files={vaultFiles}
                    onRefresh={() => fetchVaultData()} 
                    onRestoreTrip={handleRestoreTrip} 
                    onPermanentDeleteTrip={handlePermanentDeleteTrip} 
                />
            )}

            {/* 🛂 個人檔案（護照）——批①過渡殼，批②③換完整護照本 */}
            {currentView === AppView.PROFILE && (
                <ProfileView
                    user={user}
                    trips={trips.filter(t => !t.isDeleted)}
                    onLogout={handleLogout}
                    onPlanNew={() => setCurrentView(AppView.TRIPS)}
                    onGoWishbox={() => setCurrentView(AppView.WISHBOX)}
                    onGoVault={() => setCurrentView(AppView.VAULT)}
                    onAvatarChange={(url) => setUser(prev => (prev ? { ...prev, avatar: url } : prev))}
                    onOpenTrip={handleTripSelect}
                    onUpdateTrip={handleUpdateTripQuiet}
                />
            )}
        </div>

        {/* 底欄：高度/inset 全走 inline style——Tailwind 任意值 h-[calc(70px+env(...))] 在 Play CDN JIT
            沒有生成（Kelvin 真機抓到的灰帶真因：高度塌掉、inset 區露出底色），inline 不經 JIT 零風險 */}
        <div className="flex-shrink-0 z-50 relative w-full bg-white/95 backdrop-blur-xl border-t border-white/50 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center px-5"
                style={{ paddingTop: 14, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
                <TabButton active={currentView === AppView.TRIPS} onClick={() => setCurrentView(AppView.TRIPS)} icon={<Home />} label="首頁" />
                <TabButton active={currentView === AppView.WISHBOX} onClick={() => setCurrentView(AppView.WISHBOX)} icon={<Sparkles />} label="心願盒" />
                <TabButton active={currentView === AppView.VAULT} onClick={() => setCurrentView(AppView.VAULT)} icon={<FileText />} label="保管箱" />
                <TabButton active={currentView === AppView.PROFILE} onClick={() => setCurrentView(AppView.PROFILE)} icon={<UserIcon />} label="個人檔案" />
            </div>
        </div>
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-[#45846D] scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon as React.ReactElement<{ className?: string; strokeWidth?: number }>, { className: 'w-6 h-6', strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

export default App;