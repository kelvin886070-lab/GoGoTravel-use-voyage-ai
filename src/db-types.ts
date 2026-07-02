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
