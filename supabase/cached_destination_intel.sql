-- 🌍 生成表單重設計・目的地情報快取（destination-intel）
--   一次呼叫回傳：顆粒度(country/region/city/unknown)、正規名稱、國家 ISO、cityEn、幣別、
--   地帶卡組（縮圈頁）、玩法標籤（講究頁）、順遊城市、各月季節註記、猜測清單（打錯時）。
--   **全域共用快取**：同一個查詢字串全體使用者共用一筆 → 第二次起零 LLM 成本。
--   TTL：35 天（Kelvin 定案：避免換季後出現過季詞條；目的地屬性雖穩定，但季節性推薦需隨月份更新）。
--   只有 edge function 的 service role 讀寫；前端無政策＝碰不到（與 cached_searches 同一套）。
-- 於 Supabase SQL Editor 執行。可重複執行。

create table if not exists public.cached_destination_intel (
    query       text primary key,            -- 正規化後的查詢字串（小寫去空白，例 "日本"、"金澤"）
    data        jsonb not null,              -- DestinationIntel（見 services/destinationIntel.ts）
    created_at  timestamptz not null default now()
);

alter table public.cached_destination_intel enable row level security;
