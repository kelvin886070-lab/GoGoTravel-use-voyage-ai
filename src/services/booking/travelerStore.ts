// src/services/booking/travelerStore.ts
// 「我的旅伴」CRUD（使用者層級，RLS 綁 user_id）。跨行程重用的單一真相。
import { supabase } from '../supabase';
import type { Traveler } from '../../types/booking';

interface TravelerRow {
    id: string;
    user_id?: string;
    legal_name: string;
    nickname: string | null;
    pax_type: 'adult' | 'infant' | 'child' | 'senior' | null;
    aliases: string[] | null;
    is_self: boolean;
    created_at: string;
}

const rowTo = (r: TravelerRow): Traveler => ({
    id: r.id, userId: r.user_id ?? '', legalName: r.legal_name,
    nickname: r.nickname ?? undefined, paxType: r.pax_type ?? 'adult', aliases: r.aliases ?? [],
    isSelf: r.is_self, createdAt: r.created_at,
});
const toRow = (t: Traveler): Record<string, unknown> => ({
    id: t.id, user_id: t.userId, legal_name: t.legalName,
    nickname: t.nickname ?? null, pax_type: t.paxType ?? 'adult', aliases: t.aliases ?? [],
    is_self: !!t.isSelf, created_at: t.createdAt,
});

export async function fetchTravelers(): Promise<Traveler[]> {
    const { data, error } = await supabase.from('travelers').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(`讀取旅伴失敗：${error.message}`);
    return (data as TravelerRow[] ?? []).map(rowTo);
}

export async function upsertTraveler(t: Traveler): Promise<void> {
    const { error } = await supabase.from('travelers').upsert(toRow(t));
    if (error) throw new Error(`旅伴儲存失敗：${error.message}`);
}

export async function deleteTraveler(id: string): Promise<void> {
    const { error } = await supabase.from('travelers').delete().eq('id', id);
    if (error) throw new Error(`旅伴刪除失敗：${error.message}`);
}
