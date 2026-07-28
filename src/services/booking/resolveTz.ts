// src/services/booking/resolveTz.ts
// 確認步驟轉換之一：把 RawExtraction 的「當地牆上時間 + IATA」解成 UTC 絕對時刻。
// 不依賴外部時區庫、不存固定偏移——用內建 Intl 在「那個日期」即時算偏移，DST 安全。
import type { RawExtraction, FlightSegment, ISODateTime, LocalDateTime } from '../../types/booking';
import { iataZone } from './iataTz';

// 某 IANA 時區在某 UTC 瞬間的偏移（毫秒）。用 Intl 反推。
function offsetMsAt(utcMs: number, zone: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
    const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asIfUtc - utcMs;
}

// 解析「YYYY-MM-DD HH:mm」；也寬容接受 12 小時「HH:mm AM/PM」。回 [Y,Mo,D,h,mi] 或 null。
function parseLocalParts(local: LocalDateTime): [number, number, number, number, number] | null {
    const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T]+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = +m[4];
    const ampm = m[6]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    if (h > 23 || +m[5] > 59) return null;
    return [+m[1], +m[2], +m[3], h, +m[5]];
}

// 當地時間 + IANA 時區 → UTC ISO 字串。DST 邊界用兩趟收斂。
export function localToUtc(local: LocalDateTime, zone: string): ISODateTime | null {
    const parts = parseLocalParts(local);
    if (!parts) return null;
    const [Y, Mo, D, h, mi] = parts;
    const naiveUtc = Date.UTC(Y, Mo - 1, D, h, mi);
    const off1 = offsetMsAt(naiveUtc, zone);
    const guess = naiveUtc - off1;
    const off2 = offsetMsAt(guess, zone);           // DST 交界時 off1≠off2，第二趟修正
    const utcMs = naiveUtc - off2;
    const d = new Date(utcMs);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface ResolvedSegments { segments: FlightSegment[]; warnings: string[]; }

// 逐段解析；任何欄位缺或解不出 → 該段丟 warning、不納入（寧缺勿錯，交確認表補）。
export function resolveSegments(raw: RawExtraction): ResolvedSegments {
    const segments: FlightSegment[] = [];
    const warnings: string[] = [];
    raw.segments.forEach((s, i) => {
        const tag = `第 ${i + 1} 段`;
        if (!s.flightNo || !s.fromIata || !s.toIata || !s.depLocal || !s.arrLocal) {
            warnings.push(`${tag}：欄位不完整，略過`); return;
        }
        const depZone = iataZone(s.fromIata), arrZone = iataZone(s.toIata);
        if (!depZone) { warnings.push(`${tag}：出發機場 ${s.fromIata} 查無時區，需手選`); return; }
        if (!arrZone) { warnings.push(`${tag}：抵達機場 ${s.toIata} 查無時區，需手選`); return; }
        const depAtUtc = localToUtc(s.depLocal, depZone);
        const arrAtUtc = localToUtc(s.arrLocal, arrZone);
        if (!depAtUtc) { warnings.push(`${tag}：出發時間「${s.depLocal}」格式無法解析`); return; }
        if (!arrAtUtc) { warnings.push(`${tag}：抵達時間「${s.arrLocal}」格式無法解析`); return; }
        segments.push({
            flightNo: s.flightNo, fromIata: s.fromIata.toUpperCase(), toIata: s.toIata.toUpperCase(),
            depLocal: s.depLocal, depAtUtc, arrLocal: s.arrLocal, arrAtUtc,
        });
    });
    return { segments, warnings };
}
