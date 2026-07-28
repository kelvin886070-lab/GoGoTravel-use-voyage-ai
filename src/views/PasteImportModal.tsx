// src/views/PasteImportModal.tsx
// 🧱 Phase C1-0：貼上匯入。貼上自由格式文字 → AI 辨識 → 預覽勾選/編輯 → 匯入靈感。
import React, { useEffect, useMemo, useState } from 'react';
import {
    X, ClipboardPaste, Sparkles, Check, MapPin, ShoppingBag,
    Loader2, Download, ChevronLeft, Wand2, ArrowLeftRight
} from 'lucide-react';
import { parseWishesFromText, type ParsedWish } from '../services/gemini';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';

const MAX_BATCH = 35;

interface Row extends ParsedWish {
    _id: string;
    _selected: boolean;
}

interface PasteImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (rows: ParsedWish[]) => Promise<void> | void;
    onManual: () => void;
}

export const PasteImportModal: React.FC<PasteImportModalProps> = ({ isOpen, onClose, onImport, onManual }) => {
    const [text, setText] = useState('');
    const [parsing, setParsing] = useState(false);
    const [rows, setRows] = useState<Row[] | null>(null);
    const [batchTags, setBatchTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [importing, setImporting] = useState(false);
    // 🗺️ 整批地區（選填）：補地點列的 country/city → 正確分桶＋查詢自動偏置（免費 geocode 收斂）
    const [regionCountry, setRegionCountry] = useState('');
    const [regionCity, setRegionCity] = useState('');
    // 純自動：不再前置選類型，使用者貼完在預覽修錯即可（降低負擔）
    useEffect(() => { if (isOpen) setRows(null); }, [isOpen]);

    const selPlace = useMemo(() => rows?.filter(r => r._selected && r.type === 'place').length ?? 0, [rows]);
    const selItem = useMemo(() => rows?.filter(r => r._selected && r.type === 'item').length ?? 0, [rows]);
    const selectedCount = selPlace + selItem;
    // 匯入鈕文案：依實際勾選的兩桶分別計數
    const importLabel = [selPlace ? `${selPlace} 地點` : '', selItem ? `${selItem} 購物` : ''].filter(Boolean).join(' · ') || '0 筆';

    if (!isOpen) return null;

    const reset = () => { setText(''); setRows(null); setBatchTags([]); setTagInput(''); setRegionCountry(''); setRegionCity(''); };
    const handleClose = () => { reset(); onClose(); };

    const pasteFromClipboard = async () => {
        try {
            const t = await navigator.clipboard.readText();
            if (t) setText(t);
            else toast('剪貼簿沒有文字，請手動貼上。');
        } catch {
            toast('無法讀取剪貼簿，請長按輸入框手動貼上。');
        }
    };

    const handleParse = async () => {
        if (!text.trim()) { toast('請先貼上文字。'); return; }
        setParsing(true);
        try {
            const parsed = await parseWishesFromText(text, 'auto');
            if (parsed.length === 0) { toast('沒有辨識到可匯入的項目，請確認內容。'); return; }
            const capped = parsed.slice(0, MAX_BATCH);
            if (parsed.length > MAX_BATCH) toast(`一次最多 ${MAX_BATCH} 筆，已取前 ${MAX_BATCH} 筆，其餘請分批貼上。`);
            setRows(capped.map((p, i) => ({ ...p, _id: `${Date.now()}-${i}`, _selected: true })));
        } catch (e) {
            console.error('辨識失敗', e);
            toast('辨識失敗，請稍後再試。');
        } finally {
            setParsing(false);
        }
    };

    const addBatchTag = () => {
        const t = tagInput.trim().replace(/^#/, '');
        if (t && !batchTags.includes(t)) setBatchTags([...batchTags, t]);
        setTagInput('');
    };

    const toggleRow = (id: string) =>
        setRows(prev => prev?.map(r => r._id === id ? { ...r, _selected: !r._selected } : r) ?? null);
    const editTitle = (id: string, v: string) =>
        setRows(prev => prev?.map(r => r._id === id ? { ...r, title: v } : r) ?? null);
    // 🧭 逐列改判：AI 混合分類的安全網，誤判一鍵改回正確桶
    const editType = (id: string) =>
        setRows(prev => prev?.map(r => r._id === id ? { ...r, type: r.type === 'place' ? 'item' : 'place' } : r) ?? null);
    // 🧭 整區改判：同質長清單被系統性誤判時，一鍵把整區丟到另一桶
    const reclassifySection = (from: 'place' | 'item') =>
        setRows(prev => prev?.map(r => r.type === from ? { ...r, type: from === 'place' ? 'item' : 'place' } : r) ?? null);
    const removeRow = (id: string) =>
        setRows(prev => prev?.filter(r => r._id !== id) ?? null);
    const allSelected = rows?.every(r => r._selected) ?? false;
    const toggleAll = () =>
        setRows(prev => prev?.map(r => ({ ...r, _selected: !allSelected })) ?? null);

    const renderRow = (r: Row) => (
        <div key={r._id}
             className={`flex gap-3 bg-white rounded-2xl p-3 border transition-all ${r._selected ? (r.note ? 'border-[#F0D9A8]' : 'border-[#45846D]') : 'border-black/5 opacity-55'}`}>
            <button onClick={() => toggleRow(r._id)}
                    className={`w-[22px] h-[22px] rounded-[7px] flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${r._selected ? 'bg-[#45846D] text-white' : 'bg-white border-[1.5px] border-gray-300'}`}>
                {r._selected && <Check className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
                <input
                    value={r.title}
                    onChange={e => editTitle(r._id, e.target.value)}
                    className="w-full text-sm font-bold text-[#1D1D1B] bg-transparent outline-none focus:bg-gray-50 rounded px-1 -mx-1"
                />
                {r.address && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{r.address}</p>}
                {r.type === 'item' && r.budget != null && (
                    <p className="text-[11px] font-bold text-[#1D1D1B] mt-0.5 font-mono">{r.currency || ''} {r.budget.toLocaleString()}</p>
                )}
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {/* 逐列改判：把這筆丟到另一桶（誤判一鍵修正） */}
                    <button onClick={() => editType(r._id)}
                            className="text-[10px] font-bold text-gray-500 bg-[#F1EFE8] hover:bg-[#E7E3D8] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors">
                        <ArrowLeftRight className="w-2.5 h-2.5" />移到{r.type === 'place' ? '購物清單' : '地點'}
                    </button>
                    {r.city && <span className="text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md">{r.city}</span>}
                    {r.area && <span className="text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md">{r.area}</span>}
                    {r.forWhom && <span className="text-[10px] font-bold text-[#993556] bg-[#FBEAF0] px-2 py-0.5 rounded-md">給{r.forWhom}</span>}
                    {r.type === 'item' && (r.quantity ?? 0) > 1 && <span className="text-[10px] font-mono text-gray-500 bg-[#F1EFE8] px-2 py-0.5 rounded-md">×{r.quantity}</span>}
                    {r.note && <span className="text-[10px] font-bold text-[#854F0B] bg-[#FAEEDA] px-2 py-0.5 rounded-md">{r.note}</span>}
                    {(r.tags || []).map(t => <span key={t} className="text-[10px] text-gray-500 bg-[#F1EFE8] px-2 py-0.5 rounded-md">#{t}</span>)}
                </div>
            </div>
            <button onClick={() => removeRow(r._id)} className="text-gray-300 hover:text-gray-500 self-start"><X className="w-4 h-4" /></button>
        </div>
    );

    const handleImport = async () => {
        if (!rows) return;
        const chosen = rows.filter(r => r._selected);
        if (chosen.length === 0) { toast('請至少選一筆。'); return; }

        // 🗺️ ask-once：有地點但沒指定地區 → 提醒一次（避免全球亂定位）
        const hasPlace = chosen.some(r => r.type === 'place');
        const regionSet = !!(regionCountry || regionCity.trim());
        if (hasPlace && !regionSet) {
            const go = await confirmDialog({
                title: '沒指定「整批地區」',
                message: '這批有地點但沒填地區，定位可能不準。留空我仍會自動推測、把可疑的標成「位置待確認」，但填了會準很多。',
                confirmText: '仍直接匯入',
                cancelText: '回去指定',
            });
            if (!go) return;
        }

        setImporting(true);
        try {
            const rc = regionCountry.trim();
            const rcity = regionCity.trim();
            const payload: ParsedWish[] = chosen.map(({ _id, _selected, ...rest }) => {
                // 只補「地點」列缺的 country/city；AI 已判出的城市不覆蓋
                const withRegion = rest.type === 'place'
                    ? { ...rest, country: rest.country || rc || undefined, city: rest.city || rcity || undefined }
                    : rest;
                return { ...withRegion, tags: Array.from(new Set([...(rest.tags || []), ...batchTags])) };
            });
            await onImport(payload);
            handleClose();
        } catch (e) {
            console.error('匯入失敗', e);
            toast('匯入失敗，請再試一次。');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm animate-in fade-in" onClick={handleClose} />

            <div className="relative z-10 w-full sm:max-w-md bg-[#F2F1ED] rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">

                {/* 標頭 */}
                <div className="flex-shrink-0 bg-white rounded-t-[32px] px-5 pt-5 pb-4 border-b border-[#1D1D1B]/5">
                    <div className="flex items-center gap-2 mb-3">
                        <button onClick={rows ? () => setRows(null) : handleClose} className="text-gray-400 hover:text-gray-600 -ml-1">
                            {rows ? <ChevronLeft className="w-6 h-6" /> : <X className="w-5 h-5" />}
                        </button>
                        <h2 className="font-serif text-xl font-bold text-[#1D1D1B]">新增收藏</h2>
                    </div>

                    {/* 純自動：不再前置選類型。地點、購物混著貼，辨識後在預覽修錯即可 */}
                    {!rows && (
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 bg-[#EAF3DE]/60 rounded-lg px-3 py-2">
                            <Wand2 className="w-3.5 h-3.5 text-[#45846D] shrink-0" />
                            地點、購物混著貼都可以，會自動幫你分好，辨識後可再調整。
                        </div>
                    )}

                    {/* 🗺️ 整批地區（選填）：一次講明「這批在哪」，分桶正確、定位大幅收斂 */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                        <span className="text-[11px] text-gray-400">整批地區</span>
                        <select
                            value={regionCountry}
                            onChange={e => setRegionCountry(e.target.value)}
                            className="text-[11px] text-[#45846D] bg-transparent border border-dashed border-[#A9C6B8] rounded-md px-2 py-1 outline-none">
                            <option value="">國家</option>
                            {['台灣', '日本', '韓國', '泰國', '香港', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            value={regionCity}
                            onChange={e => setRegionCity(e.target.value)}
                            placeholder="城市／地區（例：台南）"
                            className="text-[11px] text-[#45846D] bg-transparent border border-dashed border-[#A9C6B8] rounded-md px-2 py-1 w-32 outline-none placeholder-[#A9C6B8]"
                        />
                        <span className="text-[10px] text-gray-300 w-full">填了定位更準、分桶正確；留空我會自動推。</span>
                    </div>

                    {/* 整批標籤 */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-[11px] text-gray-400">整批標籤</span>
                        {batchTags.map(t => (
                            <span key={t} onClick={() => setBatchTags(batchTags.filter(x => x !== t))}
                                  className="text-[11px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md cursor-pointer">
                                #{t} <span className="opacity-50">×</span>
                            </span>
                        ))}
                        <input
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBatchTag(); } }}
                            onBlur={addBatchTag}
                            placeholder="＋加標籤"
                            className="text-[11px] text-[#45846D] bg-transparent border border-dashed border-[#A9C6B8] rounded-md px-2 py-0.5 w-20 outline-none placeholder-[#45846D]"
                        />
                    </div>
                </div>

                {/* 內容 */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4">
                    {!rows ? (
                        <div className="space-y-3">
                            <textarea
                                value={text}
                                onChange={e => setText(e.target.value)}
                                placeholder={'地點和購物混著貼沒關係，會自動幫你分好…\n\n例如：\n萬座毛 沖繩恩納村\n白色戀人 幫姊姊買 ×3\n國際通 唐吉訶德\nEVE 止痛藥 約 1200 日圓'}
                                className="w-full h-48 bg-white rounded-2xl p-4 text-sm text-[#1D1D1B] outline-none border border-transparent focus:border-[#45846D]/30 resize-none leading-relaxed"
                            />
                            <button onClick={pasteFromClipboard}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-gray-500 text-sm font-bold border border-gray-100 hover:bg-gray-50 transition-colors">
                                <ClipboardPaste className="w-4 h-4" /> 從剪貼簿貼上
                            </button>
                            <button onClick={() => { handleClose(); onManual(); }}
                                    className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">
                                改用表單詳細填寫（含照片、預算）
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[13px] font-bold text-[#1D1D1B] flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-[#45846D]" /> 辨識到 {rows.length} 筆{rows.length > 0 ? `（${rows.filter(r => r.type === 'place').length} 地點 · ${rows.filter(r => r.type === 'item').length} 購物）` : ''}
                                </p>
                                <button onClick={toggleAll} className="text-[12px] text-gray-500 hover:text-gray-700">{allSelected ? '全不選' : '全選'}</button>
                            </div>

                            <p className="text-[11px] text-gray-400 leading-relaxed px-1 -mt-1">
                                分錯了？點該列「移到…」即可。<span className="text-gray-500">地點</span>＝要去的地方（地圖）· <span className="text-gray-500">購物</span>＝要帶回家的東西（清單）。
                            </p>

                            {(['place', 'item'] as const).map(sec => {
                                const secRows = rows.filter(r => r.type === sec);
                                if (secRows.length === 0) return null;
                                return (
                                    <div key={sec}>
                                        <div className="flex items-center justify-between px-1 mb-1.5">
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                                {sec === 'place' ? <MapPin className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                                                {sec === 'place' ? '地點' : '購物'} · {secRows.length}
                                            </span>
                                            <button onClick={() => reclassifySection(sec)}
                                                    className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#45846D] transition-colors">
                                                <ArrowLeftRight className="w-3 h-3" />整區移到{sec === 'place' ? '購物清單' : '地點'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {secRows.map(r => renderRow(r))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 底部動作 */}
                <div className="flex-shrink-0 px-4 pb-safe pt-3 pb-5">
                    {!rows ? (
                        <button onClick={handleParse} disabled={parsing || !text.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#45846D] text-white font-bold disabled:opacity-40 active:scale-[0.98] transition-all">
                            {parsing ? <><Loader2 className="w-5 h-5 animate-spin" /> 辨識中…</> : <><Sparkles className="w-5 h-5" /> 辨識</>}
                        </button>
                    ) : (
                        <button onClick={handleImport} disabled={importing || selectedCount === 0}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#45846D] text-white font-bold disabled:opacity-40 active:scale-[0.98] transition-all">
                            {importing ? <><Loader2 className="w-5 h-5 animate-spin" /> 匯入中…</>
                                : <><Download className="w-5 h-5" /> 匯入 {importLabel}{batchTags.length > 0 ? `・${batchTags.length} 標籤` : ''}</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
