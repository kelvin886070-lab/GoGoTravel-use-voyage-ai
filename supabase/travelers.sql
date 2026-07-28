-- 🧑‍🤝‍🧑 我的旅伴：travelers 資料表 + RLS。使用者層級、跨行程重用。
-- 於 Supabase SQL Editor 執行。可重複執行。
-- 設計：legal_name＝票面英文名（對證件、比對用）；nickname＝顯示暱稱（姊姊…）。
--       敏感欄位（生日/護照）＝未來安全任務，先不建，屆時獨立欄+加密。

create table if not exists public.travelers (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
    legal_name  text not null,            -- 票面英文法定名
    nickname    text,                     -- 顯示暱稱（選填）
    pax_type    text not null default 'adult' check (pax_type in ('adult', 'infant', 'child', 'senior')),  -- 身分三態
    aliases     text[] not null default '{}',    -- 其他票面名（記住「我」在不同票上的名字）
    is_self     boolean not null default false,  -- 本人
    created_at  timestamptz not null default now()
);
-- 既有資料庫（已建過舊版 travelers）請另跑：
--   alter table public.travelers add column if not exists aliases text[] not null default '{}';
--   -- pax_type：若之前用 3 態 check，放寬成含 infant（先移除舊約束再加新）：
--   alter table public.travelers add column if not exists pax_type text not null default 'adult';
--   alter table public.travelers drop constraint if exists travelers_pax_type_check;
--   alter table public.travelers add constraint travelers_pax_type_check check (pax_type in ('adult','infant','child','senior'));

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
