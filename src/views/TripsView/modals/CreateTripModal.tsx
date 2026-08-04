import React, { useState, useMemo, useRef } from 'react';
import { 
    X, ChevronLeft, Train, Bus, Car,
    User as UserIcon, Heart, Baby, Users, Armchair, Briefcase, GraduationCap, Dog,
    Coffee, Footprints, Zap, Book, MapPin, Scale, Landmark, Mountain, 
    Coins, ChevronDown, Sparkles, PlaneTakeoff, PlaneLanding, ArrowLeftRight,
    Plus, Globe, Map,
    Sunrise, Sun, Moon, Home, Download
} from 'lucide-react';
import { IOSButton } from '../../../components/UI';
import { generateItinerary } from '../../../services/gemini';
import { recalculateTimeline } from '../../../services/timeline';
import { ensureTripGeocoded } from '../../../services/geo';
import type { Trip, TripDay, TripConstraints } from '../../../types';
import { INTEREST_DATA, CURRENCIES } from '../shared';
import { toast } from '../../../components/Toast';

// ============================================================================
// 動態主題設定 (Chameleon Theme Mechanism)
// ============================================================================
const themes = {
    international: {
        hex: '#C2A878', 
        bg: 'bg-[#C2A878]',
        text: 'text-[#C2A878]',
        border: 'border-[#C2A878]',
        lightBg: 'bg-[#C2A878]/10',
        lightBorder: 'border-[#C2A878]/20',
        focusWithinBorder: 'focus-within:border-[#C2A878]',
        focusRing: 'focus:ring-[#C2A878]/30', 
        hoverText: 'hover:text-[#C2A878]',
        hoverBorder: 'hover:border-[#C2A878]',
        ring: 'ring-[#C2A878]',
        ghostButton: 'border-[#C2A878] text-[#C2A878] hover:bg-[#C2A878] hover:text-white bg-white/80 backdrop-blur-sm',
        ghostSubtitle: 'text-gray-400 group-hover:text-white/90',
        cityPill: 'bg-white border-gray-200 text-gray-600 hover:border-[#C2A878] hover:text-[#C2A878] hover:bg-[#C2A878]/5'
    },
    domestic: {
        hex: '#D97757', 
        bg: 'bg-[#D97757]',
        text: 'text-[#D97757]',
        border: 'border-[#D97757]',
        lightBg: 'bg-[#D97757]/10',
        lightBorder: 'border-[#D97757]/20',
        focusWithinBorder: 'focus-within:border-[#D97757]',
        focusRing: 'focus:ring-[#D97757]/30', 
        hoverText: 'hover:text-[#D97757]',
        hoverBorder: 'hover:border-[#D97757]',
        ring: 'ring-[#D97757]',
        ghostButton: 'border-[#D97757] text-[#D97757] hover:bg-[#D97757] hover:text-white bg-white/80 backdrop-blur-sm',
        ghostSubtitle: 'text-gray-400 group-hover:text-white/90',
        cityPill: 'bg-white border-gray-200 text-gray-600 hover:border-[#D97757] hover:text-[#D97757] hover:bg-[#D97757]/5'
    }
};

// ============================================================================
// 出發地預設選單資料 (Origin Options)
// ============================================================================
const ORIGIN_OPTIONS = {
    international: [
        { code: 'TPE', label: '桃園機場', icon: '✈️' },
        { code: 'TSA', label: '松山機場', icon: '✈️' },
        { code: 'KHH', label: '高雄小港', icon: '✈️' },
        { code: 'RMQ', label: '台中清泉崗', icon: '✈️' },
    ],
    domestic: [
        { code: '台北', label: '北部出發', icon: '🚄' },
        { code: '台中', label: '中部出發', icon: '🚄' },
        { code: '高雄', label: '南部出發', icon: '🚄' },
        { code: '花蓮', label: '東部出發', icon: '🚄' },
    ]
};

// 🎫 生成表單重設計（過渡期）：入口頁（views/create/EntryPage）已取代舊步驟①雙門與②目的地，
//   以 initial* props 接手——舊步驟③交通起繼續走，後續頁面逐批換新。
export const CreateTripModal: React.FC<{
    onClose: () => void;
    onAddTrip: (t: Trip) => void;
    onImport?: () => void;
    initialDestinations?: string[];
    initialIsDomestic?: boolean;
    initialStep?: number;
}> = ({ onClose, onAddTrip, onImport, initialDestinations, initialIsDomestic, initialStep }) => {
    const [step, setStep] = useState(initialStep ?? 1);
    const [loading, setLoading] = useState(false);
    
    // --- Step 1 Data ---
    const IMG_INTL = "https://images.unsplash.com/photo-1551120599-440aefce5263?q=80&w=987&auto=format&fit=crop";
    const IMG_DOMESTIC = "https://images.unsplash.com/photo-1708436746451-1444945ff61c?q=80&w=1974&auto=format&fit=crop";

    // --- Step 2 Data ---
    const [tripType, setTripType] = useState<'international' | 'domestic'>(initialIsDomestic ? 'domestic' : 'international');
    const [destinations, setDestinations] = useState<string[]>(initialDestinations ?? []); 
    const [destinationInput, setDestinationInput] = useState(''); 
    const destinationInputRef = useRef<HTMLInputElement>(null);
    const [bgImage, setBgImage] = useState(IMG_INTL); 

    const [origin, setOrigin] = useState(initialIsDomestic ? '台北' : 'TPE');
    const [isEditingOrigin, setIsEditingOrigin] = useState(false);
    const [showOriginMenu, setShowOriginMenu] = useState(false);
    
    const theme = themes[tripType];

    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
    });

    const durationDays = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    }, [startDate, endDate]);

    const handleStartDateChange = (val: string) => {
        setStartDate(val);
        if (val > endDate) setEndDate(val);
    };

    const handleDateInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        if ('showPicker' in HTMLInputElement.prototype) {
            try { input.showPicker(); } catch (err) { /* Fallback */ }
        }
    };

    const addDestination = (val: string = destinationInput) => {
        const cleanVal = val.trim();
        if (cleanVal && !destinations.includes(cleanVal)) {
            setDestinations([...destinations, cleanVal]);
            setDestinationInput('');
            destinationInputRef.current?.focus();
        }
    };

    const handleDestinationKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); addDestination(); }
    };

    const removeDestination = (tag: string) => {
        setDestinations(destinations.filter(d => d !== tag));
    };

    // ============================================================================
    // ✨ 靈感雙層架構邏輯 + Fisher-Yates 隨機洗牌
    // ============================================================================

    // （靈感辭典已刪：見 shared.ts 註記——順遊/標籤由目的地感知 LLM 快取承接，屬生成表單重設計批）

    // --- Step 3 Data ---
    const [arrivalTime, setArrivalTime] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
    const [departureTime, setDepartureTime] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
    const [showTransportDetails, setShowTransportDetails] = useState(false);
    const [transportMode, setTransportMode] = useState<'flight' | 'train' | 'time'>('flight');
    const [localTransportMode, setLocalTransportMode] = useState<'public' | 'car' | 'taxi'>('public');
    const [flightIn, setFlightIn] = useState('');
    const [flightOut, setFlightOut] = useState('');

    // --- Step 4 & 5 Data ---
    const [companion, setCompanion] = useState('couple');
    const [pace, setPace] = useState('standard');
    const [vibe, setVibe] = useState('balanced');
    const [budgetLevel, setBudgetLevel] = useState('standard');
    const [customBudget, setCustomBudget] = useState('');
    const [currency, setCurrency] = useState('TWD');
    
    const [activeInterestTab, setActiveInterestTab] = useState<keyof typeof INTEREST_DATA>('shopping');
    const [interestDetails, setInterestDetails] = useState<Record<string, string>>({});
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [specificRequests, setSpecificRequests] = useState('');
    const [coverImage] = useState('');   // lint 清理：setter 從未呼叫（封面 B 已改背景補圖）

    const toggleInterest = (tag: string) => { 
        if (selectedInterests.includes(tag)) { 
            setSelectedInterests(prev => prev.filter(i => i !== tag));
            const newDetails = { ...interestDetails };
            delete newDetails[tag];
            setInterestDetails(newDetails);
        } else { 
            setSelectedInterests(prev => [...prev, tag]);
        } 
    };

    const handleInterestDetailChange = (tag: string, value: string) => {
        setInterestDetails(prev => ({ ...prev, [tag]: value }));
    };

    // 🧬 Phase 1：表單狀態 → 結構化 TripConstraints（不再壓 prose；prose 由生成層現拼）。
    //    最小版 legs：每個目的地暫掛整趟（startDay=1..durationDays），Phase 3 表單重設計再做 per-leg 日期歸屬。
    //    抵達/離開為 hint（時段）；手打航班/車次無真實時間，折進 specificRequests 供 LLM 參考，不當 confirmed。
    const buildConstraints = (): TripConstraints => {
        const transportNote = [
            flightIn ? `去程${tripType === 'international' ? '航班' : '車次'} ${flightIn}` : '',
            flightOut ? `回程${tripType === 'international' ? '航班' : '車次'} ${flightOut}` : '',
        ].filter(Boolean).join('、');
        const mergedRequests = [specificRequests.trim(), transportNote].filter(Boolean).join('；');

        return {
            tripType,
            origin,
            currency,
            legs: destinations.map(city => ({ city, startDay: 1, endDay: durationDays })),
            hard: {
                arrival: { confidence: 'hint', value: arrivalTime },
                departure: { confidence: 'hint', value: departureTime },
            },
            soft: {
                companion,
                pace: pace as TripConstraints['soft']['pace'],
                vibe,
                budgetLevel,
                customBudget: customBudget || undefined,
                interests: selectedInterests.map(tag => ({ tag, detail: interestDetails[tag] || undefined })),
                specificRequests: mergedRequests || undefined,
                localTransportMode,
            },
        };
    };

    const handleCreate = async () => {
        const tripDays = durationDays;
        if (!tripDays || tripDays <= 0) { toast("請確認日期範圍"); return; }
        if (destinations.length === 0) { toast("請至少輸入一個目的地"); return; }

        setLoading(true);
        try {
            const constraints = buildConstraints();
            const finalDestination = destinations.join(' + ');
            const generatedDays = await generateItinerary(constraints, tripDays);
            if (generatedDays.length > 0 && generatedDays[0].activities.length > 0) {
                generatedDays[0] = recalculateTimeline(generatedDays[0]);
            }
            const processGeneratedItinerary = (days: TripDay[]): TripDay[] => { return days.map(day => recalculateTimeline(day)); };
            const daysWithTime = processGeneratedItinerary(generatedDays);
            
            const newTrip: Trip = {
                id: Date.now().toString(), destination: finalDestination, origin: origin, transportMode: transportMode, localTransportMode, startDate: startDate, endDate: endDate,
                coverImage: coverImage || '', days: daysWithTime, isDeleted: false, currency: currency, pace: pace as Trip['pace'],
                constraints: constraints,   // 🧬 Phase 1：常駐約束存進 trip，Phase 3 規劃臉可重開重編、Phase 4 重生成共讀
            };
            // 🗺️ G4（策略 a）：生成後批次 geocode，讓順路/地圖對生成行程立刻生效。best-effort，失敗不擋建立。
            let finalTrip = newTrip;
            try { finalTrip = (await ensureTripGeocoded(newTrip)).trip; } catch { /* 失敗不擋；開地圖/行程時會補 */ }
            onAddTrip(finalTrip); onClose();
        } catch (e) { toast("無法生成行程，請檢查網路或稍後再試。"); } finally { setLoading(false); }
    };

    const handleManualCreate = () => {
        const tripDays = durationDays;
        if (!tripDays || tripDays <= 0) { toast("請確認日期範圍"); return; }
        const finalDestination = destinations.length > 0 ? destinations.join(' + ') : '未命名行程';
        const emptyDays: TripDay[] = Array.from({length: tripDays}, (_, i) => ({ day: i + 1, activities: [] }));
        const newTrip: Trip = {
            id: Date.now().toString(), destination: finalDestination, origin, startDate: startDate, endDate: endDate, coverImage: coverImage || '', days: emptyDays, isDeleted: false, currency: currency, transportMode: transportMode, pace: pace as Trip['pace']
        };
        onAddTrip(newTrip); onClose();
    };

    const TimeButton = ({ type, label, icon, state, setState }: { type: 'morning'|'afternoon'|'evening', label: string, icon: React.ReactNode, state: string, setState: (v: 'morning' | 'afternoon' | 'evening') => void }) => {
        const isSelected = state === type;
        return (
            <button
                onClick={() => setState(type)}
                className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border transition-all duration-300 w-full ${
                    isSelected ? `${theme.bg} text-white ${theme.border} shadow-md scale-[1.02]` : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
                <div className={`mb-1 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                    {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number; className?: string }>, { size: 18, strokeWidth: 2.5 })}
                </div>
                <span className="text-xs font-bold">{label}</span>
            </button>
        );
    };

    const MobilityCard = ({ id, label, sub, icon }: { id: string, label: string, sub: string, icon: React.ReactNode }) => {
        const isSelected = localTransportMode === id;
        return (
            <button
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- id 為卡片字面量聯集，五步表單升級批一併正型
                onClick={() => setLocalTransportMode(id as any)}
                className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 w-full ${
                    isSelected ? `${theme.lightBg} ${theme.border} shadow-sm ring-1 ring-inset ${theme.ring}` : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
                <div className={`p-3 rounded-full transition-colors ${isSelected ? `${theme.bg} text-white shadow-md` : 'bg-gray-100 text-gray-400'}`}>
                    {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number; className?: string }>, { size: 20 })}
                </div>
                <div className="flex-1">
                    <h4 className={`text-sm font-bold transition-colors ${isSelected ? theme.text : 'text-[#1D1D1B]'}`}>{label}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>
                </div>
            </button>
        );
    };

    const ThemedOptionCard = ({ id: _id, selected, onClick, icon, label, sub }: { id: string, selected: boolean, onClick: () => void, icon: React.ReactNode, label: string, sub?: string }) => (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 w-full ${
                selected 
                ? `${theme.bg} text-white ${theme.border} shadow-md scale-105` 
                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <div className={`mb-1 ${selected ? 'text-white' : 'text-gray-400'}`}>
                {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number; className?: string }>, { size: 20 })}
            </div>
            <span className="text-xs font-bold">{label}</span>
            {sub && <span className="text-[10px] opacity-80">{sub}</span>}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {step === 1 && (<div className="absolute inset-0 bg-[#1D1D1B]/80 backdrop-blur-md transition-all duration-500 animate-in fade-in" onClick={onClose} />)}
            {step > 1 && (
                <div className="absolute inset-0 bg-[#1D1D1B] transition-all duration-1000 animate-in fade-in">
                    <img src={bgImage} className="w-full h-full object-cover opacity-60 blur-sm scale-105" alt="Background" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
                </div>
            )}
            
            {step === 1 && (
                <div className="bg-[#1D1D1B] w-full max-w-sm h-[85vh] rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col animate-in zoom-in-95 duration-500 border border-white/10">
                    <div className="absolute top-6 left-0 right-0 z-50 flex justify-end px-6">
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors"><X className="w-5 h-5" /></button>
                    </div>

                    <div onClick={() => { 
                        setTripType('international'); setTransportMode('flight'); 
                        setOrigin('TPE'); 
                        setStep(2); setBgImage(IMG_INTL); 
                    }} className="flex-1 relative group cursor-pointer overflow-hidden border-b border-white/10">
                        <img src={IMG_INTL} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100" alt="International" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                        <div className="absolute bottom-8 left-8 right-8 transition-all duration-500 group-hover:translate-y-[-5px]">
                            <span className={`inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-widest ${themes.international.text} bg-white rounded-full uppercase shadow-lg`}>International</span>
                            <h2 className="text-4xl font-serif font-bold text-white mb-1 tracking-wide leading-tight">THE WORLD</h2>
                            <p className="text-sm text-gray-300 font-medium tracking-wider mb-3">探索異國．跨越邊界</p>
                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity"><Globe className="w-3.5 h-3.5 text-white/70" /><span className="text-xs text-white/90 font-light border-l border-white/30 pl-2">跨國界多點串接</span></div>
                        </div>
                    </div>

                    <div onClick={() => { 
                        setTripType('domestic'); setTransportMode('train'); 
                        setOrigin('台北'); 
                        setStep(2); setBgImage(IMG_DOMESTIC); 
                    }} className="flex-1 relative group cursor-pointer overflow-hidden">
                        <img src={IMG_DOMESTIC} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100" alt="Domestic" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                        <div className="absolute top-8 left-8 right-8 transition-all duration-500 group-hover:translate-y-[5px]">
                            <span className={`inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-widest text-white ${themes.domestic.bg} rounded-full uppercase shadow-lg`}>Domestic</span>
                            <h2 className="text-4xl font-serif font-bold text-white mb-1 tracking-wide leading-tight">LOCAL GEMS</h2>
                            <p className="text-sm text-gray-300 font-medium tracking-wider mb-3">在地漫遊．深度發掘</p>
                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity"><Map className="w-3.5 h-3.5 text-white/70" /><span className="text-xs text-white/90 font-light border-l border-white/30 pl-2">私房景點與最佳路徑</span></div>
                        </div>
                    </div>
                </div>
            )}

            {step > 1 && (
                <div className="bg-white/90 backdrop-blur-xl w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-300">
                    <div className="pt-6 px-6 pb-2 border-b border-gray-100/50 bg-white/50 sticky top-0 z-20 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => setStep(s => s - 1)} className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-500 hover:bg-white transition-colors shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                            <h2 className="font-bold text-lg text-[#1D1D1B]">
                                {step === 2 && (tripType === 'international' ? '準備起飛' : '探索在地')}
                                {step === 3 && '交通安排'}
                                {step === 4 && '風格與預算'}
                                {step === 5 && '興趣深度'}
                                {step === 6 && '確認您的行程'}
                            </h2>
                            <div className="w-8"></div>
                        </div>
                        <div className="flex gap-2 mb-2">
                            {[1, 2, 3, 4, 5, 6].map(i => (<div key={i} className={`h-1 rounded-full flex-1 transition-colors duration-500 ${i <= step ? theme.bg : 'bg-gray-200/50'}`} />))}
                        </div>
                    </div>

                    {/* 🔒 關鍵修復 1：主容器加上 overflow-x-hidden，鎖定整個畫面的 X 軸 */}
                    <div className="p-6 overflow-y-auto overflow-x-hidden min-h-0 flex-1 scroll-smooth w-full">
                        
                        {step === 2 && (
                            <div className="flex flex-col h-full justify-center animate-in slide-in-from-right-4 duration-300 pb-12 pt-4 w-full">
                                <div className="flex flex-wrap gap-2 justify-center min-h-[40px] max-h-[100px] overflow-y-auto no-scrollbar mb-8">
                                    {destinations.length > 0 ? (
                                        destinations.map(tag => (
                                            <span key={tag} className={`${theme.bg} text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 animate-in zoom-in duration-200 shadow-md`}>
                                                {tag}
                                                <button onClick={() => removeDestination(tag)} className="hover:text-white/70 bg-black/10 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-400 font-medium opacity-50 italic mt-2">尚未選擇地點...</span>
                                    )}
                                </div>

                                <div className="space-y-4 text-center">
                                    <h3 className="text-3xl font-black text-[#1D1D1B] font-serif leading-tight">
                                        {tripType === 'international' ? "啟程，飛往異國" : "漫步，發掘在地"}
                                    </h3>
                                    <div className="relative max-w-[280px] mx-auto group">
                                        <div className={`relative flex items-end gap-2 border-b-2 border-gray-200 ${theme.focusWithinBorder} transition-colors duration-300 pb-1`}>
                                            <input 
                                                ref={destinationInputRef}
                                                type="text" 
                                                className="flex-1 bg-transparent text-2xl font-bold text-[#1D1D1B] text-center outline-none py-2 placeholder:text-base placeholder:font-light placeholder:text-gray-300"
                                                placeholder={tripType === 'international' ? "搜尋國家或城市..." : "搜尋景點或城市..."}
                                                value={destinationInput}
                                                onChange={e => setDestinationInput(e.target.value)}
                                                onKeyDown={handleDestinationKeyDown}
                                                autoFocus
                                            />
                                            <button onClick={() => addDestination()} disabled={!destinationInput.trim()} className={`mb-1 p-2 rounded-full transition-all duration-300 ${destinationInput.trim() ? `${theme.bg} text-white shadow-md scale-100 opacity-100` : 'bg-gray-100 text-gray-300 scale-90 opacity-0 pointer-events-none'}`}><Plus className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">{tripType === 'international' ? "Where to next?" : "Discover Local Gems"}</p>
                                </div>


                                <div className="pt-2 w-full">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center block mb-3">預計停留時間</label>
                                    <div className="bg-white/80 backdrop-blur-sm rounded-full p-1.5 flex items-center justify-between shadow-sm border border-white/50 relative overflow-hidden max-w-[320px] mx-auto">
                                        <div className="relative group px-4 py-2 hover:bg-black/5 rounded-l-full transition-colors cursor-pointer">
                                            <span className="block text-[10px] font-bold text-gray-400 text-center uppercase tracking-wide">DEPART</span>
                                            <div className="text-sm font-black text-[#1D1D1B] font-mono tracking-tight">{startDate.replace(/-/g, '.')}</div>
                                            <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} onClick={handleDateInputClick} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center px-2">
                                            <div className={`text-[10px] font-black ${theme.text} ${theme.lightBg} px-2 py-0.5 rounded-full mb-0.5 whitespace-nowrap`}>{durationDays} Days</div>
                                            <div className="w-full h-px bg-gray-300 relative"><div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-300 rounded-full" /></div>
                                        </div>
                                        <div className="relative group px-4 py-2 hover:bg-black/5 rounded-r-full transition-colors cursor-pointer">
                                            <span className="block text-[10px] font-bold text-gray-400 text-center uppercase tracking-wide">RETURN</span>
                                            <div className="text-sm font-black text-[#1D1D1B] font-mono tracking-tight">{endDate.replace(/-/g, '.')}</div>
                                            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} onClick={handleDateInputClick} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                    </div>

                                    <div className="flex justify-center mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
                                            <span>📍 從</span>
                                            
                                            <div className="relative">
                                                {isEditingOrigin ? (
                                                    <input 
                                                        type="text" 
                                                        className={`bg-white/90 backdrop-blur-md border border-gray-300 outline-none text-[#1D1D1B] w-[80px] text-center uppercase rounded-lg shadow-inner py-1.5 px-2 font-black transition-all ${theme.focusRing}`}
                                                        value={origin}
                                                        onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                                                        onBlur={() => {
                                                            if(!origin) setOrigin(tripType === 'international' ? 'TPE' : '台北');
                                                            setIsEditingOrigin(false);
                                                        }}
                                                        onKeyDown={(e) => { if(e.key === 'Enter') setIsEditingOrigin(false) }}
                                                        placeholder={tripType === 'international' ? 'TPE' : '台北'}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <button 
                                                        onClick={() => setShowOriginMenu(true)}
                                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm text-[#1D1D1B] transition-all hover:border-[${theme.hex}] hover:text-[${theme.hex}] hover:bg-black/5`}
                                                    >
                                                        <span className="font-black uppercase tracking-wider">
                                                            {ORIGIN_OPTIONS[tripType].find(o => o.code === origin)?.icon || (tripType === 'international' ? '✈️' : '🚄')} {origin}
                                                        </span>
                                                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                                                    </button>
                                                )}

                                                {showOriginMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowOriginMenu(false)} />
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-44 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden z-50 animate-in zoom-in-95 duration-200 p-1.5">
                                                            {ORIGIN_OPTIONS[tripType].map(opt => (
                                                                <button
                                                                    key={opt.code}
                                                                    onClick={() => { setOrigin(opt.code); setShowOriginMenu(false); }}
                                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors mb-0.5 last:mb-0 ${origin === opt.code ? `${theme.bg} text-white shadow-sm` : 'text-gray-600 hover:bg-gray-100'}`}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <span>{opt.icon}</span>
                                                                        <span className="uppercase">{opt.code}</span>
                                                                    </span>
                                                                    <span className={`text-[10px] ${origin === opt.code ? 'text-white/80' : 'text-gray-400'}`}>{opt.label}</span>
                                                                </button>
                                                            ))}
                                                            
                                                            <div className="h-px bg-gray-100/80 my-1.5 mx-2" />
                                                            
                                                            <button
                                                                onClick={() => { 
                                                                    setOrigin(''); 
                                                                    setIsEditingOrigin(true); 
                                                                    setShowOriginMenu(false); 
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                                            >
                                                                <span>✍️</span>
                                                                <span>自訂輸入...</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            
                                            <span>出發</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 pb-10 w-full">
                                <div className="space-y-5">
                                    <h3 className="text-xl font-black text-[#1D1D1B] font-serif tracking-wide">規劃您的可用時間</h3>
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider ml-1">
                                            {tripType === 'international' ? <PlaneLanding className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />} 第一天大約何時抵達？
                                        </label>
                                        <div className="grid grid-cols-3 gap-2 w-full">
                                            <TimeButton type="morning" label="早上" icon={<Sunrise />} state={arrivalTime} setState={setArrivalTime} />
                                            <TimeButton type="afternoon" label="下午" icon={<Sun />} state={arrivalTime} setState={setArrivalTime} />
                                            <TimeButton type="evening" label="晚上" icon={<Moon />} state={arrivalTime} setState={setArrivalTime} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider ml-1 mt-6">
                                            {tripType === 'international' ? <PlaneTakeoff className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />} 最後一天何時離開？
                                        </label>
                                        <div className="grid grid-cols-3 gap-2 w-full">
                                            <TimeButton type="morning" label="早上" icon={<Sunrise />} state={departureTime} setState={setDepartureTime} />
                                            <TimeButton type="afternoon" label="下午" icon={<Sun />} state={departureTime} setState={setDepartureTime} />
                                            <TimeButton type="evening" label="晚上" icon={<Moon />} state={departureTime} setState={setDepartureTime} />
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t border-b border-gray-100 py-2">
                                    <button onClick={() => setShowTransportDetails(!showTransportDetails)} className={`w-full flex items-center justify-between text-xs font-bold py-2 ${showTransportDetails ? theme.text : 'text-gray-400'} transition-colors hover:bg-gray-50 rounded-xl px-2`}>
                                        <span className="flex items-center gap-2"><Plus className={`w-4 h-4 ${showTransportDetails ? 'rotate-45' : ''} transition-transform duration-300`} />新增確切航班/車次資訊 (選填)</span>
                                    </button>
                                    {showTransportDetails && (
                                        <div className="pt-3 pb-2 space-y-3 animate-in slide-in-from-top-2 duration-300 px-2 w-full">
                                            <div className={`bg-white p-3.5 rounded-xl border border-gray-200 ${theme.focusWithinBorder} ${theme.focusRing} transition-all flex items-center gap-3 shadow-sm`}>
                                                {tripType === 'international' ? <PlaneTakeoff className="w-4 h-4 text-gray-400" /> : <Train className="w-4 h-4 text-gray-400" />}
                                                <input type="text" placeholder={tripType === 'international' ? "去程航班 (例: JX800)" : "去程車次 (例: 112次)"} value={flightIn} onChange={e => setFlightIn(e.target.value)} className="flex-1 bg-transparent text-sm font-bold outline-none uppercase text-[#1D1D1B] w-full" />
                                            </div>
                                            <div className={`bg-white p-3.5 rounded-xl border border-gray-200 ${theme.focusWithinBorder} ${theme.focusRing} transition-all flex items-center gap-3 shadow-sm`}>
                                                {tripType === 'international' ? <PlaneLanding className="w-4 h-4 text-gray-400" /> : <Train className="w-4 h-4 text-gray-400 scale-x-[-1]" />}
                                                <input type="text" placeholder={tripType === 'international' ? "回程航班 (例: JX801)" : "回程車次 (例: 113次)"} value={flightOut} onChange={e => setFlightOut(e.target.value)} className="flex-1 bg-transparent text-sm font-bold outline-none uppercase text-[#1D1D1B] w-full" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4 w-full">
                                    <h3 className="text-xl font-black text-[#1D1D1B] font-serif tracking-wide">在當地，您偏好怎麼移動？</h3>
                                    <div className="flex flex-col gap-3 w-full">
                                        <MobilityCard id="public" label="大眾運輸" sub="地鐵與公車，深入城市脈絡" icon={<Bus />} />
                                        <MobilityCard id="car" label="租車自駕" sub="機動性高，探索郊區秘境" icon={<Car />} />
                                        <MobilityCard id="taxi" label="計程車/包車" sub="點對點接駁，輕鬆不費力" icon={<MapPin />} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 w-full">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">旅伴</label>
                                    <div className="grid grid-cols-4 gap-2 w-full">
                                        <ThemedOptionCard id="solo" selected={companion === 'solo'} onClick={() => setCompanion('solo')} icon={<UserIcon />} label="獨旅" />
                                        <ThemedOptionCard id="couple" selected={companion === 'couple'} onClick={() => setCompanion('couple')} icon={<Heart />} label="情侶" />
                                        <ThemedOptionCard id="family" selected={companion === 'family'} onClick={() => setCompanion('family')} icon={<Baby />} label="親子" />
                                        <ThemedOptionCard id="friends" selected={companion === 'friends'} onClick={() => setCompanion('friends')} icon={<Users />} label="朋友" />
                                        <ThemedOptionCard id="elderly" selected={companion === 'elderly'} onClick={() => setCompanion('elderly')} icon={<Armchair />} label="長輩" />
                                        <ThemedOptionCard id="pet" selected={companion === 'pet'} onClick={() => setCompanion('pet')} icon={<Dog />} label="寵物" />
                                        <ThemedOptionCard id="colleague" selected={companion === 'colleague'} onClick={() => setCompanion('colleague')} icon={<Briefcase />} label="同事" />
                                        <ThemedOptionCard id="classmate" selected={companion === 'classmate'} onClick={() => setCompanion('classmate')} icon={<GraduationCap />} label="同學" />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 my-2" />
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">步調與風格</label>
                                    <div className="grid grid-cols-4 gap-2 w-full">
                                        <ThemedOptionCard id="relaxed" selected={pace === 'relaxed'} onClick={() => setPace('relaxed')} icon={<Coffee />} label="悠閒" />
                                        <ThemedOptionCard id="standard" selected={pace === 'standard'} onClick={() => setPace('standard')} icon={<Footprints />} label="標準" />
                                        <ThemedOptionCard id="packed" selected={pace === 'packed'} onClick={() => setPace('packed')} icon={<Zap />} label="緊湊" />
                                        <ThemedOptionCard id="deep" selected={pace === 'deep'} onClick={() => setPace('deep')} icon={<Book />} label="深度" />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mt-2 w-full">
                                        <ThemedOptionCard id="popular" selected={vibe === 'popular'} onClick={() => setVibe('popular')} icon={<MapPin />} label="經典" sub="地標" />
                                        <ThemedOptionCard id="balanced" selected={vibe === 'balanced'} onClick={() => setVibe('balanced')} icon={<Scale />} label="均衡" sub="在地" />
                                        <ThemedOptionCard id="cultural" selected={vibe === 'cultural'} onClick={() => setVibe('cultural')} icon={<Landmark />} label="人文" sub="歷史" />
                                        <ThemedOptionCard id="hidden" selected={vibe === 'hidden'} onClick={() => setVibe('hidden')} icon={<Mountain />} label="秘境" sub="自然" />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 my-2" />
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase">預算等級</label>
                                    <div className="flex gap-2 mb-3 w-full">
                                        {[{id:'cheap',l:'經濟 $'}, {id:'standard',l:'標準 $$'}, {id:'luxury',l:'豪華 $$$'}].map(opt => (
                                            <button key={opt.id} onClick={() => setBudgetLevel(opt.id)} className={`flex-1 py-3 rounded-2xl font-bold text-sm border transition-all ${budgetLevel === opt.id ? `${theme.bg} text-white ${theme.border} shadow-md` : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>{opt.l}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <div className="relative min-w-fit">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Coins className="h-4 w-4 text-gray-400" /></div>
                                            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`w-full bg-gray-50 border border-transparent rounded-xl py-3 pl-9 pr-8 text-sm outline-none transition-all ${theme.focusRing} ${theme.focusWithinBorder} appearance-none font-bold`}>
                                                {CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} {c.label}</option>))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        <input type="text" placeholder="或輸入具體預算..." className={`w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm outline-none transition-all ${theme.focusRing} ${theme.focusWithinBorder} bg-transparent font-medium`} value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 w-full">
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">您想怎麼玩？(深度興趣)</label>
                                    
                                    {/* 🛹 關鍵修復 3：深度興趣橫軸同樣加上 overscroll-x-contain 與 w-full */}
                                    <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2 no-scrollbar w-full">
                                        {Object.entries(INTEREST_DATA).map(([key, data]) => (
                                            <button key={key} onClick={() => setActiveInterestTab(key as keyof typeof INTEREST_DATA)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border transition-all ${activeInterestTab === key ? `${theme.bg} text-white ${theme.border} shadow-md` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{React.createElement(data.icon, { size: 16 })}{data.label}</button>
                                        ))}
                                    </div>
                                    <div className={`bg-gray-50 rounded-2xl p-4 min-h-[120px] transition-all border border-gray-100 mt-2 w-full`}>
                                        <div className="flex flex-wrap gap-2 animate-in fade-in mb-4">
                                            {INTEREST_DATA[activeInterestTab].tags.map(tag => (
                                                <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${selectedInterests.includes(tag) ? `${theme.bg} text-white ${theme.border} shadow-sm` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{tag}</button>
                                            ))}
                                        </div>
                                        {selectedInterests.length > 0 && (
                                            <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-gray-200 animate-in slide-in-from-top-2 w-full">
                                                <label className="text-[10px] font-bold text-gray-400 block mb-2">指定詳細需求 (選填)</label>
                                                {selectedInterests.map(tag => (
                                                    <div key={tag} className={`flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 focus-within:border-gray-300 transition-colors w-full`}>
                                                        <span className={`text-xs font-bold ${theme.text} px-2 whitespace-nowrap`}>{tag}</span>
                                                        <input 
                                                            type="text" 
                                                            placeholder={`想去的 ${tag} 品牌或地點...`}
                                                            value={interestDetails[tag] || ''}
                                                            onChange={(e) => handleInterestDetailChange(tag, e.target.value)}
                                                            className="flex-1 text-xs bg-transparent outline-none placeholder-gray-300 min-w-0"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase">許願池 / 特殊需求</label>
                                    <textarea className={`w-full bg-gray-50 border border-transparent rounded-2xl p-4 text-sm outline-none transition-all ${theme.focusRing} ${theme.focusWithinBorder} h-24 resize-none font-medium`} placeholder="例如：不想吃生食、一定要去環球影城..." value={specificRequests} onChange={e => setSpecificRequests(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {step === 6 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 w-full">
                                <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative w-full">
                                    <div className={`${theme.bg} transition-colors duration-500 p-5 text-white relative overflow-hidden`}>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div className="flex-1 pr-4">
                                                <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">Boarding Pass</p>
                                                <h3 className="text-2xl font-serif font-bold tracking-wide break-words">{destinations.join(' & ')}</h3>
                                                <p className="text-xs opacity-90 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{origin} 出發</span></p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">Date</p>
                                                <p className="text-xl font-mono font-bold">{startDate}</p>
                                                <p className="text-xs opacity-90 mt-1">{durationDays} Days</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between relative z-10 bg-white/20 p-3 rounded-xl backdrop-blur-sm border border-white/20">
                                            <div className="text-center flex-1">
                                                <p className="text-[10px] opacity-70 mb-0.5">TYPE</p>
                                                <p className="font-mono font-bold text-lg uppercase truncate">{tripType}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5 opacity-80 px-2">
                                                {tripType === 'international' ? <PlaneTakeoff className="w-4 h-4" /> : <Train className="w-4 h-4" />}
                                                <ArrowLeftRight className="w-3 h-3" /> 
                                                {tripType === 'international' ? <PlaneLanding className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                            </div>
                                            <div className="text-center flex-1">
                                                <p className="text-[10px] opacity-70 mb-0.5">MODE</p>
                                                <p className="font-mono font-bold text-lg uppercase truncate">{localTransportMode}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative h-6 bg-white -mt-3">
                                        <div className="absolute -left-3 top-0 w-6 h-6 bg-gray-200 rounded-full" />
                                        <div className="absolute -right-3 top-0 w-6 h-6 bg-gray-200 rounded-full" />
                                        <div className="absolute left-4 right-4 top-1/2 border-t-2 border-dashed border-gray-300" />
                                    </div>
                                    <div className="p-6 pt-2">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Transport</p>
                                                <p className={`font-bold text-[#1D1D1B] flex items-center gap-2 truncate`}>
                                                    {localTransportMode === 'public' ? <Bus className={`w-4 h-4 flex-shrink-0 ${theme.text}`} /> : <Car className={`w-4 h-4 flex-shrink-0 ${theme.text}`} />}
                                                    <span className="capitalize truncate">{localTransportMode}</span>
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Budget</p>
                                                <p className={`font-bold text-[#1D1D1B] flex items-center gap-2 truncate`}>
                                                    <Coins className={`w-4 h-4 flex-shrink-0 ${theme.text}`} />
                                                    <span className="capitalize truncate">{budgetLevel} ({currency})</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full">
                                    <p className="text-xs font-bold text-gray-400 mb-3 uppercase ml-1 tracking-widest">Your Vibe</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 shadow-sm`}>{pace}</span>
                                        <span className={`px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 shadow-sm`}>{vibe}</span>
                                        {selectedInterests.map(tag => {
                                            const detail = interestDetails[tag];
                                            return (
                                                <span key={tag} className={`px-3 py-1.5 ${theme.bg} text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1`}>
                                                    <Sparkles className="w-3 h-3 flex-shrink-0" /> 
                                                    <span className="truncate">{tag} {detail ? `: ${detail}` : ''}</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                {specificRequests && (
                                    <div className="bg-yellow-50/50 rounded-2xl p-5 border border-yellow-100/50 w-full">
                                        <p className="text-[10px] font-bold text-yellow-600 mb-2 uppercase tracking-widest">Notes</p>
                                        <p className="text-sm text-yellow-800 font-serif leading-relaxed italic break-words">"{specificRequests}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100/50 bg-white/80 backdrop-blur-md sticky bottom-0 z-30">
                        {step < 6 ? (
                            <div className="flex flex-col gap-3">
                                <IOSButton 
                                    fullWidth 
                                    onClick={() => { 
                                        if (step===2 && destinations.length === 0) return toast('請至少輸入一個目的地');
                                        if (step===2 && (!durationDays || durationDays <= 0)) return toast('請確認日期範圍');
                                        setStep(s => s + 1); 
                                    }}
                                    className={`${theme.bg} border-none transition-colors duration-500`}
                                    style={{ backgroundColor: theme.hex }}
                                >
                                    下一步
                                </IOSButton>
                                {step === 2 && <button onClick={handleManualCreate} className="text-gray-400 text-xs font-medium py-2 hover:text-gray-600 transition-colors">跳過，自己手動建立空白行程</button>}
                                {/* 🎟️ 暫存入口：從分享連結匯入（原在首頁，移入此處保持首頁乾淨；待五步清單重做時再正式設計） */}
                                {step === 2 && onImport && (
                                    <button onClick={onImport} className="text-gray-400 text-xs font-medium py-1 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5">
                                        <Download className="w-3.5 h-3.5" /> 從分享連結匯入行程
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button onClick={() => setStep(5)} className="flex-1 py-3 text-gray-500 font-bold text-sm bg-white border border-gray-200 rounded-full hover:bg-gray-50">修改</button>
                                <IOSButton 
                                    fullWidth 
                                    onClick={handleCreate} 
                                    isLoading={loading} 
                                    className={`flex-[2] ${theme.bg} border-none transition-colors duration-500`}
                                    style={{ backgroundColor: theme.hex }}
                                >
                                    <Sparkles className="w-4 h-4 mr-1" /> 生成夢幻行程
                                </IOSButton>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};