-- 🧱 Phase C0-1：心願盒上雲。wish_items 資料表 + RLS。
-- 於 Supabase SQL Editor 執行。可重複執行（IF NOT EXISTS / DROP POLICY IF EXISTS）。

create table if not exists public.wish_items (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
    type              text not null default 'place' check (type in ('place', 'item', 'link')),
    title             text not null,
    note              text,                 -- 「想玩什麼」等備註
    country           text,
    area              text,
    lat               double precision,     -- 存檔時 geocode 補上
    lng               double precision,
    place_id          text,                 -- Google Place ID（去重/快取用）
    url               text,                 -- link 類型或參考連結
    custom_image_path text,                 -- Storage 路徑（沿用 trip-media 慣例）
    budget            numeric,
    currency          text,
    tags              text[] not null default '{}',
    created_at        timestamptz not null default now()
);

-- 查詢加速：多以 user_id + type 篩選
create index if not exists wish_items_user_type_idx on public.wish_items (user_id, type);

-- 啟用 RLS，政策綁 user_id（比照 trips / vault_* 的作法）
alter table public.wish_items enable row level security;

drop policy if exists "wish_items_select_own" on public.wish_items;
create policy "wish_items_select_own" on public.wish_items
    for select using (auth.uid() = user_id);

drop policy if exists "wish_items_insert_own" on public.wish_items;
create policy "wish_items_insert_own" on public.wish_items
    for insert with check (auth.uid() = user_id);

drop policy if exists "wish_items_update_own" on public.wish_items;
create policy "wish_items_update_own" on public.wish_items
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wish_items_delete_own" on public.wish_items;
create policy "wish_items_delete_own" on public.wish_items
    for delete using (auth.uid() = user_id);
