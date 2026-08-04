// src/views/create/TicketNextButton.tsx
// 🎟️ 生成表單・共用的「下一步」票券鈕（票根轉世：首頁那張票被撕下的票根，一路帶著使用者走完表單）
//
// 設計憲章（docs E3「下一步按鈕統一規格」，Kelvin 選 B・迷你票券）：
//   紙色票身「下一步」＋serif、mono NEXT 小字、齒孔虛線、墨圓鈕箭頭票根。
//   **永不 disabled**：條件不足時按下去給提示，不給灰鈕（`onPress` 回 false ＝ 不撕、不前進）。
//
// 撕票：**時間與首頁 CTA 一致（680ms），差別只在音量**（Kelvin 實測定案——
//   同一個動作用同一個節奏，情感累積靠一致；步間只把音量降到 -6dB，不打斷節奏）。
//
// 撕票鐵則（2026-08-04 追了四輪換來的，勿再違反）：
//   ①**動的只有票根，票身零位移**（連 active:scale 都要在撕票期間停用——那也是一種動）
//   ②撕的瞬間票身與票根各自帶白紙與圓角；靜止時才是一張完整的卡
//     （否則飛走的只是一顆圓鈕、票身也沒撕痕，讀起來像「按鈕掉了」）
//   ③齒孔缺口與虛線留在**票身**上（缺口是撕痕，不跟著票根走）
//   ④要做原地變形動畫就動那個真的元素本身，**不要用座標複製分身**（座標系遲早對不上）
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { playPageSound, hapticTap } from '../../services/sounds';

const TEAR_MS = 680;          // 與首頁 CTA 同節奏
const HANDOFF_MS = 620;       // 票根還在落就交棒，不空等（撕完才換頁會感覺鈍）
const TEAR_VOLUME = 0.5;      // 約 -6dB：步間只降音量，不縮時間

const reduceMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const TicketNextButton: React.FC<{
    /** 票身主標（預設「下一步」；最後一步可換成「生成行程」等） */
    label?: string;
    /** 票身右側 mono 小字（預設 NEXT） */
    hint?: string;
    /**
     * 按下的第一關：回傳 false ＝ **不撕、不前進**（呼叫端自己給 toast／開確認卡）。
     * 不提供時視為永遠通過。
     */
    onPress?: () => boolean;
    /** 撕完（或 reduced-motion 立即）才前進 */
    onNext: () => void;
    className?: string;
}> = ({ label = '下一步', hint = 'NEXT', onPress, onNext, className }) => {
    const [tearing, setTearing] = useState(false);
    const timerRef = useRef<number | null>(null);
    useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

    const handle = useCallback(() => {
        if (tearing) return;                      // 連點防抖：撕到一半不接受第二次
        if (onPress && onPress() === false) return;
        if (reduceMotion()) { onNext(); return; } // 無障礙：不演出，直接前進
        setTearing(true);
        playPageSound('tear', TEAR_VOLUME);
        hapticTap();
        timerRef.current = window.setTimeout(onNext, HANDOFF_MS);
    }, [tearing, onPress, onNext]);

    return (
        <button onClick={handle} aria-label={label}
            className={`w-full flex items-stretch transition-transform ${tearing ? '' : 'active:scale-[0.99]'} ${className || ''}`}>
            {/* 票身：撕票時自帶紙與右緣齒孔虛線（撕痕留在票上），全程零位移 */}
            <span className="flex-1 bg-[#F6F1E7] rounded-l-full pl-5 pr-3 py-2.5 flex items-center justify-between relative"
                style={tearing ? { borderRight: '2px dashed #C9BFA6' } : undefined}>
                <span className="font-serif text-[15px] font-bold text-[#232320]">{label}</span>
                <span className="font-mono text-[8px] tracking-[0.2em] text-[#8A8266]">{hint}</span>
                {/* 齒孔缺口：**靜止時就在**（撕開才長出來會突兀；缺口是票券的天生特徵，不是撕票的效果）。
                    留在票身上——缺口是撕痕，不跟著票根走。 */}
                <span aria-hidden className="absolute -right-[5px] -top-[5px] w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,.28)' }} />
                <span aria-hidden className="absolute -right-[5px] -bottom-[5px] w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,.28)' }} />
            </span>
            {/* 票根：繞左下角由上而下掀起 → 隨重力墜離 */}
            <span className={`bg-[#F6F1E7] rounded-r-full px-3 flex items-center ${tearing ? '' : 'border-l-2 border-dashed border-[#C9BFA6]'}`}
                style={tearing ? {
                    transformOrigin: 'left bottom',
                    animation: `ktStepStub ${TEAR_MS}ms cubic-bezier(.34,.05,.5,1) forwards`,
                    boxShadow: '0 5px 12px rgba(0,0,0,.22)',
                    zIndex: 1,
                } : undefined}>
                <span className="w-7 h-7 rounded-full bg-[#232320] text-[#F6F1E7] flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                </span>
            </span>

            <style>{`
                @keyframes ktStepStub {
                    0%{transform:translate(0,0) rotate(0deg);opacity:1}
                    18%{transform:translate(2px,0) rotate(-2deg)}
                    46%{transform:translate(4px,1px) rotate(7deg)}
                    64%{transform:translate(9px,6px) rotate(11deg);opacity:1}
                    100%{transform:translate(30px,96px) rotate(22deg);opacity:0}
                }
            `}</style>
        </button>
    );
};
