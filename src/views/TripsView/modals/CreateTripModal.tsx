import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    X, ChevronLeft, Image as ImageIcon, Plane, Train, Clock, Bus, Car, 
    User as UserIcon, Heart, Baby, Users, Armchair, Briefcase, GraduationCap, Dog,
    Coffee, Footprints, Zap, Book, MapPin, Scale, Landmark, Mountain, 
    Coins, ChevronDown, Sparkles, PlaneTakeoff, PlaneLanding, ArrowLeftRight,
    Loader2, Calendar, ArrowRight, History, Plus, Globe, Map, Check
} from 'lucide-react';
import { IOSButton, IOSInput } from '../../../components/UI';
import { generateItinerary, lookupFlightInfo } from '../../../services/gemini';
import { recalculateTimeline } from '../../../services/timeline';
import type { Trip, TripDay } from '../../../types';
import { INTEREST_DATA, CURRENCIES } from '../shared';
import { OptionCard } from '../components/cards/OptionCard';

// ============================================================================
// Main Component: CreateTripModal
// ============================================================================
export const CreateTripModal: React.FC<{ onClose: () => void, onAddTrip: (t: Trip) => void }> = ({ onClose, onAddTrip }) => {
    // 總共 6 步
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // --- Step 1 Data (固定封面圖) ---
    // 1. 出國 (International) - 機翼雲海
    const IMG_INTL = "https://images.unsplash.com/photo-1551120599-440aefce5263?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
    
    // 2. 國內 (Domestic) - 台南廟宇燕尾脊 (Kiki's Photo)
    const IMG_DOMESTIC = "https://images.unsplash.com/photo-1708436746451-1444945ff61c?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

    // --- Step 2 Data (Destination) ---
    const [tripType, setTripType] = useState<'international' | 'domestic'>('international'); 
    const [destinations, setDestinations] = useState<string[]>([]); 
    const [destinationInput, setDestinationInput] = useState(''); 
    const destinationInputRef = useRef<HTMLInputElement>(null);
    
    // 背景圖 (隨輸入地點變換，預設使用 Step 1 選到的圖)
    const [bgImage, setBgImage] = useState(IMG_INTL); 

    // 當目的地改變時，更新背景
    useEffect(() => {
        if (destinations.length > 0) {
            const query = destinations[0];
            setBgImage(`https://source.unsplash.com/1600x900/?${query},travel,landmark`);
        } else {
            setBgImage(tripType === 'international' ? IMG_INTL : IMG_DOMESTIC);
        }
    }, [destinations, tripType]);

    const [origin, setOrigin] = useState('TPE');
    
    // 初始化日期
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
    });

    // 計算天數
    const durationDays = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays + 1; 
    }, [startDate, endDate]);

    const handleStartDateChange = (val: string) => {
        setStartDate(val);
        if (val > endDate) setEndDate(val);
    };

    // [New Logic] 新增目的地 (支援 Enter 或 點擊按鈕)
    const addDestination = () => {
        const val = destinationInput.trim();
        if (val && !destinations.includes(val)) {
            setDestinations([...destinations, val]);
            setDestinationInput('');
            // 保持 focus 以便繼續輸入
            destinationInputRef.current?.focus();
        }
    };

    const handleDestinationKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDestination();
        }
    };

    const removeDestination = (tag: string) => {
        setDestinations(destinations.filter(d => d !== tag));
    };

    // --- Step 3 Data (Transport) ---
    const [transportMode, setTransportMode] = useState<'flight' | 'train' | 'time'>('flight');
    const [localTransportMode, setLocalTransportMode] = useState<'public' | 'car' | 'taxi'>('public');
    const [flightIn, setFlightIn] = useState('');
    const [flightOut, setFlightOut] = useState('');
    // 雖然移除 AI 查航班，但保留變數結構以免報錯，之後可完全清理
    const [flightInLoading, setFlightInLoading] = useState(false);
    const [flightOutLoading, setFlightOutLoading] = useState(false);
    const [flightInInfo, setFlightInInfo] = useState<any>(null);
    const [flightOutInfo, setFlightOutInfo] = useState<any>(null);
    const [trainIn, setTrainIn] = useState({ country: '', origin: '', dest: '', type: '', number: '' });
    const [trainOut, setTrainOut] = useState({ country: '', origin: '', dest: '', type: '', number: '' });

    // --- Step 4 Data (Companion & Style) ---
    const [companion, setCompanion] = useState('couple');
    const [pace, setPace] = useState('standard');
    const [vibe, setVibe] = useState('balanced');
    const [budgetLevel, setBudgetLevel] = useState('standard');
    const [customBudget, setCustomBudget] = useState('');
    const [currency, setCurrency] = useState('TWD');

    // --- Step 5 Data (Interests) ---
    const [activeInterestTab, setActiveInterestTab] = useState('shopping');
    const [interestDetails, setInterestDetails] = useState<Record<string, string>>({});
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [specificRequests, setSpecificRequests] = useState('');
    const [coverImage, setCoverImage] = useState('');

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
    
    // Flight Logic (Keep unchanged for now to avoid breaking)
    const checkFlight = async (code: string, type: 'in' | 'out') => {
        // Simplified: removed AI lookup as requested
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0];
        if (file) { 
            const reader = new FileReader(); 
            reader.onloadend = () => { setCoverImage(reader.result as string); }; 
            reader.readAsDataURL(file); 
        } 
    };

    const buildPrompt = () => {
        const companionMap: any = { solo: '獨旅', couple: '情侶/夫妻', family: '親子家庭', friends: '一群朋友', elderly: '帶長輩', pet: '帶寵物', colleague: '同事', classmate: '同學' };
        const paceMap: any = { relaxed: '悠閒慢活', standard: '標準觀光', packed: '特種兵打卡', deep: '深度慢遊' };
        const vibeMap: any = { popular: '經典地標', balanced: '在地與熱門均衡', hidden: '大自然與秘境', cultural: '歷史人文藝術' };
        const budgetMap: any = { cheap: '經濟實惠', standard: '標準預算', luxury: '豪華享受' };
        
        const interestsWithDetails = selectedInterests.map(tag => {
            const detail = interestDetails[tag];
            return detail ? `${tag} (想去: ${detail})` : tag;
        }).join(', ');

        const destinationsStr = destinations.join('、');

        return `[旅遊條件] 
        - 類型：${tripType === 'domestic' ? '國內旅遊' : '國外旅遊'}
        - 目的地：${destinationsStr}
        - 旅伴：${companionMap[companion]}
        - 步調：${paceMap[pace]}
        - 風格：${vibeMap[vibe]}
        - 預算：${budgetMap[budgetLevel]} ${customBudget ? `(${customBudget})` : ''}
        - 興趣細項：${interestsWithDetails || '無特別指定'}
        - 特別需求：${specificRequests || '無'}
        `;
    };

    const handleCreate = async () => {
        const tripDays = durationDays;
        if (!tripDays || tripDays <= 0) { alert("請確認日期範圍"); return; }
        if (destinations.length === 0) { alert("請至少輸入一個目的地"); return; }
        
        setLoading(true);
        try {
            const fullPrompt = buildPrompt();
            
            let transportInfo = undefined;
            if (tripType === 'international') {
                if (transportMode === 'flight') {
                    transportInfo = { 
                        inbound: flightIn ? `Flight ${flightIn}` : undefined, 
                        outbound: flightOut ? `Flight ${flightOut}` : undefined 
                    };
                }
            } else {
                if (transportMode === 'train') {
                    transportInfo = { inbound: `Train/HSR`, outbound: `Train/HSR` };
                }
            }

            const finalDestination = destinations.join(' + ');

            const generatedDays = await generateItinerary(
                finalDestination, 
                tripDays, 
                fullPrompt, 
                currency, 
                transportInfo,
                '', 
                localTransportMode
            );

            if (generatedDays.length > 0 && generatedDays[0].activities.length > 0) {
                generatedDays[0] = recalculateTimeline(generatedDays[0]);
            }

            const processGeneratedItinerary = (days: TripDay[]): TripDay[] => {
                return days.map(day => recalculateTimeline(day));
            };

            const daysWithTime = processGeneratedItinerary(generatedDays);
            
            const newTrip: Trip = {
                id: Date.now().toString(),
                destination: finalDestination,
                origin: origin, 
                transportMode: transportMode,
                localTransportMode, 
                startDate: startDate,
                endDate: endDate,
                coverImage: coverImage || bgImage || `https://picsum.photos/800/600?random=${Date.now()}`,
                days: daysWithTime,
                isDeleted: false,
                currency: currency
            };
            onAddTrip(newTrip);
            onClose();

        } catch (e) { alert("無法生成行程，請檢查網路或稍後再試。"); } finally { setLoading(false); }
    };

    const handleManualCreate = () => {
        const tripDays = durationDays;
        if (!tripDays || tripDays <= 0) { alert("請確認日期範圍"); return; }
        const finalDestination = destinations.length > 0 ? destinations.join(' + ') : '未命名行程';
        
        const emptyDays: TripDay[] = Array.from({length: tripDays}, (_, i) => ({ day: i + 1, activities: [] }));
        const newTrip: Trip = { 
            id: Date.now().toString(), 
            destination: finalDestination, 
            origin, 
            startDate: startDate, 
            endDate: endDate, 
            coverImage: coverImage || bgImage, 
            days: emptyDays, 
            isDeleted: false, 
            currency: currency,
            transportMode: transportMode
        };
        onAddTrip(newTrip); onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            
            {/* === 沉浸式背景 (Step 2 以後顯示) === */}
            {step > 1 && (
                <div className="absolute inset-0 bg-[#1D1D1B] transition-all duration-1000 animate-in fade-in">
                    <img src={bgImage} className="w-full h-full object-cover opacity-60 blur-sm scale-105" alt="Background" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
                </div>
            )}
            
            {/* === Step 1: The Editorial Magazine Cover === */}
            {step === 1 && (
                <div className="bg-[#1D1D1B] w-full max-w-sm h-[85vh] rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col animate-in zoom-in-95 duration-500 border border-white/10">
                    <div className="absolute top-6 left-0 right-0 z-50 flex justify-end px-6">
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Top Half: International */}
                    <div 
                        onClick={() => { setTripType('international'); setTransportMode('flight'); setStep(2); setBgImage(IMG_INTL); }}
                        className="flex-1 relative group cursor-pointer overflow-hidden border-b border-white/10"
                    >
                        <img 
                            src={IMG_INTL}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100"
                            alt="International"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                        
                        <div className="absolute bottom-8 left-8 right-8 transition-all duration-500 group-hover:translate-y-[-5px]">
                            <span className="inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-widest text-[#1D1D1B] bg-white rounded-full uppercase shadow-lg">
                                International
                            </span>
                            <h2 className="text-4xl font-serif font-bold text-white mb-1 tracking-wide leading-tight">THE WORLD</h2>
                            <p className="text-sm text-gray-300 font-medium tracking-wider mb-3">探索異國．跨越邊界</p>
                            
                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Globe className="w-3.5 h-3.5 text-white/70" />
                                <span className="text-xs text-white/90 font-light border-l border-white/30 pl-2">跨國界多點串接</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Half: Domestic */}
                    <div 
                        onClick={() => { setTripType('domestic'); setTransportMode('train'); setStep(2); setBgImage(IMG_DOMESTIC); }}
                        className="flex-1 relative group cursor-pointer overflow-hidden"
                    >
                        <img 
                            src={IMG_DOMESTIC} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100"
                            alt="Domestic"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />

                        <div className="absolute top-8 left-8 right-8 transition-all duration-500 group-hover:translate-y-[5px]">
                            <span className="inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-widest text-white bg-[#45846D] rounded-full uppercase shadow-lg">
                                Domestic
                            </span>
                            <h2 className="text-4xl font-serif font-bold text-white mb-1 tracking-wide leading-tight">LOCAL GEMS</h2>
                            <p className="text-sm text-gray-300 font-medium tracking-wider mb-3">在地漫遊．深度發掘</p>

                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Map className="w-3.5 h-3.5 text-white/70" />
                                <span className="text-xs text-white/90 font-light border-l border-white/30 pl-2">私房景點與最佳路徑</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === Step 2~6: Wizard Container === */}
            {step > 1 && (
                <div className="bg-white/90 backdrop-blur-xl w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-300">
                    
                    {/* Header */}
                    <div className="pt-6 px-6 pb-2 border-b border-gray-100/50 bg-white/50 sticky top-0 z-20 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => setStep(s => s - 1)} className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-500 hover:bg-white transition-colors shadow-sm">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
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
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-[#45846D]' : 'bg-gray-200/50'}`} />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto min-h-0 flex-1 scroll-smooth">
                        
                        {/* === STEP 2: Destination (Conversational UI + Mobile Friendly) === */}
                        {step === 2 && (
                            <div className="flex flex-col h-full justify-center space-y-8 animate-in slide-in-from-right-4 duration-300 pb-20">
                                
                                {/* 1. Selected Tags (Floating) */}
                                <div className="flex flex-wrap gap-2 justify-center min-h-[40px] max-h-[120px] overflow-y-auto no-scrollbar">
                                    {destinations.length > 0 ? (
                                        destinations.map(tag => (
                                            <span key={tag} className="bg-[#1D1D1B] text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 animate-in zoom-in duration-200 shadow-lg">
                                                {tag}
                                                <button onClick={() => removeDestination(tag)} className="hover:text-red-300 bg-white/20 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-400 font-medium opacity-50 italic">尚未選擇地點...</span>
                                    )}
                                </div>

                                {/* 2. Conversational Input (Underline + Button) */}
                                <div className="space-y-4 text-center">
                                    <h3 className="text-3xl font-black text-[#1D1D1B] font-serif leading-tight">
                                        {tripType === 'international' ? "下一站，飛往哪裡？" : "想去哪裡探索？"}
                                    </h3>
                                    
                                    <div className="relative max-w-[280px] mx-auto group">
                                        <div className="relative flex items-end gap-2 border-b-2 border-gray-200 focus-within:border-[#45846D] transition-all pb-1">
                                            <input 
                                                ref={destinationInputRef}
                                                type="text" 
                                                className="flex-1 bg-transparent text-2xl font-bold text-[#1D1D1B] text-center outline-none py-2 placeholder:text-base placeholder:font-light placeholder:text-gray-300"
                                                placeholder={tripType === 'international' ? "輸入城市 (如: 東京)" : "輸入景點 (如: 阿里山)"}
                                                value={destinationInput}
                                                onChange={e => setDestinationInput(e.target.value)}
                                                onKeyDown={handleDestinationKeyDown}
                                                autoFocus
                                            />
                                            {/* Mobile-Friendly Add Button */}
                                            <button 
                                                onClick={addDestination}
                                                disabled={!destinationInput.trim()}
                                                className={`mb-1 p-2 rounded-full transition-all duration-300 ${destinationInput.trim() ? 'bg-[#45846D] text-white shadow-md scale-100 opacity-100' : 'bg-gray-100 text-gray-300 scale-90 opacity-0 pointer-events-none'}`}
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        {tripType === 'international' ? "Where to next?" : "Discover Local Gems"}
                                    </p>
                                </div>

                                {/* 3. Date Capsule (Timeline) */}
                                <div className="space-y-2 pt-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center block mb-3">預計停留時間</label>
                                    
                                    <div className="bg-white/80 backdrop-blur-sm rounded-full p-1.5 flex items-center justify-between shadow-sm border border-white/50 relative overflow-hidden max-w-[320px] mx-auto">
                                        {/* Start Date */}
                                        <div className="relative group px-4 py-2 hover:bg-black/5 rounded-l-full transition-colors cursor-pointer">
                                            <span className="block text-[10px] font-bold text-gray-400 text-center uppercase tracking-wide">DEPART</span>
                                            <div className="text-sm font-black text-[#1D1D1B] font-mono tracking-tight">{startDate.replace(/-/g, '.')}</div>
                                            <input 
                                                type="date" 
                                                value={startDate} 
                                                onChange={e => handleStartDateChange(e.target.value)} 
                                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                            />
                                        </div>

                                        {/* Duration Line */}
                                        <div className="flex-1 flex flex-col items-center justify-center px-2">
                                            <div className="text-[10px] font-black text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-full mb-0.5 whitespace-nowrap">
                                                {durationDays} Days
                                            </div>
                                            <div className="w-full h-px bg-gray-300 relative">
                                                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-300 rounded-full" />
                                            </div>
                                        </div>

                                        {/* End Date */}
                                        <div className="relative group px-4 py-2 hover:bg-black/5 rounded-r-full transition-colors cursor-pointer">
                                            <span className="block text-[10px] font-bold text-gray-400 text-center uppercase tracking-wide">RETURN</span>
                                            <div className="text-sm font-black text-[#1D1D1B] font-mono tracking-tight">{endDate.replace(/-/g, '.')}</div>
                                            <input 
                                                type="date" 
                                                value={endDate}
                                                min={startDate}
                                                onChange={e => setEndDate(e.target.value)} 
                                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === Step 3: Transport === */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div className="p-4 bg-[#45846D]/5 rounded-2xl border border-[#45846D]/10 flex items-start gap-3">
                                    {tripType === 'international' ? <Plane className="w-5 h-5 text-[#45846D] shrink-0 mt-0.5" /> : <Train className="w-5 h-5 text-[#45846D] shrink-0 mt-0.5" />}
                                    <div>
                                        <h3 className="text-sm font-bold text-[#1D1D1B]">
                                            {tripType === 'international' ? '前往當地的航班' : '跨縣市交通'}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                            {tripType === 'international' 
                                                ? '輸入航班號碼紀錄行程（選填）。' 
                                                : '選擇您偏好的移動方式。'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-1.5 rounded-2xl flex mb-2">
                                    {tripType === 'international' ? (
                                        <>
                                            <button onClick={() => setTransportMode('flight')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'flight' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400'}`}><Plane className="w-4 h-4"/> 航班</button>
                                            <button onClick={() => setTransportMode('time')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'time' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400'}`}><Clock className="w-4 h-4"/> 手動時間</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setTransportMode('train')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'train' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400'}`}><Train className="w-4 h-4"/> 雙鐵/客運</button>
                                            <button onClick={() => setTransportMode('time')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'time' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400'}`}><Car className="w-4 h-4"/> 自駕/其他</button>
                                        </>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">當地移動方式</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => setLocalTransportMode('public')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'public' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Bus className="w-3 h-3" /> 大眾運輸</button>
                                        <button onClick={() => setLocalTransportMode('car')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'car' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Car className="w-3 h-3" /> 租車/自駕</button>
                                        <button onClick={() => setLocalTransportMode('taxi')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'taxi' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Car className="w-3 h-3" /> 計程車</button>
                                    </div>
                                </div>

                                {transportMode === 'flight' && tripType === 'international' && (
                                    <div className="space-y-4">
                                        <div className="bg-white p-4 rounded-2xl border border-gray-200">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">去程航班 (選填)</label>
                                            <div className="flex items-center gap-3">
                                                <Plane className="w-5 h-5 text-gray-400" />
                                                <input type="text" placeholder="例：JX800" value={flightIn} onChange={(e) => setFlightIn(e.target.value.toUpperCase())} className="flex-1 bg-transparent text-lg font-bold font-mono outline-none uppercase text-[#1D1D1B]" />
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-gray-200">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">回程航班 (選填)</label>
                                            <div className="flex items-center gap-3">
                                                <Plane className="w-5 h-5 text-gray-400 rotate-180" />
                                                <input type="text" placeholder="例：JX801" value={flightOut} onChange={(e) => setFlightOut(e.target.value.toUpperCase())} className="flex-1 bg-transparent text-lg font-bold font-mono outline-none uppercase text-[#1D1D1B]" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === Step 4 (Companion) === */}
                        {step === 4 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">旅伴</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        <OptionCard selected={companion === 'solo'} onClick={() => setCompanion('solo')} icon={<UserIcon />} label="獨旅" />
                                        <OptionCard selected={companion === 'couple'} onClick={() => setCompanion('couple')} icon={<Heart />} label="情侶" />
                                        <OptionCard selected={companion === 'family'} onClick={() => setCompanion('family')} icon={<Baby />} label="親子" />
                                        <OptionCard selected={companion === 'friends'} onClick={() => setCompanion('friends')} icon={<Users />} label="朋友" />
                                        <OptionCard selected={companion === 'elderly'} onClick={() => setCompanion('elderly')} icon={<Armchair />} label="長輩" />
                                        <OptionCard selected={companion === 'pet'} onClick={() => setCompanion('pet')} icon={<Dog />} label="寵物" />
                                        <OptionCard selected={companion === 'colleague'} onClick={() => setCompanion('colleague')} icon={<Briefcase />} label="同事" />
                                        <OptionCard selected={companion === 'classmate'} onClick={() => setCompanion('classmate')} icon={<GraduationCap />} label="同學" />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 my-2" />
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">步調與風格</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        <OptionCard selected={pace === 'relaxed'} onClick={() => setPace('relaxed')} icon={<Coffee />} label="悠閒" />
                                        <OptionCard selected={pace === 'standard'} onClick={() => setPace('standard')} icon={<Footprints />} label="標準" />
                                        <OptionCard selected={pace === 'packed'} onClick={() => setPace('packed')} icon={<Zap />} label="緊湊" />
                                        <OptionCard selected={pace === 'deep'} onClick={() => setPace('deep')} icon={<Book />} label="深度" />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        <OptionCard selected={vibe === 'popular'} onClick={() => setVibe('popular')} icon={<MapPin />} label="經典" sub="地標" />
                                        <OptionCard selected={vibe === 'balanced'} onClick={() => setVibe('balanced')} icon={<Scale />} label="均衡" sub="在地" />
                                        <OptionCard selected={vibe === 'cultural'} onClick={() => setVibe('cultural')} icon={<Landmark />} label="人文" sub="歷史" />
                                        <OptionCard selected={vibe === 'hidden'} onClick={() => setVibe('hidden')} icon={<Mountain />} label="秘境" sub="自然" />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 my-2" />
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase">預算等級</label>
                                    <div className="flex gap-2 mb-3">
                                        {[{id:'cheap',l:'經濟 $'}, {id:'standard',l:'標準 $$'}, {id:'luxury',l:'豪華 $$$'}].map(opt => (
                                            <button key={opt.id} onClick={() => setBudgetLevel(opt.id)} className={`flex-1 py-3 rounded-2xl font-bold text-sm border transition-all ${budgetLevel === opt.id ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>{opt.l}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative min-w-fit">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Coins className="h-4 w-4 text-gray-400" /></div>
                                            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl py-3 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 appearance-none font-bold">
                                                {CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} {c.label}</option>))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        <input type="text" placeholder="或輸入具體預算..." className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 transition-colors bg-transparent font-medium" value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === Step 5 (Interests) === */}
                        {step === 5 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">您想怎麼玩？(深度興趣)</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                        {Object.entries(INTEREST_DATA).map(([key, data]) => (
                                            <button key={key} onClick={() => setActiveInterestTab(key)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border transition-all ${activeInterestTab === key ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{React.createElement(data.icon, { size: 16 })}{data.label}</button>
                                        ))}
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-4 min-h-[120px] transition-all border border-gray-100 mt-2">
                                        <div className="flex flex-wrap gap-2 animate-in fade-in mb-4">
                                            {INTEREST_DATA[activeInterestTab].tags.map(tag => (
                                                <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${selectedInterests.includes(tag) ? 'bg-[#45846D] text-white border-[#45846D] shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{tag}</button>
                                            ))}
                                        </div>
                                        {selectedInterests.length > 0 && (
                                            <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-gray-200 animate-in slide-in-from-top-2">
                                                <label className="text-[10px] font-bold text-gray-400 block mb-2">指定詳細需求 (選填)</label>
                                                {selectedInterests.map(tag => (
                                                    <div key={tag} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100">
                                                        <span className="text-xs font-bold text-[#45846D] px-2">{tag}</span>
                                                        <input 
                                                            type="text" 
                                                            placeholder={`想去的 ${tag} 品牌或地點...`}
                                                            value={interestDetails[tag] || ''}
                                                            onChange={(e) => handleInterestDetailChange(tag, e.target.value)}
                                                            className="flex-1 text-xs bg-transparent outline-none placeholder-gray-300"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase">許願池 / 特殊需求</label>
                                    <textarea className="w-full bg-gray-50 rounded-2xl p-4 text-sm border-none outline-none focus:ring-2 focus:ring-[#45846D]/50 h-24 resize-none font-medium" placeholder="例如：不想吃生食、一定要去環球影城..." value={specificRequests} onChange={e => setSpecificRequests(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {/* === Step 6: Confirmation === */}
                        {step === 6 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                {/* Boarding Pass Style Card */}
                                <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative">
                                    <div className="bg-[#2C5E4B] p-5 text-white relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">Boarding Pass</p>
                                                <h3 className="text-2xl font-serif font-bold tracking-wide">{destinations.join(' & ')}</h3>
                                                <p className="text-xs opacity-90 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {origin} 出發</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">Date</p>
                                                <p className="text-xl font-mono font-bold">{startDate}</p>
                                                <p className="text-xs opacity-90 mt-1">{durationDays} Days</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between relative z-10 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                            <div className="text-center">
                                                <p className="text-[10px] opacity-70 mb-0.5">TYPE</p>
                                                <p className="font-mono font-bold text-lg uppercase">{tripType}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5 opacity-80">
                                                {tripType === 'international' ? <PlaneTakeoff className="w-4 h-4" /> : <Train className="w-4 h-4" />}
                                                <ArrowLeftRight className="w-3 h-3" /> 
                                                {tripType === 'international' ? <PlaneLanding className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] opacity-70 mb-0.5">MODE</p>
                                                <p className="font-mono font-bold text-lg uppercase">{transportMode}</p>
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
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Transport</p>
                                                <p className="font-bold text-[#1D1D1B] flex items-center gap-2">
                                                    {localTransportMode === 'public' ? <Bus className="w-4 h-4 text-[#45846D]" /> : <Car className="w-4 h-4 text-[#45846D]" />}
                                                    <span className="capitalize">{localTransportMode}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Budget</p>
                                                <p className="font-bold text-[#1D1D1B] flex items-center gap-2">
                                                    <Coins className="w-4 h-4 text-[#45846D]" />
                                                    <span className="capitalize">{budgetLevel} ({currency})</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tags Cloud */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 mb-3 uppercase ml-1 tracking-widest">Your Vibe</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 shadow-sm">{pace}</span>
                                        <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 shadow-sm">{vibe}</span>
                                        {selectedInterests.map(tag => {
                                            const detail = interestDetails[tag];
                                            return (
                                                <span key={tag} className="px-3 py-1.5 bg-[#1D1D1B] text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> 
                                                    {tag} {detail ? `: ${detail}` : ''}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* Special Requests */}
                                {specificRequests && (
                                    <div className="bg-yellow-50/50 rounded-2xl p-5 border border-yellow-100/50">
                                        <p className="text-[10px] font-bold text-yellow-600 mb-2 uppercase tracking-widest">Notes</p>
                                        <p className="text-sm text-yellow-800 font-serif leading-relaxed italic">"{specificRequests}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100/50 bg-white/80 backdrop-blur-md sticky bottom-0 z-30">
                        {step < 6 ? (
                            <div className="flex flex-col gap-3">
                                <IOSButton fullWidth onClick={() => { 
                                    if (step===2 && destinations.length === 0) return alert('請至少輸入一個目的地');
                                    if (step===2 && (!durationDays || durationDays <= 0)) return alert('請確認日期範圍');
                                    setStep(s => s + 1); 
                                }}>
                                    下一步
                                </IOSButton>
                                {step === 2 && <button onClick={handleManualCreate} className="text-gray-400 text-xs font-medium py-2 hover:text-gray-600 transition-colors">跳過 AI，手動建立空白行程</button>}
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button onClick={() => setStep(5)} className="flex-1 py-3 text-gray-500 font-bold text-sm bg-white border border-gray-200 rounded-full hover:bg-gray-50">修改</button>
                                <IOSButton fullWidth onClick={handleCreate} isLoading={loading} className="flex-[2]"><Sparkles className="w-4 h-4 mr-1" /> 生成夢幻行程</IOSButton>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};