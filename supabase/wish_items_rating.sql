-- 🌟 D2② 評分（方案A）：wish_items 存下 Google 評分，列表顯示直接讀＝零額外 API 呼叫。
-- 存進心願盒時（saveWishItem）若 place 有 placeId 且尚無 rating → 打一次 Place Details，rating 一併存這。
-- 於 Supabase SQL Editor 執行。可重複執行。

alter table public.wish_items
    add column if not exists rating       numeric,     -- Google 平均評分（0–5）
    add column if not exists rating_count integer;     -- 評分人數（userRatingCount）
