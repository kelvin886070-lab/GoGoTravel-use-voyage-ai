import React, { useState, useEffect } from 'react';
import { Copy, MessageCircle, FileDown, Loader2, Share } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { TripPDFDocument } from '../../../components/pdf/TripPDFDocument';
import type { Trip } from '../../../types';
interface ShareBottomSheetProps {
    trip: Trip;
    isOpen: boolean;
    onClose: () => void;
}

export const ShareBottomSheet: React.FC<ShareBottomSheetProps> = ({ trip, isOpen, onClose }) => {
    // 解決 Hydration / 初次渲染問題，確保 PDF 引擎在 Client 端準備好
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isOpen) return null;

    const handleCopyLink = () => {
        // 模擬複製連結功能
        navigator.clipboard.writeText(`https://kelvintrip.app/share/${trip.id}`);
        alert('連結已複製！');
        onClose();
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

                        {/* 3. 匯出 PDF (The Magic Happens Here) */}
                        {isClient && (
                            <PDFDownloadLink
                                document={<TripPDFDocument trip={trip} />}
                                fileName={`KelvinTrip_${trip.destination}_行程表.pdf`}
                                className="w-full block"
                            >
                                {({ loading }) => (
                                    <button 
                                        disabled={loading}
                                        className={`w-full flex items-center gap-4 p-4 transition-colors active:bg-gray-100 ${loading ? 'bg-gray-50/80 cursor-wait' : 'hover:bg-gray-50 bg-white'}`}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 text-[#45846D] animate-spin" />
                                        ) : (
                                            <FileDown className="w-5 h-5 text-[#45846D]" />
                                        )}
                                        <span className={`font-bold text-sm ${loading ? 'text-gray-400' : 'text-[#45846D]'}`}>
                                            {loading ? '正在排版精美 PDF...' : '匯出 PDF 行程表'}
                                        </span>
                                    </button>
                                )}
                            </PDFDownloadLink>
                        )}
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