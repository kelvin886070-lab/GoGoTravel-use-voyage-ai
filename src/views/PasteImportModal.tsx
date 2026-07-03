// src/views/PasteImportModal.tsx
// 🧱 Phase C1-0：貼上匯入。貼上自由格式文字 → AI 辨識 → 預覽勾選/編輯 → 匯入靈感。
import React, { useMemo, useState } from 'react';
import {
    X, ClipboardPaste, Sparkles, Check, MapPin, ShoppingBag,
    Loader2, Download, Plus, ChevronLeft
} from 'lucide-react';
import { parseWishesFromText, type ParsedWish } from '../services/gemini';
import { toast } from '../components/Toast';

type Mode = 'place' | 'item';
const MAX_BATCH = 35;

interface Row extends ParsedWish {
    _id: string;
    _selected: boolean;
}

interface PasteImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (rows: ParsedWish[]) => Promise<void> | void;
}

export const PasteImportModal: React.FC<PasteImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [mode, setMode] = useState<Mode>('place');
    const [text, setText] = useState('');
    const [parsing, setParsing] = useState(false);
    const [rows, setRows] = useState<Row[] | null>(null);
    const [batchTags, setBatchTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [importing, setImporting] = useState(false);

    const selectedCount = useMemo(() => rows?.filter(r => r._selected).length ?? 0, [rows]);
    const unit = mode === 'item' ? '項目' : '地點';

    if (!isOpen) return null;

    const reset = () => { setText(''); setRows(null); setBatchTags([]); setTagInput(''); };
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
            const parsed = await parseWishesFromText(text, mode);
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
    const removeRow = (id: string) =>
        setRows(prev => prev?.filter(r => r._id !== id) ?? null);
    const allSelected = rows?.every(r => r._selected) ?? false;
    const toggleAll = () =>
        setRows(prev => prev?.map(r => ({ ...r, _selected: !allSelected })) ?? null);

    const handleImport = async () => {
        if (!rows) return;
        const chosen = rows.filter(r => r._selected);
        if (chosen.length === 0) { toast('請至少選一筆。'); return; }
        setImporting(true);
        try {
            const payload: ParsedWish[] = chosen.map(({ _id, _selected, ...rest }) => ({
                ...rest,
                tags: Array.from(new Set([...(rest.tags || []), ...batchTags])),
            }));
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
                        <h2 className="font-serif text-xl font-bold text-[#1D1D1B]">貼上匯入</h2>
                    </div>

                    {/* 模式切換 */}
                    <div className="bg-[#767680]/10 p-[2px] rounded-lg flex relative items-center h-9">
                        <div className="absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] bg-white rounded-md shadow-sm transition-all duration-300"
                             style={{ left: mode === 'place' ? '2px' : 'calc(50%)' }} />
                        <button onClick={() => { setMode('place'); setRows(null); }}
                                className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors ${mode === 'place' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}>
                            <MapPin className="w-3.5 h-3.5" /> 地點
                        </button>
                        <button onClick={() => { setMode('item'); setRows(null); }}
                                className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 h-full text-[13px] font-bold rounded-md transition-colors ${mode === 'item' ? 'text-[#1D1D1B]' : 'text-gray-500'}`}>
                            <ShoppingBag className="w-3.5 h-3.5" /> 購物
                        </button>
                    </div>

                    {/* 整批標籤 */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
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
                                placeholder={mode === 'place'
                                    ? '貼上你的地點清單，例如：\n\n3. 冬日Dongri\n708臺南市安平區效忠街7號之5\nhttps://maps.app.goo.gl/...'
                                    : '貼上你想買的清單，例如：\n\nEVE 止痛藥（藥妝店必買）\n資生堂洗面乳 約 1200 日圓'}
                                className="w-full h-52 bg-white rounded-2xl p-4 text-sm text-[#1D1D1B] outline-none border border-transparent focus:border-[#45846D]/30 resize-none leading-relaxed"
                            />
                            <button onClick={pasteFromClipboard}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-gray-500 text-sm font-bold border border-gray-100 hover:bg-gray-50 transition-colors">
                                <ClipboardPaste className="w-4 h-4" /> 從剪貼簿貼上
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between px-1 mb-2">
                                <p className="text-[13px] font-bold text-[#1D1D1B] flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-[#45846D]" /> 辨識到 {rows.length} 個{unit}
                                </p>
                                <button onClick={toggleAll} className="text-[12px] text-gray-500 hover:text-gray-700">{allSelected ? '全不選' : '全選'}</button>
                            </div>
                            <div className="space-y-2">
                                {rows.map(r => (
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
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {r.area && <span className="text-[10px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded-md">{r.area}</span>}
                                                {r.note && <span className="text-[10px] font-bold text-[#854F0B] bg-[#FAEEDA] px-2 py-0.5 rounded-md">{r.note}</span>}
                                                {(r.tags || []).map(t => <span key={t} className="text-[10px] text-gray-500 bg-[#F1EFE8] px-2 py-0.5 rounded-md">#{t}</span>)}
                                            </div>
                                        </div>
                                        <button onClick={() => removeRow(r._id)} className="text-gray-300 hover:text-gray-500 self-start"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
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
                                : <><Download className="w-5 h-5" /> 匯入 {selectedCount} 個{unit}{batchTags.length > 0 ? `・套用 ${batchTags.length} 標籤` : ''}</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
