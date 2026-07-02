// src/components/ErrorBoundary.tsx
// 🛡️ 3.1 全域錯誤邊界：任何子元件丟出例外時，顯示友善畫面而非整頁白屏。
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, info: unknown) {
        console.error('ErrorBoundary 捕捉到未處理的錯誤:', error, info);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-5 bg-[#E4E2DD] px-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <AlertTriangle className="w-7 h-7 text-[#45846D]" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-[#1D1D1B]">糟糕，出了點狀況</h1>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                            這個頁面暫時無法顯示。<br />重新整理通常就能恢復。
                        </p>
                    </div>
                    <button
                        onClick={this.handleReload}
                        className="px-6 py-3 rounded-xl bg-[#45846D] text-white font-bold text-sm shadow-sm active:scale-95 transition-transform"
                    >
                        重新整理
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
