// src/components/Toast.tsx
// 🔔 3.4 全域提示（Toast）：下方置中、由下往上滑入、停 3 秒後淡出。
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Check, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});
export const useToast = () => useContext(ToastContext);

// 讓非元件（或懶得接 hook）的地方也能直接呼叫：import { toast } from '.../Toast'
let externalShow: ((message: string, type: ToastType) => void) | null = null;
export function toast(message: string, type: ToastType = 'error') {
    externalShow?.(message, type);
}

const STYLE: Record<ToastType, { color: string; Icon: typeof Check }> = {
    success: { color: '#45846D', Icon: Check },
    error: { color: '#C0573E', Icon: AlertTriangle },
    info: { color: '#5B7C9B', Icon: Info },
};

const ToastPill: React.FC<{ toast: ToastItem; onDone: (id: number) => void }> = ({ toast, onDone }) => {
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        const t1 = setTimeout(() => setLeaving(true), 3000);   // 停 3 秒
        const t2 = setTimeout(() => onDone(toast.id), 3320);   // 淡出後移除
        return () => { clearTimeout(t1); clearTimeout(t2); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { color, Icon } = STYLE[toast.type];
    return (
        <div
            className={`inline-flex items-center gap-2.5 bg-[#1D1D1B]/65 backdrop-blur-xl border border-white/10 text-white px-4 py-2.5 rounded-full text-sm font-medium shadow-lg max-w-[90vw] ${
                leaving ? 'animate-out fade-out slide-out-to-bottom-2 duration-300' : 'animate-in fade-in slide-in-from-bottom-4 duration-300'
            }`}
        >
            <span className="w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color, width: 18, height: 18 }}>
                <Icon className="w-3 h-3 text-white" />
            </span>
            <span className="truncate">{toast.message}</span>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now() + Math.random();
        // 同一時間只留最新一則：連點時舊的即時消失、新的補位滑入（key 換新 → 重播動畫並重置 3 秒）
        setToasts([{ id, message, type }]);
    }, []);

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // 註冊給 imperative toast() 使用
    useEffect(() => {
        externalShow = showToast;
        return () => { externalShow = null; };
    }, [showToast]);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div
                className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none"
                // 底部導覽列存在時（主分頁），由 App 寫入 --bottom-nav-h 把 Toast 抬到列上方；行程頁無列則為 0
                style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom) + var(--bottom-nav-h, 0px))' }}
            >
                {toasts.map(t => <ToastPill key={t.id} toast={t} onDone={remove} />)}
            </div>
        </ToastContext.Provider>
    );
};
