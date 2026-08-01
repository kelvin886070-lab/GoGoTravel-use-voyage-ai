// src/dev/storageOrphans.ts
// 🧹 Storage 孤兒檔清理工具（DEV console 專用；正式 bundle 不含——App 只在 import.meta.env.DEV 掛 window hook）。
//   背景：兩輪失敗遷移（saveTripToCloud user-null 靜默吞存檔）在 trip-media 桶累積了未被引用的檔案；
//   另外每次換頭貼/換封面的舊檔也可能殘留。
//   原理：全引用路徑集合（trips 全量含垃圾桶 + profiles 頭貼 + wish_items/wish_lists 任何 Storage 路徑欄，
//   一律連影子縮圖 _t.jpg 一起納入）vs 桶內使用者資料夾全檔清單 → 差集＝孤兒。
//   安全設計：預設 dry-run 只列不刪；`__storageOrphans(true)` 才真刪；只動 trip-media 桶、只動自己資料夾
//   （vault 桶完全不碰——證件文件由 vault_files 表管理，不在此工具射程內）。
//   使用：npm run dev → 登入 → Console：`await __storageOrphans()` 看清單 → 確認後 `await __storageOrphans(true)`。
import { supabase } from '../services/supabase';
import { thumbPathOf, isStoragePath } from '../services/storage';
import type { Trip } from '../types';

const BUCKET = 'trip-media';

export async function runStorageOrphans(remove = false): Promise<{ total: number; orphans: string[] } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { console.log('未登入'); return null; }

    // ── 1) 蒐集全引用路徑（含影子縮圖） ──
    const refs = new Set<string>();
    const addRef = (p?: string | null) => {
        if (p && isStoragePath(p)) { refs.add(p); refs.add(thumbPathOf(p)); }
    };

    const { data: tripRows, error: tripErr } = await supabase.from('trips').select('trip_data');
    if (tripErr) { console.error('trips 讀取失敗（中止，不做不完整差集）', tripErr); return null; }
    for (const row of (tripRows || []) as Array<{ trip_data: Trip }>) {
        const t = row.trip_data;
        addRef(t.coverImagePath);
        (t.memoryPhotoPaths || []).forEach(addRef);
        t.days?.forEach(d => d.activities?.forEach(a => { addRef(a.expenseImagePath); addRef(a.imagePath); }));
    }

    const { data: prof } = await supabase.from('profiles').select('avatar_path').eq('user_id', user.id).maybeSingle();
    addRef((prof?.avatar_path as string) || null);

    // wish_items / wish_lists：欄位名不硬編——掃列內所有字串值，長得像 Storage 路徑就納入（未來加欄位也不漏）
    for (const table of ['wish_items', 'wish_lists'] as const) {
        const { data: rows, error } = await supabase.from(table).select('*');
        if (error) { console.error(`${table} 讀取失敗（中止，不做不完整差集）`, error); return null; }
        for (const row of (rows || []) as Array<Record<string, unknown>>) {
            for (const v of Object.values(row)) {
                if (typeof v === 'string') addRef(v);
            }
        }
    }

    // ── 2) 桶內清單（自己資料夾，分頁撈全） ──
    const files: string[] = [];
    for (let offset = 0; ; offset += 100) {
        const { data: page, error } = await supabase.storage.from(BUCKET).list(user.id, { limit: 100, offset });
        if (error) { console.error('Storage 列表失敗（中止）', error); return null; }
        if (!page || page.length === 0) break;
        for (const f of page) files.push(`${user.id}/${f.name}`);
        if (page.length < 100) break;
    }

    // ── 3) 差集＋（選）刪除 ──
    const orphans = files.filter(p => !refs.has(p));
    console.log(`🧹 trip-media：桶內 ${files.length} 檔｜引用 ${refs.size} 路徑｜孤兒 ${orphans.length} 檔`);
    if (orphans.length) console.table(orphans);
    if (remove && orphans.length) {
        const { error } = await supabase.storage.from(BUCKET).remove(orphans);
        console.log(error ? `刪除失敗：${error.message}` : `✅ 已刪除 ${orphans.length} 個孤兒檔`);
    } else if (orphans.length) {
        console.log('（dry-run）確認上表無誤後，執行 await __storageOrphans(true) 真刪。');
    }
    return { total: files.length, orphans };
}
