-- =====================================================================
-- Kelvin Trip · 每日用量原子計數 RPC（2026-08-14 資安補強批）
-- =====================================================================
-- 為什麼需要這個函式：
--   舊版限額是「讀 → 判斷 → 寫」三步，不是原子的。並發 20 個請求同時讀到
--   count=5，全部寫入 6——實際發生 20 次呼叫、計數只 +1。
--   正常使用時它是準的，被刻意攻擊時它就不準了；而限額存在的意義正是防攻擊。
--   insert … on conflict do update 在 Postgres 是單一原子敘述，永不 lost update。
--
-- 呼叫端：只有 ai-proxy Edge Function（service role）。
--   前端與 anon/authenticated 一律不可執行（見檔尾 revoke）。
--
-- ⚠️ 執行順序：先在 SQL Editor 跑這份，**再**部署新版 ai-proxy。
--   新版 ai-proxy 對這個 RPC 是 fail-closed——函式不存在時所有計費 action 都會被擋，
--   這是刻意的（錯誤要立刻浮現，不能靜默放行）。
--
-- 可重複執行（create or replace）。於 Supabase SQL Editor 執行全文。
-- =====================================================================

create or replace function public.bump_usage(p_user_id uuid, p_day date, p_cost int)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  -- 防呆：成本必須是正數（負數可以「還點」，不允許）
  if p_cost is null or p_cost < 1 then
    p_cost := 1;
  end if;
  insert into public.geocode_usage (user_id, day, count)
  values (p_user_id, p_day, p_cost)
  on conflict (user_id, day)
  do update set count = geocode_usage.count + excluded.count
  returning count into new_count;
  return new_count;   -- 呼叫端（ai-proxy）用回傳值與 DAILY_BUDGET 比較決定放行與否
end;
$$;

-- 權限收緊：只有 service role（ai-proxy 的 admin client）可執行
revoke all on function public.bump_usage(uuid, date, int) from public;
revoke all on function public.bump_usage(uuid, date, int) from anon;
revoke all on function public.bump_usage(uuid, date, int) from authenticated;
grant execute on function public.bump_usage(uuid, date, int) to service_role;

-- ---------- 驗證 ----------
-- ① 函式存在且 owner 正確：
-- select proname, prosecdef from pg_proc where proname = 'bump_usage';
-- ② 原子性煙霧測試（跑兩次，count 應為 3 → 6）：
-- select public.bump_usage('00000000-0000-0000-0000-000000000000'::uuid, current_date, 3);
-- 測完清掉測試列：
-- delete from geocode_usage where user_id = '00000000-0000-0000-0000-000000000000';
