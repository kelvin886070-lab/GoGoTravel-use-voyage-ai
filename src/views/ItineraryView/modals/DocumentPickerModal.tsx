import React, { useState, useMemo } from 'react';
import { 
    X, CheckCircle2, Folder, 
    ArrowLeft, HardDrive, Search, 
    Image as ImageIcon, File as FileIcon 
} from 'lucide-react';
import type { Document, VaultFolder, VaultFile } from '../../../types';

interface DocumentPickerModalProps {
    documents: Document[]; 
    folders?: VaultFolder[];
    files?: VaultFile[];
    initialSelectedIds: string[];
    onClose: () => void;
    onSave: (selectedIds: string[]) => void;
}

export const DocumentPickerModal: React.FC<DocumentPickerModalProps> = ({ 
    documents, 
    folders = [], 
    files = [],
    initialSelectedIds, 
    onClose, 
    onSave 
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds || []);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. 整理資料
    const uniqueLegacyDocs = useMemo(() => {
        const existingFileIds = new Set(files.map(f => f.id));
        return documents
            .filter(d => !existingFileIds.has(d.id))
            .map(d => ({
                id: d.id,
                name: d.title,
                type: d.type === 'passport' || d.type === 'hotel' ? 'pdf' : 'other',
                size: 'Synced',
                date: d.createdAt,
                parentId: null,
                isDeleted: false,
                isPinned: false
            } as VaultFile));
    }, [documents, files]);

    const allAvailableFiles = useMemo(() => {
        return [...files, ...uniqueLegacyDocs].filter(f => !f.isDeleted);
    }, [files, uniqueLegacyDocs]);

    // 2. 決定顯示內容
    const { displayFolders, displayFiles } = useMemo(() => {
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            return {
                displayFolders: [],
                displayFiles: allAvailableFiles.filter(f => f.name.toLowerCase().includes(lowerTerm))
            };
        }

        if (currentFolderId) {
            return {
                displayFolders: [],
                displayFiles: allAvailableFiles.filter(f => f.parentId === currentFolderId)
            };
        } else {
            return {
                displayFolders: folders.filter(f => !f.isDeleted && !f.parentId),
                displayFiles: allAvailableFiles.filter(f => !f.parentId)
            };
        }
    }, [searchTerm, currentFolderId, folders, allAvailableFiles]);

    const currentFolderName = searchTerm 
        ? '搜尋結果' 
        : (currentFolderId ? folders.find(f => f.id === currentFolderId)?.name : '保管箱');

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const selectedCount = selectedIds.length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden relative z-10 shadow-2xl flex flex-col h-[80vh] max-h-[600px] animate-in zoom-in-95">
                
                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white z-20">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            {currentFolderId && !searchTerm ? (
                                <button 
                                    onClick={() => setCurrentFolderId(null)}
                                    className="p-1.5 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            ) : (
                                <div className="p-1.5 -ml-2">
                                    <BriefcaseIcon className="w-5 h-5 text-[#1D1D1B]" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-bold text-[#1D1D1B] leading-tight">
                                    {currentFolderName}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    {searchTerm ? `找到 ${displayFiles.length} 個檔案` : (currentFolderId ? '選擇檔案' : '選擇資料夾或檔案')}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="bg-gray-50 p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="搜尋文件..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 h-10 rounded-xl pl-9 pr-4 text-sm outline-none border border-transparent focus:border-[#45846D]/30 focus:bg-white transition-all placeholder:text-gray-400 font-medium text-gray-700"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-200 rounded-full p-0.5 text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#FAFAFA]">
                    
                    {/* Folders Grid */}
                    {displayFolders.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-gray-400 mb-3 px-1">資料夾</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {displayFolders.map(folder => {
                                    const selectedInFolder = allAvailableFiles.filter(f => f.parentId === folder.id && selectedIds.includes(f.id)).length;
                                    
                                    return (
                                        <button 
                                            key={folder.id}
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-start gap-3 hover:shadow-md hover:border-[#45846D]/20 transition-all group text-left relative active:scale-95"
                                        >
                                            {selectedInFolder > 0 && (
                                                <div className="absolute top-3 right-3 bg-[#1D1D1B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                                                    {selectedInFolder}
                                                </div>
                                            )}
                                            <div className="w-10 h-10 rounded-xl bg-[#E4E2DD]/50 flex items-center justify-center text-[#45846D] group-hover:bg-[#45846D] group-hover:text-white transition-colors">
                                                <Folder className="w-5 h-5 fill-current opacity-80" />
                                            </div>
                                            <div className="w-full">
                                                <span className="font-bold text-[#1D1D1B] text-sm block truncate">
                                                    {folder.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                                    {allAvailableFiles.filter(f => f.parentId === folder.id).length} 項目
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Files List (Polished Editorial Style) */}
                    <div>
                        {(displayFolders.length > 0 || searchTerm) && (
                            <h4 className="text-xs font-bold text-gray-400 mb-3 px-1">
                                {searchTerm ? '符合的檔案' : (currentFolderId ? '檔案列表' : '未分類檔案')}
                            </h4>
                        )}
                        
                        {displayFiles.length === 0 && displayFolders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-300 border-2 border-dashed border-gray-200 rounded-2xl">
                                <HardDrive className="w-10 h-10 mb-2 opacity-20" />
                                <span className="text-xs font-bold">
                                    {searchTerm ? '找不到相關文件' : '此資料夾是空的'}
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayFiles.map(file => {
                                    const isSelected = selectedIds.includes(file.id);
                                    return (
                                        <div 
                                            key={file.id} 
                                            onClick={() => toggleSelection(file.id)}
                                            className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.98] 
                                                ${isSelected 
                                                    ? 'bg-[#45846D]/5 border-[#45846D] shadow-md' 
                                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                                }`}
                                        >
                                            {/* File Icon */}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors
                                                ${isSelected 
                                                    ? 'bg-[#45846D]/10 text-[#45846D]' 
                                                    : (file.type === 'pdf' ? 'bg-red-50 text-red-500' : file.type === 'image' ? 'bg-purple-50 text-purple-500' : 'bg-gray-50 text-gray-500')
                                                }`}>
                                                {file.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <FileIcon className="w-6 h-6" />}
                                            </div>

                                            <div className="min-w-0 flex-1 pr-6">
                                                <div className={`font-bold text-sm truncate transition-colors ${isSelected ? 'text-[#45846D]' : 'text-[#1D1D1B]'}`}>
                                                    {file.name}
                                                </div>
                                                <div className={`text-[10px] flex items-center gap-2 mt-1 ${isSelected ? 'text-[#45846D]/70 font-medium' : 'text-gray-400'}`}>
                                                    <span className={`uppercase px-1.5 py-0.5 rounded tracking-wider ${isSelected ? 'bg-[#45846D]/10' : 'bg-gray-100'}`}>
                                                        {file.category || 'FILE'}
                                                    </span>
                                                    <span>{file.date}</span>
                                                </div>
                                            </div>

                                            {/* Selection Stamp (Top Right Corner) */}
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 animate-in zoom-in duration-200">
                                                    <CheckCircle2 className="w-5 h-5 text-[#45846D] fill-[#45846D]/10" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-100 z-20">
                    <button 
                        onClick={() => onSave(selectedIds)} 
                        className="w-full py-4 rounded-2xl bg-[#1D1D1B] text-white font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        確認選擇
                        {selectedCount > 0 && (
                            <span className="bg-white/20 text-white px-2 py-0.5 rounded text-xs">
                                {selectedCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BriefcaseIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);