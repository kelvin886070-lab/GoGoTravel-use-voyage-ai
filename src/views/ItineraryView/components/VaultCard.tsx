import React, { useState } from 'react';
import { 
    FileText, Plane, Bed, BookUser, Copy, Check, 
    Shield, Map, Eye, X, Pencil, Plus 
} from 'lucide-react';
import type { Document } from '../../../types';

type ExtendedDocument = Document & { folderName?: string };

const getThemeConfig = (doc: ExtendedDocument) => {
    const folder = (doc.folderName || '').toLowerCase();
    const type = doc.type;

    if (folder.includes('機票') || folder.includes('交通') || folder.includes('flight') || folder.includes('transport') || folder.includes('ticket')) {
        return { icon: Plane, label: doc.folderName || '機票憑證', bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-600', iconBg: 'bg-sky-100', numberLabel: '訂位代號' };
    }
    if (folder.includes('住宿') || folder.includes('飯店') || folder.includes('hotel') || folder.includes('booking')) {
        return { icon: Bed, label: doc.folderName || '住宿憑證', bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-600', iconBg: 'bg-purple-100', numberLabel: '訂單編號' };
    }
    if (folder.includes('保險') || folder.includes('合約') || folder.includes('insurance') || folder.includes('policy')) {
        return { icon: Shield, label: doc.folderName || '旅遊保險', bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-600', iconBg: 'bg-teal-100', numberLabel: '保單號碼' };
    }
    if (folder.includes('護照') || folder.includes('證件') || folder.includes('passport') || folder.includes('id') || type === 'passport') {
        return { icon: BookUser, label: doc.folderName || '護照證件', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100', numberLabel: '證件號碼' };
    }
    if (folder.includes('行程') || folder.includes('地圖') || folder.includes('plan') || folder.includes('map') || folder.includes('reference')) {
        return { icon: Map, label: doc.folderName || '行程參考', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100', numberLabel: '參考編號' };
    }

    return { icon: FileText, label: doc.folderName || '一般文件', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-slate-200', numberLabel: '關鍵號碼' };
};

export const VaultCard: React.FC<{ 
    doc: Document; 
    onRemove?: () => void;
    onEdit?: () => void; 
}> = ({ doc, onRemove, onEdit }) => {
    
    const config = getThemeConfig(doc as ExtendedDocument);
    const Icon = config.icon;
    const [copied, setCopied] = useState(false);

    const isImageVisual = doc.fileUrl && (
        doc.type === 'passport' || 
        (doc as any).type === 'image' || 
        /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(doc.fileUrl)
    );

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // 雖然卡片本身沒事件了，但保持習慣防止冒泡
        if (doc.documentNumber) {
            navigator.clipboard.writeText(doc.documentNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handlePreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (doc.fileUrl) {
            window.open(doc.fileUrl, '_blank');
        } else {
            alert('預覽功能：此文件無檔案連結。');
        }
    };

    return (
        <div 
            className="group relative w-[300px] bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col cursor-default"
        >
            <div className={`h-1.5 w-full ${config.bg.replace('50', '500')}`} />
            
            {/* 右上角：編輯與刪除 (Hover 顯示) */}
            <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-[#1D1D1B] hover:text-white transition-colors shadow-sm"
                        title="編輯資訊"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                )}
                {onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"
                        title="移除此連結"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                        <span className={`text-[10px] font-bold ${config.text} tracking-wide truncate max-w-[120px]`}>
                            {config.label}
                        </span>
                    </div>
                    {doc.isOffline && (
                        <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-[9px] font-bold text-green-700">Offline</span>
                        </div>
                    )}
                </div>

                {/* Main Content (Image/Icon & Title) */}
                <div className="flex gap-4">
                    <div className="shrink-0">
                        {isImageVisual ? (
                            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-inner border border-gray-100 bg-gray-50">
                                <img src={doc.fileUrl} alt="preview" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center`}>
                                <Icon className={`w-7 h-7 ${config.text} opacity-80`} />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <h3 className="font-bold text-[#1D1D1B] text-sm leading-tight truncate mb-1 select-text">
                            {doc.title}
                        </h3>
                        {doc.notes && (
                            <p className="text-[10px] text-gray-400 font-medium truncate">
                                {doc.notes}
                            </p>
                        )}
                    </div>
                </div>

                {/* 分隔線 */}
                <div className="my-4 border-t-2 border-dashed border-gray-100 relative">
                    <div className="absolute -left-[22px] -top-2 w-4 h-4 bg-[#FAFAFA] rounded-full" />
                    <div className="absolute -right-[22px] -top-2 w-4 h-4 bg-[#FAFAFA] rounded-full" />
                </div>

                {/* Footer: 極簡風格資訊列 + 工具列 */}
                <div className="mt-auto flex justify-between items-end h-[32px]">
                    {/* 左側：顯示號碼 或 建立日期 */}
                    <div className="flex flex-col justify-end pb-0.5">
                        {doc.documentNumber ? (
                            <>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                                    {config.numberLabel}
                                </span>
                                <span className="font-mono font-bold text-[#1D1D1B] text-sm leading-none select-all">
                                    {doc.documentNumber}
                                </span>
                            </>
                        ) : (
                            <span className="text-[10px] text-gray-300 font-bold">
                                Added {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    {/* 右側：工具按鈕組 (複製/新增 + 檢視) */}
                    <div className="flex items-center gap-2">
                        {/* 按鈕 1: 複製 或 新增 */}
                        {doc.documentNumber ? (
                            <button 
                                onClick={handleCopy}
                                className={`p-1.5 rounded-lg transition-all active:scale-95 ${copied ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-[#1D1D1B]'}`}
                                title="複製號碼"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        ) : (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-[#45846D] hover:text-[#45846D] hover:bg-[#45846D]/5 transition-all active:scale-95 group/add"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">編號</span>
                            </button>
                        )}

                        {/* 按鈕 2: 檢視 (唯一的開啟入口) */}
                        <button 
                            onClick={handlePreview}
                            className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-[#1D1D1B] transition-all active:scale-95 shadow-sm border border-transparent hover:border-gray-200"
                            title="檢視檔案"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};