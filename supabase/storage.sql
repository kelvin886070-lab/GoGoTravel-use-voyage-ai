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

-- ---------- buckets ----------
-- vault / trip-media：private。vault 另設伺服端 10MB 上限（前端檢查擋君子，bucket 限制擋直接打 API 的人）。
insert into storage.buckets (id, name, public) values ('trip-media', 'trip-media', false)
    on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public, file_size_limit) values ('vault', 'vault', false, 10485760)
    on conflict (id) do update set public = false, file_size_limit = 10485760;
-- avatars：public 是刻意的（頭像用 getPublicUrl 顯示，ProfileModal.tsx）。
-- 但 public 只該代表「讀」——寫入權在下方政策收緊。另設 2MB＋僅限圖片（與前端檢查一致）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
    on conflict (id) do update set public = true, file_size_limit = 2097152,
        allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

-- ---------- 清掉舊的/危險的政策 ----------
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow public read access" on storage.objects;   -- 🔴 危險：public read，務必移除
-- 🔴 2026-08-14 稽核發現：面板時期的 avatars 政策只檢查 bucket、不檢查擁有者——
--   任何登入者可覆蓋/刪除**別人的**頭像，並把任意檔案塞進 public bucket（＝拿你的專案免費架檔＋燒 Egress）。
drop policy if exists "Allow avatar uploads 1oj01fe_0" on storage.objects;
drop policy if exists "Allow avatar uploads 1oj01fe_1" on storage.objects;
drop policy if exists "Allow avatar uploads 1oj01fe_2" on storage.objects;
drop policy if exists "Allow avatar uploads 1oj01fe_3" on storage.objects;
-- 面板時期的 vault 政策（auth.uid() = owner）：檢查正確但與 Strict* 重複——同一件事兩套規則，
--   日後改其中一套會以為改完了。移除，只留 Strict* 一套權威版本。
drop policy if exists "Allow Users Manage Own Files 1oj01fe_0" on storage.objects;
drop policy if exists "Allow Users Manage Own Files 1oj01fe_1" on storage.objects;
drop policy if exists "Allow Users Manage Own Files 1oj01fe_2" on storage.objects;
drop policy if exists "Allow Users Manage Own Files 1oj01fe_3" on storage.objects;

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

-- ---------- avatars：讀公開（bucket public 本身就放行 URL 讀取），寫入只限自己資料夾 ----------
-- 路徑約定：{uid}/avatar_{ts}.{ext}（ProfileModal.tsx）——第一層資料夾＝uid，與 vault/trip-media 同一套規則。
drop policy if exists "avatars Uploads" on storage.objects;
create policy "avatars Uploads" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars Updates" on storage.objects;   -- 頭像用 upsert:true，UPDATE 必須有
create policy "avatars Updates" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars Delete" on storage.objects;
create policy "avatars Delete" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars Reads" on storage.objects;     -- API 列舉用（public URL 讀取不經 RLS）
create policy "avatars Reads" on storage.objects for select to authenticated
    using (bucket_id = 'avatars');

-- ---------- 驗證（跑完應為：vault/trip-media public=false、avatars public=true；----------
-- ----------  政策只剩 Strict* / trip-media* / avatars* 三組，且無任何 roles 含 public）----------
-- select id, public, file_size_limit from storage.buckets;
-- select policyname, roles, cmd, qual from pg_policies where schemaname='storage' and tablename='objects';
