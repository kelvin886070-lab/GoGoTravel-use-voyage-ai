# Kelvin Trip（voyage-ai）

智慧旅遊規劃 PWA：行程編排、記帳分帳、地圖與順路檢視、文件保管箱、離線瀏覽，以及一鍵匯出精美 PDF 旅遊書。前端為 React 19 + TypeScript，後端以 Supabase（Auth / Postgres / Storage / Edge Functions）承載，所有第三方金鑰一律經 Edge Function 代理，永不落地到瀏覽器。

## 功能總覽

- 行程規劃：多日行程、活動卡片、拖曳排序、行前待辦清單、天氣與時區小工具。
- 記帳分帳：逐項分攤、成員結算、收據照片。
- 地圖檢視：Google Maps 品牌樣式地圖、編號標記、依道路的路線（Directions）、一鍵開啟導航。
- 保管箱：證件與訂房等文件上傳、資料夾管理、與行程雙向連結、垃圾桶還原。
- 靈感（心願盒）與探索：機票／住宿等外部搜尋入口。
- PDF 旅遊書：雜誌式排版，隨行程生命週期切換為回憶錄模式。
- PWA：可安裝、離線快取、iOS 安全區與全螢幕支援。

## 技術棧

- 前端：React 19、TypeScript 5.9、Vite（`rolldown-vite`）、Tailwind（CDN）+ tailwindcss-animate
- 資料與後端：Supabase（Auth、Postgres + RLS、Storage、Edge Functions / Deno）
- 地圖：Google Maps JS API、Geocoding、Directions、`@vis.gl/react-google-maps`
- 其他：`@react-pdf/renderer`（動態載入）、`@hello-pangea/dnd`、`lucide-react`

## 架構重點

- **金鑰代理（ai-proxy）**：所有 AI 與外部 API 呼叫集中在單一 Edge Function（`supabase/functions/ai-proxy`），動作含 `gemini-text`、`gemini-vision`、`weather`、`timezone`、`geocode`、`directions`。金鑰只存在 Supabase Secrets，前端拿不到；亦方便日後抽換 LLM 供應商。
- **成本控制**：全域快取表（`cached_locations`、`cached_routes`）避免重複計費，並以 `geocode_usage` 做每人每日上限。
- **資料模型**：行程以 JSONB 存於 `trips.trip_data`；圖片存 Storage 路徑並以 signed URL 顯示，DB 不寫入暫時網址。
- **安全**：所有資料表啟用 RLS；快取／用量表僅 service-role（Edge Function）可存取。前端無任何長效金鑰。
- **韌性**：全域 Error Boundary、全域 Toast 提示與確認對話框、離線 Service Worker 快取。

## 專案結構

```
src/
  components/        共用元件（Toast、ConfirmDialog、ErrorBoundary、pdf/、common/）
  views/             主畫面（TripsView、ItineraryView、ExploreView、ToolsView、VaultView…）
  services/          資料與 API 存取（supabase、gemini、geo、storage、timeline）
  db-types.ts        Supabase 資料列型別（snake_case，與 UI 模型分離）
  types.ts           前端資料模型
supabase/
  functions/ai-proxy 金鑰代理 Edge Function
public/
  icons/             PWA 圖示、apple-touch-icon
  service-worker.js  離線快取
```

## 開始開發

### 需求

- Node.js 20+（開發環境為 22）
- 一個 Supabase 專案、一組 Google Maps 平台金鑰

### 安裝與啟動

```bash
npm install
npm run dev        # 本機開發（Vite）
```

### 前端環境變數（`.env`）

| 變數 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 專案 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key（受 RLS 保護） |
| `VITE_GOOGLE_MAPS_KEY` | Maps JS API 金鑰（請設 HTTP referrer 限制） |
| `VITE_GOOGLE_MAP_ID` | 向量地圖 Map ID（AdvancedMarker + 品牌樣式） |

> 這些是可公開的前端金鑰；請務必在 Google Cloud 對 Maps 金鑰設定 referrer 限制。計費型的 Geocoding／Directions／Gemini 金鑰不放前端，見下方伺服端設定。

## Supabase 設定

### 資料表（皆啟用 RLS）

- `trips`：行程本體（`trip_data` JSONB）
- `vault_folders`、`vault_files`：保管箱資料夾與檔案
- `cached_locations`、`cached_routes`：地理編碼／路線全域快取（僅 service-role）
- `geocode_usage`：每人每日用量上限（僅 service-role）

一般資料表的 RLS 政策以 `user_id` 綁定使用者；快取與用量表不開放前端政策，只由 Edge Function 以 service-role 存取。

### Storage buckets

- `trip-media`：行程封面與記帳照片
- `vault`：保管箱文件

### Edge Function 與 Secrets

金鑰以 Supabase Secrets 設定（`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 由平台自動注入）：

| Secret | 用途 |
| --- | --- |
| `GEMINI_KEY` | Gemini 文字／視覺 |
| `GOOGLE_GEOCODING_KEY` | Geocoding 與 Directions |
| `WEATHER_KEY` | 天氣查詢 |

```bash
supabase secrets set GEMINI_KEY=... GOOGLE_GEOCODING_KEY=... WEATHER_KEY=...
supabase functions deploy ai-proxy
```

## 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 本機開發伺服器 |
| `npm run build` | 型別檢查（`tsc -b`）並打包 |
| `npm run preview` | 預覽打包結果 |
| `npm run lint` | ESLint |

## 部署

前端可部署至 Vercel 等平台（於平台設定上述 `VITE_*` 環境變數）；後端資料庫、Storage 與 `ai-proxy` Edge Function 由 Supabase 承載。部署前請確認 Maps 金鑰 referrer 白名單已包含正式網域。
