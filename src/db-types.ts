// src/db-types.ts
// 🧱 3.2 型別收斂：Supabase 資料列（snake_case）的形狀。
// 目的：把「資料庫結構」與前端 UI 模型（types.ts，camelCase）分離，
//       讓 fetch 邊界有明確型別，取代散落的 `any`。
import type { Trip } from './types';

/** trips 資料表：行程本體以 JSONB 存在 trip_data */
export interface TripRow {
    id: string;
    user_id?: string;
    trip_data: Trip;
    updated_at?: string;
    created_at?: string;
}

/** vault_folders 資料表 */
export interface VaultFolderRow {
    id: string;
    user_id?: string;
    name: string;
    parent_id: string | null;
    is_pinned: boolean;
    is_deleted: boolean;
    created_at?: string;
}

/** wish_items 資料表（心願盒收藏） */
export interface WishItemRow {
    id: string;
    user_id?: string;
    type: string;
    title: string;
    note: string | null;              // 對應前端 WishItem.notes
    country: string | null;
    city: string | null;              // 🧱 C1-1 城市
    area: string | null;
    lat: number | null;
    lng: number | null;
    place_id: string | null;
    needs_location_confirm: boolean | null;   // 🧭 T1 弱信心座標待確認
    is_favorite: boolean | null;
    is_purchased: boolean | null;
    preferred_slot: string | null;
    url: string | null;
    custom_image_path: string | null; // 對應前端 WishItem.customImage
    budget: number | null;
    currency: string | null;
    tags: string[] | null;
    created_at: string;
}

/** vault_files 資料表 */
export interface VaultFileRow {
    id: string;
    user_id?: string;
    name: string;
    type: string;
    size: string;
    parent_id: string | null;
    file_path: string;
    is_deleted: boolean;
    is_pinned: boolean;
    category?: string;
    document_number?: string;
    notes?: string;
    created_at: string;
}
