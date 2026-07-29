// src/views/ItineraryView/StageFaces.tsx
// 🎟️ 準備／前夕／回憶 三張階段臉（簽名版·最小可用；細節後續逐臉補）。
import React from 'react';
import { Plane, BedDouble, FileText, Luggage, Footprints, AlertTriangle, Stamp, Heart, Search, ChevronRight, Share2, Hourglass, CircleCheck, Baby, Upload, Moon, Route, Plus } from 'lucide-react';
import type { Trip, Activity } from '../../types';
import type { FlightBooking, HotelBooking, StoredBooking } from '../../types/booking';
import { haversineKm } from '../../hooks/useNearby';
import { nightsCoverage, shortNight, hotelNights, hotelDateWarnings } from '../../services/booking/nights';
import { isFlightRoundTrip, readinessSummary } from '../../services/readiness';
import { ReadyStamp } from '../../components/brand/ReadyStamp';
import { isSystemType } from './shared';

const INK = '#232320', PAPER = '#F6F1E7', BORDER = '#E0D8C6', GREEN = '#3F6B52', STAMP = '#A23B2E', MUTE = '#8A8266', DASH = '#D6CDB8';
const allActs = (t: Trip): Activity[] => t.days.flatMap(d => d.activities);
const spotsOf = (t: Trip) => allActs(t).filter(a => !isSystemType(a.type)).length;

// ── 準備臉 ─────────────────────────────
// 兩區：訂購（機票走 booking、住宿手動）＋打包（文件/行李手動）。就緒環只計「訂購」關鍵路徑。
type ReadyKey = 'flight' | 'hotel' | 'docs' | 'pack';
export const PrepareFace: React.FC<{
    trip: Trip; daysToDep: number;
    flightBookings?: FlightBooking[];   // 機票（可多筆/多程）
    hotelBookings?: HotelBooking[];     // 住宿（可多筆，算覆蓋）
    onImport?: () => void;              // 補齊＝開匯入核對表（機票/住宿共用）
    onView?: (b: StoredBooking) => void;  // 已備＝唯讀檢視該筆
    onMarkReady: (k: ReadyKey, v: boolean) => void;
    onFix: (k: ReadyKey) => void;
}> = ({ trip, daysToDep, flightBookings, hotelBookings, onImport, onView, onMarkReady, onFix }) => {
    const r = trip.readiness || {};
    const fbs = flightBookings ?? [];
    // 🎟️ 機票「完整性」把關：來回閉環（首段起點＝末段終點）才算訂購完成，不只「有匯入」。
    //   與 services/readiness.computeBookingReadiness 同一判定，確保準備臉與首頁快照一致。
    const flightDone = isFlightRoundTrip(fbs);
    // 🛏️ 住宿覆蓋：全覆蓋才算「訂購完成」；部分覆蓋顯示尚缺幾晚
    const hbs = hotelBookings ?? [];
    const hb = hbs[0];
    const cov = nightsCoverage(trip, hbs);
    const hasHotel = hbs.length > 0;
    const canCover = cov.neededCount > 0;                 // 有行程夜數才算得了覆蓋
    const fullyCovered = hasHotel && canCover && cov.missing.length === 0;
    const hotelDone = fullyCovered;
    // 🔎 A1 交叉把關：兩者都有才比對（日期；地點另用 geo）
    const showCross = flightDone && hasHotel;
    const crossWarns = showCross ? hotelDateWarnings(trip, hbs) : [];
    const docsDone = !!r.docs, packDone = !!r.pack;

    const bookingReady = (flightDone ? 1 : 0) + (hotelDone ? 1 : 0);   // 關鍵路徑 /2
    const packReady = (docsDone ? 1 : 0) + (packDone ? 1 : 0);         // 次要 /2
    const ringPct = (bookingReady / 2) * 100;
    const mood = bookingReady === 2 ? '訂購都到齊了！'
        : flightDone && !hotelDone ? '機票已匯入，還剩住宿'
        : hotelDone && !flightDone ? '住宿已匯入，還剩機票'
        : '開始準備了';

    // 機票摘要 / 兒童 / 行李彙總（取第一筆 flight）
    const fb = fbs[0];
    const seg0 = fb?.segments[0], segN = fb?.segments[fb.segments.length - 1];
    const dateRange = seg0 && segN ? `${seg0.depLocal.slice(5, 10).replace('-', '/')}–${segN.arrLocal.slice(5, 10).replace('-', '/')}` : '';
    const flightSub = fb && seg0 ? `${seg0.fromIata}→${seg0.toIata} · ${fb.passengers.length} 人 · ${dateRange}` : '已訂';
    const kids = fb ? fb.passengers.filter(p => p.isChild).length : 0;
    const checked = fb ? fb.passengers.filter(p => (p.perSegment[0]?.checkedKg ?? null) != null).length : 0;
    const carry = fb ? fb.passengers.length - checked : 0;
    const packSub = fb ? `${checked} 件託運 · ${carry} 件只手提` : (packDone ? '已收' : '行李清單');
    const hotelSub = !hasHotel ? '匯入確認信'
        : !canCover ? `入住 ${(hb!.checkInLocal || '').slice(5, 10)} · 退房 ${(hb!.checkOutLocal || '').slice(5, 10)}`
            : fullyCovered ? `${cov.neededCount} 晚住宿已確認 · 搞定！`
                : `住 ${shortNight(hb!.checkInLocal)}–${shortNight(hb!.checkOutLocal)}（已排 ${cov.coveredCount} 晚 ／ 總共 ${cov.neededCount} 晚）`;

    // 🎟️ 批 C：五段里程碑（規劃/機票/住宿/文件/打包）全亮 → 騎縫大章接替進度環
    const allReady = readinessSummary(trip).allReady;

    return (
        <div className="rounded-2xl overflow-hidden relative" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
            {/* 🎟️ 騎縫大章（方案 A）：像真護照一樣斜壓在頁面右上、微出血；鏤空線框不擋閱讀。
                演一次→停在蓋好姿態；點章重播（ReadyStamp 煙火模型）。圓形 hit area 不擋下方按鈕。 */}
            {allReady && (
                <div style={{ position: 'absolute', top: 2, right: -12, zIndex: 5 }}>
                    <ReadyStamp startDate={trip.startDate} size={122} animated />
                </div>
            )}
            {/* 就緒環：訂購為主、打包為次；全就緒時環的任務完成 → 讓位給章、文字轉綠 */}
            <div className="flex items-center gap-4 p-4" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                {!allReady && (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(${GREEN} 0 ${ringPct}%, ${DASH} ${ringPct}% 100%)` }}>
                        <div className="w-11 h-11 rounded-full flex flex-col items-center justify-center" style={{ background: PAPER }}>
                            <span className="font-mono text-[14px] font-bold" style={{ color: GREEN, lineHeight: 1 }}>{bookingReady}/2</span>
                            <span className="text-[8px]" style={{ color: MUTE }}>訂購</span>
                        </div>
                    </div>
                )}
                <div className="flex-1" style={allReady ? { paddingRight: 100 } : undefined}>
                    <div className="font-mono text-[10px] tracking-wide" style={{ color: MUTE }}>出發前 {Math.max(daysToDep, 0)} 天</div>
                    <div className="font-serif text-[16px]" style={{ color: allReady ? GREEN : INK, fontWeight: allReady ? 700 : 500 }}>{allReady ? '全部就緒 · 可以出發了' : mood}</div>
                    <div className="font-mono text-[9px] tracking-wide mt-0.5" style={{ color: MUTE }}>打包 {packReady}/2 · {allReady ? '都收好了' : '之後再說'}</div>
                </div>
            </div>

            <div className="p-4">
                <div className="font-mono text-[9px] tracking-[1.5px] mb-2" style={{ color: MUTE }}>訂購 · BOOKINGS</div>

                {/* 機票群組（可多筆/多程） */}
                {fbs.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                        <Plane className="w-[19px] h-[19px] shrink-0" style={{ color: STAMP }} />
                        <div className="flex-1 min-w-0"><div className="font-serif text-[14px]" style={{ color: INK }}>機票</div><div className="font-mono text-[9.5px]" style={{ color: STAMP }}>匯入確認信</div></div>
                        <button onClick={() => onImport?.()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-medium shrink-0" style={{ background: INK, color: PAPER }}><Upload className="w-3.5 h-3.5" />匯入確認信</button>
                    </div>
                ) : fbs.map((f, i) => {
                    const s0 = f.segments[0], sN = f.segments[f.segments.length - 1];
                    const range = s0 && sN ? `${s0.depLocal.slice(5, 10).replace('-', '/')}–${sN.arrLocal.slice(5, 10).replace('-', '/')}` : '';
                    const sub = s0 ? `${s0.fromIata}→${s0.toIata} · ${f.passengers.length} 人 · ${range}` : '已訂';
                    return (
                        <div key={f.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i > 0 ? 'mt-2' : ''}`} style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                            <Plane className="w-[19px] h-[19px] shrink-0" style={{ color: GREEN }} />
                            <div className="flex-1 min-w-0"><div className="font-serif text-[14px]" style={{ color: INK }}>機票{fbs.length > 1 ? ` ${i + 1}` : ''}</div><div className="font-mono text-[9.5px] truncate" style={{ color: MUTE }}>{sub}</div></div>
                            <button onClick={() => onView?.(f)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold shrink-0" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-3 h-3" />OK</button>
                        </div>
                    );
                })}

                {/* 住宿群組（逐間＋聯集覆蓋＋再匯一間，A3） */}
                {!hasHotel ? (
                    <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                        <BedDouble className="w-[19px] h-[19px] shrink-0" style={{ color: STAMP }} />
                        <div className="flex-1 min-w-0"><div className="font-serif text-[14px]" style={{ color: INK }}>住宿</div><div className="font-mono text-[9.5px]" style={{ color: STAMP }}>匯入確認信</div></div>
                        <button onClick={() => onImport?.()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-medium shrink-0" style={{ background: INK, color: PAPER }}><Upload className="w-3.5 h-3.5" />匯入確認信</button>
                    </div>
                ) : (
                    <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: '#FBF7EE', border: `0.5px solid ${BORDER}` }}>
                        <div className="flex items-center gap-2 mb-1">
                            <BedDouble className="w-[18px] h-[18px] shrink-0" style={{ color: fullyCovered ? GREEN : '#A0741A' }} />
                            <span className="font-serif text-[15px]" style={{ color: INK }}>住宿</span>
                            {canCover && <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={fullyCovered ? { background: '#E7EFE9', color: '#2f5340', border: '1px solid #B9D2C4' } : { background: '#FBF3E4', color: '#A0741A', border: '1px solid #EAD9B5' }}>{fullyCovered ? '搞定！' : `${cov.coveredCount} / ${cov.neededCount} 晚`}</span>}
                        </div>
                        {hbs.map(h => {
                            const n = hotelNights(h).length;
                            const rangeH = `${shortNight(h.checkInLocal)}–${shortNight(h.checkOutLocal)}${n ? ` · ${n} 晚` : ''}`;
                            return (
                                <button key={h.id} onClick={() => onView?.(h)} className="w-full flex items-center gap-2.5 py-2 text-left active:opacity-60" style={{ borderTop: `0.5px solid #ECE4D4` }}>
                                    <div className="flex-1 min-w-0"><div className="font-serif text-[13.5px] truncate" style={{ color: INK }}>{h.property}</div><div className="font-mono text-[9px]" style={{ color: MUTE }}>{rangeH}</div></div>
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9.5px] font-bold shrink-0" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-2.5 h-2.5" />OK</span>
                                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#b3a894' }} />
                                </button>
                            );
                        })}
                        {canCover && !fullyCovered && (
                            <div className="flex items-center gap-2 mt-2 rounded-lg px-3 py-2" style={{ background: '#FBF3E4', border: '1px solid #EAD9B5' }}>
                                <Moon className="w-4 h-4 shrink-0" style={{ color: '#A0741A' }} />
                                <span className="flex-1 text-[11.5px] leading-snug" style={{ color: '#7d5a12' }}>{cov.missing.length === 1 ? `${shortNight(cov.missing[0])} 這一晚還沒有安排住宿，記得提早訂房喔！` : `${cov.missing.map(shortNight).join('、')} 還沒安排住宿，記得提早訂房喔！`}</span>
                                <button onClick={() => onImport?.()} className="rounded-lg px-3 py-1.5 text-[12px] font-medium shrink-0" style={{ background: INK, color: PAPER }}>預訂這晚</button>
                            </div>
                        )}
                        <button onClick={() => onImport?.()} className="w-full mt-2 py-2 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5" style={{ border: `1px dashed #C9BFA6`, color: MUTE }}><Plus className="w-4 h-4" />再匯一間確認信</button>
                    </div>
                )}

                {/* 🔎 行程把關（A1：機票↔住宿日期交叉檢查） */}
                {showCross && (
                    <div className="mt-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Route className="w-[15px] h-[15px]" style={{ color: MUTE }} />
                            <span className="font-serif text-[13px]" style={{ color: INK }}>行程把關</span>
                        </div>
                        {crossWarns.length > 0
                            ? crossWarns.map((w, i) => (
                                <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 mb-2" style={{ background: '#FBF3E4', border: '1px solid #EAD9B5' }}>
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#A0741A' }} />
                                    <div className="flex-1"><div className="text-[12.5px] font-medium" style={{ color: '#7d5a12' }}>{w.title}</div><div className="text-[11.5px] mt-0.5 leading-snug" style={{ color: '#a0741a' }}>{w.body}</div></div>
                                </div>
                            ))
                            : (
                                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: '#E7EFE9', border: '0.5px solid #B9D2C4' }}>
                                    <CircleCheck className="w-[18px] h-[18px] shrink-0" style={{ color: GREEN }} />
                                    <div className="flex-1"><div className="text-[12.5px] font-medium" style={{ color: '#2f5340' }}>機票和住宿都對得上</div><div className="text-[11px] mt-0.5" style={{ color: '#5a7a68' }}>日期都銜接好了，放心出發！</div></div>
                                </div>
                            )}
                    </div>
                )}

                {/* 兒童證件（booking 抓到小朋友才出現） */}
                {kids > 0 && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#F7EEE9', border: '0.5px solid #E7D3C7' }}>
                        <Baby className="w-[19px] h-[19px] shrink-0" style={{ color: '#8a4230' }} />
                        <div className="flex-1"><div className="text-[13px] font-medium" style={{ color: '#7a3a2a' }}>{kids} 位小朋友同行</div><div className="text-[10px]" style={{ color: '#9c6552' }}>記得帶兒童證件 · 未滿 12 歲需監護同行</div></div>
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#b98a76' }} />
                    </div>
                )}

                {/* 打包區（次要） */}
                <div className="font-mono text-[9px] tracking-[1.5px] mt-4 mb-1" style={{ color: MUTE }}>打包 · PACK</div>
                <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `0.5px dashed ${DASH}` }}>
                    <FileText className="w-[18px] h-[18px] shrink-0" style={{ color: docsDone ? MUTE : STAMP }} />
                    <div className="flex-1"><div className="font-serif text-[14px]" style={{ color: INK }}>文件</div><div className="font-mono text-[9px]" style={{ color: docsDone ? MUTE : STAMP }}>{docsDone ? ((trip.linkedDocumentIds?.length ?? 0) > 0 ? `${trip.linkedDocumentIds!.length} 份已備` : '已備') : '從保管箱挑'}</div></div>
                    {docsDone
                        ? <button onClick={() => onMarkReady('docs', false)} title="撤章" className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-3 h-3" />OK</button>
                        : <div className="flex items-center gap-1.5"><button onClick={() => onMarkReady('docs', true)} className="text-[11px] rounded-lg px-2 py-1" style={{ color: MUTE }}>已備</button><button onClick={() => onFix('docs')} className="text-[11px] rounded-lg px-2.5 py-1" style={{ border: `1px dashed ${STAMP}`, color: STAMP }}>補齊</button></div>}
                </div>
                <div className="flex items-center gap-3 py-2.5">
                    <Luggage className="w-[18px] h-[18px] shrink-0" style={{ color: fb || packDone ? MUTE : STAMP }} />
                    <div className="flex-1"><div className="font-serif text-[14px]" style={{ color: INK }}>行李打包</div><div className="font-mono text-[9px]" style={{ color: fb ? GREEN : (packDone ? MUTE : STAMP) }}>{packSub}</div></div>
                    {packDone
                        ? <button onClick={() => onMarkReady('pack', false)} title="撤章" className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `1.5px solid ${GREEN}`, color: GREEN, transform: 'rotate(-3deg)' }}><Stamp className="w-3 h-3" />OK</button>
                        : <div className="flex items-center gap-1.5"><button onClick={() => onMarkReady('pack', true)} className="text-[11px] rounded-lg px-2 py-1" style={{ color: MUTE }}>已收</button><button onClick={() => onFix('pack')} className="text-[11px] rounded-lg px-2.5 py-1" style={{ border: `1px solid #C9BFA6`, color: MUTE }}>清單</button></div>}
                </div>
            </div>
        </div>
    );
};

// ── 前夕臉 ─────────────────────────────
export const EveFace: React.FC<{ trip: Trip; daysToDep: number; onRehearse: () => void }> = ({ trip, daysToDep, onRehearse }) => {
    const perDay = trip.days.map(d => {
        const pts = d.activities.filter(a => a.lat != null && a.lng != null);
        let km = 0; for (let i = 1; i < pts.length; i++) km += haversineKm({ lat: pts[i - 1].lat!, lng: pts[i - 1].lng! }, { lat: pts[i].lat!, lng: pts[i].lng! });
        return { day: d.day, km: Math.round(km) };
    });
    const worst = perDay.reduce((a, b) => (b.km > a.km ? b : a), { day: 0, km: 0 });

    return (
        <div>
            <div className="rounded-2xl overflow-hidden" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: INK }}>
                    <span className="font-mono text-[9px] tracking-[2px]" style={{ color: '#C9B98F' }}>BOARDING PASS</span>
                    <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.6)' }}>KELVIN TRIP</span>
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between">
                        <div><div className="font-mono text-[8px] tracking-wide" style={{ color: MUTE }}>FROM</div><div className="font-serif text-[24px] font-medium" style={{ color: INK, lineHeight: 1 }}>{(trip.origin || '—').slice(0, 4)}</div></div>
                        <Plane className="w-4 h-4" style={{ color: GREEN }} />
                        <div className="text-right"><div className="font-mono text-[8px] tracking-wide" style={{ color: MUTE }}>TO</div><div className="font-serif text-[22px] font-medium" style={{ color: INK, lineHeight: 1.05 }}>{trip.destination}</div></div>
                    </div>
                    <div className="flex items-end justify-between mt-3.5">
                        <div><div className="font-mono text-[8px] tracking-wide" style={{ color: MUTE }}>DEPART</div><div className="font-mono text-[13px]" style={{ color: INK }}>{(trip.startDate || '').slice(5).replace('-', '.')}</div></div>
                        <div className="text-right"><div className="font-mono text-[8px] tracking-wide" style={{ color: STAMP }}>BOARDING IN</div><div className="font-serif text-[26px] font-medium" style={{ color: STAMP, lineHeight: 0.9 }}>{Math.max(daysToDep, 0)} 天</div></div>
                    </div>
                </div>
                <div className="relative" style={{ borderTop: `1.5px dashed ${DASH}` }} />
                <div className="flex py-2">
                    <button onClick={onRehearse} className="flex-1 flex flex-col items-center gap-1 py-1 text-[11px] font-medium" style={{ color: GREEN }}><Footprints className="w-[18px] h-[18px]" />彩排</button>
                    <button className="flex-1 flex flex-col items-center gap-1 py-1 text-[11px] font-medium" style={{ color: INK, borderLeft: `0.5px solid ${BORDER}` }}><Hourglass className="w-[18px] h-[18px]" />最後檢查</button>
                    <button className="flex-1 flex flex-col items-center gap-1 py-1 text-[11px] font-medium" style={{ color: STAMP, borderLeft: `0.5px solid ${BORDER}` }}><Share2 className="w-[18px] h-[18px]" />分享</button>
                </div>
            </div>

            {worst.km > 40 && (
                <div className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ background: '#FBF3E4', border: '1px solid #EAD9B5' }}>
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#A0741A' }} />
                    <div className="flex-1"><div className="text-[12px] font-medium" style={{ color: '#7d5a12' }}>Day {worst.day} 移動偏多 · <span className="font-mono">{worst.km} km</span></div><div className="text-[10px]" style={{ color: '#a0741a' }}>彩排看看順不順</div></div>
                    <button onClick={onRehearse} className="text-[11px] font-medium rounded-lg px-2.5 py-1" style={{ border: '1px solid #EAD9B5', color: '#A0741A' }}>彩排</button>
                </div>
            )}
        </div>
    );
};

// ── 回憶臉 ─────────────────────────────
export const MemoryFace: React.FC<{ trip: Trip }> = ({ trip }) => {
    const spots = spotsOf(trip);
    const favs = allActs(trip).filter(a => !isSystemType(a.type)).slice(0, 3);
    return (
        <div>
            <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                <div className="absolute right-3 top-3 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `2px solid ${STAMP}`, color: STAMP, transform: 'rotate(-8deg)', opacity: 0.9 }}>COMPLETED</div>
                <div className="font-mono text-[9px] tracking-[2px]" style={{ color: MUTE }}>{trip.days.length} DAYS</div>
                <div className="font-serif text-[28px] font-medium mt-1" style={{ color: INK }}>{trip.destination}</div>
                <div className="font-mono text-[10px] mt-1.5" style={{ color: MUTE }}>{spots} SPOTS</div>
                <button className="mt-3 w-full py-2.5 rounded-lg text-[12.5px] font-medium flex items-center justify-center gap-1.5" style={{ background: INK, color: PAPER }}><Share2 className="w-4 h-4" />分享旅程回顧</button>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl p-3" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                <div className="w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center shrink-0" style={{ borderColor: STAMP, transform: 'rotate(-6deg)' }}><CircleCheck className="w-5 h-5" style={{ color: STAMP }} /></div>
                <div className="flex-1"><div className="font-serif text-[14px]" style={{ color: INK }}>{trip.destination} 已收藏</div><div className="font-mono text-[9px]" style={{ color: MUTE }}>你旅程收藏 +1</div></div>
                <ChevronRight className="w-4 h-4" style={{ color: MUTE }} />
            </div>

            {favs.length > 0 && (
                <div className="mt-3 rounded-xl p-3" style={{ background: PAPER, border: `0.5px solid ${BORDER}` }}>
                    <div className="text-[12px] font-medium mb-2" style={{ color: INK }}>這趟最愛哪幾個？<span className="font-mono text-[9px]" style={{ color: MUTE }}> 餵 Kelvin 下次排更準</span></div>
                    <div className="flex gap-2 flex-wrap">
                        {favs.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: `0.5px solid ${DASH}`, color: MUTE }}><Heart className="w-3 h-3" />{a.title.length > 6 ? a.title.slice(0, 6) + '…' : a.title}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
