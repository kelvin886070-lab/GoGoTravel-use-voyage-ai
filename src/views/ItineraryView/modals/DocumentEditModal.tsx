import React, { useState, useMemo } from 'react';
import { 
    X, Save, Folder, Hash, AlignLeft, 
    Loader2
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import type { Document, VaultFolder, VaultFile } from '../../../types';

interface DocumentEditModalProps {
    doc: Document & { folderName?: string }; 
    folders: VaultFolder[]; 
    onClose: () => void;
    onSave: (updatedDoc: Partial<VaultFile>) => void; 
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({ 
    doc, 
    folders, 
    onClose, 
    onSave 
}) => {
    const initialFolderId = folders.find(f => f.name === doc.folderName)?.id || '';
    const displayFolderName = doc.folderName || '一般文件 / 未分類';

    const smartConfig = useMemo(() => {
        const name = (doc.folderName || '').toLowerCase();
        
        if (name.includes('機票') || name.includes('交通') || name.includes('flight') || name.includes('transport')) {
            return { label: '訂位代號 (PNR) / 票號', placeholder: '例如：6 碼英數字 (ABC123)' };
        }
        if (name.includes('住宿') || name.includes('飯店') || name.includes('hotel') || name.includes('booking')) {
            return { label: '訂單編號', placeholder: '例如：Agoda / Booking 訂單號' };
        }
        if (name.includes('保險') || name.includes('合約') || name.includes('insurance')) {
            return { label: '保單號碼', placeholder: '例如：旅平險保單編號' };
        }
        if (name.includes('護照') || name.includes('證件') || name.includes('passport') || name.includes('id') || doc.type === 'passport') {
            return { label: '證件號碼', placeholder: '例如：護照號碼、身分證字號' };
        }
        if (name.includes('行程') || name.includes('地圖') || name.includes('map')) {
            return { label: '參考編號', placeholder: '例如：地圖代碼、店家電話' };
        }
        
        return { label: '關鍵號碼 (Smart Copy)', placeholder: '例如：訂位代號、會員編號' };
    }, [doc.folderName, doc.type]);

    const [documentNumber, setDocumentNumber] = useState(doc.documentNumber || '');
    const [notes, setNotes] = useState(doc.notes || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = {
                document_number: documentNumber.trim() || null,
                notes: notes.trim() || null,
            };

            const { error } = await supabase
                .from('vault_files')
                .update(updates)
                .eq('id', doc.id);

            if (error) throw error;

            onSave({
                id: doc.id,
                documentNumber: updates.document_number || undefined,
                notes: updates.notes || undefined
            });
            
            onClose();
        } catch (e: any) {
            console.error("更新失敗", e);
            alert("更新失敗：" + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            
            <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden relative z-10 shadow-2xl flex flex-col animate-in zoom-in-95 scale-100">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-20">
                    <div>
                        <h3 className="text-lg font-bold text-[#1D1D1B]">編輯文件資訊</h3>
                    </div>
                    <button onClick={onClose} className="bg-gray-50 p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors active:scale-95">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 bg-white max-h-[65vh] overflow-y-auto">
                    
                    {/* Header Info */}
                    <div className="text-center space-y-3 pb-2">
                        <h2 className="text-xl font-black text-[#1D1D1B] leading-tight break-words px-2">
                            {doc.title}
                        </h2>
                        <div className="flex justify-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                                <Folder className="w-3.5 h-3.5" /> 
                                {displayFolderName}
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 pt-1">
                            如需更名或移動，請至「保管箱」操作
                        </p>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Form Inputs */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#45846D] flex items-center gap-1.5 uppercase tracking-wider pl-1">
                            <Hash className="w-3.5 h-3.5" /> {smartConfig.label}
                        </label>
                        <input 
                            type="text" 
                            value={documentNumber}
                            onChange={(e) => setDocumentNumber(e.target.value)}
                            // [Fix] 加入 placeholder:text-sm 確保與 text-sm 一致
                            className="w-full bg-[#FAFAFA] border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-[#1D1D1B] focus:outline-none focus:border-[#45846D] focus:ring-2 focus:ring-[#45846D]/20 transition-all placeholder:font-sans placeholder:text-sm placeholder:text-gray-400 placeholder:font-medium shadow-sm"
                            placeholder={smartConfig.placeholder}
                        />
                        <p className="text-[10px] text-gray-400 px-2 leading-relaxed">
                            輸入後，卡片將出現「一鍵複製」按鈕，方便您在報到時快速填寫。
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 uppercase tracking-wider pl-1">
                            <AlignLeft className="w-3.5 h-3.5" /> 備註
                        </label>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                            // [Fix] 加入 placeholder:text-sm
                            className="w-full bg-[#FAFAFA] border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-[#1D1D1B] focus:outline-none focus:border-[#45846D] focus:ring-2 focus:ring-[#45846D]/20 transition-all resize-none placeholder:text-sm placeholder:text-gray-400 shadow-sm"
                            placeholder="輸入任何您想記住的細節..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-white z-20">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-4 rounded-2xl bg-[#1D1D1B] text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 hover:bg-black"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> 儲存中...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" /> 儲存變更
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};