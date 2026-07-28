-- 📚 相簿排序/釘選：wish_lists 加 position（手動排序）與 pinned（釘選置頂）。
-- 於 Supabase SQL Editor 執行。可重複執行。
-- 排序語意（前端 fetchWishLists）：pinned desc → position asc → created_at desc。
--   position 預設 0：使用者尚未手動排序前，全部 0，退回 created_at（最新在前，維持現行行為）。
--   進「編輯模式」拖曳後，前端會把每本寫入明確 position（0..n-1），之後 position 主導。

alter table public.wish_lists
    add column if not exists position integer not null default 0,
    add column if not exists pinned   boolean not null default false;

-- 排序查詢用複合索引（釘選在前、position 次之）
create index if not exists wish_lists_order_idx
    on public.wish_lists (user_id, pinned desc, position asc);
