# Voyage-AI 優化執行清單（Optimization Checklist）

> 審查日期：2026-06-27
> 原則：依「風險 × 解除阻塞程度」排序。**先做完一個階段再進下一個**，每項都有驗收標準（DoD）。
> 標記：🔴 嚴重 / 🟠 架構 / 🟡 細節

---

## 📋 我需要你提供的資訊（開始前）

| # | 需要的東西 | 為什麼需要 | 怎麼給我 |
|---|-----------|-----------|---------|
| A | Supabase 三張表（`trips` / `vault_folders` / `vault_files`）目前的 **RLS policy 狀態** | 判斷是否人人可讀寫所有人資料（比金鑰外洩更嚴重） | Supabase Dashboard → Authentication → Policies 截圖；或在 SQL Editor 跑下方查詢把結果貼給我 |
| B | 三張表的 **欄位結構（schema）** | 規劃「圖片改存 Storage」「拆分大 blob」時要對照 | SQL Editor 跑 `\d trips` 或下方查詢 |
| C | 這個 app 的 **部署位置**（Vercel / Netlify / Cloudflare Pages / 純本機） | 決定 API 代理放哪（Supabase Edge Function vs Cloudflare Worker） | 直接告訴我平台名稱 |
| D | 使用情境：**只有你一個人用，還是多人共用 / 會公開？** | 決定 RLS 與金鑰防護的嚴格程度 | 一句話說明 |
| E | Supabase Storage 有幾個 bucket、`vault` bucket 是 public 還是 private | 規劃封面圖搬遷 | Dashboard → Storage 截圖 |

**查 RLS 狀態的 SQL（貼結果給我，不含任何密鑰，安全）：**
```sql
-- 1. 各表 RLS 是否開啟
select relname, relrowsecurity
from pg_class
where relname in ('trips','vault_folders','vault_files');

-- 2. 現有 policy 列表
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('trips','vault_folders','vault_files');

-- 3. 表結構
select table_name, column_name, data_type
from information_schema.columns
where table_name in ('trips','vault_folders','vault_files')
order by table_name, ordinal_position;
```

---

## 🔴 階段一：安全止血（最優先，做完才安全公開）

### [x] 1.1 輪換（Rotate）所有外洩金鑰 ✅ 2026-06-28 完成（Gemini / Weather 皆已重產）
- **為什麼**：`.env` 曾被 commit（`eb3ac19`），Gemini／天氣金鑰仍可從 git 歷史取出；且 `VITE_` 金鑰已被打包進前端 bundle，等於公開。
- **做什麼**：
  - Google AI Studio → 刪除舊 Gemini API key → 產生新 key。
  - WeatherAPI → 重新產生 key。
  - （Supabase anon key 暫不需輪換，但 service_role key 若曾外流則必須換。）
- **DoD**：舊 key 在後台已撤銷，呼叫舊 key 會回 401/403。

### [x] 1.2 把 Gemini / 天氣 API 呼叫移到後端代理 ✅ 2026-06-28 完成（本機驗收：ai-proxy 有打到、generativelanguage/AIza 皆 No matches）
- **為什麼**：只要金鑰在瀏覽器，輪換再多次都會再外洩。唯一根治法是金鑰只存在你控制的伺服器。
- **做什麼**（建議用 Supabase Edge Function，因為你已在用 Supabase）：
  1. 建一個 Edge Function `ai-proxy`，把 Gemini key 存進 Supabase Secrets（`supabase secrets set GEMINI_KEY=...`），**不加 VITE_ 前綴**。
  2. 前端 `gemini.ts` 改為呼叫 `supabase.functions.invoke('ai-proxy', { body: { prompt } })`，不再直接打 Google。
  3. 在 Edge Function 內驗證使用者 JWT，避免代理被濫用。
- **DoD**：DevTools Network 分頁看不到任何 `generativelanguage.googleapis.com?key=...` 請求，也搜不到金鑰字串。
- **需要我**：告訴我資訊 C（部署平台），我給你完整 Edge Function 程式碼。

### [ ] 1.3 清除 git 歷史中的 .env（選配但建議）
- **為什麼**：即使輪換金鑰，歷史中的舊值仍是不良實踐；若日後 service_role key 等更敏感資料進過歷史會很危險。
- **做什麼**：用 `git filter-repo`（或 BFG）移除歷史中的 `.env`，force-push。⚠️ 會改寫歷史，協作者需重新 clone。
- **DoD**：`git log --all -- .env` 無輸出。
- **注意**：若 1.1 已輪換金鑰，此步驟的急迫性下降；可排在階段一最後。

### [x] 1.4 確認 Supabase RLS（最關鍵的隱形洞）✅ 2026-06-27 通過
- **驗證結果**：三張表 `relrowsecurity = true`；trips 的 SELECT/INSERT/UPDATE/DELETE 與 vault_files/vault_folders 的 ALL policy 全部綁 `auth.uid() = user_id`。資料層安全。
- **備註**：UPDATE/ALL 的 `with_check = NULL` 由 Postgres 自動沿用 USING 條件，非漏洞。未來可選擇補顯式 with_check 強化可讀性。
- **待辦（搬到階段二一起做）**：確認 Storage `vault` bucket（private，7 條 policy）的 storage.objects policy 也綁使用者資料夾；`avatars` bucket 是 public。

---

## 🟠 階段二：架構解阻塞（讓後續優化變容易）

### [x] 2.1 刪除巢狀重複目錄 `voyage-ai/voyage-ai/` ✅ 2026-06-28 完成（commit 4858377，刪 23 檔 / 3695 行；已確認主程式無引用、可從 git 歷史復原）
- **為什麼**：那是一份預設 Vite 樣板殘骸，被 git 追蹤、含獨立 117MB node_modules，純死碼，會誤導搜尋與協作。
- **做什麼**：確認該資料夾無任何被主程式 import 後，`git rm -r voyage-ai/`（巢狀那個）並 commit。
- **DoD**：根目錄只剩一份 `src/`，build 仍正常。
- **需要我**：可請我先幫你做一次「無引用」確認掃描。

### [~] 2.2 封面圖／記帳照片改存 Supabase Storage（停止 base64-in-JSON）（進行中）
- ✅ 2026-06-29 封面圖：建立 trip-media bucket + 3 條 storage policy；services/storage.ts（upload/delete/批次 signPaths）；
  types 加 coverImagePath；App 載入解析 signed URL、儲存還原路徑；TripSettingsModal 上傳改走 Storage、換圖刪舊。
  驗收：trip-media 出現檔案、trip_data 只存路徑(coverImage="")、換圖後舊檔自動刪除，皆通過。
- ✅ 2026-06-29 記帳照片 expenseImage：types 加 expenseImagePath；storage.ts 加 collectTripImagePaths/deleteTripImages/resolveTripImages/serializeTripForDb；
  App 載入批次簽全部圖、儲存走訪序列化、永久刪行程連帶清圖；ActivityDetailModal 上傳改 Storage、換圖刪舊；ItineraryView 刪卡清圖。
  驗收：上傳進 trip-media、trip_data 只存路徑、重整保留、換圖/刪卡/永久刪皆清孤兒，全通過。
- ✅ 2.2 完成（封面＋記帳照片皆改存 Storage，blob 不再塞 base64 圖）。

---
原始 2.2 說明：
- **為什麼**：圖片以 base64 塞進 `trip_data` JSON，使每張圖膨脹約 33%、每次儲存重傳整包、撐爆資料列。保管箱檔案已正確走 Storage + signed URL，封面圖卻沒有——收斂這個不一致。
- **做什麼**：上傳圖片到 `vault`（或新 `covers` bucket）→ 只在 `trip_data` 存 `file_path` → 讀取時用 signed URL（沿用 `App.tsx` 既有模式）。
- **DoD**：`trip_data` 內不再出現 `data:image/...;base64` 字串。
- **需要我**：給我資訊 E。

### [x] 2.3 `saveTripToCloud` 加上 debounce ✅ 2026-06-28 完成（800ms 防抖 + flush on 換頁/登出/關閉 + cancel on 刪除；四情境驗收通過）
- **為什麼**：`onUpdateTrip` 在 `ItineraryView` 被呼叫 20+ 次，每次都 upsert 整包 blob、無節流，造成過量寫入與成本。
- **做什麼**：在 `App.tsx` 用一個 debounce（如 800ms）包住雲端寫入；本地 state 仍即時更新，只延後寫 DB。可加「同步中／已儲存」狀態提示。
- **DoD**：連續操作（如連點調整）只觸發一次 DB 寫入。

### [ ] 2.4 心願盒（wishItems）接上雲端持久化
- **為什麼**：目前 `wishItems` 用 `App.tsx` 寫死的 `MOCK_WISH_ITEMS`，重整就回到假資料——這個功能等於沒真正保存。
- **做什麼**：新增 `wish_items` 表（或併入既有結構），比照 trips 的 fetch/save 流程；移除 mock。
- **DoD**：新增願望→重整→資料仍在。
- **需要我**：確認你要獨立表還是塞進現有結構，我給 schema。

---

## 🟡 階段三：品質與韌性

### [ ] 3.1 加入 Error Boundary
- **為什麼**：目前任何元件丟例外都是整頁白畫面（無任何 boundary）；`parseJSON`、PDF、時間解析都是潛在丟錯點。
- **做什麼**：在 `App` 外層包一個 `ErrorBoundary`，顯示友善錯誤與「重試」。
- **DoD**：手動丟錯時看到 fallback UI 而非白屏。

### [ ] 3.2 收斂型別 `any`（29 處 `: any` + 15 處 `as any`）
- **為什麼**：Supabase 回傳全用 `any` 手動 map，等於關掉 TS 在資料邊界的保護；`Activity.type` 的 `| string` 也讓聯合型別失效。
- **做什麼**：為 DB row 定義明確 interface（或用 Supabase 產生的型別 `supabase gen types`）；移除 `Activity.type` 的 `| string`。
- **DoD**：`grep -rn "as any" src` 大幅下降，`tsc` 無錯。

### [~] 3.3 拆分巨型元件 + 導入 memo / lazy load （進行中）
- ✅ 2026-06-28：5 個拖曳卡片（ActivityItem/ExpensePolaroid/TransportConnectorItem/NoteItem/ProcessItem）加上自訂比較函式的 React.memo。
  量測結果：Scripting 密度 ↓約36%（320→206 ms/s）、INP ↓35%（812→529ms）。功能驗收（點擊/拖曳/顯示）通過。
- [ ] 待辦：DayRouteCard / TripCard memo、App handler useCallback、拆分 1092 行 ItineraryView、PDF 元件 lazy load。

---
原始 3.3 說明：
- **為什麼**：`ItineraryView`(1092 行)、`CreateTripModal`(904 行) 過大；`React.memo`=0、`useCallback`=0，每次 render 重建所有 handler，拖曳大行程會掉幀；`@react-pdf/renderer` 等大套件全進首包。
- **做什麼**：
  - 把 `App.tsx` 的 handler 用 `useCallback` 包起。
  - 列表項目（活動卡、TripCard）用 `React.memo`。
  - PDF 元件與重模態框改 `React.lazy` + `Suspense` 動態載入。
- **DoD**：build 後 PDF 相關 chunk 獨立；首包體積下降；長行程拖曳順暢。

### [ ] 3.4 統一錯誤處理，清除靜默 catch 與 console
- **為什麼**：多處 `catch(e){}` 靜默吞錯、17 處殘留 `console.*`，線上難以排查。
- **做什麼**：建立統一的錯誤提示（toast）與最小化的 logger；移除除錯用 console。
- **DoD**：失敗操作會給使用者明確回饋。

---

## 🟢 階段四：細節收斂（低風險、隨手做）

- [ ] 4.1 修正 `manifest.json`：name/short_name 改成正式 app 名；PWA icon 從外部 dicebear SVG 改為 `public/` 內的本地圖（離線才不會掛）。
- [ ] 4.2 `.gitignore` 移除重複的 `.env` 行。
- [ ] 4.3 用自訂對話框元件取代原生 `confirm()`（登出／刪除），與玻璃擬態風格一致。
- [ ] 4.4 README 仍是 Vite 預設樣板內容，改成真正的專案說明。
- [ ] 4.5 評估開啟 ESLint 的 type-aware 規則（`recommendedTypeChecked`），配合 3.2 一起做。

---

## 建議的執行節奏
1. **先給我資訊 A–E** → 我先確認 RLS（1.4）這個隱形洞，因為它可能比金鑰更嚴重。
2. 接著做 1.1 / 1.2（金鑰與代理）——這是公開前的底線。
3. 階段二的 2.1（刪死碼）可立刻做、零風險，先清場。
4. 其餘依序推進，每階段做完跑一次 `npm run build` 驗收。

> 紅隊提醒：不要被「功能都會動」的表象迷惑。1.2 與 1.4 沒做之前，這個 app **不該對外公開**——能動，不等於安全。
