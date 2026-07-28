import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, X, Loader2, Check, Bookmark, Link2 } from 'lucide-react';
import type { WishItem } from '../../../types';
import { searchPlaces, resolveMapsLink, type PlaceSearchResult, type MapsLinkPlace } from '../../../services/geo';
import { looksLikeMapsUrl } from '../../../utils/mapsUrl';
import { estimateLeg } from '../../../services/routing';

export interface SelectedPlace { placeId?: string; name: string; address?: string; lat?: number; lng?: number; }

interface Coord { lat: number; lng: number; }

interface Props {
    dayNumber: number;
    dayCity?: string;
    bias?: Coord;              // 城市中心，供 API 偏置
    routeCoords: Coord[];      // 當天既有站座標，供順路計算（空＝無路線）
    wishItems: WishItem[];
    existingPlaceIds: Set<string>;  // 已在行程的 placeId → 標「已加入」
    onSelect: (r: SelectedPlace) => void;
    onSave?: (r: SelectedPlace) => void;   // 🔖 存/取消（上層決定開存到清單 sheet 或取消）
    savedPlaceIds?: Set<string>;           // 🔖 已存進心願盒的 placeId → 顯示 ✓
    onClose: () => void;
}

// 順路（分）＝距當天最近既有站的估算；無路線→null
function detourMin(routeCoords: Coord[], lat?: number, lng?: number): number | null {
    if (lat == null || lng == null || routeCoords.length === 0) return null;
    let best = Infinity;
    for (const s of routeCoords) best = Math.min(best, estimateLeg(s, { lat, lng }).minutes);
    return best === Infinity ? null : best;
}

// 時長人性化：<60→「N 分」；>=60→「H 小時 M 分」
function fmtDur(min: number): string {
    if (min < 60) return `${min} 分`;
    const h = Math.floor(min / 60), m = min % 60;
    return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

// 地址精簡成「地區」：去掉郵遞區號/國名前綴，取尾段
function shortArea(addr?: string): string {
    if (!addr) return '';
    return addr.replace(/^日本、?/, '').replace(/〒?\d[\d-]*\s*/, '').replace(/^台灣\s*/, '').replace(/^대한민국\s*/, '').trim().slice(0, 16);
}

export const PlaceSearchSheet: React.FC<Props> = ({ dayNumber, dayCity, bias, routeCoords, wishItems, existingPlaceIds, onSelect, onSave, savedPlaceIds, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
    const [loadingMore, setLoadingMore] = useState(false);
    const reqSeq = useRef(0);
    // 🔗 D2①：貼連結解析
    const [linkResult, setLinkResult] = useState<MapsLinkPlace | null>(null);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const linkSeq = useRef(0);

    const q = query.trim();
    const tagMode = q.startsWith('#');
    const tagTerm = tagMode ? q.slice(1).trim().toLowerCase() : '';
    const linkMode = looksLikeMapsUrl(q);   // 偵測到 Google Maps 網址 → 走解析、不打 place-search

    // 熱門標籤 chip（wishItems 出現最多的前幾個 tag）
    const topTags = useMemo(() => {
        const c: Record<string, number> = {};
        for (const w of wishItems) for (const t of (w.tags || [])) c[t] = (c[t] || 0) + 1;
        return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
    }, [wishItems]);

    // Google 搜尋：tagMode/linkMode 不打 place-search；純文字 >=2 字、debounce 350ms、忽略過期回應
    useEffect(() => {
        if (tagMode || linkMode || q.length < 2) { setResults([]); setNextPageToken(undefined); setLoading(false); setError(null); return; }
        setLoading(true); setError(null);
        const seq = ++reqSeq.current;
        const h = setTimeout(async () => {
            try {
                const resp = await searchPlaces(q, bias);
                if (seq === reqSeq.current) { setResults(resp.results); setNextPageToken(resp.nextPageToken); setLoading(false); }
            } catch {
                if (seq === reqSeq.current) { setError('連線問題，稍後再試'); setLoading(false); }
            }
        }, 350);
        return () => clearTimeout(h);
    }, [q, tagMode, linkMode, bias]);

    // 🔗 D2①：偵測到地圖連結 → 解析成一個地點（debounce 300ms、忽略過期）
    useEffect(() => {
        if (!linkMode) { setLinkResult(null); setLinkLoading(false); setLinkError(null); return; }
        setLinkLoading(true); setLinkError(null); setLinkResult(null);
        const seq = ++linkSeq.current;
        const h = setTimeout(async () => {
            try {
                const p = await resolveMapsLink(q);
                if (seq !== linkSeq.current) return;
                setLinkResult(p);
                setLinkLoading(false);
                if (!p) setLinkError('這個連結解析不出地點，換一個試試');
            } catch {
                if (seq === linkSeq.current) { setLinkError('解析失敗，稍後再試'); setLinkLoading(false); }
            }
        }, 300);
        return () => clearTimeout(h);
    }, [q, linkMode]);

    // 更多結果（分頁）：追加下一頁、去重
    const loadMore = async () => {
        if (!nextPageToken || loadingMore) return;
        setLoadingMore(true);
        try {
            const resp = await searchPlaces(q, bias, nextPageToken);
            setResults(prev => {
                const seen = new Set(prev.map(r => r.placeId).filter(Boolean));
                return [...prev, ...resp.results.filter(r => !r.placeId || !seen.has(r.placeId))];
            });
            setNextPageToken(resp.nextPageToken);
        } catch { /* 靜默：更多結果失敗不干擾現有清單 */ }
        finally { setLoadingMore(false); }
    };

    // 心願盒命中（tagMode：比 tags/標題/地區含 tagTerm；純文字：同上比 q）
    const wishSorted = useMemo(() => {
        const term = (tagMode ? tagTerm : q.toLowerCase());
        if (!term) return [];
        return wishItems
            .filter(w => w.type === 'place')
            .filter(w => !dayCity || !w.city || w.city === dayCity)   // 只 surface 這天城市的收藏（避免台南收藏出現在京都那天）
            .filter(w => {
                const inTags = (w.tags || []).some(t => t.toLowerCase().includes(term));
                const inTitle = w.title.toLowerCase().includes(term);
                const inArea = (w.area || w.city || '').toLowerCase().includes(term);
                return inTags || inTitle || inArea;
            })
            .map(w => ({ w, d: detourMin(routeCoords, w.lat, w.lng) }))
            .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999))
            .slice(0, 6);
    }, [wishItems, q, tagMode, tagTerm, routeCoords]);

    const wishPlaceIds = useMemo(
        () => new Set(wishSorted.map(x => x.w.placeId).filter(Boolean) as string[]),
        [wishSorted],
    );

    // Google 結果：去重（心願盒已含不重列）、依順路排序
    const googleSorted = useMemo(() => {
        return results
            .filter(r => !r.placeId || !wishPlaceIds.has(r.placeId))
            .map(r => ({ r, d: detourMin(routeCoords, r.lat, r.lng) }))
            .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999));
    }, [results, wishPlaceIds, routeCoords]);

    const noRoute = routeCoords.length === 0;

    const Meta: React.FC<{ area: string; d: number | null }> = ({ area, d }) => (
        <div className="font-mono text-[9px] mt-[3px]" style={{ color: '#8A8266' }}>
            {area}{area && (d != null) ? ' · ' : ''}
            {d != null && <span style={{ color: '#A23B2E' }}>順路 {fmtDur(d)}</span>}
        </div>
    );

    const Row: React.FC<{ name: string; area: string; d: number | null; added: boolean; onAdd: () => void; onSaveClick?: () => void; saved?: boolean }> = ({ name, area, d, added, onAdd, onSaveClick, saved }) => (
        <div className="w-full flex items-center gap-2 px-2 py-2.5 rounded-xl" style={{ background: '#fff', border: '0.5px solid #E7E0CE', marginBottom: 6, opacity: added ? 0.55 : 1 }}>
            <button onClick={added ? undefined : onAdd} disabled={added} className="flex-1 min-w-0 text-left">
                <div className="font-serif text-[14px] truncate" style={{ color: '#232320' }}>{name}</div>
                <Meta area={area} d={d} />
            </button>
            {onSaveClick && !added && (
                <button onClick={onSaveClick} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: `0.5px solid ${saved ? '#3F6B52' : '#E0D8C6'}`, background: saved ? '#E7EFE9' : 'transparent', color: saved ? '#3F6B52' : '#8A8266' }} title={saved ? '已存 · 點一下取消收藏' : '存進心願盒'}>
                    {saved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                </button>
            )}
            {added
                ? <span className="text-[10px] font-mono flex items-center gap-1 flex-shrink-0" style={{ color: '#3F6B52' }}><Check className="w-3 h-3" />已加入</span>
                : <button onClick={onAdd} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#3F6B52', color: '#fff' }}>＋</button>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-[#232320]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] flex flex-col" style={{ background: '#F2EFE7', height: '80vh', boxShadow: '0 -8px 40px rgba(35,35,32,0.2)' }}>
                {/* 輸入 */}
                <div className="p-4 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px]" style={{ color: '#8A8266' }}>加到 <b style={{ color: '#232320' }}>Day {dayNumber}{dayCity ? ` · ${dayCity}` : ''}</b></span>
                        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E7E0CE', color: '#8A8266' }}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#fff', border: '1px solid #232320' }}>
                        <Search className="w-4 h-4" style={{ color: '#8A8266' }} />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="搜尋地點，或 #標籤 找收藏"
                            className="flex-1 bg-transparent outline-none text-[14px]"
                            style={{ color: '#232320' }}
                        />
                        {dayCity && !tagMode && <span className="text-[9px] px-2 py-[2px] rounded-full" style={{ color: '#3F6B52', background: '#E7EFE9' }}>{dayCity}</span>}
                    </div>
                    {/* 標籤 chip */}
                    {topTags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {topTags.map(t => (
                                <button key={t} onClick={() => setQuery('#' + t)} className="text-[10px] px-2.5 py-1 rounded-full" style={{ color: '#8A8266', background: '#fff', border: '0.5px solid #E0D8C6' }}>#{t}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 結果 */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
                    {q.length < 2 && !tagMode && !linkMode && (
                        <div className="text-center py-10 text-[12px]" style={{ color: '#B4AE9E' }}>打 2 個字開始搜尋，或點上面的 #標籤 找收藏</div>
                    )}

                    {/* 🔗 D2①：貼連結解析段（沿用同一 Row 樣式，保持一致） */}
                    {linkMode && (
                        <>
                            <div className="flex items-center gap-1.5 px-2 pt-1 pb-2">
                                <Link2 className="w-3 h-3" style={{ color: '#3F6B52' }} />
                                <span className="text-[10px] font-bold" style={{ color: '#3F6B52' }}>從連結</span>
                                {linkLoading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8A8266' }} />}
                            </div>
                            {linkError && !linkLoading && (
                                <div className="text-center py-4 text-[12px]" style={{ color: '#A23B2E' }}>{linkError}</div>
                            )}
                            {linkResult && (() => {
                                const sp: SelectedPlace = { placeId: linkResult.placeId, name: linkResult.name, address: linkResult.address, lat: linkResult.lat, lng: linkResult.lng };
                                const d = detourMin(routeCoords, linkResult.lat, linkResult.lng);
                                const added = !!sp.placeId && existingPlaceIds.has(sp.placeId);
                                const area = shortArea(linkResult.address) || `${linkResult.lat.toFixed(4)}, ${linkResult.lng.toFixed(4)}`;
                                return (
                                    <Row name={linkResult.name} area={area} d={d} added={added}
                                        onAdd={() => onSelect(sp)}
                                        onSaveClick={onSave ? () => onSave(sp) : undefined}
                                        saved={!!sp.placeId && !!savedPlaceIds?.has(sp.placeId)} />
                                );
                            })()}
                        </>
                    )}

                    {/* 心願盒段 */}
                    {!linkMode && wishSorted.length > 0 && (
                        <>
                            <div className="flex items-center gap-1.5 px-2 pt-1 pb-2">
                                <Sparkles className="w-3 h-3" style={{ color: '#3F6B52' }} />
                                <span className="text-[10px] font-bold" style={{ color: '#3F6B52' }}>你存過的</span>
                            </div>
                            {wishSorted.map(({ w, d }) => (
                                <Row key={'w-' + w.id} name={w.title} area={shortArea(w.area || w.city)} d={d}
                                    added={!!w.placeId && existingPlaceIds.has(w.placeId)}
                                    onAdd={() => onSelect({ placeId: w.placeId, name: w.title, address: w.area || w.city, lat: w.lat, lng: w.lng })} />
                            ))}
                        </>
                    )}

                    {/* Google 段（tagMode/linkMode 不顯示） */}
                    {!linkMode && !tagMode && q.length >= 2 && (
                        <>
                            <div className="flex items-center gap-1.5 px-2 pt-2 pb-2">
                                <Search className="w-3 h-3" style={{ color: '#8A8266' }} />
                                <span className="text-[10px] font-bold" style={{ color: '#8A8266' }}>Google 地點</span>
                                {loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8A8266' }} />}
                            </div>
                            {error && <div className="text-center py-4 text-[12px]" style={{ color: '#A23B2E' }}>{error}</div>}
                            {!loading && !error && googleSorted.length === 0 && (
                                <div className="text-center py-4 text-[12px]" style={{ color: '#B4AE9E' }}>找不到，換個關鍵字試試</div>
                            )}
                            {googleSorted.map(({ r, d }) => {
                                const key = r.placeId || r.name;
                                const sp: SelectedPlace = { placeId: r.placeId, name: r.name, address: r.address, lat: r.lat, lng: r.lng };
                                return (
                                    <Row key={'g-' + key} name={r.name} area={shortArea(r.address)} d={d}
                                        added={!!r.placeId && existingPlaceIds.has(r.placeId)}
                                        onAdd={() => onSelect(sp)}
                                        onSaveClick={onSave ? () => onSave(sp) : undefined}
                                        saved={!!r.placeId && !!savedPlaceIds?.has(r.placeId)} />
                                );
                            })}
                            {nextPageToken && !loading && (
                                <button onClick={loadMore} disabled={loadingMore} className="w-full text-center py-2.5 rounded-xl text-[12px] font-bold mt-1" style={{ color: '#3F6B52', background: '#fff', border: '0.5px solid #E0D8C6' }}>
                                    {loadingMore ? '載入中…' : '更多結果'}
                                </button>
                            )}
                        </>
                    )}

                    {tagMode && q.length >= 2 && wishSorted.length === 0 && (
                        <div className="text-center py-8 text-[12px]" style={{ color: '#B4AE9E' }}>收藏裡沒有 #{tagTerm} 的地點</div>
                    )}

                    {noRoute && (wishSorted.length > 0 || googleSorted.length > 0) && (
                        <div className="text-center py-2 text-[10px]" style={{ color: '#C0BBAD' }}>這天還沒有站，暫時無法算順路</div>
                    )}
                </div>

                {!tagMode && <div className="px-4 py-2 text-right text-[9px] shrink-0" style={{ color: '#B4B0A4' }}>Powered by Google</div>}
            </div>
        </div>
    );
};
