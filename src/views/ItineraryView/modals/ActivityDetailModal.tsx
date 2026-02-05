import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Trash2, Edit3, X, ZoomIn, Clock, ChevronDown, Camera, Save, 
    MoveVertical, FileText, MapPin as MapPinIcon, Check
} from 'lucide-react';
import { IOSInput } from '../../../components/UI';
import { TimePickerWheel } from '../../../components/common/TimePickerWheel';
// [Fix] 移除舊的 LocationLink，改用直接渲染正確的 URL
// import { LocationLink } from '../../../components/common/LocationLink';
import { CATEGORIES, getMemberName, getMemberAvatarColor, isSystemType, Tag } from '../shared';
import type { Activity, Member, ExpenseItem } from '../../../types';

export const ActivityDetailModal: React.FC<{ 
    act: Activity; 
    onClose: () => void;
    onSave: (updatedAct: Activity) => void; 
    onDelete: () => void; 
    members?: Member[]; 
    initialEdit?: boolean;
    currencySymbol: string; 
}> = ({ act, onClose, onSave, onDelete, members = [], initialEdit = false, currencySymbol }) => {
    const [isEditing, setIsEditing] = useState(initialEdit);
    const [edited, setEdited] = useState<Activity>({ ...act });
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
    const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false); 
    
    // 圖片拖曳位置狀態
    const [imagePositionY, setImagePositionY] = useState(act.imagePositionY ?? 50);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const imageDragStartY = useRef(0);
    const imageStartPos = useRef(50);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    // Stealth Toolbar State
    const [showLocationField, setShowLocationField] = useState(!!act.location);
    const [showNoteField, setShowNoteField] = useState(!!act.description);

    const isSystem = isSystemType(edited.type);
    const isReceiptMode = !isSystem; 
    const isTransport = edited.type === 'transport'; 
    const isNote = edited.type === 'note';
    
    const newItemInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!edited.payer && members.length > 0) {
            setEdited(prev => ({ ...prev, payer: members[0].id }));
        }
    }, []);

    // 儲存圖片位置變更
    useEffect(() => {
        setEdited(prev => ({ ...prev, imagePositionY }));
    }, [imagePositionY]);

    const handleChange = (field: keyof Activity, value: any) => {
        setEdited(prev => ({ ...prev, [field]: value }));
    };

    // 圖片拖曳邏輯
    const handleImageMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isEditing) return;
        setIsDraggingImage(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        imageDragStartY.current = clientY;
        imageStartPos.current = imagePositionY;
    };

    const handleImageMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDraggingImage || !imageContainerRef.current) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - imageDragStartY.current;
        const containerHeight = imageContainerRef.current.clientHeight;
        const percentChange = (deltaY / containerHeight) * 100 * 1.5; 
        
        let newPos = imageStartPos.current - percentChange;
        newPos = Math.max(0, Math.min(100, newPos)); 
        setImagePositionY(newPos);
    };

    const handleImageMouseUp = () => {
        setIsDraggingImage(false);
    };

    const handleTransportDetailChange = (field: string, value: string) => {
        setEdited(prev => ({
            ...prev,
            transportDetail: {
                ...prev.transportDetail,
                mode: prev.transportDetail?.mode || 'bus',
                duration: prev.transportDetail?.duration || '',
                [field]: value
            } as any
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setEdited(prev => ({ ...prev, expenseImage: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const addItem = () => {
        const newItem: ExpenseItem = { id: Date.now().toString(), name: '', amount: 0, assignedTo: [] };
        setEdited(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
        setTimeout(() => newItemInputRef.current?.focus(), 100);
    };

    const updateItem = (id: string, field: keyof ExpenseItem, value: any) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => item.id === id ? { ...item, [field]: value } : item);
            const newTotal = newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            return { ...prev, items: newItems, cost: newTotal };
        });
    };

    const deleteItem = (id: string) => {
        setEdited(prev => {
            const newItems = (prev.items || []).filter(item => item.id !== id);
            const newTotal = newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            return { ...prev, items: newItems, cost: newTotal };
        });
    };

    const toggleItemMember = (itemId: string, memberId?: string) => {
        setEdited(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id !== itemId) return item;
                if (!memberId) return { ...item, assignedTo: [] };
                const current = item.assignedTo || [];
                let newAssigned: string[] = [];
                if (current.includes(memberId)) {
                    newAssigned = current.filter(id => id !== memberId);
                } else {
                    newAssigned = [...current, memberId];
                }
                return { ...item, assignedTo: newAssigned };
            });
            return { ...prev, items: newItems };
        });
    };

    const splitSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        const currentTotal = Number(edited.cost || 0);
        if (edited.items && edited.items.length > 0) {
            edited.items.forEach(item => {
                const amount = Number(item.amount) || 0;
                const splitters = (item.assignedTo && item.assignedTo.length > 0) 
                    ? item.assignedTo 
                    : members.map(m => m.id); 
                
                if (splitters.length > 0) {
                    const share = amount / splitters.length;
                    splitters.forEach(mid => summary[mid] = (summary[mid] || 0) + share);
                }
            });
        } else {
            if (currentTotal > 0) {
                const share = currentTotal / members.length;
                members.forEach(m => summary[m.id] = (summary[m.id] || 0) + share);
            }
        }
        return summary;
    }, [edited.items, edited.cost, members]);

    const activePayerName = getMemberName(members, edited.payer);
    const activePayerAvatarColor = getMemberAvatarColor(activePayerName);
    const currentCategory = CATEGORIES.find(c => c.id === edited.type) || CATEGORIES.find(c => c.id === 'other');

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex-shrink-0 bg-white z-20 px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">{isEditing ? '編輯內容' : '詳情資訊'}</h3>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <button onClick={() => { if(confirm('確定刪除此行程？')) onDelete(); }} className="bg-red-50 p-2 rounded-full text-red-500 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => setIsEditing(true)} className="bg-[#1D1D1B] p-2 rounded-full text-white hover:bg-gray-800 transition-colors shadow-md"><Edit3 className="w-4 h-4" /></button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 text-sm font-bold px-2">取消</button>
                        )}
                        <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[#FAFAFA]" onMouseUp={handleImageMouseUp} onTouchEnd={handleImageMouseUp}>
                    
                    {/* --- RECEIPT STYLE UI (For ALL consumption types) --- */}
                    {isReceiptMode ? (
                        <div className="space-y-4">
                            {/* 1. Hero Photo (Interactive Crop) */}
                            <div 
                                ref={imageContainerRef}
                                className={`relative w-full h-48 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden group transition-colors hover:border-[#45846D]/30 hover:bg-[#45846D]/5 ${isEditing ? 'cursor-ns-resize' : ''}`}
                                onMouseDown={handleImageMouseDown}
                                onMouseMove={handleImageMouseMove}
                                onTouchStart={handleImageMouseDown}
                                onTouchMove={handleImageMouseMove}
                            >
                                {edited.expenseImage ? (
                                    <>
                                        <img 
                                            src={edited.expenseImage} 
                                            className="w-full h-full object-cover pointer-events-none select-none" 
                                            style={{ objectPosition: `center ${imagePositionY}%` }}
                                        />
                                        {!isEditing && <div className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white cursor-pointer hover:bg-black/70 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}><ZoomIn className="w-4 h-4" /></div>}
                                        
                                        {/* Overlay Hint for Editing */}
                                        {isEditing && (
                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg pointer-events-none">
                                                    <MoveVertical className="w-3 h-3" /> 拖曳調整位置
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Change Photo Button (Bottom Right) */}
                                        {isEditing && (
                                            <div className="absolute bottom-2 right-2">
                                                <label className="bg-white/90 hover:bg-white text-[#1D1D1B] text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border border-gray-200 flex items-center gap-1.5 transition-all active:scale-95">
                                                    <Camera className="w-3.5 h-3.5" /> 更換
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                                </label>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    isEditing ? (
                                        <label className="text-gray-400 flex flex-col items-center p-4 text-center cursor-pointer w-full h-full justify-center">
                                            <Camera className="w-10 h-10 opacity-20 mb-2" />
                                            <span className="text-sm font-bold text-[#45846D]">上傳收據 / 照片</span>
                                            <span className="text-[10px] opacity-60 mt-1">點擊上傳</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    ) : <div className="text-gray-300 text-xs py-4">無照片</div>
                                )}
                            </div>

                            {/* 2. Info Row (Time & Category) */}
                            <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {isEditing ? (
                                        <button onClick={() => setShowTimePicker(true)} className="font-mono font-bold text-lg text-[#1D1D1B] border-b border-dotted border-gray-300 hover:text-[#45846D]">{edited.time}</button>
                                    ) : (
                                        <span className="font-mono font-bold text-lg text-[#1D1D1B]">{edited.time}</span>
                                    )}
                                </div>
                                {/* Smart Capsule for Category */}
                                {isEditing ? (
                                    <button 
                                        onClick={() => setIsCategorySheetOpen(true)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${currentCategory?.tagClass.replace('bg-opacity-10 text-opacity-100', '')} border shadow-sm active:scale-95`}
                                    >
                                        {currentCategory?.icon && <currentCategory.icon className="w-3 h-3" />}
                                        {currentCategory?.label}
                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                    </button>
                                ) : (
                                    <Tag type={edited.type} />
                                )}
                            </div>

                            {/* 3. Title Input (Editable) */}
                            <div className="px-1">
                                {isEditing ? (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">名稱</label>
                                        <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} placeholder="項目名稱 (如: 晚餐)" />
                                    </div>
                                ) : (
                                    <div className="font-bold text-xl text-[#1D1D1B] mt-2 mb-1">{edited.title}</div>
                                )}
                            </div>

                            {/* 4. Items List with Per-Item Splitting */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
                                <div className="h-1 bg-[radial-gradient(circle,transparent_0.2rem,#f3f4f6_0.2rem)] bg-[length:0.5rem_0.5rem] absolute top-0 left-0 right-0 -mt-1 opacity-50" />
                                <div className="space-y-4">
                                    {/* Header Row */}
                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2"><span>Item Details</span><span>Cost & Split</span></div>
                                    
                                    {edited.items && edited.items.length > 0 ? (
                                        edited.items.map((item, idx) => (
                                            <div key={item.id} className="flex flex-col gap-1 border-b border-dashed border-gray-50 pb-2 last:border-0 last:pb-0">
                                                {/* Input Row: Name & Cost */}
                                                <div className="flex justify-between items-center gap-2">
                                                    {isEditing ? <input ref={idx === (edited.items?.length || 0) - 1 ? newItemInputRef : null} className="bg-transparent border-none outline-none font-bold text-[#1D1D1B] w-full placeholder-gray-300 text-sm" value={item.name} placeholder="品項名稱" onChange={(e) => updateItem(item.id, 'name', e.target.value)} /> : <span className="font-bold text-[#1D1D1B] text-sm">{item.name || '未命名'}</span>}
                                                    <div className="flex items-center gap-2">
                                                        {isEditing ? <input type="number" className="w-16 bg-transparent border-none outline-none font-bold text-[#1D1D1B] text-right text-sm" value={item.amount === 0 ? '' : item.amount} placeholder="0" onChange={(e) => updateItem(item.id, 'amount', e.target.value === '' ? 0 : Number(e.target.value))} /> : <span className="font-bold text-[#1D1D1B] text-right text-sm">{item.amount}</span>}
                                                    </div>
                                                </div>
                                                
                                                {/* Second Row: Delete Button (Left) & Split Avatars (Right) */}
                                                {(isEditing || (item.assignedTo && item.assignedTo.length > 0)) && (
                                                    <div className="flex justify-between items-center mt-1">
                                                        {isEditing ? (
                                                            <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 p-1 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        ) : <div />}

                                                        <div className="flex justify-end items-center gap-1">
                                                            {isEditing && <button onClick={() => toggleItemMember(item.id)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${(!item.assignedTo || item.assignedTo.length === 0) ? 'bg-[#45846D] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>ALL</button>}
                                                            {members.map(m => {
                                                                const isAssigned = (item.assignedTo || []).includes(m.id);
                                                                if (!isEditing && !isAssigned && item.assignedTo && item.assignedTo.length > 0) return null;
                                                                return <button key={m.id} onClick={() => isEditing && toggleItemMember(item.id, m.id)} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all duration-200 ${isAssigned ? `${getMemberAvatarColor(m.name)} text-white border-transparent shadow-sm ${isEditing ? 'active:scale-90 scale-110' : ''}` : 'bg-gray-100 text-gray-300 border-transparent hover:bg-gray-200'} ${!isEditing && !isAssigned ? 'hidden' : ''}`} disabled={!isEditing}>{isAssigned ? <Check className="w-2.5 h-2.5" /> : m.name[0]}</button>
                                                            })}
                                                            {!isEditing && (!item.assignedTo || item.assignedTo.length === 0) && <span className="text-[9px] font-bold text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded ml-1">ALL</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : <div className="text-center text-xs text-gray-300 italic py-2">無明細，請輸入總金額</div>}
                                </div>
                                {isEditing && <button onClick={addItem} className="w-full mt-3 py-2 text-xs font-bold text-[#45846D] bg-[#45846D]/5 hover:bg-[#45846D]/10 rounded-lg border border-dashed border-[#45846D]/30 transition-colors">+ 新增品項</button>}
                            </div>

                            {/* 5. Total & Payer Footer */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-gray-400 uppercase">TOTAL</span>
                                    <div className="flex items-center">
                                        <span className="text-xl font-bold text-gray-400 mr-1">{currencySymbol}</span>
                                        <span className="text-4xl font-black text-[#1D1D1B]">{edited.cost}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start border-t border-dashed border-gray-100 pt-4">
                                    <div className="relative">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Paid By</label>
                                        <button onClick={() => isEditing && setIsPayerDropdownOpen(!isPayerDropdownOpen)} className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gray-50 border border-gray-200 ${isEditing ? 'active:scale-95' : ''}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activePayerAvatarColor}`}>{activePayerName[0]}</div>
                                            <span className="text-xs font-bold text-gray-700">{activePayerName}</span>
                                        </button>
                                        {isPayerDropdownOpen && isEditing && (
                                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-20 min-w-[120px] animate-in slide-in-from-bottom-2">
                                                {members.map(m => (
                                                    <button key={m.id} onClick={() => { handleChange('payer', m.id); setIsPayerDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors ${edited.payer === m.id ? 'text-[#45846D]' : 'text-gray-600'}`}><div className={`w-2 h-2 rounded-full ${getMemberAvatarColor(m.name)}`} /> {m.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-1 pl-4">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Split Summary</label>
                                        <div className="space-y-1">
                                            {Object.entries(splitSummary).map(([mid, amount]) => {
                                                const mName = getMemberName(members, mid);
                                                if (amount <= 0 || (mid === edited.payer)) return null; 
                                                return <div key={mid} className="text-xs font-mono text-gray-600 flex justify-end gap-2"><span>{mName}</span><span className="font-bold border-b border-dotted border-gray-300 text-[#1D1D1B]">{currencySymbol}{Math.round(amount)}</span></div>
                                            })}
                                            {Object.keys(splitSummary).length === 0 && <span className="text-xs text-gray-300">無分帳資訊 (全員平分)</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Stealth Toolbar (Location & Note) & Read-Only Display */}
                            <div className="pt-2 flex flex-col gap-3">
                                {/* READ ONLY VIEW: Show text if exists */}
                                {!isEditing && edited.location && (
                                    <div className="flex items-center gap-2 text-gray-500 text-xs px-2">
                                        {/* [Fix] Google Maps Official URL Scheme */}
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(edited.location)}`}
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 hover:text-[#45846D] transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MapPinIcon className="w-3.5 h-3.5" />
                                            <span className="underline decoration-dotted underline-offset-2">{edited.location}</span>
                                        </a>
                                    </div>
                                )}
                                {!isEditing && edited.description && (
                                    <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-600 leading-relaxed mx-1">
                                        {edited.description}
                                    </div>
                                )}

                                {/* EDITING: Show Inputs if active */}
                                {isEditing && showLocationField && (
                                    <div className="animate-in slide-in-from-bottom-2 fade-in">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">地點</label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input className="w-full bg-white border border-gray-200 h-10 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50" value={edited.location || ''} onChange={e => handleChange('location', e.target.value)} placeholder="輸入地點..." autoFocus />
                                            <button onClick={() => { setShowLocationField(false); handleChange('location', ''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                )}
                                {isEditing && showNoteField && (
                                    <div className="animate-in slide-in-from-bottom-2 fade-in">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">備註</label>
                                        <div className="relative">
                                            <textarea className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 min-h-[80px]" value={edited.description || ''} onChange={e => handleChange('description', e.target.value)} placeholder="輸入備註..." autoFocus />
                                            <button onClick={() => { setShowNoteField(false); handleChange('description', ''); }} className="absolute right-2 top-2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* The Toolbar Icons (Only in Edit Mode) */}
                                {isEditing && (
                                    <div className="flex justify-center gap-6 pb-2 opacity-50 hover:opacity-100 transition-opacity">
                                        {!showLocationField && <button onClick={() => setShowLocationField(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><MapPinIcon className="w-5 h-5" /></button>}
                                        {!showNoteField && <button onClick={() => setShowNoteField(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><FileText className="w-5 h-5" /></button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // --- SYSTEM LAYOUT ---
                        <div className="space-y-4">
                            {!isNote && (
                                <div className="flex gap-4">
                                    <div className="w-2/5">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">時間</label>
                                        {isEditing ? (
                                            <button onClick={() => setShowTimePicker(true)} className="w-full bg-white border border-gray-200 h-12 rounded-xl font-bold text-center flex items-center justify-center text-[#1D1D1B] shadow-sm active:scale-95 transition-transform">{edited.time}</button>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 h-12 flex items-center justify-center rounded-xl font-bold text-[#1D1D1B] font-mono shadow-sm">{edited.time}</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">{isTransport ? '標題' : '名稱'}</label>
                                        {isEditing ? <IOSInput value={edited.title} onChange={e => handleChange('title', e.target.value)} /> : <div className="w-full bg-white border border-gray-100 px-4 h-12 flex items-center rounded-xl font-bold text-[#1D1D1B] shadow-sm truncate">{edited.title}</div>}
                                    </div>
                                </div>
                            )}

                            {isTransport && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">工具</label><div className="font-bold text-lg">{edited.transportDetail?.mode}</div></div>
                                        <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">耗時</label><div className="font-bold text-lg">{edited.transportDetail?.duration}</div></div>
                                    </div>
                                    <div className="text-sm text-gray-600">{edited.transportDetail?.instruction}</div>
                                </div>
                            )}

                            {isNote && (
                                <div className="bg-yellow-50 p-4 rounded-xl">
                                    <div className="font-bold text-yellow-800 mb-2">{edited.title}</div>
                                    <div className="text-sm text-yellow-900 whitespace-pre-wrap">{edited.description}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white z-20">
                    {isEditing ? (
                        <button 
                            onClick={() => { onSave(edited); setIsEditing(false); }} 
                            className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> 儲存變更
                        </button>
                    ) : (
                         <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] text-white font-bold text-sm active:scale-95 transition-transform">確認</button>
                    )}
                </div>
            </div>

            {/* Category Drawer (Bottom Sheet) */}
            {isCategorySheetOpen && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCategorySheetOpen(false)} />
                    <div className="bg-white w-full max-w-sm rounded-t-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-[#1D1D1B]">選擇類別</h3>
                            <button onClick={() => setIsCategorySheetOpen(false)} className="bg-gray-100 p-2 rounded-full"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            {CATEGORIES.filter(c => !c.isSystem).map(cat => (
                                <button 
                                    key={cat.id} 
                                    onClick={() => { handleChange('type', cat.id); setIsCategorySheetOpen(false); }}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${edited.type === cat.id ? 'bg-[#45846D]/10 ring-2 ring-[#45846D]' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.tagClass.replace('bg-opacity-10 text-opacity-100', '')}`}>
                                        <cat.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {lightboxOpen && edited.expenseImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxOpen(false)}><img src={edited.expenseImage} className="max-w-full max-h-full object-contain" /><button className="absolute top-6 right-6 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors"><X className="w-6 h-6" /></button></div>}
            {showTimePicker && <TimePickerWheel value={edited.time} onChange={(val) => handleChange('time', val)} onClose={() => setShowTimePicker(false)} />}
        </div>
    );
};