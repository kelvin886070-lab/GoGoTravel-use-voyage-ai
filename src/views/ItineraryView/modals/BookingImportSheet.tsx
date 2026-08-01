// src/views/ItineraryView/modals/BookingImportSheet.tsx
// 🎟️ 訂位匯入核對表：貼上文字／上傳截圖 → 抽取 → 核對（航段/旅伴/費用）→ buildFlightBooking → 回傳。
// 元件自足：不直接寫 DB，產出 FlightBooking 交父層 upsert（單一真相仍在 bookings 表）。
import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Plane, ArrowRight, CircleCheck, Lock, Bookmark, Check, AlertTriangle, Upload, Stamp, Sparkles, UserCheck, ChevronDown, ChevronUp, User, Users, BedDouble, Trash2 } from 'lucide-react';
import type { Trip } from '../../../types';
import type { RawExtraction, RawPassenger, StoredBooking, Traveler, PaxType } from '../../../types/booking';
import { parseBookingFromText, parseBookingFromImage } from '../../../services/gemini';
import { buildFlightBooking, buildHotelBookings } from '../../../services/booking/buildBooking';
import { paxFromTitle, normalizeName } from '../../../services/booking/mapMembers';
import { extractPdfText, hasUsableText } from '../../../services/booking/pdfText';
import { uploadBookingFile } from '../../../services/booking/bookingFile';

const INK = '#232320', PAPER = '#F6F1E7', GREEN = '#3F6B52', MUTE = '#8A8266', BORDER = '#E0D8C6', STAMP = '#A23B2E';

// 照顧標籤選取時的溫暖微文案（承諾＝之後提醒卡要交付的規格）
const CARE_COPY: Record<'infant' | 'child' | 'senior', string> = {
    infant: '已選嬰兒！我們會自動幫您把關兒童證件、監護同行與嬰幼兒用品（推車／奶粉／尿布），讓旅程更安心。',
    child: '已選小朋友！我們會自動幫您把關兒童證件、小兒常備藥與隨身安撫零食，讓旅程更安心。',
    senior: '已選長輩！我們會自動幫您把關必帶藥品、醫療防護與行動輔助／護具，讓旅程更安心。',
};
const CARE_LABEL: Record<'infant' | 'child' | 'senior', string> = { infant: '嬰兒', child: '小朋友', senior: '長輩' };
const CARE_STYLE: Record<'infant' | 'child' | 'senior', { bg: string; fg: string; bd: string }> = {
    infant: { bg: '#F7E7EC', fg: '#8a4a5a', bd: '#e6c6cf' },
    child: { bg: '#F3E7DF', fg: '#8a4230', bd: '#e2c3b4' },
    senior: { bg: '#EFE7D6', fg: '#7a5a1f', bd: '#ddcfac' },
};
// 抽取 loading 的通用溫暖品牌標語（此時尚不知標籤，故通用；標籤專屬話留給匯入後確認）
const LOADING_LINES = ['帶寶貝出門不容易，交給 Kelvin Trip', '親子整理，交給我們就好', '讓準備變簡單，你只管期待出發'];

interface Props {
    open: boolean;
    trip: Trip;
    userId: string;
    viewBooking?: StoredBooking | null;   // 有值＝唯讀檢視已匯入訂位；無值＝匯入流程
    travelers?: Traveler[];               // 🧑‍🤝‍🧑 我的旅伴（供下拉挑選/比對）
    onCreateTraveler?: (legalName: string, paxType?: PaxType) => Promise<Traveler>;
    onUpdateTraveler?: (id: string, patch: Partial<Traveler>) => void;
    onDelete?: (id: string) => void;      // 刪除這筆訂位
    onClose: () => void;
    onImported: (booking: StoredBooking) => void;
}

type Step = 'input' | 'loading' | 'confirm' | 'view';

export const BookingImportSheet: React.FC<Props> = ({ open, trip, userId, viewBooking, travelers = [], onCreateTraveler, onUpdateTraveler, onDelete, onClose, onImported }) => {
    const [step, setStep] = useState<Step>('input');
    const [text, setText] = useState('');
    const [raw, setRaw] = useState<RawExtraction | null>(null);
    const [memberMap, setMemberMap] = useState<Record<number, string | null>>({});
    const [err, setErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [filePath, setFilePath] = useState<string | undefined>();        // 保管箱路徑
    const [source, setSource] = useState<'paste' | 'upload'>('paste');
    const [renameFor, setRenameFor] = useState<number | null>(null);       // 正在取暱稱的列
    const [renameText, setRenameText] = useState('');
    const [lineIdx, setLineIdx] = useState(0);                              // loading 品牌標語輪播
    const [pickerRow, setPickerRow] = useState<number | null>(null);       // 展開「已記錄旅伴」的列
    const [confirmDel, setConfirmDel] = useState(false);                   // 刪除二次確認
    const [removedHotels, setRemovedHotels] = useState<Set<number>>(new Set());  // 匯入前移除的飯店 index

    const selfTraveler = travelers.find(t => t.isSelf);

    const reset = () => { setStep('input'); setText(''); setRaw(null); setMemberMap({}); setErr(null); setFilePath(undefined); setSource('paste'); setRenameFor(null); setPickerRow(null); setRemovedHotels(new Set()); };
    const close = () => { reset(); onClose(); };

    // 開啟時決定進「檢視」還是「匯入」
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 開窗重置＝事件語意（一次性），非串聯渲染
        setStep(viewBooking ? 'view' : 'input');
        setErr(null);
        setConfirmDel(false);
    }, [open, viewBooking]);

    // 抽取 loading 時輪播通用品牌標語
    useEffect(() => {
        if (step !== 'loading') return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 輪播歸零＝事件語意
        setLineIdx(0);
        const t = setInterval(() => setLineIdx(x => (x + 1) % LOADING_LINES.length), 1600);
        return () => clearInterval(t);
    }, [step]);


    const runExtract = async (fn: () => Promise<RawExtraction>) => {
        setErr(null); setStep('loading');
        try {
            const r = await fn();
            setRaw(r);
            // 依票面名/別名比對已存旅伴（本人後蓋、優先）
            const byNorm = new Map<string, string>();
            const add = (t: Traveler) => { for (const n of [t.legalName, ...(t.aliases ?? [])]) { const k = normalizeName(n); if (k) byNorm.set(k, t.id); } };
            travelers.filter(t => !t.isSelf).forEach(add);
            travelers.filter(t => t.isSelf).forEach(add);
            const proposed: Record<number, string | null> = {};
            r.passengers.forEach((p, i) => { proposed[i] = byNorm.get(normalizeName(p.fullName)) ?? null; });
            setMemberMap(proposed);
            setStep('confirm');
        } catch (e) {
            setErr(e instanceof Error ? e.message : '讀取失敗，再試一次');
            setStep('input');
        }
    };

    // 上傳檔案：PDF 走隔離抽字→文字解析；圖走視覺。同時把原始檔存進保管箱（best-effort）。
    const onPickFile = async (file: File) => {
        setErr(null);
        setSource('upload');
        uploadBookingFile(file).then(setFilePath).catch(e => console.warn('保管箱上傳失敗', e));
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            setStep('loading');
            let pdfText = '';
            try { pdfText = await extractPdfText(file); }
            catch { setErr('讀取 PDF 失敗，改用貼上或截圖'); setStep('input'); return; }
            if (!hasUsableText(pdfText)) { setErr('這份 PDF 像是掃描檔、抓不到文字。先改用截圖，或直接貼上信件內文。'); setStep('input'); return; }
            await runExtract(() => parseBookingFromText(pdfText));
        } else if (file.type.startsWith('image/')) {
            const b64 = await new Promise<string>((res) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result).split(',')[1] || '');
                r.readAsDataURL(file);
            });
            await runExtract(() => parseBookingFromImage(b64));
        } else {
            setErr('請上傳 PDF 或圖片檔');
        }
    };

    const confirmImport = async () => {
        if (!raw) return;
        const ctxBuild = { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()), userId, source, fileUrl: filePath };
        // 訂房：多間各建一筆（移除的不建）；無旅伴對應
        if (raw.kind === 'hotel') {
            setSaving(true);
            const keptHotels = raw.hotels.filter((_, i) => !removedHotels.has(i));
            const hr = buildHotelBookings({ raw: { ...raw, hotels: keptHotels }, tripId: trip.id, memberMap: {} }, ctxBuild);
            setSaving(false);
            if (hr.bookings.length === 0) { setErr(hr.errors.join('；') || '無法建立訂房'); return; }
            hr.bookings.forEach(b => onImported(b));
            close();
            return;
        }
        setSaving(true);
        // 還沒對應到旅伴的乘客 → 自動建成旅伴（實現「會存進我的旅伴」＋跨行程重用）
        const finalMap: Record<number, string | null> = { ...memberMap };
        if (onCreateTraveler) {
            for (let i = 0; i < raw.passengers.length; i++) {
                if (!finalMap[i]) {
                    const p = raw.passengers[i];
                    const t = await onCreateTraveler(p.fullName, paxFromTitle(p.title));
                    finalMap[i] = t.id;
                }
            }
        }
        const res = buildFlightBooking({ raw, tripId: trip.id, memberMap: finalMap }, ctxBuild);
        setSaving(false);
        if (!res.booking) { setErr(res.errors.join('；') || '無法建立訂位'); return; }
        // 兒童以旅伴為準（跨行程、不受 LLM 稱謂變動影響）
        res.booking.passengers = res.booking.passengers.map((pt, i) => {
            const tv = travelers.find(t => t.id === finalMap[i]);
            return tv ? { ...pt, isChild: tv.paxType === 'child' } : pt;
        });
        onImported(res.booking);
        close();
    };

    // 下拉「這是誰」：選旅伴 / 我 / 新增這位為旅伴
    const travelerOf = (i: number) => travelers.find(t => t.id === memberMap[i]);
    // 照顧身分：已配對以旅伴為準，否則票面稱謂初判（長輩無法從稱謂判）
    const displayPax = (i: number, p: RawPassenger): PaxType => travelerOf(i)?.paxType ?? paxFromTitle(p.title);
    const ensureTravelerId = async (i: number, p: RawPassenger): Promise<string | undefined> => {
        if (memberMap[i]) return memberMap[i]!;
        if (!onCreateTraveler) return undefined;
        const t = await onCreateTraveler(p.fullName, paxFromTitle(p.title));
        setMemberMap(m => ({ ...m, [i]: t.id }));
        return t.id;
    };
    // 點照顧標：同標再點取消回大人；三標互斥
    const setPax = async (i: number, p: RawPassenger, tag: 'infant' | 'child' | 'senior') => {
        const next: PaxType = displayPax(i, p) === tag ? 'adult' : tag;
        const id = await ensureTravelerId(i, p);
        if (id) onUpdateTraveler?.(id, { paxType: next });
    };
    const isMe = (i: number) => !!selfTraveler && memberMap[i] === selfTraveler.id;
    const toggleMe = async (i: number, p: RawPassenger) => {
        if (isMe(i)) { setMemberMap(m => ({ ...m, [i]: null })); return; }
        if (!selfTraveler) return;
        setMemberMap(m => ({ ...m, [i]: selfTraveler.id }));
        const nm = p.fullName;   // 把票面名記進本人別名，下次匯入自動認得「我」
        if (selfTraveler.legalName !== nm && !(selfTraveler.aliases ?? []).includes(nm)) {
            onUpdateTraveler?.(selfTraveler.id, { aliases: [...(selfTraveler.aliases ?? []), nm] });
        }
    };
    const startEdit = (i: number) => { setRenameFor(i); setPickerRow(null); setRenameText(isMe(i) ? '' : (travelerOf(i)?.nickname ?? '')); };
    const pickRecorded = (i: number, t: Traveler) => { setMemberMap(m => ({ ...m, [i]: t.id })); setRenameText(t.nickname ?? ''); setPickerRow(null); };
    const commitRename = async (i: number, p: RawPassenger) => {
        if (!isMe(i)) { const id = await ensureTravelerId(i, p); if (id) onUpdateTraveler?.(id, { nickname: renameText.trim() || undefined }); }
        setRenameFor(null);
    };

    const warnings = raw?.warnings ?? [];
    const hotelKeptCount = raw?.kind === 'hotel' ? raw.hotels.filter((_, i) => !removedHotels.has(i)).length : 0;
    const segLabel = useMemo(() => {
        if (!raw || raw.segments.length === 0) return '';
        const a = raw.segments[0], b = raw.segments[raw.segments.length - 1];
        return `${a.fromIata ?? '?'} ⇄ ${a.toIata ?? '?'} · ${(a.depLocal ?? '').slice(5, 10)}${b.arrLocal ? '–' + b.arrLocal.slice(5, 10) : ''}`;
    }, [raw]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={close}>
            <div className="absolute inset-0 bg-black/30" />
            <div onClick={e => e.stopPropagation()} className="relative w-full max-w-md rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-4"
                style={{ background: PAPER, border: `0.5px solid ${BORDER}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: INK }}>
                    <span className="font-mono text-[10px] tracking-[2px]" style={{ color: '#C9B98F' }}>REVIEW BOOKING</span>
                    <div className="flex items-center gap-3.5">
                        {step === 'view' && viewBooking && onDelete && (
                            <button onClick={() => setConfirmDel(true)} aria-label="刪除這筆訂位"><Trash2 className="w-4 h-4" style={{ color: '#e0a99b' }} /></button>
                        )}
                        <button onClick={close} aria-label="關閉"><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} /></button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4" style={{ flex: 1 }}>
                    {step === 'input' && (
                        <div>
                            <div className="font-serif text-[18px]" style={{ color: INK }}>匯入確認信</div>
                            <div className="text-[12px] mt-1" style={{ color: MUTE }}>上傳機票或訂房的確認信檔案（PDF 最準），或把內文貼進來。原始檔會收進保管箱。</div>
                            <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="也可以把確認信的內容貼在這裡…"
                                className="w-full mt-3 rounded-xl p-3 text-[13px] outline-none" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}`, color: INK, resize: 'none' }} />
                            {err && <div className="text-[12px] mt-2" style={{ color: STAMP }}>{err}</div>}
                            <div className="flex gap-2 mt-3">
                                <label className="flex-1 py-2.5 rounded-lg text-[12.5px] font-medium text-center cursor-pointer flex items-center justify-center gap-1.5" style={{ background: INK, color: PAPER }}>
                                    <Upload className="w-4 h-4" />上傳檔案
                                    <input type="file" accept="application/pdf,image/*" hidden onChange={e => e.target.files?.[0] && onPickFile(e.target.files[0])} />
                                </label>
                                <button disabled={!text.trim()} onClick={() => { setSource('paste'); runExtract(() => parseBookingFromText(text)); }}
                                    className="flex-1 py-2.5 rounded-lg text-[12.5px] font-medium disabled:opacity-40" style={{ border: `1px solid ${INK}`, color: INK }}>讀貼上的內文</button>
                            </div>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="py-16 flex flex-col items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: GREEN }} />
                            <div className="font-serif text-[14px] text-center px-6 transition-opacity" style={{ color: INK }}>{LOADING_LINES[lineIdx]}</div>
                            <div className="font-mono text-[10px]" style={{ color: MUTE }}>正在讀這封信…</div>
                        </div>
                    )}

                    {step === 'confirm' && raw && raw.kind !== 'hotel' && (
                        <div>
                            <div className="font-serif text-[18px]" style={{ color: INK }}>核對這筆訂位</div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: '#E7EFE9', color: '#2f5340' }}><Plane className="w-3 h-3" />機票</span>
                                <span className="font-serif text-[14px]" style={{ color: INK }}>{raw.provider ?? '航空公司'}</span>
                                <span className="font-mono text-[10px] ml-auto" style={{ color: GREEN }}>{segLabel}</span>
                            </div>

                            {warnings.length > 0 && (
                                <div className="mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: '#FBF3E4', border: '1px solid #EAD9B5' }}>
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#A0741A' }} />
                                    <div className="text-[11.5px]" style={{ color: '#7d5a12' }}>{warnings.slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}</div>
                                </div>
                            )}

                            <div className="mt-3 rounded-xl p-3" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                {raw.segments.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 py-0.5" style={i > 0 ? { borderTop: `0.5px dashed #D6CDB8`, paddingTop: 6, marginTop: 6 } : undefined}>
                                        <span className="font-mono text-[10px]" style={{ color: GREEN }}>{s.flightNo ?? '—'}</span>
                                        <span className="font-serif text-[15px]" style={{ color: INK }}>{s.fromIata ?? '?'}</span>
                                        <span className="font-mono text-[11px]" style={{ color: INK }}>{(s.depLocal ?? '').slice(11)}</span>
                                        <ArrowRight className="w-3.5 h-3.5" style={{ color: MUTE }} />
                                        <span className="font-serif text-[15px]" style={{ color: INK }}>{s.toIata ?? '?'}</span>
                                        <span className="font-mono text-[11px]" style={{ color: INK }}>{(s.arrLocal ?? '').slice(11)}</span>
                                    </div>
                                ))}
                                <div className="flex items-center gap-1.5 mt-2">
                                    <CircleCheck className="w-3.5 h-3.5" style={{ color: GREEN }} />
                                    <span className="text-[10.5px]" style={{ color: MUTE }}>時間是當地時間，匯入時幫你對好時區</span>
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-baseline justify-between">
                                    <span className="font-serif text-[15px]" style={{ color: INK }}>這趟的旅伴</span>
                                    <span className="text-[11px]" style={{ color: MUTE }}>{raw.passengers.length} 位</span>
                                </div>
                                {raw.passengers.map((p, i) => {
                                    const pax = displayPax(i, p);
                                    const care = pax !== 'adult' ? (pax as 'infant' | 'child' | 'senior') : null;
                                    const me = isMe(i);
                                    const nn = travelerOf(i)?.nickname;
                                    const editing = renameFor === i;
                                    const bag = p.perSegment.map((ps, k) => `${k === 0 ? '去' : '回'} ${ps.checkedKg != null ? ps.checkedKg + 'kg' : '無託運'}·${ps.seat ?? '—'}`).join('　');
                                    const chipStyle = me || nn
                                        ? { background: '#E7EFE9', color: '#2f5340', border: '1px solid #B9D2C4' }
                                        : { background: 'transparent', color: MUTE, border: `1px dashed #C9BFA6` };
                                    const someoneIsMe = !!selfTraveler && Object.values(memberMap).includes(selfTraveler.id);
                                    const recorded = travelers.filter(t => !t.isSelf);
                                    return (
                                        <div key={i} style={{ borderTop: `0.5px solid #ECE4D4` }}>
                                            {/* 英文名整條——編輯時也留著 */}
                                            <div className="flex items-center gap-2 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-serif text-[14px] truncate" style={{ color: INK, letterSpacing: 0.3 }}>{p.fullName}
                                                        {care && <span className="ml-1.5 rounded px-1.5 text-[9.5px]" style={{ background: CARE_STYLE[care].bg, color: CARE_STYLE[care].fg }}>{CARE_LABEL[care]}</span>}
                                                    </div>
                                                    <div className="font-mono text-[9px]" style={{ color: MUTE }}>{bag}</div>
                                                </div>
                                                <button onClick={() => (editing ? commitRename(i, p) : startEdit(i))} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium shrink-0" style={editing ? { background: INK, color: PAPER } : chipStyle}>
                                                    {me && !editing && <UserCheck className="w-3.5 h-3.5" />}{editing ? '完成' : (me ? '我' : (nn || '暱稱'))}{editing ? <ChevronUp className="w-3.5 h-3.5" style={{ opacity: 0.7 }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ opacity: 0.55 }} />}
                                                </button>
                                            </div>

                                            {/* 編輯器——展開在英文名下方 */}
                                            {editing && (
                                                <div className="mb-2 rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                                    <div className="flex items-center gap-1.5">
                                                        <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitRename(i, p)} placeholder="暱稱" className="text-[14px] rounded-lg px-2.5 py-1.5 outline-none" style={{ width: 72, border: `1px solid ${GREEN}`, color: INK, background: '#fff' }} />
                                                        {recorded.length > 0 && (
                                                            <button onClick={() => setPickerRow(pickerRow === i ? null : i)} aria-label="選已記錄的旅伴" className="rounded-lg p-1.5 shrink-0" style={{ border: `1px solid ${pickerRow === i ? GREEN : BORDER}`, color: pickerRow === i ? GREEN : MUTE }}><Users className="w-4 h-4" /></button>
                                                        )}
                                                        {(['infant', 'child', 'senior'] as const).map(tag => (
                                                            <button key={tag} onClick={() => setPax(i, p, tag)} className="rounded-full px-2.5 py-1 text-[11px] shrink-0" style={pax === tag ? { background: CARE_STYLE[tag].bg, color: CARE_STYLE[tag].fg, border: `1px solid ${CARE_STYLE[tag].bd}`, fontWeight: 500 } : { border: '1px solid #D6CDB8', color: MUTE }}>{CARE_LABEL[tag]}</button>
                                                        ))}
                                                    </div>
                                                    {pickerRow === i && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            <span className="text-[10px] self-center" style={{ color: MUTE }}>記過的：</span>
                                                            {recorded.map(t => (
                                                                <button key={t.id} onClick={() => pickRecorded(i, t)} className="rounded-full px-3 py-1 text-[11.5px]" style={{ border: `1px solid #B9D2C4`, color: '#2f5340', background: '#E7EFE9' }}>{t.nickname || t.legalName}</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {care && (
                                                        <div className="flex items-start gap-1.5 mt-2 rounded-lg px-2.5 py-1.5" style={{ background: '#FBF3E9' }}>
                                                            <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: CARE_STYLE[care].fg }} />
                                                            <span className="text-[10.5px] leading-snug" style={{ color: '#7a5a4a' }}>{CARE_COPY[care]}</span>
                                                        </div>
                                                    )}
                                                    {(!someoneIsMe || me) && (
                                                        <div className="mt-2.5">
                                                            <button onClick={() => toggleMe(i, p)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px]" style={me ? { background: '#E7EFE9', color: '#2f5340', border: '1px solid #B9D2C4', fontWeight: 500 } : { border: '1px solid #D6CDB8', color: MUTE }}><User className="w-3 h-3" />這是我</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-2" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                    <Bookmark className="w-3.5 h-3.5" style={{ color: GREEN }} />
                                    <span className="text-[10.5px]" style={{ color: '#6b6656' }}>會存進「我的旅伴」，下次訂票打開就能選</span>
                                </div>
                            </div>

                            {raw.fare && (
                                <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                    <div><div className="font-mono text-[9px]" style={{ color: MUTE }}>總計金額</div><div className="font-serif text-[18px]" style={{ color: INK }}>{raw.fare.currency} {raw.fare.total.toLocaleString()}</div></div>
                                    {raw.fare.paidBy?.last4 && <div className="text-right"><div className="font-mono text-[9px]" style={{ color: MUTE }}>付款</div><div className="font-mono text-[11px]" style={{ color: INK }}>{raw.fare.paidBy.method} ••{raw.fare.paidBy.last4}</div></div>}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                                <Lock className="w-3 h-3" style={{ color: MUTE }} />
                                <span className="text-[10px]" style={{ color: MUTE }}>原始信件已加密儲存，卡號僅保留末四碼供核對。</span>
                            </div>
                            {err && <div className="text-[12px] mt-2" style={{ color: STAMP }}>{err}</div>}
                        </div>
                    )}

                    {step === 'confirm' && raw && raw.kind === 'hotel' && (() => {
                        const kept = raw.hotels.map((h, i) => ({ h, i })).filter(({ i }) => !removedHotels.has(i));
                        const multi = raw.hotels.length > 1;
                        const total = kept.reduce((s, { h }) => s + (h.fare?.total ?? 0), 0);
                        const cur = kept.find(({ h }) => h.fare?.currency)?.h.fare?.currency ?? raw.fare?.currency ?? 'TWD';
                        return (
                            <div>
                                <div className="font-serif text-[18px]" style={{ color: INK }}>{multi ? '核對這幾筆訂房' : '核對這筆訂房'}</div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: '#F7EEE9', color: '#8a4230' }}><BedDouble className="w-3 h-3" />訂房</span>
                                    {multi && <span className="text-[12px]" style={{ color: MUTE }}>{raw.hotels.length} 間</span>}
                                </div>

                                {warnings.length > 0 && (
                                    <div className="mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: '#FBF3E4', border: '1px solid #EAD9B5' }}>
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#A0741A' }} />
                                        <div className="text-[11.5px]" style={{ color: '#7d5a12' }}>{warnings.slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}</div>
                                    </div>
                                )}

                                {multi && (
                                    <div className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: '#E7EFE9', border: '0.5px solid #B9D2C4' }}>
                                        <CircleCheck className="w-3.5 h-3.5 shrink-0" style={{ color: GREEN }} />
                                        <span className="text-[11.5px]" style={{ color: '#2f5340' }}>這封信有 {raw.hotels.length} 間住宿，已幫你分成 {kept.length} 筆，請確認以下訂房明細。</span>
                                    </div>
                                )}

                                <div className="mt-3 flex flex-col gap-2">
                                    {kept.map(({ h, i }) => (
                                        <div key={i} className="relative rounded-xl p-3" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                            {multi && <button onClick={() => setRemovedHotels(s => { const n = new Set(s); n.add(i); return n; })} aria-label="移除這間" className="absolute top-2 right-2 p-1" style={{ color: '#b3a894' }}><X className="w-4 h-4" /></button>}
                                            <div className="font-serif text-[16px] pr-5" style={{ color: INK }}>{h.property ?? '—'}</div>
                                            <div className="flex items-center gap-2 mt-2 font-mono text-[11px]" style={{ color: INK }}>
                                                <span>入住 {h.checkInLocal?.slice(0, 10) ?? '—'}</span>
                                                <ArrowRight className="w-3.5 h-3.5" style={{ color: MUTE }} />
                                                <span>退房 {h.checkOutLocal?.slice(0, 10) ?? '—'}</span>
                                            </div>
                                            <div className="font-mono text-[9.5px] mt-1.5" style={{ color: MUTE }}>{h.rooms ?? 1} 間 · {h.guests ?? 1} 人{h.address ? ` · ${h.address}` : ''}</div>
                                            {h.fare && <div className="font-serif text-[15px] mt-1.5" style={{ color: INK }}>{h.fare.currency} {h.fare.total.toLocaleString()}</div>}
                                        </div>
                                    ))}
                                </div>

                                {kept.length > 0 && (multi || raw.fare) && (
                                    <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                        <span className="text-[12px]" style={{ color: MUTE }}>{multi ? `共 ${kept.length} 間 · 合計` : '總計金額'}</span>
                                        <span className="font-serif text-[18px]" style={{ color: INK }}>{cur} {(multi ? total : (raw.fare?.total ?? total)).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 mt-2">
                                    <Lock className="w-3 h-3" style={{ color: MUTE }} />
                                    <span className="text-[10px]" style={{ color: MUTE }}>原始信件已加密儲存，卡號僅保留末四碼供核對。</span>
                                </div>
                                {err && <div className="text-[12px] mt-2" style={{ color: STAMP }}>{err}</div>}
                            </div>
                        );
                    })()}

                    {step === 'view' && viewBooking && viewBooking.kind === 'flight' && (
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-serif text-[18px]" style={{ color: INK }}>{viewBooking.provider}</span>
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-3 h-3" />OK</span>
                                {viewBooking.pnr && <span className="font-mono text-[10px] ml-auto" style={{ color: MUTE }}>{viewBooking.pnr}</span>}
                            </div>

                            <div className="mt-3 rounded-xl p-3" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                {viewBooking.segments.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 py-0.5" style={i > 0 ? { borderTop: `0.5px dashed #D6CDB8`, paddingTop: 6, marginTop: 6 } : undefined}>
                                        <span className="font-mono text-[10px]" style={{ color: GREEN }}>{s.flightNo}</span>
                                        <span className="font-serif text-[15px]" style={{ color: INK }}>{s.fromIata}</span>
                                        <span className="font-mono text-[11px]" style={{ color: INK }}>{s.depLocal.slice(11)}</span>
                                        <ArrowRight className="w-3.5 h-3.5" style={{ color: MUTE }} />
                                        <span className="font-serif text-[15px]" style={{ color: INK }}>{s.toIata}</span>
                                        <span className="font-mono text-[11px]" style={{ color: INK }}>{s.arrLocal.slice(11)}</span>
                                        <span className="font-mono text-[10px] ml-auto" style={{ color: MUTE }}>{s.depLocal.slice(5, 10).replace('-', '/')}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3">
                                <div className="flex items-baseline justify-between">
                                    <span className="font-serif text-[15px]" style={{ color: INK }}>這趟的旅伴</span>
                                    <span className="text-[11px]" style={{ color: MUTE }}>{viewBooking.passengers.length} 位</span>
                                </div>
                                {viewBooking.passengers.map((p, i) => {
                                    const tv = travelers.find(t => t.id === p.memberId);
                                    const pax = tv?.paxType ?? (p.isChild ? 'child' : 'adult');
                                    const bag = p.perSegment.map((ps, k) => `${k === 0 ? '去' : '回'} ${ps.checkedKg != null ? ps.checkedKg + 'kg' : '無託運'}·${ps.seat ?? '—'}`).join('　');
                                    return (
                                        <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: `0.5px solid #ECE4D4` }}>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-serif text-[14px]" style={{ color: INK, letterSpacing: 0.3 }}>{p.fullName}
                                                    {pax === 'child' && <span className="ml-1.5 rounded px-1.5 text-[9.5px]" style={{ background: '#F3E7DF', color: '#8a4230' }}>小朋友</span>}
                                                    {pax === 'senior' && <span className="ml-1.5 rounded px-1.5 text-[9.5px]" style={{ background: '#EFE7D6', color: '#7a5a1f' }}>長輩</span>}
                                                </div>
                                                <div className="font-mono text-[9px]" style={{ color: MUTE }}>{bag}</div>
                                            </div>
                                            {tv?.nickname && <span className="text-[12.5px] font-medium shrink-0" style={{ color: GREEN }}>{tv.nickname}</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {viewBooking.fare && (
                                <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                    <div><div className="font-mono text-[9px]" style={{ color: MUTE }}>總計金額</div><div className="font-serif text-[18px]" style={{ color: INK }}>{viewBooking.fare.currency} {viewBooking.fare.total.toLocaleString()}</div></div>
                                    {viewBooking.fare.paidBy?.last4 && <div className="text-right"><div className="font-mono text-[9px]" style={{ color: MUTE }}>付款</div><div className="font-mono text-[11px]" style={{ color: INK }}>{viewBooking.fare.paidBy.method} ••{viewBooking.fare.paidBy.last4}</div></div>}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                                <Lock className="w-3 h-3" style={{ color: MUTE }} />
                                <span className="text-[10px]" style={{ color: MUTE }}>原始信件已加密儲存，卡號僅保留末四碼供核對。</span>
                            </div>
                        </div>
                    )}

                    {step === 'view' && viewBooking && viewBooking.kind === 'hotel' && (
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-serif text-[18px]" style={{ color: INK }}>{viewBooking.property}</span>
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-3 h-3" />OK</span>
                                {viewBooking.pnr && <span className="font-mono text-[10px] ml-auto" style={{ color: MUTE }}>{viewBooking.pnr}</span>}
                            </div>
                            <div className="mt-3 rounded-xl p-3.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                <div className="flex items-center gap-2 font-mono text-[11.5px]" style={{ color: INK }}>
                                    <span>入住 {viewBooking.checkInLocal?.slice(0, 10) || '—'}</span>
                                    <ArrowRight className="w-3.5 h-3.5" style={{ color: MUTE }} />
                                    <span>退房 {viewBooking.checkOutLocal?.slice(0, 10) || '—'}</span>
                                </div>
                                <div className="font-mono text-[10px] mt-2" style={{ color: MUTE }}>{viewBooking.rooms} 間 · {viewBooking.guests} 人{viewBooking.address ? ` · ${viewBooking.address}` : ''}</div>
                            </div>
                            {viewBooking.fare && (
                                <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                                    <div><div className="font-mono text-[9px]" style={{ color: MUTE }}>總計金額</div><div className="font-serif text-[18px]" style={{ color: INK }}>{viewBooking.fare.currency} {viewBooking.fare.total.toLocaleString()}</div></div>
                                    {viewBooking.fare.paidBy?.last4 && <div className="text-right"><div className="font-mono text-[9px]" style={{ color: MUTE }}>付款</div><div className="font-mono text-[11px]" style={{ color: INK }}>{viewBooking.fare.paidBy.method} ••{viewBooking.fare.paidBy.last4}</div></div>}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                                <Lock className="w-3 h-3" style={{ color: MUTE }} />
                                <span className="text-[10px]" style={{ color: MUTE }}>原始信件已加密儲存，卡號僅保留末四碼供核對。</span>
                            </div>
                        </div>
                    )}
                </div>

                {step === 'confirm' && (
                    <div className="flex gap-2 p-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                        <button onClick={reset} className="flex-[0_0_33%] py-2.5 rounded-lg text-[13px] font-medium" style={{ border: `1px solid #C9BFA6`, color: MUTE }}>先不要</button>
                        <button disabled={saving} onClick={confirmImport} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: INK, color: PAPER }}><Check className="w-4 h-4" />{hotelKeptCount > 1 ? `加進行程（${hotelKeptCount} 筆）` : '核對好了，加進行程'}</button>
                    </div>
                )}

                {step === 'view' && (confirmDel ? (
                    <div className="p-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                        <div className="text-[12.5px] text-center mb-2" style={{ color: STAMP }}>刪除這筆訂位？此動作無法復原。</div>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDel(false)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: `1px solid #C9BFA6`, color: MUTE }}>取消</button>
                            <button onClick={() => viewBooking && onDelete?.(viewBooking.id)} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: STAMP, color: '#fff' }}>刪除</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 p-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                        <button onClick={close} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: INK, color: PAPER }}>關閉</button>
                        <button onClick={reset} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: `1px solid #C9BFA6`, color: MUTE }}>重新匯入</button>
                    </div>
                ))}
            </div>
        </div>
    );
};
