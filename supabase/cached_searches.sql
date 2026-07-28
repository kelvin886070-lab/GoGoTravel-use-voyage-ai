-- 🔎 D2：地點搜尋清單快取（typeahead 省 API）。
-- 只有 edge function 的 service role 讀寫；前端無政策＝碰不到（與 cached_locations 同一套）。
-- 於 Supabase SQL Editor 執行。可重複執行。

create table if not exists public.cached_searches (
    query       text primary key,            -- "search:<query>@<lat.1>,<lng.1>"
    results     jsonb not null,              -- PlaceSearchResult[]
    created_at  timestamptz not null default now()
);

-- 啟用 RLS 且不加任何 user 政策 → anon/authenticated 皆無法存取；service role（edge function）繞過 RLS。
alter table public.cached_searches enable row level security;
