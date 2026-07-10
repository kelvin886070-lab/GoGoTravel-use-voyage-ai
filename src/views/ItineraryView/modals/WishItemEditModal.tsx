import React, { useState, useMemo, useRef } from 'react';
import {
    X, MapPin, ShoppingBag, Camera, Store, Trash2,
    Link as LinkIcon, Tag as TagIcon, Save, Globe, MapPinPlus, MapPinCheck
} from 'lucide-react';
import type { WishItem, WishItemType } from '../../../types';
import { toast } from '../../../components/Toast';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CURRENCY_SYMBOLS } from '../shared';
import { uploadTripImage, signPaths } from '../../../services/storage';
import { LocationPinSheet } from '../../../components/wish/LocationPinSheet';
import { coordsFromMapsUrl } from '../../../services/geo';
import { looksLikeMapsUrl, parseMapsUrl, isShortMapsUrl } from '../../../utils/mapsUrl';

interface WishItemEditModalProps {
    item?: WishItem | null; // 傳入 item 代表編輯，不傳代表新增
    allWishItems: WishItem[]; // 傳入所有心願，用於萃取歷史分區與標籤
    onSave: (item: WishItem) => void;
    onClose: () => void;
    onDelete?: (id: string) => void;
}

// 完美繼承 ActivityDetailModal 的標籤上色邏輯
const getTagColor = (tag: string) => {
    const colors = [
        'text-pink-600 bg-pink-50',
        'text-blue-600 bg-blue-50',
        'text-orange-600 bg-orange-50',
        'text-purple-600 bg-purple-50',
        'text-cyan-600 bg-cyan-50',
    ];
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export const WishItemEditModal: React.FC<WishItemEditModalProps> = ({ 
    item, allWishItems, onSave, onClose, onDelete 
}) => {
    const isEditing = !!item;
    
    // 初始化表單狀態
    const [edited, setEdited] = useState<WishItem>(item || {
        id: crypto.randomUUID(),
        type: 'place',
        country: '',
        title: '',
        createdAt: new Date().toISOString()
    });

    // UX 狀態
    const [showAreaDropdown, setShowAreaDropdown] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [pinOpen, setPinOpen] = useState(false);   // 🧭 T3 拖釘校正
    const [urlPin, setUrlPin] = useState<'idle' | 'loading' | 'fail'>('idle');   // 🧭 T0 連結定位狀態（安靜）

    // 🧭 T0（B 版｜全自動＋安靜）：完整網址打字/貼上即時解析；短網址離開欄位時背景解析
    const handleUrlChange = (v: string) => {
        setUrlPin('idle');
        const local = parseMapsUrl(v);
        setEdited(prev => local
            ? { ...prev, url: v, lat: local.lat, lng: local.lng, needsLocationConfirm: false }
            : { ...prev, url: v });
    };
    const handleUrlBlur = async () => {
        const u = edited.url || '';
        if (!looksLikeMapsUrl(u) || parseMapsUrl(u) || !isShortMapsUrl(u)) return;  // 完整網址已即時處理
        setUrlPin('loading');
        const c = await coordsFromMapsUrl(u);
        if (c) { setEdited(prev => ({ ...prev, lat: c.lat, lng: c.lng, needsLocationConfirm: false })); setUrlPin('idle'); }
        else setUrlPin('fail');
    };

    // 🛡️ 防禦 1：鍵盤防遮擋 (Keyboard Avoidance)
    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    };

    // 💡 智慧邏輯：萃取該國家曾用過的歷史分區
    const availableAreas = useMemo(() => {
        if (!edited.country) return [];
        const areas = new Set<string>();
        allWishItems.forEach(w => {
            if (w.country === edited.country && w.area) {
                areas.add(w.area);
            }
        });
        return Array.from(areas);
    }, [edited.country, allWishItems]);

    // 表單更新 Handler
    const handleChange = (field: keyof WishItem, value: any) => {
        setEdited(prev => ({ ...prev, [field]: value }));
    };

    // 🧱 C5 圖片改上傳 Storage：存 durable 路徑、顯示 signed URL（不再把 base64 塞進 DB）
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const path = await uploadTripImage(file);
            const urlMap = await signPaths([path]);
            setEdited(prev => ({ ...prev, customImagePath: path, customImage: urlMap[path] || '' }));
        } catch (err) {
            console.error('心願圖片上傳失敗', err);
            toast('圖片上傳失敗，請再試一次。');
        }
    };

    // 標籤操作
    const handleAddTag = () => {
        const newTag = tagInput.trim().replace(/^#/, ''); // 自動濾掉開頭的 #
        if (newTag && !edited.tags?.includes(newTag)) {
            handleChange('tags', [...(edited.tags || []), newTag]);
        }
        setTagInput('');
    };

    const handleSave = () => {
        if (!edited.title.trim() || !edited.country.trim()) {
            toast('請至少填寫「國家」與「名稱」喔！');
            return;
        }
        onSave(edited);
    };

    const isPlace = edited.type === 'place';

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* 🛡️ 防禦 2：底層鎖定 (touch-none overscroll-none) 阻絕穿透 */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in touch-none overscroll-none" onClick={onClose} />

            <div className="bg-[#F2F1ED] w-full max-w-sm rounded-t-[32px] relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
                
                {/* === Header：標題 + 降級的類型切換 === */}
                <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-black/5 flex justify-between items-center bg-white rounded-t-[32px]">
                    <div className="flex items-center gap-2.5">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        <h3 className="font-serif text-xl font-bold text-[#1D1D1B]">{isEditing ? '編輯' : '新增'}</h3>
                    </div>
                    <div className="flex bg-[#767680]/10 rounded-lg p-[2px] text-xs font-bold">
                        <button onClick={() => handleChange('type', 'place')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors ${isPlace ? 'bg-[#45846D] text-white' : 'text-gray-500'}`}><MapPin className="w-3 h-3" /> 地點</button>
                        <button onClick={() => handleChange('type', 'item')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors ${!isPlace ? 'bg-[#45846D] text-white' : 'text-gray-500'}`}><ShoppingBag className="w-3 h-3" /> 購物</button>
                    </div>
                </div>

                {/* === 內容 === */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4 overscroll-contain">

                    {/* 主區塊：圖片縮圖 + 名稱 */}
                    <div className="flex gap-3 items-center">
                        <label className="w-16 h-16 rounded-2xl bg-[#E9E5DC] flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer relative text-[#B0AA9E] hover:text-[#45846D] transition-colors">
                            {edited.customImage ? (
                                <>
                                    <img src={edited.customImage} alt="preview" className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">更換</span>
                                </>
                            ) : <Camera className="w-6 h-6" />}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <div className="flex-1 min-w-0">
                            <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider">名稱 <span className="text-red-400">*</span></label>
                            <input
                                onFocus={handleFocus}
                                value={edited.title}
                                onChange={e => handleChange('title', e.target.value)}
                                placeholder={isPlace ? '例: Blue Bottle' : '例: 白色戀人'}
                                className="w-full bg-transparent text-lg font-bold text-[#1D1D1B] outline-none border-b border-[#E2DFD8] focus:border-[#45846D] py-1 transition-colors"
                            />
                        </div>
                    </div>

                    {/* 國家 + 城市 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                            <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider flex items-center gap-1"><Globe className="w-3 h-3" /> 國家 <span className="text-red-400">*</span></label>
                            <input onFocus={handleFocus} value={edited.country} onChange={e => handleChange('country', e.target.value)} placeholder="例: 日本" className="w-full bg-transparent text-sm font-bold text-[#1D1D1B] outline-none pt-0.5" />
                        </div>
                        <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                            <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> 城市</label>
                            <input onFocus={handleFocus} value={edited.city || ''} onChange={e => handleChange('city', e.target.value)} placeholder="例: 東京" className="w-full bg-transparent text-sm font-bold text-[#1D1D1B] outline-none pt-0.5" />
                        </div>
                    </div>

                    {/* 類型專屬區塊 */}
                    {isPlace ? (
                        <>
                            {/* 分區（含歷史下拉） */}
                            <div className="relative bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                                <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> 自訂分區</label>
                                <input
                                    value={edited.area || ''}
                                    onFocus={(e) => { handleFocus(e); setShowAreaDropdown(true); }}
                                    onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
                                    onChange={e => handleChange('area', e.target.value)}
                                    placeholder="例: 澀谷區"
                                    className="w-full bg-transparent text-sm font-bold text-[#1D1D1B] outline-none pt-0.5"
                                />
                                {showAreaDropdown && availableAreas.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 max-h-32 overflow-y-auto animate-in fade-in zoom-in-95">
                                        {availableAreas.map(area => (
                                            <button key={area} onMouseDown={(e) => { e.preventDefault(); handleChange('area', area); setShowAreaDropdown(false); }}
                                                    className="w-full text-left px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-[#45846D] transition-colors">{area}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* 網址 */}
                            <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                                <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider flex items-center gap-1"><LinkIcon className="w-3 h-3" /> 網址連結</label>
                                <input type="url" onFocus={handleFocus} onBlur={handleUrlBlur} value={edited.url || ''} onChange={e => handleUrlChange(e.target.value)} placeholder="貼上 Google Maps / IG 連結…" className="w-full bg-transparent text-sm font-medium text-blue-500 outline-none pt-0.5" />
                                {/* 🧭 T0（B 版）：連結定位狀態——成功安靜（由下方地圖位置列反映），只在讀取/失敗給淡提示 */}
                                {urlPin === 'loading' && <p className="mt-1.5 text-[11px] text-gray-400">讀取連結位置中…</p>}
                                {urlPin === 'fail' && <p className="mt-1.5 text-[11px] text-gray-400">連結讀不到座標，可用下方地圖定位</p>}
                            </div>
                            {/* 🧭 T3 地圖位置：三段式視覺階層——待確認(吵)／已定位(安靜)／未定位(中性) */}
                            {edited.needsLocationConfirm ? (
                                <button onClick={() => setPinOpen(true)} className="w-full bg-[#FAEEDA] rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                                    <span className="w-9 h-9 rounded-xl bg-white/70 text-[#854F0B] flex items-center justify-center flex-shrink-0"><MapPinPlus className="w-4 h-4" /></span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[#B0894B] tracking-wider">地圖位置</p>
                                        <p className="text-sm font-bold text-[#854F0B]">位置待確認・點我在地圖上修正</p>
                                    </div>
                                </button>
                            ) : edited.lat != null ? (
                                <button onClick={() => setPinOpen(true)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#45846D] px-1 py-0.5 transition-colors">
                                    <MapPinCheck className="w-3.5 h-3.5 text-[#45846D]" /> 已在地圖上定位 · <span className="underline underline-offset-2">微調位置</span>
                                </button>
                            ) : (
                                <button onClick={() => setPinOpen(true)} className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                                    <span className="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0"><MapPinPlus className="w-4 h-4" /></span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[#B0AA9E] tracking-wider">地圖位置</p>
                                        <p className="text-sm font-bold text-gray-400">尚未定位・點我在地圖上指定</p>
                                    </div>
                                </button>
                            )}
                            {/* 希望時段（選填，一鍵順路優先尊重） */}
                            <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                                <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider flex items-center gap-1">希望時段（選填）</label>
                                <div className="flex gap-1.5 mt-1.5">
                                    {([['', '不指定'], ['morning', '上午'], ['afternoon', '下午'], ['evening', '晚上']] as const).map(([val, label]) => (
                                        <button key={label} onClick={() => handleChange('preferredSlot', val || undefined)}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${((edited.preferredSlot || '') === val) ? 'bg-[#45846D] text-white' : 'bg-gray-100 text-gray-500'}`}>{label}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* 購物：類別/店家 + 預算 */
                        <div className="bg-[#EDF2F0] border border-[#45846D]/15 rounded-2xl p-4 space-y-3">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-[#45846D] tracking-wider flex items-center gap-1"><Store className="w-3 h-3" /> 類別 / 店家</label>
                                <input
                                    value={edited.area || ''}
                                    onFocus={(e) => { handleFocus(e); setShowAreaDropdown(true); }}
                                    onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
                                    onChange={e => handleChange('area', e.target.value)}
                                    placeholder="例: Lawson、生鮮、Uniqlo"
                                    className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-3 py-2.5 mt-1 rounded-xl outline-none border border-[#45846D]/20 focus:border-[#45846D]/40"
                                />
                                {showAreaDropdown && availableAreas.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 max-h-32 overflow-y-auto animate-in fade-in zoom-in-95">
                                        {availableAreas.map(area => (
                                            <button key={area} onMouseDown={(e) => { e.preventDefault(); handleChange('area', area); setShowAreaDropdown(false); }}
                                                    className="w-full text-left px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-[#45846D] transition-colors">{area}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="w-1/3">
                                    <label className="text-[10px] font-bold text-[#45846D] tracking-wider pl-1">幣別</label>
                                    <select value={edited.currency || 'TWD'} onChange={e => handleChange('currency', e.target.value)}
                                            className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-3 py-2.5 mt-1 rounded-xl outline-none border border-[#45846D]/20 focus:border-[#45846D]/40 appearance-none">
                                        {Object.keys(CURRENCY_SYMBOLS).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-[#45846D] tracking-wider pl-1">預算（選填）</label>
                                    <input type="number" onFocus={handleFocus} value={edited.budget || ''} onChange={e => handleChange('budget', Number(e.target.value))} placeholder="例: 1500"
                                           className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-4 py-2.5 mt-1 rounded-xl outline-none border border-[#45846D]/20 focus:border-[#45846D]/40" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 標籤（共用） */}
                    <div>
                        <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider pl-1 flex items-center gap-1"><TagIcon className="w-3 h-3" /> 標籤</label>
                        {edited.tags && edited.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 my-2">
                                {edited.tags.map(tag => (
                                    <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${getTagColor(tag)}`}>
                                        #{tag}
                                        <button onClick={() => handleChange('tags', edited.tags?.filter(t => t !== tag))} className="ml-1 opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2 mt-1.5">
                            <input onFocus={handleFocus} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="輸入標籤（如: 咖啡、藥妝）"
                                   className="flex-1 bg-white text-xs font-bold text-[#1D1D1B] px-3 py-2.5 rounded-xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm" />
                            <button onClick={handleAddTag} className="bg-[#45846D]/10 text-[#45846D] px-3 rounded-xl text-xs font-bold hover:bg-[#45846D]/20 transition-colors">新增</button>
                        </div>
                    </div>

                    {/* 備註（共用） */}
                    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                        <label className="text-[10px] font-bold text-[#B0AA9E] tracking-wider">備註</label>
                        <textarea onFocus={handleFocus} value={edited.notes || ''} onChange={e => handleChange('notes', e.target.value)} placeholder="寫下細節…"
                                  className="w-full bg-transparent text-sm font-medium text-[#1D1D1B] outline-none min-h-[64px] resize-none pt-1" />
                    </div>
                </div>

                {/* === Footer === */}
                <div className="flex-shrink-0 p-4 border-t border-black/5 bg-white pb-safe flex gap-3 rounded-b-[32px]">
                    {isEditing && onDelete && (
                        <button onClick={async () => { if(await confirmDialog({ title: '刪除這個心願？', confirmText: '刪除', tone: 'danger' })) onDelete(edited.id); }}
                                className="w-12 flex items-center justify-center rounded-xl bg-[#FBE9E4] text-[#C0573E] hover:bg-[#F6D9D0] transition-colors">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={handleSave} className="flex-1 py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" /> {isEditing ? '儲存變更' : '收藏心願'}
                    </button>
                </div>
            </div>

            {/* 🧭 T3 拖釘校正（更新草稿，按儲存才寫回） */}
            <LocationPinSheet
                open={pinOpen}
                title={edited.title || '這個地點'}
                area={edited.area || edited.city}
                initial={{ lat: edited.lat, lng: edited.lng }}
                onConfirm={(lat, lng) => { setEdited(prev => ({ ...prev, lat, lng, needsLocationConfirm: false })); setPinOpen(false); toast('位置已更新，記得按儲存', 'success'); }}
                onClose={() => setPinOpen(false)}
            />
        </div>
    );
};