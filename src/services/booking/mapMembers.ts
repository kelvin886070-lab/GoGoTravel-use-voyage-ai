// src/services/booking/mapMembers.ts
// 確認步驟轉換之二：把票面乘客對應到 trip 成員。
// LLM 不知道成員，只吐票面姓名；這裡先「提議」自動配對供確認表預填，最終由使用者拍板。
import type { RawPassenger, PaxTicket, PaxType } from '../../types/booking';

export interface MemberLite { id: string; name: string; }

const TITLES = /^(MR|MRS|MS|MISS|MSTR|MASTER|DR|CHD|INF|MSTER)\.?$/i;

// 正規化姓名以利比對：去頭銜、去標點、大寫、token 排序（解「姓在前 vs 名在前」）。
export function normalizeName(s: string): string {
    return (s || '')
        .toUpperCase().replace(/[.,]/g, ' ')
        .split(/\s+/).filter(t => t && !TITLES.test(t))
        .sort().join(' ').trim();
}

// 兒童判定：台灣航空慣例成年女性用 MS/MRS、女童用 MISS；男童用 MSTR/MASTER。
// 故 MISS/MSTR/MASTER/CHD/INF → 視為兒童（初判）。仍屬啟發式，最終應由確認表讓使用者切換。
export function isChildFromTitle(title?: string | null): boolean {
    const t = (title || '').toUpperCase().replace(/\./g, '').trim();
    return t === 'MISS' || t === 'MSTR' || t === 'MSTER' || t === 'MASTER' || t === 'CHD' || t === 'INF';
}

// 稱謂→照顧身分初判：INF＝嬰兒、MISS/MSTR…＝小朋友，其餘大人（長輩無法從稱謂判）。
export function paxFromTitle(title?: string | null): PaxType {
    const t = (title || '').toUpperCase().replace(/\./g, '').trim();
    if (t === 'INF' || t === 'INFANT') return 'infant';
    if (t === 'MISS' || t === 'MSTR' || t === 'MSTER' || t === 'MASTER' || t === 'CHD') return 'child';
    return 'adult';
}

// 提議 passenger index → memberId（無把握給 null）。只做「正規化後完全相等」的保守配對，避免亂配。
export function proposeMemberMap(
    passengers: RawPassenger[], members: MemberLite[],
): Record<number, string | null> {
    const byNorm = new Map<string, string>();
    for (const m of members) {
        const key = normalizeName(m.name);
        if (key && !byNorm.has(key)) byNorm.set(key, m.id);
    }
    const map: Record<number, string | null> = {};
    passengers.forEach((p, i) => {
        map[i] = byNorm.get(normalizeName(p.fullName)) ?? null;
    });
    return map;
}

// 依（使用者確認過的）memberMap 組出 PaxTicket。memberId 可為 null（非同團仍存姓名）。
export function buildPaxTickets(
    passengers: RawPassenger[], memberMap: Record<number, string | null>,
): PaxTicket[] {
    return passengers.map((p, i) => ({
        memberId: memberMap[i] ?? null,
        fullName: p.fullName,
        isChild: isChildFromTitle(p.title),
        perSegment: p.perSegment.map(ps => ({
            segIndex: ps.segIndex, checkedKg: ps.checkedKg, seat: ps.seat,
        })),
    }));
}
