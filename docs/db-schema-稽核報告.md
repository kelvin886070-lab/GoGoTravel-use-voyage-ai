# 資料庫稽核報告（2026-07-27）

依線上內省 dump（欄位／政策／索引／FK／CHECK）對照 repo。目的：收斂單一真相、找漂移、標可刪。

## 產出檔案
- `supabase/schema.sql` — **canonical 藍圖**：12 張表的乾淨完整結構，冪等，新環境一鍵重建。（已補 vault user_id 外鍵 ON DELETE CASCADE。）
- `supabase/storage.sql` — **Storage 設定**：trip-media＋vault 兩 bucket（皆 private）＋ per-user 政策；並 drop 掉危險的 public read 舊政策。schema.sql 不含 Storage，補在此。
- `supabase/drift_fix.sql` — **既有庫對齊**：修 travelers 的 infant bug、刪死欄位 is_child。既有庫跑一次。
- 舊的零散 `.sql` 與面板 17 段便條 → 歷史保留即可，未來以 `schema.sql`＋`storage.sql` 為準。

## 🔴🔴 最高優先：Storage vault 曾被設為 public（需立即驗證）
面板第 6 段把 `vault` bucket 設 `public = true` 並建立 `Allow public read access`（`FOR SELECT TO public`）＝**任何人都能讀取 vault 檔案（護照/證件！）**。第 7 段後來修正成 private + 嚴格 per-user。
**現況取決於第 7 段是否在第 6 段之後跑過。請務必立刻驗證：**
```sql
select id, public from storage.buckets where id in ('vault','trip-media');   -- 兩者都應 public=false
select policyname, roles, cmd from pg_policies where schemaname='storage' and tablename='objects';  -- 不該有 TO public 的 read
```
若 `vault.public` 還是 true 或還存在 public read 政策 → **跑 `storage.sql` 立即封起來**。

## 面板 17 段分類
- **可刪（建表食譜，已被 schema.sql 收錄）**：1 trips、2 vault_files、3 status flags、4 vault_folders、10 cached_locations、11 geocode_usage、12 cached_routes、13 wish_items(＋wish_lists/order/rating/place_details)、14 bookings、16 travelers、17 cached_searches。
- **可刪（一次性查詢/檢查）**：8 inspect_core_tables_schema、15 檢查 bookings 狀態。
- **要保留概念、已收進 `storage.sql`**：9 trip-media、7 vault 嚴格政策。
- **⚠️ 危險、絕不可再跑**：6 vault 設 public + public read（已被 storage.sql 明確 drop）。
- **schema.sql 已補**：5 vault user_id 外鍵 cascade。
- **確認漂移源頭**：16 travelers 建表帶 `is_child`、pax_type check 只有 `adult/child/senior`（無 infant）→ 就是 drift_fix 要修的。

## 表清單（線上 12 張）
`trips`、`travelers`、`bookings`、`wish_lists`、`wish_items`、`vault_folders`、`vault_files`、
`cached_locations`、`cached_searches`、`cached_place_details`、`cached_routes`、`geocode_usage`。

## 安全（過關）
- 12 張表**全部啟用 RLS**。
- 使用者資料表（trips/travelers/bookings/wish_*/vault_*）政策全綁 `auth.uid() = user_id`，own-user 隔離正確。
- 5 張快取/用量表（cached_*／geocode_usage）**RLS 開、零政策** → 前端碰不到、只有 edge service role 能存取 = 正確設計。

## 🔴 漂移與 bug（drift_fix.sql 已處理）
1. **travelers.pax_type 缺 `infant`（真 bug）**：線上 CHECK 只允許 `adult/child/senior`，但 App 的 `PaxType` 有 `infant`、訂位匯入畫面（`BookingImportSheet`）會設嬰兒 → **存嬰兒旅伴會被 DB 擋下報錯**。repo `travelers.sql` 本來就想含 infant，線上從沒 migrate。已於 drift_fix 補上；並同步修 `travelerStore.ts` 的 row 型別。
2. **travelers.is_child 死欄位**：程式碼未使用此表欄位（app 用的是 passenger 物件上的 `isChild`）。drift_fix 已 drop。

## 🟡 過去的最大問題：repo 曾不完整
內省前，repo 只記錄 6 張表，核心的 `trips`、`vault_*`、`cached_locations`、`cached_routes`、`geocode_usage` **只活在面板便條**。
→ 現已由 `schema.sql` 全數收進 repo，此漂移風險解除。

## 面板便條清理建議（Supabase Dashboard → SQL Editor 存檔查詢）
> 這些是「存檔的 SQL 文字」，不是資料庫；刪它們不動任何資料。schema.sql 收好後即可清。

**可刪（純查詢/檢查用）**：`檢查 bookings 狀態`、`inspect_core_tables_schema`、`Vault Files Status Flags`、`記錄「誰上傳了什麼檔案」`、`連帶刪除`。
**建表食譜類（已被 schema.sql 取代，可刪）**：`行程管理`(trips)、`vault 儲存桶`、`vault_folders`、`create_cached_locations_table`、`路線快取表cached_routes`、`地理編碼每日用量表`、`Bookings`、`travelers`、`wish_items`、`cached_searches`、`trip-media`、`enforce-private-vault…`。
**建議做法**：先跑 `drift_fix.sql` → 確認 App 一切正常 → 再一次清掉上述便條。

## Egress 超額（另案，非結構問題）
Supabase「Exceeding usage limits」是 **Egress（5GB）**，來自重度測試反覆下載 Storage 圖片＋大 JSONB 讀取，與 schema 無關。降 egress 見 `上架前檢查清單.md`（圖片壓縮/快取、大 JSONB 瘦身）。
