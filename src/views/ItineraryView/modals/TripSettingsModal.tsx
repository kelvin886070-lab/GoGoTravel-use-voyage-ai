import React, { useState, useRef, useMemo } from 'react';
import { 
    X, Camera, Calendar, MapPin, 
    Bell, Trash2, Plus, Minus, 
    Check, Users, Crop, MoveVertical,Save
} from 'lucide-react';
import type { Trip, Member, User } from '../../../types';

interface TripSettingsModalProps {
    trip: Trip;
    user: User;
    onClose: () => void;
    onUpdate: (updatedTrip: Trip) => void;
    onDelete: () => void;
}

export const TripSettingsModal: React.FC<TripSettingsModalProps> = ({ trip, user, onClose, onUpdate, onDelete }) => {
    // --- Data States ---
    const [destination, setDestination] = useState(trip.destination);
    const [startDate, setStartDate] = useState(trip.startDate);
    const [endDate, setEndDate] = useState(trip.endDate);
    const [coverImage, setCoverImage] = useState(trip.coverImage);
    const [imagePositionY, setImagePositionY] = useState(50); 
    
    // UI States
    const [isRepositioning, setIsRepositioning] = useState(false);
    
    // Members Logic
    const [members, setMembers] = useState<Member[]>(trip.members || []);
    const [newMemberName, setNewMemberName] = useState('');
    const [isAddingMember, setIsAddingMember] = useState(false);

    // Other Settings
    const [reminderEnabled, setReminderEnabled] = useState(true);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const startDateRef = useRef<HTMLInputElement>(null); // [新增]
    const endDateRef = useRef<HTMLInputElement>(null);
    const isDraggingRef = useRef(false);
    const startYRef = useRef(0);

    // --- Logic: Duration Calculation ---
    const durationDays = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        if (diffTime < 0) return 1;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate]);

    // --- Helper: Date Formatter ---
    const getDateParts = (dateStr: string) => {
        if (!dateStr) return { y: '----', md: '--.--' };
        const [y, m, d] = dateStr.split('-');
        return { y, md: `${m}.${d}` };
    };

    const startParts = getDateParts(startDate);
    const endParts = getDateParts(endDate);

    // --- Handlers: Image ---
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverImage(reader.result as string);
                setIsRepositioning(true);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Handlers: Drag ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isRepositioning) return;
        isDraggingRef.current = true;
        startYRef.current = e.clientY;
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !isRepositioning) return;
        e.preventDefault(); 
        const delta = e.clientY - startYRef.current;
        const sensitivity = 0.3;
        setImagePositionY(prev => Math.min(100, Math.max(0, prev - delta * sensitivity)));
        startYRef.current = e.clientY; 
    };

    const handleMouseUp = () => { isDraggingRef.current = false; };

    // --- Handlers: Members ---
    const handleAddMember = () => {
        if (!newMemberName.trim()) return;
        const newMember: Member = {
            id: Date.now().toString(),
            name: newMemberName,
            avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${newMemberName}`,
            isHost: false
        };
        setMembers([...members, newMember]);
        setNewMemberName('');
        setIsAddingMember(false);
    };

    // --- Handlers: Save ---
    const handleSave = () => {
        let newDays = [...trip.days];
        const currentCount = newDays.length;
        if (durationDays > currentCount) {
            for (let i = currentCount + 1; i <= durationDays; i++) newDays.push({ day: i, activities: [] });
        } else if (durationDays < currentCount) {
            newDays = newDays.slice(0, durationDays);
        }

        const updatedTrip: Trip = {
            ...trip,
            destination,
            startDate,
            endDate,
            coverImage,
            days: newDays,
            members,
        };
        
        onUpdate(updatedTrip);
        onClose(); 
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/60 backdrop-blur-md transition-opacity" onClick={onClose} />
            
            <div className="bg-[#F2F2F2] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 pt-5 pb-3 flex justify-between items-center bg-[#F2F2F2] shrink-0">
                    <h2 className="text-xl font-black text-[#1D1D1B] font-serif tracking-wide">行程儀表板</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
                    
                    {/* === BLOCK A: Cover Identity === */}
                    <div className="w-full h-52 bg-white rounded-[24px] overflow-hidden relative group shadow-sm border border-white select-none">
                        <div 
                            className={`absolute inset-0 ${isRepositioning ? 'cursor-ns-resize active:cursor-grabbing' : ''}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <img 
                                src={coverImage} 
                                alt="Cover" 
                                className={`w-full h-full object-cover pointer-events-none transition-transform duration-500 ${isRepositioning ? 'scale-110 blur-[1px]' : 'scale-100'}`}
                                style={{ objectPosition: `center ${imagePositionY}%` }} 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                            {isRepositioning && (
                                <div className="absolute inset-0 border-2 border-white/30 pointer-events-none animate-in fade-in">
                                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 font-bold text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-2">
                                        <MoveVertical className="w-3 h-3" /> 上下拖曳調整
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isRepositioning && (
                            <div className="absolute bottom-5 left-5 right-5 text-white z-10 pointer-events-none animate-in fade-in">
                                <div className="pointer-events-auto">
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">
                                        <MapPin className="w-3 h-3" /> Destination
                                    </label>
                                    <input 
                                        type="text" 
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        className="w-full bg-transparent text-4xl font-black font-serif outline-none placeholder-white/30 text-white drop-shadow-md border-b border-transparent focus:border-white/50 transition-colors py-1"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                            {isRepositioning ? (
                                <button onClick={() => setIsRepositioning(false)} className="px-3 py-1.5 bg-[#45846D] text-white text-xs font-bold rounded-full shadow-lg hover:bg-[#3A705C] transition-colors flex items-center gap-1"><Check className="w-3 h-3" /> 完成</button>
                            ) : (
                                <>
                                    <button onClick={() => setIsRepositioning(true)} className="w-8 h-8 bg-black/30 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20 hover:bg-black/50 transition-colors"><Crop className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 bg-black/30 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20 hover:bg-black/50 transition-colors"><Camera className="w-3.5 h-3.5" /></button>
                                </>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>

                    {/* === BLOCK B: Date Ticket (Clean Text Only) === */}
                    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-white relative overflow-hidden">
                        {/* Decorative Notches */}
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#F2F2F2] rounded-full" />
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#F2F2F2] rounded-full" />
                        
                        {/* Header Label */}
                        <div className="flex justify-between items-center mb-4 px-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" /> Date Period
                            </label>
                            <span className="text-[10px] font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-md">
                                {durationDays} DAYS
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 px-1">
                            
                            {/* --- DEPART ZONE (Left) --- */}
                            <div 
                                className="flex-1 cursor-pointer group flex flex-col items-start"
                                onClick={() => startDateRef.current?.showPicker()}
                            >
                                <span className="text-[9px] font-bold text-gray-400 mb-1 block tracking-wider uppercase">DEPART</span>
                                {/* Date Text Only (Icon Removed) */}
                                <div className="flex flex-col items-start w-full">
                                    <span className="block text-2xl font-bold text-[#1D1D1B] tracking-tight leading-none font-mono group-hover:text-[#45846D] transition-colors">
                                        {startParts.md}
                                    </span>
                                    <span className="block text-[10px] font-bold text-gray-400 mt-0.5 font-mono">
                                        {startParts.y}
                                    </span>
                                </div>
                                {/* Hidden Input (Force Triggered) */}
                                <input 
                                    ref={startDateRef}
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => { 
                                        setStartDate(e.target.value); 
                                        if(e.target.value > endDate) setEndDate(e.target.value); 
                                    }} 
                                    className="hidden" 
                                />
                            </div>

                            {/* Divider (Simple Dashed Line) */}
                            <div className="w-px h-10 bg-gray-100 border-r border-dashed border-gray-300 mx-2" />

                            {/* --- RETURN ZONE (Right) --- */}
                            <div 
                                className="flex-1 cursor-pointer group flex flex-col items-end"
                                onClick={() => endDateRef.current?.showPicker()}
                            >
                                <span className="text-[9px] font-bold text-gray-400 mb-1 block tracking-wider uppercase">RETURN</span>
                                {/* Date Text Only (Icon Removed) */}
                                <div className="flex flex-col items-end w-full">
                                    <span className="block text-2xl font-bold text-[#1D1D1B] tracking-tight leading-none font-mono group-hover:text-[#45846D] transition-colors">
                                        {endParts.md}
                                    </span>
                                    <span className="block text-[10px] font-bold text-gray-400 mt-0.5 font-mono">
                                        {endParts.y}
                                    </span>
                                </div>
                                {/* Hidden Input */}
                                <input 
                                    ref={endDateRef}
                                    type="date" 
                                    value={endDate} 
                                    min={startDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    className="hidden"
                                />
                            </div>

                        </div>
                    </div>
                    {/* === BLOCK C: Travelers (White Card) === */}
                    <div className="bg-white rounded-[24px] p-3 shadow-sm border border-white">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Users className="w-3 h-3" /> The Squad
                            </label>
                            <span className="text-[10px] font-bold text-gray-300">{members.length} People</span>
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
                            <button 
                                onClick={() => setIsAddingMember(true)}
                                className="w-10 h-10 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-[#45846D] hover:text-[#45846D] hover:bg-[#45846D]/5 transition-all shrink-0 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {members.map(member => {
                                const isMe = (member.id === user.id) || (member.isHost) || (member.name === user.name);
                                const displayAvatar = isMe ? user.avatar : member.avatar;
                                return (
                                    <div key={member.id} className="relative shrink-0">
                                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-100 relative">
                                            <img src={displayAvatar} alt={member.name} className="w-full h-full object-cover" />
                                            {member.isHost && <div className="absolute inset-0 border-2 border-[#45846D] rounded-full" />}
                                        </div>
                                        {!member.isHost && (
                                            <button 
                                                onClick={() => setMembers(members.filter(m => m.id !== member.id))}
                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border border-white active:scale-90 transition-transform z-10"
                                            >
                                                <Minus className="w-2.5 h-2.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {isAddingMember && (
                            <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <input 
                                    autoFocus
                                    className="flex-1 bg-transparent text-xs font-bold px-3 py-1.5 outline-none text-[#1D1D1B] placeholder-gray-400"
                                    placeholder="名字..."
                                    value={newMemberName}
                                    onChange={e => setNewMemberName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                                />
                                <button onClick={handleAddMember} className="p-1.5 bg-[#1D1D1B] text-white rounded-lg hover:bg-black active:scale-95 transition-transform shadow-sm">
                                    <Check className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Spacer */}
                    <div className="h-2" />

                   {/* === BLOCK D: Reminder (Transparent Bar) === */}
                    <button 
                        onClick={() => setReminderEnabled(!reminderEnabled)}
                        className="w-full h-16 px-5 rounded-[24px] flex items-center justify-between transition-all hover:bg-gray-50 active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-[#45846D]">
                                <Bell className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1D1D1B]">出發提醒</span>
                        </div>
                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${reminderEnabled ? 'bg-[#45846D]' : 'bg-gray-200'}`}>
                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${reminderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>

                    {/* [修正] 分隔線 (Divider) - 改用 gray-200 加深顏色確保可見 */}
                    <div className="mx-5 my-2 h-px bg-gray-300" />

                    {/* === BLOCK E: Delete (Text Only, No Icon) === */}
                    <button 
                        onClick={() => { if(confirm('確定要刪除此行程嗎？此動作無法復原。')) onDelete(); }}
                        // 修改處：移除了 gap-2，保留 flex justify-center 讓文字置中
                        className="w-full h-12 px-5 rounded-[24px] bg-red-50 text-red-500 text-sm font-bold flex items-center justify-center hover:bg-red-100 active:scale-[0.99] transition-all"
                    >
                        {/* 修改處：已移除 Trash2 icon */}
                        <span>刪除整個行程</span>
                    </button>

                    </div>

                {/* === BLOCK F: Save Bar (Sticky Bottom, Black) === */}
                <div className="p-4 pt-2 bg-[#F2F2F2] sticky bottom-0 z-20 border-t border-gray-200/50 backdrop-blur-sm">
                    <button 
                        onClick={handleSave}
                        className="h-12 w-full rounded-[24px] bg-[#1D1D1B] text-white flex items-center justify-center gap-2 shadow-lg hover:bg-black active:scale-[0.99] transition-transform"
                    >
                        {/* 1. 加入儲存圖示 (大小設為 w-4 h-4) */}
                        <Save className="w-4 h-4" />
                        
                        {/* 2. 修改文字大小 (text-base -> text-sm) */}
                        <span className="text-sm font-bold tracking-wide">儲存設定</span>
                    </button>
                </div>
            </div>
        </div>
    );
};