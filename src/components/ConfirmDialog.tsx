// src/components/ConfirmDialog.tsx
// 🪟 4.3 全域確認對話框：取代原生 confirm()。
//   - imperative API：const ok = await confirmDialog({ title, message, tone })
//   - tone='danger'（破壞性/無法復原，磚紅）｜'default'（可復原，墨黑）
//   - 置中排版、襯線標題（呼應品牌）、幽靈取消鈕
import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

type Tone = 'danger' | 'default';
export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    tone?: Tone;
}

interface DialogState extends ConfirmOptions {
    open: boolean;
    resolve?: (ok: boolean) => void;
}

// 讓任何地方（含非元件）直接呼叫：import { confirmDialog } from '.../ConfirmDialog'
let externalConfirm: ((o: ConfirmOptions) => Promise<boolean>) | null = null;
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
    // 極端情況（Provider 尚未掛載）退回原生 confirm，確保永不卡死
    if (!externalConfirm) return Promise.resolve(window.confirm(options.title));
    return externalConfirm(options);
}

const TONE = {
    danger: { tint: '#F6ECE8', icon: '#C0573E', button: '#C0573E', Icon: AlertTriangle },
    default: { tint: '#EDF2F0', icon: '#45846D', button: '#1D1D1B', Icon: HelpCircle },
} as const;

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<DialogState>({ open: false, title: '' });
    const resolveRef = useRef<((ok: boolean) => void) | null>(null);

    const show = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({ ...options, open: true });
        });
    }, []);

    const close = useCallback((ok: boolean) => {
        resolveRef.current?.(ok);
        resolveRef.current = null;
        setState((s) => ({ ...s, open: false }));
    }, []);

    useEffect(() => {
        externalConfirm = show;
        return () => { externalConfirm = null; };
    }, [show]);

    // Esc 取消
    useEffect(() => {
        if (!state.open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state.open, close]);

    const tone = TONE[state.tone || 'default'];
    const Icon = tone.Icon;

    return (
        <>
            {children}
            {state.open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    <div
                        className="absolute inset-0 bg-[#1D1D1B]/50 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => close(false)}
                    />
                    <div className="relative z-10 w-full max-w-[320px] bg-white rounded-[26px] p-7 text-center shadow-2xl border border-[#1D1D1B]/5 animate-in zoom-in-95 fade-in duration-200">
                        <div
                            className="w-12 h-12 rounded-[15px] flex items-center justify-center mx-auto"
                            style={{ backgroundColor: tone.tint }}
                        >
                            <Icon className="w-[22px] h-[22px]" style={{ color: tone.icon }} />
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#1D1D1B] mt-4 tracking-wide">{state.title}</h3>
                        {state.message && (
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{state.message}</p>
                        )}
                        <div className="flex gap-2.5 mt-6">
                            <button
                                onClick={() => close(false)}
                                className="flex-1 py-3 rounded-[15px] bg-white border border-[#E7E5E1] text-[#57534E] text-[15px] font-bold hover:bg-gray-50 active:scale-[0.98] transition-all"
                            >
                                {state.cancelText || '取消'}
                            </button>
                            <button
                                onClick={() => close(true)}
                                className="flex-1 py-3 rounded-[15px] text-white text-[15px] font-bold active:scale-[0.98] transition-all"
                                style={{ backgroundColor: tone.button }}
                            >
                                {state.confirmText || '確定'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
