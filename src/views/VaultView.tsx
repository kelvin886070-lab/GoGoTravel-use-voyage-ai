
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, FileText, Upload, ChevronRight, Plus, Trash2, Folder, Image as ImageIcon, ArrowLeft, File as FileIcon, RotateCcw, XCircle, Pin, GripHorizontal, GripVertical } from 'lucide-react';
import { IOSHeader, IOSCard, MadeByFooter } from '../components/UI';
import type { ChecklistItem, ChecklistCategory, Trip, VaultFile, VaultFolder } from '../types';

interface VaultViewProps {
    deletedTrips?: Trip[];
    onRestoreTrip?: (id: string) => void;
    onPermanentDeleteTrip?: (id: string) => void;
}

// --- Checklist Types & Data ---
const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: '1', text: '護照', checked: false, category: 'documents' },
  { id: '2', text: '簽證影本', checked: false, category: 'documents' },
  { id: '3', text: '機票證明', checked: false, category: 'documents' },
  { id: '4', text: '外幣/信用卡', checked: false, category: 'documents' },
  { id: '5', text: '行動電源', checked: false, category: 'gadgets' },
  { id: '6', text: '轉接頭', checked: false, category: 'gadgets' },
  { id: '8', text: '盥洗用具', checked: false, category: 'toiletries' },
  { id: '10', text: '保暖外套', checked: false, category: 'clothes' },
];

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
    documents: '必備證件',
    clothes: '衣物穿搭',
    toiletries: '盥洗/藥品',
    gadgets: '3C 電子',
    others: '其他物品'
};

const INITIAL_FOLDERS: VaultFolder[] = [
    { id: 'f1', name: '機票憑證', parentId: null },
    { id: 'f2', name: '住宿確認', parentId: null },
    { id: 'f3', name: '保險單', parentId: null },
    { id: 'f4', name: '行程參考圖', parentId: null },
];

export const VaultView: React.FC<VaultViewProps> = ({ deletedTrips = [], onRestoreTrip, onPermanentDeleteTrip }) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'files'>('checklist');

  return (
    <div className="min-h-screen pb-24">
      <IOSHeader title="保管箱" />
      
      <div className="px-5 mt-4 mb-6">
        <div className="bg-gray-200/50 p-1 rounded-xl flex">
          <button 
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'checklist' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            檢查表
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'files' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            文件管理
          </button>
        </div>
      </div>

      <div className="px-5">
        {activeTab === 'checklist' ? <ChecklistManager /> : <FileManager deletedTrips={deletedTrips} onRestoreTrip={onRestoreTrip} onPermanentDeleteTrip={onPermanentDeleteTrip} />}
      </div>
      <MadeByFooter />
    </div>
  );
};

// --- Sub-Component: Checklist Manager ---
// Changed from const to function to allow hoisting
function ChecklistManager() {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    try {
        const saved = localStorage.getItem('voyage_checklist');
        return saved ? JSON.parse(saved) : INITIAL_CHECKLIST;
    } catch (e) {
        return INITIAL_CHECKLIST;
    }
  });

  useEffect(() => {
    localStorage.setItem('voyage_checklist', JSON.stringify(items));
  }, [items]);

  const [newItemText, setNewItemText] = useState('');
  const [addingToCategory, setAddingToCategory] = useState<ChecklistCategory | null>(null);

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const addItem = (category: ChecklistCategory) => {
      if (!newItemText.trim()) return;
      const newItem: ChecklistItem = {
          id: Date.now().toString(),
          text: newItemText,
          checked: false,
          category
      };
      setItems([...items, newItem]);
      setNewItemText('');
      setAddingToCategory(null);
  };

  const deleteItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setItems(items.filter(i => i.id !== id));
  };

  const completedCount = items.filter(i => i.checked).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const renderCategory = (category: ChecklistCategory) => {
      const categoryItems = items.filter(i => i.category === category);
      
      return (
          <div key={category} className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4 border border-gray-100">
              <div className="w-full flex items-center justify-between p-4 bg-gray-50/50 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-base">{CATEGORY_LABELS[category]}</h3>
                  <span className="text-xs text-gray-400 font-medium bg-white px-2 py-1 rounded-full border border-gray-200">
                      {categoryItems.filter(i => i.checked).length}/{categoryItems.length}
                  </span>
              </div>
              
              <div>
                  {categoryItems.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => toggleCheck(item.id)}
                        className="p-4 flex items-center gap-4 cursor-pointer active:bg-gray-50 border-b border-gray-50 last:border-0 group"
                      >
                        {item.checked ? (
                          <CheckCircle2 className="w-6 h-6 text-ios-green fill-current shrink-0" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-300 shrink-0" />
                        )}
                        <span className={`text-[17px] flex-1 transition-all ${item.checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {item.text}
                        </span>
                        <button 
                            onClick={(e) => deleteItem(item.id, e)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  ))}
                  
                  {addingToCategory === category ? (
                      <div className="p-3 flex gap-2 items-center bg-gray-50 animate-in fade-in">
                          <input 
                            autoFocus
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-ios-blue"
                            placeholder="輸入項目名稱..."
                            value={newItemText}
                            onChange={e => setNewItemText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem(category)}
                          />
                          <button onClick={() => addItem(category)} className="text-ios-blue font-semibold text-sm px-2">新增</button>
                          <button onClick={() => setAddingToCategory(null)} className="text-gray-400 text-sm px-2">取消</button>
                      </div>
                  ) : (
                      <button 
                        onClick={() => setAddingToCategory(category)}
                        className="w-full p-3 text-sm text-ios-blue hover:bg-blue-50/50 flex items-center justify-center gap-1 font-medium transition-colors"
                      >
                          <Plus className="w-4 h-4" /> 新增項目
                      </button>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm sticky top-[120px] z-10 border border-gray-100">
            <div className="flex justify-between text-sm font-medium mb-2 text-gray-500">
            <span>準備進度</span>
            <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-ios-green transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
        </div>

        <div className="space-y-2">
            {renderCategory('documents')}
            {renderCategory('clothes')}
            {renderCategory('toiletries')}
            {renderCategory('gadgets')}
            {renderCategory('others')}
        </div>
    </div>
  );
}

// --- Sub-Component: File Manager & Trash Bin ---
interface FileManagerProps {
    deletedTrips: Trip[];
    onRestoreTrip?: (id: string) => void;
    onPermanentDeleteTrip?: (id: string) => void;
}

// Changed from const to function to allow hoisting
function FileManager({ deletedTrips, onRestoreTrip, onPermanentDeleteTrip }: FileManagerProps) {
    const [currentPath, setCurrentPath] = useState<string | null>(null); // null = root
    const [viewingTrash, setViewingTrash] = useState(false);
    
    // State for Folders and Files
    const [folders, setFolders] = useState<VaultFolder[]>(() => {
        const saved = localStorage.getItem('voyage_folders');
        return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
    });

    const [files, setFiles] = useState<VaultFile[]>(() => {
        const saved = localStorage.getItem('voyage_files');
        return saved ? JSON.parse(saved) : [];
    });

    // Persistence
    useEffect(() => { localStorage.setItem('voyage_folders', JSON.stringify(folders)); }, [folders]);
    useEffect(() => { 
        try {
            localStorage.setItem('voyage_files', JSON.stringify(files)); 
        } catch(e) {
            console.error("Quota exceeded");
        }
    }, [files]);

    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Filter Logic
    const activeFiles = files.filter(f => !f.isDeleted);
    const deletedFiles = files.filter(f => f.isDeleted);
    
    // If not in trash, show normal structure
    const currentFolders = folders.filter(f => f.parentId === currentPath);
    const currentFiles = activeFiles.filter(f => f.parentId === currentPath);
    
    // Separate pinned and unpinned
    const pinnedFiles = currentFiles.filter(f => f.isPinned);
    const unpinnedFiles = currentFiles.filter(f => !f.isPinned);
    
    const currentFolderName = currentPath ? folders.find(f => f.id === currentPath)?.name : '我的文件';

    // Drag and Drop State for FILES
    const dragFileId = useRef<string | null>(null);
    const dragOverFileId = useRef<string | null>(null);

    // Drag and Drop State for FOLDERS
    const dragFolderId = useRef<string | null>(null);
    const dragOverFolderId = useRef<string | null>(null);

    const handleCreateFolder = () => {
        if(!newFolderName.trim()) return;
        const newFolder: VaultFolder = {
            id: Date.now().toString(),
            name: newFolderName,
            parentId: currentPath
        };
        setFolders([...folders, newFolder]);
        setNewFolderName('');
        setIsCreatingFolder(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        if (file.size > 1024 * 1024) {
            alert("檔案過大！為了確保 App 運作順暢，請上傳小於 1MB 的檔案。");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const newFile: VaultFile = {
                id: Date.now().toString(),
                name: file.name,
                type: file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'other',
                size: (file.size / 1024).toFixed(1) + ' KB',
                date: new Date().toLocaleDateString(),
                parentId: currentPath,
                data: reader.result as string,
                isDeleted: false,
                isPinned: false
            };
            try {
                setFiles(prev => [...prev, newFile]);
            } catch (e) {
                alert("儲存空間已滿，無法新增檔案。");
            }
        };
        reader.readAsDataURL(file);
    };

    // Toggle Pin
    const handleTogglePin = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFiles(files.map(f => f.id === id ? { ...f, isPinned: !f.isPinned } : f));
    };

    // Soft Delete File
    const handleSoftDeleteFile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm("確定要將此檔案移至垃圾桶嗎？")) {
            setFiles(files.map(f => f.id === id ? { ...f, isDeleted: true } : f));
        }
    }

    // Restore File
    const handleRestoreFile = (id: string) => {
        setFiles(files.map(f => f.id === id ? { ...f, isDeleted: false } : f));
    }

    // Permanent Delete File
    const handlePermanentDeleteFile = (id: string) => {
        if(confirm("確定要永久刪除？無法復原。")) {
            setFiles(files.filter(f => f.id !== id));
        }
    }

    const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm("確定要刪除此資料夾及其內容嗎？(資料夾內容將永久刪除)")) {
            setFolders(folders.filter(f => f.id !== id));
            // Also delete files inside strictly
            setFiles(files.filter(f => f.parentId !== id));
        }
    }

    // --- File Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        dragFileId.current = id;
    };

    const handleDragEnter = (e: React.DragEvent, id: string) => {
        dragOverFileId.current = id;
    };

    const handleDragEnd = () => {
        if (!dragFileId.current || !dragOverFileId.current) return;
        
        const copy = [...files];
        const dragIndex = copy.findIndex(f => f.id === dragFileId.current);
        const hoverIndex = copy.findIndex(f => f.id === dragOverFileId.current);
        
        if (dragIndex !== -1 && hoverIndex !== -1) {
             const draggedItem = copy[dragIndex];
             copy.splice(dragIndex, 1);
             copy.splice(hoverIndex, 0, draggedItem);
             setFiles(copy);
        }

        dragFileId.current = null;
        dragOverFileId.current = null;
    };

    // --- Folder Drag and Drop Handlers ---
    const handleFolderDragStart = (e: React.DragEvent, id: string) => {
        dragFolderId.current = id;
    };

    const handleFolderDragEnter = (e: React.DragEvent, id: string) => {
        dragOverFolderId.current = id;
    };

    const handleFolderDragEnd = () => {
        if (!dragFolderId.current || !dragOverFolderId.current) return;
        if (dragFolderId.current === dragOverFolderId.current) return;

        const copy = [...folders];
        const dragIndex = copy.findIndex(f => f.id === dragFolderId.current);
        const hoverIndex = copy.findIndex(f => f.id === dragOverFolderId.current);

        if (dragIndex !== -1 && hoverIndex !== -1) {
            const draggedItem = copy[dragIndex];
            copy.splice(dragIndex, 1);
            copy.splice(hoverIndex, 0, draggedItem);
            setFolders(copy);
        }

        dragFolderId.current = null;
        dragOverFolderId.current = null;
    };

    // --- Trash View ---
    if (viewingTrash) {
        return (
            <div className="pb-4 animate-in fade-in slide-in-from-bottom-4">
                 <div className="flex items-center gap-2 mb-6 px-1">
                    <button 
                        onClick={() => setViewingTrash(false)} 
                        className="text-ios-blue flex items-center gap-1 pr-2 font-medium active:opacity-50"
                    >
                        <ArrowLeft className="w-5 h-5" /> 
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900">垃圾桶</h2>
                </div>

                <div className="space-y-6">
                    {/* Deleted Files Section */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 ml-1">已刪除的檔案</h3>
                        {deletedFiles.length === 0 ? (
                            <p className="text-gray-400 text-sm ml-1 italic">無檔案</p>
                        ) : (
                            <div className="space-y-2">
                                {deletedFiles.map(file => (
                                    <div key={file.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm opacity-70 hover:opacity-100 transition-opacity">
                                         <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 text-gray-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate text-gray-800">{file.name}</p>
                                                <p className="text-xs text-gray-400">{file.size}</p>
                                            </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => handleRestoreFile(file.id)} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                                                <RotateCcw className="w-4 h-4" />
                                             </button>
                                             <button onClick={() => handlePermanentDeleteFile(file.id)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100">
                                                <XCircle className="w-4 h-4" />
                                             </button>
                                         </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Deleted Trips Section */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 ml-1">已刪除的行程</h3>
                        {deletedTrips.length === 0 ? (
                            <p className="text-gray-400 text-sm ml-1 italic">無行程</p>
                        ) : (
                            <div className="space-y-2">
                                {deletedTrips.map(trip => (
                                    <div key={trip.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm opacity-70 hover:opacity-100 transition-opacity">
                                         <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                                <img src={trip.coverImage} className="w-full h-full object-cover grayscale" alt="Deleted" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">{trip.destination}</p>
                                                <p className="text-xs text-gray-400">{trip.days.length} 天</p>
                                            </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => onRestoreTrip && onRestoreTrip(trip.id)} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                                                <RotateCcw className="w-4 h-4" />
                                             </button>
                                             <button onClick={() => onPermanentDeleteTrip && onPermanentDeleteTrip(trip.id)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100">
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
        );
    }

    // --- Normal File Browser View ---
    return (
        <div className="pb-4 animate-in fade-in slide-in-from-bottom-4">
            {/* Breadcrumb / Navigation */}
            <div className="flex items-center gap-2 mb-6 px-1">
                {currentPath && (
                    <button 
                        onClick={() => setCurrentPath(null)} 
                        className="text-ios-blue flex items-center gap-1 pr-2 font-medium active:opacity-50"
                    >
                        <ArrowLeft className="w-5 h-5" /> 
                    </button>
                )}
                <h2 className="text-2xl font-bold text-gray-900">{currentFolderName}</h2>
            </div>

            {/* Root-only Folders (Trash Can) */}
            {!currentPath && (
                <div 
                    onClick={() => setViewingTrash(true)}
                    className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-6 flex items-center gap-3 cursor-pointer hover:bg-red-100 transition-colors"
                >
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Trash2 className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-red-900">垃圾桶</h3>
                        <p className="text-xs text-red-400">管理已刪除的檔案與行程</p>
                    </div>
                    <ChevronRight className="ml-auto text-red-300 w-5 h-5" />
                </div>
            )}

            {/* Folder Grid */}
            {currentFolders.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {currentFolders.map((folder, index) => (
                        <div 
                            key={folder.id} 
                            draggable
                            onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                            onDragEnter={(e) => handleFolderDragEnter(e, folder.id)}
                            onDragEnd={handleFolderDragEnd}
                            onClick={() => setCurrentPath(folder.id)}
                            className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 active:bg-blue-100 transition-colors cursor-pointer relative group flex flex-col items-start"
                        >
                            <Folder className="w-10 h-10 text-ios-blue mb-3" fill="currentColor" fillOpacity={0.2} />
                            <h3 className="font-semibold text-gray-800 truncate w-full">{folder.name}</h3>
                            <p className="text-xs text-gray-500">
                                {activeFiles.filter(f => f.parentId === folder.id).length} 個檔案
                            </p>
                            
                            {/* Delete Button */}
                            <button 
                                onClick={(e) => handleDeleteFolder(folder.id, e)}
                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            {/* Drag Handle - Right Side */}
                            <div 
                                className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-ios-blue cursor-grab active:cursor-grabbing z-20"
                                onClick={(e) => e.stopPropagation()} 
                                onMouseDown={() => { /* This ensures drag starts here */ }}
                            >
                                <GripVertical className="w-5 h-5" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pinned Files Section */}
            {pinnedFiles.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1 flex items-center gap-1">
                        <Pin className="w-3 h-3" /> 置頂檔案
                    </h3>
                    <div className="space-y-3">
                        {pinnedFiles.map(file => (
                             <IOSCard key={file.id} className="!p-3 flex items-center gap-4 border border-yellow-200 bg-yellow-50/50">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-yellow-100 text-yellow-600`}>
                                    {file.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 truncate">{file.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{file.size}</span>
                                        <span>•</span>
                                        <span>{file.date}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleTogglePin(file.id, e)}
                                    className="p-2 text-yellow-500 hover:text-gray-400"
                                >
                                    <Pin className="w-5 h-5 fill-current" />
                                </button>
                            </IOSCard>
                        ))}
                    </div>
                </div>
            )}

            {/* Unpinned File List */}
            <div className="space-y-3">
                {currentFiles.length === 0 && currentFolders.length === 0 && !isCreatingFolder && (
                     <div className="text-center py-12 text-gray-400">
                        <Folder className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>此資料夾是空的</p>
                    </div>
                )}

                {unpinnedFiles.map(file => (
                    <div
                        key={file.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, file.id)}
                        onDragEnter={(e) => handleDragEnter(e, file.id)}
                        onDragEnd={handleDragEnd}
                        className="transition-transform"
                    >
                        <IOSCard className="!p-3 flex items-center gap-4 active:scale-[0.99] transition-transform cursor-pointer group">
                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                                <GripHorizontal className="w-5 h-5" />
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                file.type === 'pdf' ? 'bg-red-100 text-red-500' : 
                                file.type === 'image' ? 'bg-purple-100 text-purple-500' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {file.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">{file.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>{file.size}</span>
                                    <span>•</span>
                                    <span>{file.date}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => handleTogglePin(file.id, e)}
                                    className="p-2 text-gray-300 hover:text-yellow-500"
                                >
                                    <Pin className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={(e) => handleSoftDeleteFile(file.id, e)}
                                    className="p-2 text-gray-300 hover:text-red-500"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </IOSCard>
                    </div>
                ))}
            </div>

            {/* Actions */}
            {isCreatingFolder ? (
                <div className="mt-4 bg-gray-50 p-4 rounded-2xl flex gap-2 items-center animate-in fade-in">
                    <Folder className="text-gray-400 w-6 h-6" />
                    <input 
                        autoFocus
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none"
                        placeholder="資料夾名稱"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <button onClick={handleCreateFolder} className="text-ios-blue font-semibold text-sm px-2">建立</button>
                    <button onClick={() => setIsCreatingFolder(false)} className="text-gray-400 text-sm px-2">取消</button>
                </div>
            ) : (
                <div className="mt-8 grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold active:bg-gray-200 transition-colors"
                    >
                        <Folder className="w-5 h-5" />
                        新資料夾
                    </button>
                    <label className="flex items-center justify-center gap-2 py-3 bg-ios-blue text-white rounded-xl font-semibold active:bg-blue-600 transition-colors cursor-pointer shadow-sm shadow-blue-200">
                        <Upload className="w-5 h-5" />
                        上傳檔案
                        <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                    </label>
                </div>
            )}
        </div>
    );
}
