-- =====================================================================
-- 漂移修正：把「既有線上 DB」對齊到 canonical schema.sql
-- =====================================================================
-- 為什麼需要：schema.sql 是藍圖，在既有庫上「create if not exists」不會改 CHECK 或刪欄位。
-- 這支專門處理既有庫的差異。只需在既有庫跑「一次」。可重複執行（安全）。
-- 於 Supabase SQL Editor 執行。
-- =====================================================================

-- 1) 🔴 修 travelers.pax_type CHECK：補上 'infant'
--    真 bug：App 可設嬰兒（BookingImportSheet），但線上 CHECK 只允許 adult/child/senior，
--    存嬰兒旅伴會被資料庫擋下報錯。先移除舊約束、再加含 infant 的新約束。
alter table public.travelers drop constraint if exists travelers_pax_type_check;
alter table public.travelers
    add constraint travelers_pax_type_check check (pax_type in ('adult', 'infant', 'child', 'senior'));

-- 2) 🟢 刪 travelers.is_child（死欄位）
--    程式碼未使用這張表的 is_child 欄位（app 用的是 passenger 物件上的 isChild，非此欄）。
--    ⚠️ 破壞性但已確認無引用。若不放心可先註解掉這行、日後再刪。
alter table public.travelers drop column if exists is_child;
