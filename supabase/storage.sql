-- =====================================================================
-- Kelvin Trip · Storage 設定（buckets + per-user 存取政策）
-- =====================================================================
-- schema.sql 只涵蓋資料表；Storage bucket 與 storage.objects 政策在這裡。
-- 兩個 bucket 都設 private，一律用 Signed URL 存取；只有「檔案路徑第一層資料夾＝自己 uid」才可讀寫。
-- 可重複執行（先 drop policy if exists 再 create）。於 Supabase SQL Editor 執行。
--
-- ⚠️ 安全歷史：面板第 6 段曾把 'vault' 設 public 並建立「Allow public read access」
--   （FOR SELECT TO public）＝任何人都能讀 vault 檔案。第 7 段已修正。此檔重申正確狀態，
--   並明確 DROP 掉那個危險政策。跑完請用檔尾的驗證查詢確認 vault 已 private。
-- =====================================================================

-- ---------- buckets：兩個都 private ----------
insert into storage.buckets (id, name, public) values ('trip-media', 'trip-media', false)
    on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('vault', 'vault', false)
    on conflict (id) do update set public = false;

-- ---------- 清掉舊的/危險的政策 ----------
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow public read access" on storage.objects;   -- 🔴 危險：public read，務必移除

-- ---------- trip-media：每人只能存取自己資料夾（name 第一層＝uid）----------
drop policy if exists "trip-media Uploads" on storage.objects;
create policy "trip-media Uploads" on storage.objects for insert to authenticated
    with check (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "trip-media Reads" on storage.objects;
create policy "trip-media Reads" on storage.objects for select to authenticated
    using (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "trip-media Delete" on storage.objects;
create policy "trip-media Delete" on storage.objects for delete to authenticated
    using (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- vault：每人只能存取自己資料夾 ----------
drop policy if exists "Strict Uploads" on storage.objects;
create policy "Strict Uploads" on storage.objects for insert to authenticated
    with check (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Strict Reads" on storage.objects;
create policy "Strict Reads" on storage.objects for select to authenticated
    using (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Strict Delete" on storage.objects;
create policy "Strict Delete" on storage.objects for delete to authenticated
    using (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 驗證（跑完應為：兩 bucket public=false；無 public read 政策）----------
-- select id, public from storage.buckets where id in ('trip-media','vault');
-- select policyname, roles, cmd from pg_policies where schemaname='storage' and tablename='objects';
