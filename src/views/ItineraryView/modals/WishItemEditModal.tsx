import React, { useState, useMemo, useRef } from 'react';
import { 
    X, MapPin, ShoppingBag, ChevronDown, Camera, 
    Link as LinkIcon, Image as ImageIcon, Tag as TagIcon, Save, Globe
} from 'lucide-react';
import type { WishItem, WishItemType } from '../../../types';

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
    const [showDetails, setShowDetails] = useState(isEditing); // 編輯模式預設展開，新增模式預設極簡
    const [showAreaDropdown, setShowAreaDropdown] = useState(false);
    const [tagInput, setTagInput] = useState('');

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

    // 圖片上傳 (轉 Base64)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            handleChange('customImage', reader.result as string);
        };
        reader.readAsDataURL(file);
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
            alert('請至少填寫「國家」與「名稱」喔！');
            return;
        }
        onSave(edited);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* 🛡️ 防禦 2：底層鎖定 (touch-none overscroll-none) 阻絕穿透 */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in touch-none overscroll-none" onClick={onClose} />
            
            <div className="bg-[#F2F2F2] w-full max-w-sm rounded-t-[32px] relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
                
                {/* === 抽屜 Header === */}
                <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200/50 flex justify-between items-center bg-white rounded-t-[32px]">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">{isEditing ? '編輯心願' : '收藏新靈感'}</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* === 抽屜內容 (可滾動區) === */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-5 overscroll-contain">
                    
                    {/* 1. 分類切換 (地點 / 物品) */}
                    <div className="bg-white p-1 rounded-2xl flex shadow-sm border border-gray-100">
                        <button 
                            onClick={() => handleChange('type', 'place')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-colors ${edited.type === 'place' ? 'bg-[#45846D] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <MapPin className="w-4 h-4" /> 地點景點
                        </button>
                        <button 
                            onClick={() => handleChange('type', 'item')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-colors ${edited.type === 'item' ? 'bg-[#45846D] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ShoppingBag className="w-4 h-4" /> 購物清單
                        </button>
                    </div>

                    {/* 2. 國家與分區 (Grid Layout) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                <Globe className="w-3 h-3" /> 國家/城市 <span className="text-red-400">*</span>
                            </label>
                            <input 
                                type="text"
                                onFocus={handleFocus}
                                value={edited.country}
                                onChange={e => handleChange('country', e.target.value)}
                                placeholder="例: 日本"
                                className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-4 py-3.5 rounded-2xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm transition-all"
                            />
                        </div>
                        <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> 自訂分區
                            </label>
                            <input 
                                type="text"
                                value={edited.area || ''}
                                onFocus={(e) => { handleFocus(e); setShowAreaDropdown(true); }}
                                onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
                                onChange={e => handleChange('area', e.target.value)}
                                placeholder="例: 澀谷區"
                                className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-4 py-3.5 rounded-2xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm transition-all"
                            />
                            {/* 💡 智慧歷史分區下拉選單 */}
                            {showAreaDropdown && availableAreas.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 max-h-32 overflow-y-auto animate-in fade-in zoom-in-95">
                                    {availableAreas.map(area => (
                                        <button
                                            key={area}
                                            onMouseDown={(e) => { e.preventDefault(); handleChange('area', area); setShowAreaDropdown(false); }}
                                            className="w-full text-left px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-[#45846D] transition-colors"
                                        >
                                            {area}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. 名稱 */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                            名稱 <span className="text-red-400">*</span>
                        </label>
                        <input 
                            type="text"
                            onFocus={handleFocus}
                            value={edited.title}
                            onChange={e => handleChange('title', e.target.value)}
                            placeholder="例: Blue Bottle Coffee"
                            className="w-full bg-white text-lg font-bold text-[#1D1D1B] px-4 py-3.5 rounded-2xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm transition-all"
                        />
                    </div>

                    {/* 4. 網址 (Google Maps / IG) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" /> 網址連結
                        </label>
                        <input 
                            type="url"
                            onFocus={handleFocus}
                            value={edited.url || ''}
                            onChange={e => handleChange('url', e.target.value)}
                            placeholder="貼上 Google Maps 或 IG 連結..."
                            className="w-full bg-white text-sm font-medium text-blue-500 px-4 py-3.5 rounded-2xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm transition-all"
                        />
                    </div>

                    {/* === 漸進式揭露 (Progressive Disclosure) === */}
                    {!showDetails && (
                        <button 
                            onClick={() => setShowDetails(true)}
                            className="w-full py-3 mt-2 text-xs font-bold text-gray-400 hover:text-[#45846D] bg-gray-200/50 hover:bg-gray-200 rounded-xl transition-colors border border-dashed border-gray-300"
                        >
                            📝 展開詳細設定 (備註、圖片、標籤...)
                        </button>
                    )}

                    {showDetails && (
                        <div className="animate-in fade-in slide-in-from-top-4 space-y-5 pt-4 mt-2 border-t border-dashed border-gray-300/50">
                            
                            {/* 5. 自訂圖片 (優雅降級) */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3" /> 自訂首圖
                                </label>
                                <div className="relative w-full h-32 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden group transition-colors hover:border-[#45846D]/30 shadow-sm">
                                    {edited.customImage ? (
                                        <>
                                            <img src={edited.customImage} alt="Preview" className="w-full h-full object-cover" />
                                            <label className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer backdrop-blur-md transition-all active:scale-95">
                                                更換圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                            </label>
                                        </>
                                    ) : (
                                        <label className="text-gray-400 flex flex-col items-center justify-center w-full h-full cursor-pointer hover:text-[#45846D] transition-colors">
                                            <Camera className="w-6 h-6 mb-2 opacity-50" />
                                            <span className="text-xs font-bold">上傳照片 / 截圖</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* 6. 備註 */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                                    備註
                                </label>
                                <textarea 
                                    onFocus={handleFocus}
                                    value={edited.notes || ''}
                                    onChange={e => handleChange('notes', e.target.value)}
                                    placeholder="寫下為什麼想存這個靈感..."
                                    className="w-full bg-white text-sm font-medium text-[#1D1D1B] p-4 rounded-2xl outline-none border border-transparent focus:border-[#45846D]/30 shadow-sm transition-all min-h-[80px] resize-none"
                                />
                            </div>

                            {/* 7. 購物專屬：預算與標籤 */}
                            {edited.type === 'item' && (
                                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-4">
                                    <div className="flex gap-3">
                                        <div className="w-1/3 space-y-1.5">
                                            <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">幣別</label>
                                            <select 
                                                value={edited.currency || 'TWD'}
                                                onChange={e => handleChange('currency', e.target.value)}
                                                className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-3 py-3 rounded-xl outline-none border border-orange-100 focus:border-orange-300 shadow-sm appearance-none"
                                            >
                                                <option value="TWD">TWD</option>
                                                <option value="JPY">JPY</option>
                                                <option value="KRW">KRW</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">預算金額</label>
                                            <input 
                                                type="number"
                                                onFocus={handleFocus}
                                                value={edited.budget || ''}
                                                onChange={e => handleChange('budget', Number(e.target.value))}
                                                placeholder="例: 1500"
                                                className="w-full bg-white text-sm font-bold text-[#1D1D1B] px-4 py-3 rounded-xl outline-none border border-orange-100 focus:border-orange-300 shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                            <TagIcon className="w-3 h-3" /> 風格標籤
                                        </label>
                                        
                                        {/* 標籤視覺繼承 ActivityDetailModal */}
                                        {edited.tags && edited.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {edited.tags.map(tag => (
                                                    <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${getTagColor(tag)}`}>
                                                        #{tag}
                                                        <button onClick={() => handleChange('tags', edited.tags?.filter(t => t !== tag))} className="ml-1 opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                onFocus={handleFocus}
                                                value={tagInput}
                                                onChange={e => setTagInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                                placeholder="輸入標籤 (如: 藥妝、伴手禮)"
                                                className="flex-1 bg-white text-xs font-bold text-[#1D1D1B] px-3 py-2.5 rounded-xl outline-none border border-orange-100 focus:border-orange-300 shadow-sm"
                                            />
                                            <button onClick={handleAddTag} className="bg-orange-100 text-orange-600 px-3 rounded-xl text-xs font-bold hover:bg-orange-200 transition-colors">
                                                新增
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* === Footer === */}
                <div className="p-4 border-t border-gray-200/50 bg-white pb-safe flex gap-3 z-20 rounded-b-[32px]">
                    {isEditing && onDelete && (
                        <button 
                            onClick={() => { if(confirm('確定要刪除此心願嗎？')) onDelete(edited.id); }}
                            className="px-4 py-3.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <button 
                        onClick={handleSave} 
                        className="flex-1 py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm shadow-xl shadow-black/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> {isEditing ? '儲存變更' : '收藏心願'}
                    </button>
                </div>
            </div>
        </div>
    );
};