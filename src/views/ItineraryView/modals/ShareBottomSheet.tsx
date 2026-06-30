import React, { useState } from 'react';
import { Copy, MessageCircle, FileDown, Loader2, Share } from 'lucide-react';
import type { Trip } from '../../../types';

interface ShareBottomSheetProps {
    trip: Trip;
    isOpen: boolean;
    onClose: () => void;
}

export const ShareBottomSheet: React.FC<ShareBottomSheetProps> = ({ trip, isOpen, onClose }) => {
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const handleCopyLink = () => {
        // 模擬複製連結功能
        navigator.clipboard.writeText(`https://kelvintrip.app/share/${trip.id}`);
        alert('連結已複製！');
        onClose();
    };

    // 🩹 改為「按下才產生 PDF」：
    //   - 避免一打開面板就用 PDFDownloadLink eager 渲染整份 PDF（手機記憶體不足→白畫面）
    //   - 動態 import @react-pdf（大套件不進主 bundle，縮小首包）
    //   - 全程 try/catch，失敗只跳提示、不讓整棵 React 樹崩潰
    const handleExportPdf = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        try {
            const [{ pdf }, { TripPDFDocument }] = await Promise.all([
                import('@react-pdf/renderer'),
                import('../../../components/pdf/TripPDFDocument'),
            ]);
            const blob = await pdf(<TripPDFDocument trip={trip} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `KelvinTrip_${trip.destination}_行程表.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (err) {
            console.error('PDF 匯出失敗', err);
            alert('PDF 匯出失敗，可能是照片過多或裝置記憶體不足，請稍後再試。');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* 🛡️ 防禦：底層鎖定防穿透 */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in touch-none overscroll-none"
                onClick={onClose}
            />

            <div className="bg-[#F2F2F2] w-full max-w-md rounded-t-[32px] relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">

                {/* 頂部把手 */}
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* 快速分享 Icon 區塊 (模擬您的截圖) */}
                <div className="flex justify-center gap-8 py-6">
                    <button className="flex flex-col items-center gap-2 group">
                        <div className="w-14 h-14 bg-[#06C755] rounded-2xl flex items-center justify-center text-white shadow-sm group-active:scale-95 transition-transform">
                            <MessageCircle className="w-7 h-7 fill-current" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">LINE</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 group">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm border border-gray-100 group-active:scale-95 transition-transform">
                            <Share className="w-7 h-7" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">AirDrop</span>
                    </button>
                </div>

                {/* 列表選項區塊 */}
                <div className="px-5 pb-5 space-y-3">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">

                        {/* 1. 複製連結 */}
                        <button
                            onClick={handleCopyLink}
                            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 active:bg-gray-100"
                        >
                            <Copy className="w-5 h-5 text-gray-400" />
                            <span className="font-bold text-[#1D1D1B] text-sm">複製連結</span>
                        </button>

                        {/* 2. 分享至 LINE */}
                        <button
                            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 active:bg-gray-100"
                        >
                            <MessageCircle className="w-5 h-5 text-[#06C755]" />
                            <span className="font-bold text-[#1D1D1B] text-sm">分享至 LINE</span>
                        </button>

                        {/* 3. 匯出 PDF（按下才產生，避免手機白畫面） */}
                        <button
                            onClick={handleExportPdf}
                            disabled={isGenerating}
                            className={`w-full flex items-center gap-4 p-4 transition-colors active:bg-gray-100 ${isGenerating ? 'bg-gray-50/80 cursor-wait' : 'hover:bg-gray-50 bg-white'}`}
                        >
                            {isGenerating ? (
                                <Loader2 className="w-5 h-5 text-[#45846D] animate-spin" />
                            ) : (
                                <FileDown className="w-5 h-5 text-[#45846D]" />
                            )}
                            <span className={`font-bold text-sm ${isGenerating ? 'text-gray-400' : 'text-[#45846D]'}`}>
                                {isGenerating ? '正在排版精美 PDF...' : '匯出 PDF 行程表'}
                            </span>
                        </button>
                    </div>

                    {/* 取消按鈕 */}
                    <button
                        onClick={onClose}
                        className="w-full p-4 bg-white rounded-2xl font-bold text-gray-500 hover:text-gray-700 shadow-sm border border-gray-100 transition-colors active:bg-gray-50"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};
