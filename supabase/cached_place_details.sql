-- 🌟 D2② 評分快取（Place Details，方案A 省 API）。
-- 只有 edge function 的 service role 讀寫；前端無政策＝碰不到（與 cached_searches 同一套）。
-- TTL 30 天由前端/edge 判斷（created_at）；此表只存最後一次抓到的 details。
-- 於 Supabase SQL Editor 執行。可重複執行。

create table if not exists public.cached_place_details (
    place_id    text primary key,            -- Google Places placeId
    data        jsonb not null,              -- { placeId, rating?, ratingCount?, name? }
    created_at  timestamptz not null default now()
);

-- 啟用 RLS 且不加任何 user 政策 → anon/authenticated 皆無法存取；service role（edge function）繞過 RLS。
alter table public.cached_place_details enable row level security;
