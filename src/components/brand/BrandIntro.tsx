// src/components/brand/BrandIntro.tsx
// 🎟️ 冷啟動「蓋章」開場動畫：戳章壓下→油墨暈開→字標浮起，約 1.25 秒。
//   紙灰底與 manifest background_color 一致，和 OS 靜態啟動畫面無縫接。
//   只在冷啟動跑一次（sessionStorage 守衛）、可點跳過。跑在「本來就要等資料」的時間上，不硬加延遲。
import React, { useEffect, useState } from 'react';
import { BrandStamp, BrandWordmark } from './BrandLogo';

const BrandIntro: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [leaving, setLeaving] = useState(false);
    const finish = () => { setLeaving(true); window.setTimeout(onDone, 340); };
    useEffect(() => {
        const t = window.setTimeout(finish, 2000);   // 蓋章動畫約 1.4s 完成，再停留約 0.6s 讓品牌印象停一下（總約 2 秒）
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div onClick={finish}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#E4E2DD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, opacity: leaving ? 0 : 1, transition: 'opacity 340ms ease' }}>
            <div style={{ position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="kti-ink" style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: '2px solid #3F6B52' }} />
                <div className="kti-stamp"><BrandStamp size={140} /></div>
            </div>
            <div className="kti-word" style={{ textAlign: 'center' }}>
                <BrandWordmark size={26} />
                <div style={{ fontFamily: "ui-monospace, 'Roboto Mono', monospace", fontSize: 9, letterSpacing: '.22em', color: '#8A8266', marginTop: 6 }}>DESIGN YOUR MEMORIES</div>
            </div>
            <style>{`
                @keyframes kti-stamp{0%{transform:translateY(-26px) scale(1.5);opacity:0}16%{transform:translateY(0) scale(.9);opacity:1}22%{transform:scale(1.04)}30%{transform:scale(1)}100%{transform:translateY(0) scale(1);opacity:1}}
                @keyframes kti-ink{0%,13%{transform:scale(.5);opacity:0}16%{opacity:.4}30%{transform:scale(1.9);opacity:0}100%{opacity:0}}
                @keyframes kti-word{0%,26%{opacity:0;transform:translateY(9px)}46%,100%{opacity:1;transform:translateY(0)}}
                .kti-stamp{animation:kti-stamp 1.4s cubic-bezier(.2,.8,.3,1) forwards}
                .kti-ink{animation:kti-ink 1.4s ease-out forwards}
                .kti-word{animation:kti-word 1.4s ease forwards}
            `}</style>
        </div>
    );
};

// 自帶「只冷啟動一次」守衛：掛在 App 之外當 sibling overlay，不動 App 的 render 分支。
export const BrandIntroGate: React.FC = () => {
    const [show, setShow] = useState(() => {
        try { return !sessionStorage.getItem('kt_intro'); } catch { return true; }
    });
    if (!show) return null;
    return <BrandIntro onDone={() => { try { sessionStorage.setItem('kt_intro', '1'); } catch { /* ignore */ } setShow(false); }} />;
};
