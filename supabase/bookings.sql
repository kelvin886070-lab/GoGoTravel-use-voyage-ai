-- 🎟️ 訂位上雲：bookings 資料表 + 索引 + RLS。
-- 於 Supabase SQL Editor 執行。可重複執行（IF NOT EXISTS / DROP POLICY IF EXISTS）。
--
-- 設計要點：
--   booking 是「使用者層級」的獨立實體（非埋 trips.trip_data），才能支援
--   (1) 跨行程「我的所有訂位」時間軸  (2) 外站變更通知用 (airline, pnr) 反查。
--   segments/passengers/fare 用 jsonb 保留巢狀；pnr / airline / flight_no / dep_at
--   從第一航段「反正規化」拉成有索引的欄位，供上述兩種查詢。
--   trip_id 可為 null（訂位優先流 / 變更反查）；刪行程時由 App 設 null，booking 不刪。

create table if not exists public.bookings (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
    kind          text not null check (kind in ('flight', 'hotel')),
    trip_id       text,                     -- 可 null，比照 wish_items 用 text（不硬綁 FK；刪行程由 App 設 null）
    provider      text,                     -- 顯示用航空/飯店名，如 台灣虎航
    airline       text,                     -- 反查比對鍵之一（航空代碼或名稱）
    pnr           text,                     -- 訂位代號（反查比對鍵之一）
    flight_no     text,                     -- 反正規化：第一航段航班號
    dep_at        timestamptz,              -- 反正規化：第一航段出發 UTC（跨行程排序用）
    arr_at        timestamptz,              -- 反正規化：最後航段抵達 UTC
    segments      jsonb not null default '[]'::jsonb,   -- flight 用
    passengers    jsonb not null default '[]'::jsonb,   -- flight 用
    hotel         jsonb,                                -- hotel 用（property/checkIn/checkOut/rooms/guests/address）
    fare          jsonb,
    file_url      text,                     -- 原始信件憑證（Storage 路徑或 URL）
    source        text not null default 'paste' check (source in ('paste', 'upload')),
    created_at    timestamptz not null default now()
);

-- 既有資料庫（已建過 bookings）請另跑：
--   alter table public.bookings add column if not exists hotel jsonb;

-- 跨行程時間軸：user_id + dep_at 排序
create index if not exists bookings_user_depat_idx on public.bookings (user_id, dep_at);
-- 變更通知反查：user_id + pnr（比對鍵 (airline, pnr)）
create index if not exists bookings_user_pnr_idx on public.bookings (user_id, pnr);
-- 行程頁視圖：依 trip_id 撈這趟的訂位
create index if not exists bookings_trip_idx on public.bookings (trip_id);

-- 啟用 RLS，政策綁 user_id（比照 wish_items / trips）
alter table public.bookings enable row level security;

drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
    for select using (auth.uid() = user_id);

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own" on public.bookings
    for insert with check (auth.uid() = user_id);

drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own" on public.bookings
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bookings_delete_own" on public.bookings;
create policy "bookings_delete_own" on public.bookings
    for delete using (auth.uid() = user_id);
