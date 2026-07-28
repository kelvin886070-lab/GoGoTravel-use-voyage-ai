-- 📚 心願盒相簿/清單：wish_lists 資料表 + RLS，並為 wish_items 加 list_id（歸屬相簿）。
-- 於 Supabase SQL Editor 執行。可重複執行。

create table if not exists public.wish_lists (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
    name              text not null,
    cover_image_path  text,                 -- 自訂封面（Storage 路徑）；空＝UI 用相簿內地點照片拼貼
    created_at        timestamptz not null default now()
);

create index if not exists wish_lists_user_idx on public.wish_lists (user_id);

alter table public.wish_lists enable row level security;

drop policy if exists "wish_lists_select_own" on public.wish_lists;
create policy "wish_lists_select_own" on public.wish_lists
    for select using (auth.uid() = user_id);

drop policy if exists "wish_lists_insert_own" on public.wish_lists;
create policy "wish_lists_insert_own" on public.wish_lists
    for insert with check (auth.uid() = user_id);

drop policy if exists "wish_lists_update_own" on public.wish_lists;
create policy "wish_lists_update_own" on public.wish_lists
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wish_lists_delete_own" on public.wish_lists;
create policy "wish_lists_delete_own" on public.wish_lists
    for delete using (auth.uid() = user_id);

-- 📚 wish_items 歸屬相簿：刪相簿 → 其地點自動變「未分類」（list_id 設 null），不刪地點。
alter table public.wish_items
    add column if not exists list_id uuid references public.wish_lists(id) on delete set null;
