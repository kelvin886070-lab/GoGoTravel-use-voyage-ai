import React, { useState, useEffect } from 'react';
import { 
    Folder, Plus, Trash2, Image as ImageIcon, File as FileIcon, 
    ArrowLeft, RotateCcw, XCircle, Pin, GripVertical, 
    Upload, HardDrive, Cloud, Loader2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { Trip, VaultFolder, VaultFile } from '../types';
import { supabase } from '../services/supabase';

// 定義介面：接收從 App.tsx 傳下來的真實資料與刷新函式
interface VaultViewProps {
    deletedTrips?: Trip[];
    folders: VaultFolder[];
    files: VaultFile[];
    onRefresh: () => void;
    onRestoreTrip?: (id: string) => void;
    onPermanentDeleteTrip?: (id: string) => void;
}

export const VaultView: React.FC<VaultViewProps> = ({ 
    deletedTrips = [], 
    folders, 
    files, 
    onRefresh, 
    onRestoreTrip, 
    onPermanentDeleteTrip 
}) => {
    // ============================================================================
    // ✨ 階段三瘦身：移除 CheckList 邏輯與 Tab 切換，直接提昇文件管理核心
    // ============================================================================
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [viewingTrash, setViewingTrash] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // 本地快照 (用於 UI 拖曳操作，並與 Props 同步)
    const [localFolders, setLocalFolders] = useState<VaultFolder[]>(folders);
    const [localFiles, setLocalFiles] = useState<VaultFile[]>(files);

    // 當外部資料 (Props) 更新時，同步到本地狀態
    useEffect(() => {
        setLocalFolders(folders);
        setLocalFiles(files);
    }, [folders, files]);

    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const allActiveFiles = localFiles.filter(f => !f.isDeleted);
    const activeFolders = localFolders.filter(f => !f.isDeleted && f.parentId === currentPath);
    const currentFiles = allActiveFiles.filter(f => f.parentId === currentPath);
    
    const deletedFolders = localFolders.filter(f => f.isDeleted);
    const deletedFiles = localFiles.filter(f => f.isDeleted);
    const pinnedFiles = currentFiles.filter(f => f.isPinned);
    const unpinnedFiles = currentFiles.filter(f => !f.isPinned);
    
    const sortedFolders = [...activeFolders].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    const currentFolderName = currentPath ? localFolders.find(f => f.id === currentPath)?.name : '我的文件';

    const handleCreateFolder = async () => {
        if(!newFolderName.trim()) return;
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if(!user) return;
            
            const newFolder = {
                user_id: user.id,
                name: newFolderName,
                parent_id: currentPath,
                is_pinned: false,
                is_deleted: false
            };

            const { error } = await supabase.from('vault_folders').insert(newFolder);
            if(error) throw error;

            setNewFolderName('');
            setIsCreatingFolder(false);
            onRefresh(); // 通知 App.tsx 更新
        } catch (e) {
            console.error(e);
            alert("建立資料夾失敗");
        }
    };

    const onFolderDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(sortedFolders);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        
        // 暫時僅更新本地視圖
        const otherFolders = localFolders.filter(f => f.isDeleted || f.parentId !== currentPath);
        setLocalFolders([...otherFolders, ...items]);
    };

    const updateFolderStatus = async (id: string, updates: any) => {
        // 樂觀更新 (Optimistic Update)
        setLocalFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        const dbUpdates: any = {};
        if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
        if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
        
        const { error } = await supabase.from('vault_folders').update(dbUpdates).eq('id', id);
        if(error) {
            console.error(error);
            onRefresh(); // 出錯時回滾
        } else {
            onRefresh(); // 成功後確認同步
        }
    };

    const toggleFolderPin = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const folder = localFolders.find(f => f.id === id);
        if(folder) updateFolderStatus(id, { isPinned: !folder.isPinned });
    };

    const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm("確定將此資料夾移至垃圾桶？")) {
            updateFolderStatus(id, { isDeleted: true });
        }
    };

    const handleRestoreFolder = (id: string) => {
        updateFolderStatus(id, { isDeleted: false });
    };

    const handlePermanentDeleteFolder = async (id: string) => {
        if(confirm("確定要永久刪除此資料夾？此動作無法復原。")) {
            setLocalFolders(prev => prev.filter(f => f.id !== id));
            await supabase.from('vault_folders').delete().eq('id', id);
            onRefresh();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        if (file.size > 10 * 1024 * 1024) { alert("檔案過大！上限 10MB"); return; }
        
        setIsUploading(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("請先登入");

            const fileExt = file.name.split('.').pop();
            const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${user.id}/${safeFileName}`;
            
            const { error: uploadError } = await supabase.storage.from('vault').upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const newFileRec = {
                user_id: user.id,
                name: file.name,
                type: file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'other',
                size: (file.size / 1024).toFixed(0) + ' KB',
                file_path: filePath,
                parent_id: currentPath,
                is_deleted: false,
                is_pinned: false,
                category: 'other' // 預設為一般文件
            };
            
            const { error: dbError } = await supabase.from('vault_files').insert(newFileRec);
            if (dbError) throw dbError;
            
            onRefresh(); // 通知更新
            alert("上傳成功！");
        } catch (error: any) { 
            alert("上傳失敗：" + error.message); 
        } finally { 
            setIsUploading(false);
        }
    };

    const handleOpenFile = async (file: VaultFile) => {
        // 如果 App.tsx 已經生成了有效的 Signed URL，直接用
        if (file.data && file.data.startsWith('http')) {
            window.open(file.data, '_blank');
            return;
        }

        // 否則現場申請一個 (1小時有效)
        if (!file.file_path) return;
        try {
            const { data, error } = await supabase
                .storage
                .from('vault')
                .createSignedUrl(file.file_path, 60 * 60);

            if (error) throw error;
            if (data) window.open(data.signedUrl, '_blank');
        } catch (e) { 
            console.error("無法開啟檔案", e);
            alert("無法開啟檔案：權限不足或檔案不存在");
        }
    };

    const updateFileStatus = async (id: string, updates: any) => {
        setLocalFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        const dbUpdates: any = {};
        if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
        if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
        
        const { error } = await supabase.from('vault_files').update(dbUpdates).eq('id', id);
        if (error) {
            onRefresh(); // Rollback
        } else {
            onRefresh(); // Sync
        }
    };

    const handlePermanentDeleteFile = async (id: string, filePath?: string) => {
        if(confirm("確定要永久刪除？無法復原。")) {
            setLocalFiles(prev => prev.filter(f => f.id !== id));
            const { error } = await supabase.from('vault_files').delete().eq('id', id);
            if (error) { alert("刪除失敗"); onRefresh(); return; }
            if (filePath) await supabase.storage.from('vault').remove([filePath]);
            onRefresh();
        }
    };

    return (
        <div className="h-full flex flex-col w-full bg-transparent">
            {/* === Header === */}
            <div className="flex-shrink-0 pt-20 pb-4 px-5 bg-[#E4E2DD]/95 backdrop-blur-xl z-40 border-b border-gray-200/50 w-full transition-all sticky top-0">
                <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1B]">保管箱</h1>
            </div>

            {/* === Content Area === */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-24 w-full scroll-smooth no-scrollbar">
                
                {/* 垃圾桶視圖 */}
                {viewingTrash ? (
                    <div className="animate-in fade-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3 mb-6 px-1">
                            <button onClick={() => setViewingTrash(false)} className="p-2 bg-white rounded-full text-gray-600 hover:bg-gray-100 transition-colors shadow-sm border border-gray-100">
                                <ArrowLeft className="w-5 h-5" /> 
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-[#1D1D1B]">垃圾桶</h2>
                                <p className="text-xs text-gray-500">已刪除的項目</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* 1. 刪除的資料夾 */}
                            <div className="bg-[#FFF7ED] rounded-[28px] p-5 border border-orange-100">
                                <h3 className="text-xs font-bold text-orange-400 uppercase mb-3 ml-1 flex items-center gap-1"><Folder className="w-3 h-3" /> 資料夾</h3>
                                {deletedFolders.length === 0 ? (<p className="text-gray-400 text-sm text-center py-4">無資料夾</p>) : (
                                    <div className="space-y-2">
                                        {deletedFolders.map(folder => (
                                            <div key={folder.id} className="bg-white p-3 rounded-2xl border border-orange-100 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0 text-orange-400">
                                                        <Folder className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0"><p className="font-medium truncate text-gray-800 text-sm">{folder.name}</p></div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleRestoreFolder(folder.id)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handlePermanentDeleteFolder(folder.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. 刪除的文件 */}
                            <div className="bg-[#FEF2F2] rounded-[28px] p-5 border border-red-100">
                                <h3 className="text-xs font-bold text-red-400 uppercase mb-3 ml-1 flex items-center gap-1"><FileIcon className="w-3 h-3" /> 文件</h3>
                                {deletedFiles.length === 0 ? (<p className="text-gray-400 text-sm text-center py-4">無檔案</p>) : (
                                    <div className="space-y-2">
                                        {deletedFiles.map(file => (
                                            <div key={file.id} className="bg-white p-3 rounded-2xl border border-red-100 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 text-gray-400">{file.type === 'image' ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}</div>
                                                    <div className="min-w-0"><p className="font-medium truncate text-gray-800 text-sm">{file.name}</p><p className="text-[10px] text-gray-400">{file.size}</p></div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => updateFileStatus(file.id, { isDeleted: false })} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handlePermanentDeleteFile(file.id, file.data)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. 刪除的行程 */}
                            <div className="bg-[#EFF6FF] rounded-[28px] p-5 border border-blue-100">
                                <h3 className="text-xs font-bold text-blue-400 uppercase mb-3 ml-1 flex items-center gap-1"><Cloud className="w-3 h-3" /> 行程</h3>
                                {deletedTrips.length === 0 ? (<p className="text-gray-400 text-sm text-center py-4">無行程</p>) : (
                                    <div className="space-y-2">
                                        {deletedTrips.map(trip => (
                                            <div key={trip.id} className="bg-white p-3 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-gray-200 rounded-xl overflow-hidden shrink-0"><img src={trip.coverImage} className="w-full h-full object-cover grayscale opacity-60" alt="" /></div>
                                                    <div className="min-w-0"><p className="font-medium truncate text-gray-800 text-sm">{trip.destination}</p><p className="text-[10px] text-gray-400">{trip.days.length} 天</p></div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { if (onRestoreTrip) onRestoreTrip(trip.id); }} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { if (onPermanentDeleteTrip) onPermanentDeleteTrip(trip.id); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // 正常檔案瀏覽視圖
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 1. 儲存空間指示器 */}
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-white">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">雲端空間</span>
                                <span className="text-sm font-bold text-gray-900">{files.length} 個檔案</span>
                            </div>
                            <div className="h-3 w-full bg-[#F5F5F4] rounded-full overflow-hidden flex">
                                <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${(files.filter(f=>f.type==='image').length/files.length)*100 || 0}%` }}></div>
                                <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${(files.filter(f=>f.type==='pdf').length/files.length)*100 || 0}%` }}></div>
                            </div>
                            <div className="flex gap-3 mt-3">
                                <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="w-2 h-2 rounded-full bg-yellow-400"></div>圖片</div>
                                <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="w-2 h-2 rounded-full bg-blue-400"></div>文件</div>
                            </div>
                        </div>

                        {/* 2. 路徑導航 & 垃圾桶入口 */}
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                {currentPath && (
                                    <button onClick={() => setCurrentPath(null)} className="text-[#45846D] flex items-center gap-1 pr-1 font-bold active:opacity-50">
                                        <ArrowLeft className="w-5 h-5" /> 
                                    </button>
                                )}
                                <h2 className="text-xl font-bold text-[#1D1D1B]">{currentFolderName}</h2>
                            </div>
                            
                            {!currentPath && (
                                <button onClick={() => setViewingTrash(true)} className="p-2 bg-white rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm border border-white">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <DragDropContext onDragEnd={onFolderDragEnd}>
                            {/* 3. 資料夾列表 (支援拖曳) */}
                            {sortedFolders.length > 0 && (
                                <Droppable droppableId="folders-list" type="FOLDER" direction="horizontal">
                                    {(provided) => (
                                        <div 
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="grid grid-cols-2 gap-3 mb-6"
                                        >
                                            {sortedFolders.map((folder, index) => (
                                                <Draggable key={folder.id} draggableId={folder.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div 
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
                                                            onClick={() => setCurrentPath(folder.id)}
                                                            className={`p-4 rounded-[24px] border transition-all cursor-pointer relative group flex flex-col items-start 
                                                                ${folder.isPinned ? 'bg-[#FFFBEB] border-yellow-100' : 'bg-[#E4E2DD]/60 border-white/50'}
                                                                ${snapshot.isDragging ? 'z-50 shadow-lg scale-105 opacity-90' : ''}
                                                            `}
                                                        >
                                                            <div className="w-full flex justify-between items-start mb-2">
                                                                <Folder className={`w-8 h-8 ${folder.isPinned ? 'text-yellow-500' : 'text-[#45846D]'} fill-current opacity-80`} />
                                                                <div className="flex gap-1">
                                                                    <button 
                                                                        onClick={(e) => toggleFolderPin(folder.id, e)}
                                                                        className={`p-1 rounded-full transition-colors ${folder.isPinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-yellow-500'}`}
                                                                    >
                                                                        <Pin className="w-3.5 h-3.5 fill-current" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => handleDeleteFolder(folder.id, e)}
                                                                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <h3 className="font-bold text-[#1D1D1B] truncate w-full text-sm">{folder.name}</h3>
                                                            <p className="text-[10px] text-gray-500">
                                                                {allActiveFiles.filter(f => f.parentId === folder.id).length} 項目
                                                            </p>
                                                            
                                                            <div 
                                                                {...provided.dragHandleProps}
                                                                className="absolute bottom-2 right-2 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing z-10 touch-none"
                                                                style={{ touchAction: 'none' }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            )}

                            {/* 4. 置頂檔案區 */}
                            {pinnedFiles.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1 flex items-center gap-1"><Pin className="w-3 h-3" /> 置頂</h3>
                                    <div className="space-y-2">
                                        {pinnedFiles.map(file => (
                                            <div onClick={() => handleOpenFile(file)} key={file.id} className="bg-[#FFFBEB] p-3 rounded-2xl border border-yellow-100 flex items-center gap-4 shadow-sm cursor-pointer">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-yellow-100 text-yellow-600`}>
                                                    {file.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <FileIcon className="w-6 h-6" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-[#1D1D1B] truncate text-sm">{file.name}</h4>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500"><span>{file.size}</span><span></span><span>{file.date}</span></div>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); updateFileStatus(file.id, { isPinned: false }); }} className="p-2 text-yellow-500 hover:text-gray-400"><Pin className="w-5 h-5 fill-current" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 5. 檔案列表區 (支援拖曳) */}
                            <div className="space-y-2">
                                {currentFiles.length === 0 && sortedFolders.length === 0 && !isCreatingFolder && (
                                    <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl">
                                        <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs font-medium">此資料夾是空的</p>
                                    </div>
                                )}

                                {unpinnedFiles.length > 0 && (
                                    <Droppable droppableId="files-list" type="FILE">
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                                                {unpinnedFiles.map((file, index) => (
                                                    <Draggable key={file.id} draggableId={file.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div 
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                style={{ ...provided.draggableProps.style, touchAction: 'pan-y' }}
                                                                onClick={() => handleOpenFile(file)}
                                                                className={`bg-white p-3 rounded-2xl border border-white shadow-sm flex items-center gap-3 transition-transform group cursor-pointer ${snapshot.isDragging ? 'z-50 shadow-lg opacity-90' : ''}`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${file.type === 'pdf' ? 'bg-red-50 text-red-500' : file.type === 'image' ? 'bg-purple-50 text-purple-500' : 'bg-gray-50 text-gray-500'}`}>
                                                                    {file.type === 'image' ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-bold text-[#1D1D1B] truncate text-sm">{file.name}</h4>
                                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400"><span>{file.size}</span><span></span><span>{file.date}</span></div>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); updateFileStatus(file.id, { isPinned: true }); }} className="p-2 text-gray-300 hover:text-yellow-500"><Pin className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); updateFileStatus(file.id, { isDeleted: true }); }} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                                </div>

                                                                <div 
                                                                    {...provided.dragHandleProps}
                                                                    className="p-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
                                                                    style={{ touchAction: 'none' }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <GripVertical className="w-5 h-5" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                )}
                            </div>
                        </DragDropContext>

                        {/* 6. 底部操作按鈕 */}
                        {isCreatingFolder ? (
                            <div className="bg-[#F5F5F4] p-3 rounded-2xl flex gap-2 items-center animate-in fade-in mt-4">
                                <Folder className="text-[#45846D] w-5 h-5 ml-1" />
                                <input 
                                    autoFocus
                                    className="flex-1 bg-white border border-transparent rounded-xl px-3 py-2 text-sm outline-none"
                                    placeholder="資料夾名稱"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                                />
                                <button onClick={handleCreateFolder} className="text-[#45846D] font-bold text-xs px-2">建立</button>
                                <button onClick={() => setIsCreatingFolder(false)} className="text-gray-400 text-xs px-2">取消</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <button 
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="flex items-center justify-center gap-1.5 py-3.5 bg-white border border-white text-gray-600 rounded-2xl font-bold text-xs shadow-sm active:bg-gray-50 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    新資料夾
                                </button>
                                <label className={`flex items-center justify-center gap-1.5 py-3.5 bg-[#45846D] text-white rounded-2xl font-bold text-xs shadow-md shadow-[#45846D]/20 active:bg-[#3A705C] transition-colors cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {isUploading ? '上傳中...' : '上傳檔案'}
                                    <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" disabled={isUploading} />
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};