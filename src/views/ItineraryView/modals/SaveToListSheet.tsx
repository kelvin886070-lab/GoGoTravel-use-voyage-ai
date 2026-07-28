import React, { useState } from 'react';
import { X, Star, Plus, Check } from 'lucide-react';
import type { WishList } from '../../../types';

interface Props {
    placeName: string;
    lists: WishList[];
    onPick: (opts: { listId: string | null; favorite: boolean }) => void;   // 選定目的地→上層建立心願
    onCreateList: (name: string) => Promise<WishList | null>;
    onClose: () => void;
}

// 📚 存到清單 sheet：加入最愛（獨立快標）＋相簿格狀（點一本存進去）＋未分類＋新建。一 wish 一主清單（v1）。
export const SaveToListSheet: React.FC<Props> = ({ placeName, lists, onPick, onCreateList, onClose }) => {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const handleCreate = async () => {
        const n = name.trim();
        if (!n || busy) return;
        setBusy(true);
        const list = await onCreateList(n);
        setBusy(false);
        if (list) onPick({ listId: list.id, favorite: false });
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-[#232320]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-sm rounded-t-[24px] sm:rounded-[24px]" style={{ background: '#F2EFE7', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(35,35,32,0.2)' }}>
                <div className="p-4 pb-6">
                    <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ background: '#D8CFBB' }} />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[15px] font-bold" style={{ color: '#232320' }}>存到清單</span>
                        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E7E0CE', color: '#8A8266' }}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="text-[11px] mb-3 truncate" style={{ color: '#8A8266' }}>{placeName}</div>

                    {/* 加入最愛（獨立快標） */}
                    <button onClick={() => onPick({ listId: null, favorite: true })} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3" style={{ background: '#FBF6E8', border: '0.5px solid #EADFBE' }}>
                        <Star className="w-[18px] h-[18px]" style={{ color: '#E7B23A' }} />
                        <span className="flex-1 text-left text-[13px] font-semibold" style={{ color: '#232320' }}>加入最愛</span>
                        <span className="text-[9px]" style={{ color: '#B4AE9E' }}>獨立快標</span>
                    </button>

                    <div className="text-[10px] mb-2 px-1" style={{ color: '#8A8266' }}>點一本清單存進去</div>
                    <div className="grid grid-cols-3 gap-2">
                        {lists.map(l => (
                            <button key={l.id} onClick={() => onPick({ listId: l.id, favorite: false })} className="relative h-[66px] rounded-[10px] overflow-hidden" style={{ background: '#3F6B52' }}>
                                {l.coverImage
                                    ? <img src={l.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    : <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#6b7a63,#3F6B52)' }} />}
                                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: 'linear-gradient(transparent,rgba(35,35,32,0.62))' }}>
                                    <div className="text-[9px] truncate" style={{ color: '#fff', fontFamily: 'Georgia,serif' }}>{l.name}</div>
                                </div>
                            </button>
                        ))}
                        {/* 未分類（低摩擦先存著） */}
                        <button onClick={() => onPick({ listId: null, favorite: false })} className="h-[66px] rounded-[10px] flex flex-col items-center justify-center gap-0.5" style={{ background: '#fff', border: '0.5px solid #E0D8C6', color: '#8A8266' }}>
                            <span className="text-[10px]">未分類</span>
                            <span className="text-[8px]" style={{ color: '#B4AE9E' }}>先存著</span>
                        </button>
                        {/* 新建 */}
                        {!creating && (
                            <button onClick={() => setCreating(true)} className="h-[66px] rounded-[10px] border border-dashed flex flex-col items-center justify-center gap-1" style={{ borderColor: '#C9B98F', color: '#3F6B52' }}>
                                <Plus className="w-[15px] h-[15px]" /><span className="text-[9px]">新建</span>
                            </button>
                        )}
                    </div>

                    {creating && (
                        <div className="flex items-center gap-2 mt-3">
                            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="清單名稱…" className="flex-1 px-3 py-2 rounded-xl text-[13px] outline-none" style={{ background: '#fff', border: '1px solid #E0D8C6', color: '#232320' }} />
                            <button onClick={handleCreate} disabled={busy || !name.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#3F6B52', color: '#fff', opacity: (busy || !name.trim()) ? 0.5 : 1 }}><Check className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
