-- =====================================================================
-- Kelvin Trip · Canonical Schema（單一真相：整庫結構藍圖）
-- =====================================================================
-- 用途：一份檔案描述全部 12 張表的「乾淨、預期」結構。
--   • 新環境重建：整份跑一次即可把結構蓋回來。
--   • 冪等（create/alter ... if not exists、drop policy if exists）→ 在現有庫上跑等於 no-op。
-- ⚠️ 這是「藍圖」，不是遷移。在既有庫上跑「不會」刪欄位或改 CHECK（那些留給 drift_fix.sql）。
--   例：travelers 這裡是乾淨版（pax_type 含 infant、無 is_child），但既有庫要靠 drift_fix.sql 才會對齊。
-- 依 2026-07-27 線上內省 dump（欄位/政策/索引/FK/CHECK）重建。
-- 建表順序已處理外鍵相依（wish_lists 先於 wish_items）。
-- =====================================================================

-- ---------- trips（行程；trip_data 為 JSONB 主體）----------
create table if not exists public.trips (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null,
    trip_data   jsonb,
    updated_at  timestamptz default timezone('utc'::text, now())
);
alter table public.trips enable row level security;
drop policy if exists "Users can see their own trips" on public.trips;
create policy "Users can see their own trips" on public.trips for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own trips" on public.trips;
create policy "Users can insert their own trips" on public.trips for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own trips" on public.trips;
create policy "Users can update their own trips" on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own trips" on public.trips;
create policy "Users can delete their own trips" on public.trips for delete using (auth.uid() = user_id);

-- ---------- travelers（我的旅伴；使用者層級、跨行程重用）----------
-- 乾淨版：pax_type 含 infant（App 需要）；不含 legacy is_child（程式碼未使用）。
create table if not exists public.travelers (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
    legal_name  text not null,
    nickname    text,
    pax_type    text not null default 'adult' check (pax_type in ('adult', 'infant', 'child', 'senior')),
    aliases     text[] not null default '{}',
    is_self     boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists travelers_user_idx on public.travelers (user_id);
alter table public.travelers enable row level security;
drop policy if exists "travelers_select_own" on public.travelers;
create policy "travelers_select_own" on public.travelers for select using (auth.uid() = user_id);
drop policy if exists "travelers_insert_own" on public.travelers;
create policy "travelers_insert_own" on public.travelers for insert with check (auth.uid() = user_id);
drop policy if exists "travelers_update_own" on public.travelers;
create policy "travelers_update_own" on public.travelers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "travelers_delete_own" on public.travelers;
create policy "travelers_delete_own" on public.travelers for delete using (auth.uid() = user_id);

-- ---------- bookings（訂位；使用者層級，跨行程時間軸＋變更反查）----------
create table if not exists public.bookings (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
    kind        text not null check (kind in ('flight', 'hotel')),
    trip_id     text,
    provider    text,
    airline     text,
    pnr         text,
    flight_no   text,
    dep_at      timestamptz,
    arr_at      timestamptz,
    segments    jsonb not null default '[]'::jsonb,
    passengers  jsonb not null default '[]'::jsonb,
    fare        jsonb,
    file_url    text,
    source      text not null default 'paste' check (source in ('paste', 'upload')),
    hotel       jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists bookings_user_depat_idx on public.bookings (user_id, dep_at);
create index if not exists bookings_user_pnr_idx on public.bookings (user_id, pnr);
create index if not exists bookings_trip_idx on public.bookings (trip_id);
alter table public.bookings enable row level security;
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings for select using (auth.uid() = user_id);
drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own" on public.bookings for insert with check (auth.uid() = user_id);
drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own" on public.bookings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bookings_delete_own" on public.bookings;
create policy "bookings_delete_own" on public.bookings for delete using (auth.uid() = user_id);

-- ---------- wish_lists（心願盒相簿；wish_items 以 list_id 參照）----------
create table if not exists public.wish_lists (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
    name              text not null,
    cover_image_path  text,
    position          integer not null default 0,
    pinned            boolean not null default false,
    created_at        timestamptz not null default now()
);
create index if not exists wish_lists_user_idx on public.wish_lists (user_id);
create index if not exists wish_lists_order_idx on public.wish_lists (user_id, pinned desc, position asc);
alter table public.wish_lists enable row level security;
drop policy if exists "wish_lists_select_own" on public.wish_lists;
create policy "wish_lists_select_own" on public.wish_lists for select using (auth.uid() = user_id);
drop policy if exists "wish_lists_insert_own" on public.wish_lists;
create policy "wish_lists_insert_own" on public.wish_lists for insert with check (auth.uid() = user_id);
drop policy if exists "wish_lists_update_own" on public.wish_lists;
create policy "wish_lists_update_own" on public.wish_lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wish_lists_delete_own" on public.wish_lists;
create policy "wish_lists_delete_own" on public.wish_lists for delete using (auth.uid() = user_id);

-- ---------- wish_items（心願盒地點/購物）----------
create table if not exists public.wish_items (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade default auth.uid(),
    type                   text not null default 'place' check (type in ('place', 'item', 'link')),
    title                  text not null,
    note                   text,
    country                text,
    city                   text,
    area                   text,
    lat                    double precision,
    lng                    double precision,
    place_id               text,
    url                    text,
    custom_image_path      text,
    budget                 numeric,
    currency               text,
    tags                   text[] not null default '{}',
    is_favorite            boolean not null default false,
    is_purchased           boolean not null default false,
    preferred_slot         text,
    needs_location_confirm boolean not null default false,
    for_whom               text,
    quantity               integer,
    actual_price           numeric,
    is_settled             boolean not null default false,
    trip_id                text,
    stop_id                text,
    used_in_trips          text[] not null default '{}',
    list_id                uuid references public.wish_lists(id) on delete set null,
    rating                 numeric,
    rating_count           integer,
    created_at             timestamptz not null default now()
);
create index if not exists wish_items_user_type_idx on public.wish_items (user_id, type);
alter table public.wish_items enable row level security;
drop policy if exists "wish_items_select_own" on public.wish_items;
create policy "wish_items_select_own" on public.wish_items for select using (auth.uid() = user_id);
drop policy if exists "wish_items_insert_own" on public.wish_items;
create policy "wish_items_insert_own" on public.wish_items for insert with check (auth.uid() = user_id);
drop policy if exists "wish_items_update_own" on public.wish_items;
create policy "wish_items_update_own" on public.wish_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wish_items_delete_own" on public.wish_items;
create policy "wish_items_delete_own" on public.wish_items for delete using (auth.uid() = user_id);

-- ---------- vault_folders（保管箱資料夾）----------
create table if not exists public.vault_folders (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        text not null,
    parent_id   text,
    is_pinned   boolean default false,
    is_deleted  boolean default false,
    created_at  timestamptz default timezone('utc'::text, now())
);
alter table public.vault_folders enable row level security;
drop policy if exists "Users can manage own folders" on public.vault_folders;
create policy "Users can manage own folders" on public.vault_folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- vault_files（保管箱檔案）----------
create table if not exists public.vault_files (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade,
    name             text not null,
    type             text,
    size             text,
    file_path        text not null,
    parent_id        text,
    is_pinned        boolean default false,
    is_deleted       boolean default false,
    category         text default 'other',
    document_number  text,
    notes            text,
    created_at       timestamptz default timezone('utc'::text, now())
);
alter table public.vault_files enable row level security;
drop policy if exists "Users can manage own files" on public.vault_files;
create policy "Users can manage own files" on public.vault_files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- 快取／用量表：只有 edge function 的 service role 讀寫。
-- 一律「啟用 RLS 且不加任何 user 政策」→ anon/authenticated 皆碰不到；service role 繞過 RLS。
-- =====================================================================

-- ---------- cached_locations（geocode/findplace 座標快取）----------
create table if not exists public.cached_locations (
    query       text primary key,
    lat         double precision not null,
    lng         double precision not null,
    place_id    text,
    created_at  timestamptz default now()
);
alter table public.cached_locations enable row level security;

-- ---------- cached_searches（Text Search 清單快取，TTL 7 天由 edge 判斷）----------
create table if not exists public.cached_searches (
    query       text primary key,
    results     jsonb not null,
    created_at  timestamptz not null default now()
);
alter table public.cached_searches enable row level security;

-- ---------- cached_place_details（評分 Details 快取，TTL 30 天由 edge 判斷）----------
create table if not exists public.cached_place_details (
    place_id    text primary key,
    data        jsonb not null,
    created_at  timestamptz not null default now()
);
alter table public.cached_place_details enable row level security;

-- ---------- cached_routes（Directions 折線快取）----------
create table if not exists public.cached_routes (
    route_key   text primary key,
    polyline    text not null,
    created_at  timestamptz default now()
);
alter table public.cached_routes enable row level security;

-- ---------- geocode_usage（每人每日 Google 呼叫計數；200/日硬限額）----------
create table if not exists public.geocode_usage (
    user_id     uuid not null,
    day         date not null default current_date,
    count       integer not null default 0,
    primary key (user_id, day)
);
alter table public.geocode_usage enable row level security;
