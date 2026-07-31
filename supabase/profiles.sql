-- supabase/profiles.sql
-- 🛂 批③：profiles 表——把「暱稱」從身份中解耦的第一刀。
--   user_id＝真正的 PK（UUID，永不變）；friend_code＝人類可讀的唯一識別（會員碼，UNIQUE），
--   display_name＝顯示名（可重複、未來可改名——改名不影響身份與外鍵）。
--   v1 會員碼由 client 以 uuid 前 8 hex 導出後 upsert；自訂碼＝未來社交批（查重/防搶註在 UNIQUE 之上加流程）。
--   ⚠️ 登入仍走「暱稱合成 email」的舊制——真 email 遷移屬「登入頁 2-2 重做」批（docs 已記）。
-- 執行方式：Supabase Dashboard → SQL Editor 貼上執行（冪等，可重跑）。

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  friend_code  text not null unique,
  display_name text,
  created_at   timestamptz not null default now()
);

-- 批③微調：頭貼（Storage 路徑，trip-media 私有桶；顯示端簽名 URL）
alter table public.profiles add column if not exists avatar_path text;

alter table public.profiles enable row level security;

-- 自己的列自己管；跨使用者查詢（好友搜尋）＝未來社交批再開專用 policy／RPC，現在不開。
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
