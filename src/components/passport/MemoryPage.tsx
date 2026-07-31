// src/components/passport/MemoryPage.tsx
// 🛂 批④＋⑤b：護照內頁——回憶卡＋旅程手記。
//   一年一組內頁、一頁一張卡（照片與旅途中 hero 同高 208，一頁一段回憶——Kelvin 定案）；
//   卡＝封面照＋白色 PASS 章（蓋「回國日」）＋serif 名＋日期區間＋輕統計。點照片→回憶臉。
//   ⑤b 旅程手記：卡下 serif 斜體一段話（空＝淡色邀請句）；點→小視窗編輯（不做頁內輸入，
//   避開鍵盤與翻頁衝突）；存 trip.memoryNote（App 安靜更新路徑，不誤開行程頁）。
//   ⑤c 照片集：卡尾列 播放（有照片）/＋照片（沒照片）；全螢幕 PhotoViewer（滑動/刪除/加照）；
//   相簿上限＝一律 150 張/趟；路徑存 trip.memoryPhotoPaths（私有桶），顯示走 signed URL（載入管線擴充）。
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, Loader2 } from 'lucide-react';
import type { Trip } from '../../types';
import { toast } from '../Toast';
import { uploadTripImage, signPaths, deleteTripImage } from '../../services/storage';
import { PhotoViewer } from './PhotoViewer';

// 相簿上限＝一律 150 張/趟（Kelvin 定案：上限的本質是每趟成本天花板，規則越簡單越好溝通；§3.7）
const photoCap = (): number => 150;

const MUTE = '#8A8266';
const NOTE_MAX = 500;

const PAPER_TEXTURE: React.CSSProperties = {
    background: '#F6F1E7',
    backgroundImage:
        'repeating-radial-gradient(circle at 30% 20%, rgba(63,107,82,.028) 0 2px, transparent 2px 9px),' +
        'repeating-radial-gradient(circle at 75% 80%, rgba(201,185,143,.05) 0 2px, transparent 2px 11px)',
};

// 回國日（endDate）→ 章上的日期
const stampDate = (s?: string): string => (s || '').slice(0, 10).replace(/-/g, '.');
// 日期區間：2026.07.21 – 07.24（同年省略年份）
const rangeLabel = (start?: string, end?: string): string => {
    const a = (start || '').slice(0, 10).replace(/-/g, '.');
    const b = (end || '').slice(0, 10).replace(/-/g, '.');
    if (!a || !b) return a || b;
    return a.slice(0, 5) === b.slice(0, 5) ? `${a} – ${b.slice(5)}` : `${a} – ${b}`;
};
const stopsOf = (t: Trip): number =>
    (t.days || []).reduce((n, d) => n + (d.activities || []).filter(a => (a.type || '').toLowerCase() !== 'transport').length, 0);

// 白色 PASS 章（迷你版：外點線圈＋PASS＋回國日）——蓋在照片右上。
// 🛂 批⑥ ceremony＝壓印動畫：新完成趟第一次翻到（riffle 收尾後才觸發）——章從高處落下壓上（scale 2.1→1
//   彈簧微震＝蓋章的頓感），只演一次（key 換值 remount 才套 initial）；prefers-reduced-motion＝直接定格。
const prefersReducedMotion = (): boolean => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const MiniPass: React.FC<{ date: string; ceremony?: boolean }> = ({ date, ceremony }) => {
    const animated = !!ceremony && !prefersReducedMotion();
    return (
        <motion.div
            key={animated ? 'ceremony' : 'plain'}
            initial={animated ? { scale: 2.1, opacity: 0, rotate: -2 } : false}
            animate={{ scale: 1, opacity: 1, rotate: -10 }}
            transition={animated ? { type: 'spring', stiffness: 340, damping: 21, delay: 0.15 } : { duration: 0 }}
            style={{ position: 'absolute', top: 10, right: 10, width: 62, height: 62, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
        >
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.95)' }}>
                <span className="font-serif" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }}>PASS</span>
                <span className="font-mono" style={{ fontSize: 6, letterSpacing: 0.5 }}>{date.slice(5) || date}</span>
            </div>
        </motion.div>
    );
};

// 手記編輯小視窗（data-no-flip：背景點擊不觸發翻頁）
const NoteEditModal: React.FC<{ initial: string; tripName: string; onSave: (text: string) => void; onClose: () => void }> =
    ({ initial, tripName, onSave, onClose }) => {
        const [text, setText] = useState(initial);
        return (
            <div data-no-flip className="fixed inset-0 z-[120] flex items-center justify-center px-8" style={{ background: 'rgba(35,35,32,0.35)' }} onClick={e => { e.stopPropagation(); onClose(); }}>
                <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
                    <div className="font-serif text-[16px] font-bold text-[#232320]">旅程手記</div>
                    <div className="font-mono text-[9px] tracking-[0.14em] mt-0.5" style={{ color: MUTE }}>{tripName}</div>
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value.slice(0, NOTE_MAX))}
                        placeholder="為這段旅程寫下一句話…"
                        rows={6}
                        autoFocus
                        className="w-full mt-3 rounded-xl p-3 text-[14px] leading-relaxed outline-none font-serif"
                        style={{ background: '#F5F5F4', color: '#232320', resize: 'none' }}
                    />
                    <div className="font-mono text-right text-[10px] mt-1" style={{ color: '#B4B2A9' }}>{text.length}/{NOTE_MAX}</div>
                    <div className="flex gap-3 mt-3">
                        <button onClick={onClose} className="flex-1 h-10 rounded-full text-[13px] font-bold font-serif bg-white" style={{ color: MUTE, border: '1px solid rgba(0,0,0,0.08)' }}>取消</button>
                        <button onClick={() => { onSave(text.trim()); onClose(); }} className="flex-1 h-10 rounded-full bg-[#232320] text-white text-[13px] font-bold font-serif">儲存</button>
                    </div>
                </div>
            </div>
        );
    };

const MemoryCard: React.FC<{
    trip: Trip;
    onOpen: () => void;
    photoCount: number;
    adding: boolean;
    onPlay: () => void;
    onPickFiles: (files: FileList) => void;
    ceremony?: boolean;          // 批⑥：蓋章儀式（壓印動畫一次）
}> = ({ trip, onOpen, photoCount, adding, onPlay, onPickFiles, ceremony }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    return (
        <div className="w-full rounded-[14px] overflow-hidden bg-white" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            {/* 照片＝進回憶臉的入口 */}
            <button onClick={onOpen} className="relative block w-full text-left active:opacity-95" style={{ height: 208 }}>
                {trip.coverImage ? (
                    <img src={trip.coverImage} alt={trip.destination} className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: `center ${trip.coverImagePositionY ?? 50}%` }} />
                ) : (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a4a44,#232320)' }} />
                )}
                <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: 84, background: 'linear-gradient(transparent, rgba(20,22,26,0.78))' }} />
                <MiniPass date={stampDate(trip.endDate)} ceremony={ceremony} />
                <div className="absolute left-3 bottom-2 text-white">
                    <div className="font-serif" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{trip.destination}</div>
                    <div className="font-mono" style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{rangeLabel(trip.startDate, trip.endDate)}</div>
                </div>
            </button>
            {/* 輕統計＋照片控制（⑤c）：有照片＝張數＋播放；沒照片＝虛線「＋照片」邀請 */}
            <div className="px-3 py-2 flex items-center justify-between">
                <span className="font-mono" style={{ fontSize: 10, color: MUTE }}>
                    {(trip.days || []).length} 天 · {stopsOf(trip)} 個地方{photoCount > 0 ? ` · ${photoCount} 張照片` : ''}
                </span>
                {photoCount > 0 ? (
                    <button onClick={onPlay} aria-label="播放照片集"
                        className="w-9 h-9 rounded-full bg-[#232320] text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                        <Play className="w-4 h-4 ml-0.5" />
                    </button>
                ) : (
                    <button onClick={() => fileRef.current?.click()} disabled={adding} aria-label="新增照片"
                        className="h-8 px-3 rounded-full flex items-center gap-1 text-[11px] font-bold disabled:opacity-60 shrink-0"
                        style={{ border: '1.5px dashed #8A8266', color: '#5F5E5A' }}>
                        {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        <span className="font-serif">{adding ? '上傳中' : '照片'}</span>
                    </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) onPickFiles(e.target.files); e.target.value = ''; }} />
            </div>
        </div>
    );
};

// ⑤c：單趟的照片集控制器（上傳/刪除/瀏覽；安靜更新持久化）
const useTripPhotos = (trip: Trip, onUpdateTrip: (t: Trip) => void) => {
    const [adding, setAdding] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const photos = trip.memoryPhotos || [];
    const paths = trip.memoryPhotoPaths || [];

    const addFiles = async (files: FileList) => {
        if (adding) return;
        const cap = photoCap();
        const remain = cap - paths.length;
        if (remain <= 0) { toast(`這段回憶最多 ${cap} 張照片`, 'info'); return; }
        const list = Array.from(files).slice(0, remain);
        if (files.length > remain) toast(`最多 ${cap} 張，已取前 ${remain} 張`, 'info');
        setAdding(true);
        try {
            const newPaths: string[] = [];
            for (const f of list) newPaths.push(await uploadTripImage(f));   // 逐張（壓縮管線；私有桶）
            const map = await signPaths(newPaths);
            const newUrls = newPaths.map(pp => map[pp]).filter((u): u is string => !!u);
            onUpdateTrip({ ...trip, memoryPhotoPaths: [...paths, ...newPaths], memoryPhotos: [...photos, ...newUrls] });
            toast(`已加入 ${list.length} 張照片`, 'success');
        } catch {
            toast('照片上傳失敗，稍後再試', 'error');
        } finally {
            setAdding(false);
        }
    };

    const deletePhoto = (i: number) => {
        const path = paths[i];
        onUpdateTrip({ ...trip, memoryPhotoPaths: paths.filter((_, x) => x !== i), memoryPhotos: photos.filter((_, x) => x !== i) });
        void deleteTripImage(path);   // best-effort：清 Storage（失敗不影響資料一致性）
    };

    return { adding, viewerOpen, setViewerOpen, photos, addFiles, deletePhoto };
};

// 🛂 ⑤b 旅程手記——寫在「護照紙面」上（不在白卡內：卡片像卡片、紀錄像紀錄，Kelvin 定案）。
//   顯示保留換行（pre-wrap）、最多 5 行淡出截斷（500 字紙面不爆版）；點→編輯視窗看/改全文。
const PaperNote: React.FC<{ trip: Trip; onSaveNote: (text: string) => void }> = ({ trip, onSaveNote }) => {
    const [noteOpen, setNoteOpen] = useState(false);
    const note = (trip.memoryNote || '').trim();
    return (
        <>
            <button onClick={() => setNoteOpen(true)} className="w-full text-left px-2 pt-3 active:opacity-70" aria-label="編輯旅程手記">
                <div style={{ marginBottom: 3 }}>
                    <span className="font-serif" style={{ fontSize: 10, color: MUTE }}>旅程手記</span>
                    <span className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: MUTE }}> / NOTE</span>
                </div>
                <div className="font-serif" style={{
                    fontStyle: 'italic', fontSize: 14, lineHeight: 1.7,
                    color: note ? '#3d3a33' : '#A89F8A',
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {note || '為這段旅程寫下一句話…'}
                </div>
            </button>
            {noteOpen && (
                <NoteEditModal
                    initial={note}
                    tripName={trip.destination}
                    onClose={() => setNoteOpen(false)}
                    onSave={(text) => { onSaveNote(text); toast(text ? '手記已寫進護照' : '手記已清除', 'success'); }}
                />
            )}
        </>
    );
};

// 卡＋紙面手記＋照片集 viewer（一趟一組）
const TripMemoryBlock: React.FC<{ trip: Trip; onOpen: () => void; onUpdateTrip: (t: Trip) => void; ceremony?: boolean }> = ({ trip, onOpen, onUpdateTrip, ceremony }) => {
    const { adding, viewerOpen, setViewerOpen, photos, addFiles, deletePhoto } = useTripPhotos(trip, onUpdateTrip);
    return (
        <>
            <MemoryCard trip={trip} onOpen={onOpen}
                photoCount={photos.length} adding={adding} ceremony={ceremony}
                onPlay={() => setViewerOpen(true)} onPickFiles={f => { void addFiles(f); }} />
            <PaperNote trip={trip} onSaveNote={(text) => onUpdateTrip({ ...trip, memoryNote: text || undefined })} />
            {viewerOpen && (
                <PhotoViewer
                    photos={photos}
                    start={0}
                    adding={adding}
                    onClose={() => setViewerOpen(false)}
                    onDelete={deletePhoto}
                    onAddFiles={f => { void addFiles(f); }}
                />
            )}
        </>
    );
};

/** 一頁回憶內頁：年份抬頭＋一張卡＋頁碼。 */
export const MemoryPage: React.FC<{
    year: number;
    trips: Trip[];               // 本頁的趟（一頁一張）
    pageNo: string;              // 內頁編號（01 起；封面/個資頁不編號）
    onOpenTrip: (t: Trip) => void;
    onUpdateTrip: (t: Trip) => void;   // 安靜更新（存手記；不誤開行程頁）
    ceremonyTripId?: string | null;    // 批⑥：此趟＝蓋章儀式目標（riffle 收尾後由 ProfileView 設值）
}> = ({ year, trips, pageNo, onOpenTrip, onUpdateTrip, ceremonyTripId }) => (
    <div className="w-full h-full relative flex flex-col" style={{ ...PAPER_TEXTURE, border: '1px solid #E0D8C6', borderRadius: 16 }}>
        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
            <span className="font-serif" style={{ fontSize: 17, fontWeight: 700, color: '#232320' }}>回憶</span>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', color: MUTE }}>MEMORIES · {year}</span>
        </div>
        <div className="flex-1 min-h-0 px-3 overflow-hidden">
            {trips.map(t => (
                <TripMemoryBlock key={t.id} trip={t} onOpen={() => onOpenTrip(t)} onUpdateTrip={onUpdateTrip} ceremony={t.id === ceremonyTripId} />
            ))}
        </div>
        <span className="font-mono text-center" style={{ fontSize: 10, letterSpacing: '0.3em', color: '#B4B2A9', padding: '8px 0 10px' }}>{pageNo}</span>
    </div>
);
