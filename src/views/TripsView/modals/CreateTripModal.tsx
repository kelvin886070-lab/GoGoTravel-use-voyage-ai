import React, { useState, useMemo } from 'react';
import { 
    X, ChevronLeft, Image as ImageIcon, Plane, Train, Clock, Bus, Car, 
    User as UserIcon, Heart, Baby, Users, Armchair, Briefcase, GraduationCap, Dog,
    Coffee, Footprints, Zap, Book, MapPin, Scale, Landmark, Mountain, 
    Coins, ChevronDown, Sparkles, PlaneTakeoff, PlaneLanding, ArrowLeftRight,
    Loader2, Calendar, ArrowRight, History
} from 'lucide-react';
import { IOSButton, IOSInput } from '../../../components/UI';
import { generateItinerary, lookupFlightInfo } from '../../../services/gemini';
import { recalculateTimeline } from '../../../services/timeline';
import type { Trip, TripDay } from '../../../types';
import { INTEREST_DATA, CURRENCIES } from '../shared';
import { OptionCard } from '../components/cards/OptionCard';

// ============================================================================
// 本地輸入元件：航班輸入 (FlightInput)
// ============================================================================
const FlightInput: React.FC<{
    type: 'in' | 'out';
    code: string;
    setCode: (c: string) => void;
    checkFlight: () => void;
    info: any;
    loading: boolean;
}> = ({ type, code, setCode, checkFlight, info, loading }) => {
    const isInbound = type === 'in';
    const label = isInbound ? '去程航班 (Inbound)' : '回程航班 (Outbound)';
    
    return (
        <div className="bg-[#F5F5F4] p-4 rounded-2xl border border-gray-100 relative group focus-within:ring-2 focus-within:ring-[#45846D]/20 transition-all">
            <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
                {loading && <Loader2 className="w-3 h-3 animate-spin text-[#45846D]" />}
                {!loading && info && <span className="text-[10px] font-bold text-[#45846D] bg-[#45846D]/10 px-2 py-0.5 rounded-full">已確認</span>}
            </div>
            
            <div className="flex items-center gap-3">
                <Plane className={`w-5 h-5 ${isInbound ? 'text-gray-400' : 'text-gray-400 rotate-180'}`} />
                <input 
                    type="text" 
                    placeholder={isInbound ? "例：JX800" : "例：JX801"}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onBlur={checkFlight}
                    className="flex-1 bg-transparent text-lg font-bold font-mono outline-none placeholder-gray-300 uppercase text-[#1D1D1B]"
                />
            </div>

            {/* 航班資訊顯示區 */}
            {info && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center animate-in slide-in-from-top-1">
                    <div className="flex gap-4">
                        <div>
                            <span className="block text-[10px] text-gray-400 font-bold">DEPART</span>
                            <span className="block text-sm font-bold">{info.origin} {info.depTime}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] text-gray-400 font-bold">ARRIVE</span>
                            <span className="block text-sm font-bold">{info.dest} {info.arrTime}</span>
                        </div>
                    </div>
                    {info.originTerm && (
                        <div className="text-right">
                            <span className="block text-[10px] text-gray-400 font-bold">TERM</span>
                            <span className="block text-sm font-bold">{info.originTerm}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 本地輸入元件：列車輸入 (TrainInput)
// ============================================================================
const TrainInput: React.FC<{
    label: string;
    info: any;
    setInfo: (i: any) => void;
}> = ({ label, info, setInfo }) => {
    return (
        <div className="bg-[#F5F5F4] p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
                <Train className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <input 
                        type="text" 
                        placeholder="起點 (如: 東京)" 
                        value={info.origin} 
                        onChange={(e) => setInfo({...info, origin: e.target.value})}
                        className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#45846D]/20 transition-all"
                    />
                </div>
                <div>
                    <input 
                        type="text" 
                        placeholder="終點 (如: 京都)" 
                        value={info.dest} 
                        onChange={(e) => setInfo({...info, dest: e.target.value})}
                        className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#45846D]/20 transition-all"
                    />
                </div>
            </div>
            
            <div className="flex gap-3">
                <input 
                    type="text" 
                    placeholder="車種 (如: 新幹線)" 
                    value={info.type} 
                    onChange={(e) => setInfo({...info, type: e.target.value})}
                    className="flex-[2] bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#45846D]/20 transition-all"
                />
                <input 
                    type="text" 
                    placeholder="車次號碼" 
                    value={info.number} 
                    onChange={(e) => setInfo({...info, number: e.target.value})}
                    className="flex-[1] bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#45846D]/20 transition-all text-center font-mono"
                />
            </div>
        </div>
    );
};


// ============================================================================
// Main Component: CreateTripModal
// ============================================================================
export const CreateTripModal: React.FC<{ onClose: () => void, onAddTrip: (t: Trip) => void }> = ({ onClose, onAddTrip }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // --- Step 1 Data (Modified: Uses End Date instead of Days Input) ---
    const [destination, setDestination] = useState('');
    const [origin, setOrigin] = useState('TPE');
    const [focusArea, setFocusArea] = useState('');
    
    // 初始化日期
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(() => {
        // 預設 4 天行程 (開始日期 + 3天)
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
    });

    // 計算天數 (Duration)
    const durationDays = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays + 1; // 包含頭尾
    }, [startDate, endDate]);

    // 處理日期變更 (防呆: 結束日期不能早於開始日期)
    const handleStartDateChange = (val: string) => {
        setStartDate(val);
        if (val > endDate) {
            setEndDate(val); // 如果開始日期晚於結束日期，自動推延結束日期
        }
    };
    
    // --- Step 2 Data ---
    const [transportMode, setTransportMode] = useState<'flight' | 'train' | 'time'>('flight');
    const [localTransportMode, setLocalTransportMode] = useState<'public' | 'car' | 'taxi'>('public');
    const [flightIn, setFlightIn] = useState('');
    const [flightOut, setFlightOut] = useState(''); 
    const [flightInLoading, setFlightInLoading] = useState(false);
    const [flightOutLoading, setFlightOutLoading] = useState(false);
    const [flightInInfo, setFlightInInfo] = useState<any>(null);
    const [flightOutInfo, setFlightOutInfo] = useState<any>(null);
    const [trainIn, setTrainIn] = useState({ country: '', origin: '', dest: '', type: '', number: '' });
    const [trainOut, setTrainOut] = useState({ country: '', origin: '', dest: '', type: '', number: '' });

    // --- Step 3 Data ---
    const [companion, setCompanion] = useState('couple');
    const [pace, setPace] = useState('standard');
    const [vibe, setVibe] = useState('balanced');
    const [budgetLevel, setBudgetLevel] = useState('standard');
    const [customBudget, setCustomBudget] = useState('');
    const [currency, setCurrency] = useState('TWD');

    // --- Step 4 Data ---
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
    
    const checkFlight = async (code: string, type: 'in' | 'out') => {
        if (!code || code.length < 4) return;
        if (type === 'in') setFlightInLoading(true);
        else setFlightOutLoading(true);

        try {
            const info = await lookupFlightInfo(code);
            if (info) {
                if (type === 'in') setFlightInInfo(info);
                else setFlightOutInfo(info);
            }
        } finally {
            if (type === 'in') setFlightInLoading(false);
            else setFlightOutLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setCoverImage(reader.result as string); }; reader.readAsDataURL(file); } };
    
    const buildPrompt = () => {
        const companionMap: any = { solo: '獨旅', couple: '情侶/夫妻', family: '親子家庭', friends: '一群朋友', elderly: '帶長輩', pet: '帶寵物', colleague: '同事', classmate: '同學' };
        const paceMap: any = { relaxed: '悠閒慢活', standard: '標準觀光', packed: '特種兵打卡', deep: '深度慢遊' };
        const vibeMap: any = { popular: '經典地標', balanced: '在地與熱門均衡', hidden: '大自然與秘境', cultural: '歷史人文藝術' };
        const budgetMap: any = { cheap: '經濟實惠', standard: '標準預算', luxury: '豪華享受' };
        const interestsWithDetails = selectedInterests.map(tag => {
            const detail = interestDetails[tag];
            return detail ? `${tag} (想去: ${detail})` : tag;
        }).join(', ');
        return `[旅遊條件] 
        - 旅伴：${companionMap[companion]}
        - 步調：${paceMap[pace]}
        - 風格：${vibeMap[vibe]}
        - 預算：${budgetMap[budgetLevel]} ${customBudget ? `(${customBudget})` : ''}
        - 興趣細項：${interestsWithDetails || '無特別指定'}
        - 特別需求：${specificRequests || '無'}
        `;
    };

    const handleCreate = async () => {
        const tripDays = durationDays; // 使用計算出的天數
        if (!tripDays || tripDays <= 0) { alert("請確認日期範圍"); return; }
        
        setLoading(true);
        try {
            const fullPrompt = buildPrompt();
            let transportInfo = undefined;
            if (transportMode === 'flight') {
                transportInfo = { 
                    inbound: flightIn ? `Flight ${flightIn} (${flightInInfo?.depTime || 'TBA'} - ${flightInInfo?.arrTime || 'TBA'})` : undefined, 
                    outbound: flightOut ? `Flight ${flightOut} (${flightOutInfo?.depTime || 'TBA'})` : undefined 
                };
            } else if (transportMode === 'train') {
                transportInfo = { inbound: trainIn.number ? `${trainIn.type} ${trainIn.number} from ${trainIn.origin} to ${trainIn.dest}` : undefined, outbound: trainOut.number ? `${trainOut.type} ${trainOut.number}` : undefined };
            }

            const generatedDays = await generateItinerary(
                destination, 
                tripDays, 
                fullPrompt, 
                currency, 
                transportInfo,
                focusArea,
                localTransportMode
            );
            
            if (generatedDays.length > 0 && generatedDays[0].activities.length > 0) {
                if (transportMode === 'flight' && flightInInfo?.arrTime) {
                    generatedDays[0].activities[0].time = flightInInfo.arrTime;
                }
                generatedDays[0] = recalculateTimeline(generatedDays[0]);
            }

            const processGeneratedItinerary = (days: TripDay[]): TripDay[] => {
                return days.map(day => recalculateTimeline(day));
            };

            const daysWithTime = processGeneratedItinerary(generatedDays);
            
            // 注意：這裡使用使用者選擇的 endDate，而不是透過 Start + Days 計算，確保與 UI 一致
            const newTrip: Trip = {
                id: Date.now().toString(),
                destination,
                origin: origin, 
                focusArea, 
                
                // [New] 寫入主要交通方式
                transportMode: transportMode,
                
                localTransportMode, 
                startDate: startDate,
                endDate: endDate, // 直接使用 State 中的 endDate
                coverImage: coverImage || `https://picsum.photos/800/600?random=${Date.now()}`,
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
        
        const emptyDays: TripDay[] = Array.from({length: tripDays}, (_, i) => ({ day: i + 1, activities: [] }));
        
        const newTrip: Trip = { 
            id: Date.now().toString(), 
            destination: destination || '未命名行程', 
            origin, 
            startDate: startDate, 
            endDate: endDate, // 直接使用 State 中的 endDate
            coverImage: coverImage || `https://picsum.photos/800/600?random=${Date.now()}`, 
            days: emptyDays, 
            isDeleted: false, 
            currency: currency,
            
            // [New] 寫入主要交通方式
            transportMode: transportMode
        };
        
        onAddTrip(newTrip); onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-md" onClick={onClose} />
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="pt-6 px-6 pb-2 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} className="text-gray-400 hover:text-gray-600">
                            {step === 1 ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                        </button>
                        <h2 className="font-bold text-lg text-[#1D1D1B]">
                            {step === 1 && '行程設定'}
                            {step === 2 && '交通安排'}
                            {step === 3 && '風格與預算'}
                            {step === 4 && '興趣深度'}
                            {step === 5 && '確認您的行程'}
                        </h2>
                        <div className="w-6"></div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        {[1, 2, 3, 4, 5].map(i => (<div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-[#45846D]' : 'bg-gray-100'}`} />))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto min-h-0 flex-1 scroll-smooth">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-[#F5F5F4] group">
                                {coverImage ? (<img src={coverImage} alt="Cover" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><ImageIcon className="w-8 h-8 mb-2 opacity-50" /><span className="text-xs font-medium">設定封面 (選填)</span></div>)}
                                <label className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-black/5 transition-colors"><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
                            </div>
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">出發地</label><IOSInput placeholder="TPE" value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} /></div>
                                    <div><label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">目的地</label><IOSInput autoFocus placeholder="例如：京都" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">指定區域/商圈 (選填)</label>
                                    <IOSInput placeholder="例：中西區、安平、國華街..." value={focusArea} onChange={(e) => setFocusArea(e.target.value)} />
                                </div>
                                
                                {/* --- 日期範圍選擇器 (Modified UI) --- */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">旅遊期間</label>
                                        <div className="flex items-center gap-1 bg-[#1D1D1B]/5 px-2 py-0.5 rounded-md">
                                            <History className="w-3 h-3 text-[#1D1D1B]" />
                                            <span className="text-[10px] font-bold text-[#1D1D1B]">共 {durationDays} 天</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-[#F5F5F4] p-4 rounded-2xl">
                                        <div className="flex-1">
                                            <span className="block text-[10px] font-bold text-gray-400 mb-1">DEPART</span>
                                            <input 
                                                type="date" 
                                                value={startDate} 
                                                onChange={e => handleStartDateChange(e.target.value)} 
                                                className="w-full bg-transparent font-bold text-[#1D1D1B] outline-none text-sm p-0" 
                                            />
                                        </div>
                                        <div className="text-gray-300">
                                            <ArrowRight className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 text-right">
                                            <span className="block text-[10px] font-bold text-gray-400 mb-1">RETURN</span>
                                            <input 
                                                type="date" 
                                                value={endDate}
                                                min={startDate}
                                                onChange={e => setEndDate(e.target.value)} 
                                                className="w-full bg-transparent font-bold text-[#1D1D1B] outline-none text-sm p-0 text-right" 
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                     )}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#F5F5F4] p-1.5 rounded-2xl flex mb-6">
                               <button onClick={() => setTransportMode('flight')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'flight' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400 hover:text-gray-600'}`}><Plane className="w-4 h-4"/> 航班</button>
                                <button onClick={() => setTransportMode('train')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'train' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400 hover:text-gray-600'}`}><Train className="w-4 h-4"/> 列車</button>
                                <button onClick={() => setTransportMode('time')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${transportMode === 'time' ? 'bg-white shadow-sm text-[#1D1D1B]' : 'text-gray-400 hover:text-gray-600'}`}><Clock className="w-4 h-4"/> 手動</button>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">當地移動方式 (AI 將依此安排路線)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setLocalTransportMode('public')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'public' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Bus className="w-3 h-3" /> 大眾運輸</button>
                                    <button onClick={() => setLocalTransportMode('car')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'car' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Car className="w-3 h-3" /> 自駕/包車</button>
                                    <button onClick={() => setLocalTransportMode('taxi')} className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${localTransportMode === 'taxi' ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-100'}`}><Car className="w-3 h-3" /> 計程車</button>
                                </div>
                            </div>

                            {transportMode === 'flight' && (
                                <div className="space-y-4">
                                    {/* 替換為本地 FlightInput 元件 */}
                                    <FlightInput
                                        type="in" 
                                        code={flightIn} 
                                        setCode={setFlightIn} 
                                        checkFlight={() => checkFlight(flightIn, 'in')}
                                        info={flightInInfo} 
                                        loading={flightInLoading} 
                                    />
                                    <FlightInput
                                        type="out" 
                                        code={flightOut} 
                                        setCode={setFlightOut} 
                                        checkFlight={() => checkFlight(flightOut, 'out')}
                                        info={flightOutInfo} 
                                        loading={flightOutLoading} 
                                    />
                                    <p className="text-xs text-center text-gray-400 mt-4">AI 將自動查詢航班時間並安排接送機行程</p>
                                </div>
                            )}
                            {transportMode === 'train' && (
                                <div className="space-y-4">
                                    {/* 替換為本地 TrainInput 元件 */}
                                    <TrainInput label="去程資訊" info={trainIn} setInfo={setTrainIn} />
                                    <TrainInput label="回程資訊" info={trainOut} setInfo={setTrainOut} />
                                    <p className="text-xs text-center text-gray-400 mt-4">AI 將依據車種與車次估算時間</p>
                                </div>
                            )}
                            {transportMode === 'time' && (
                                <div className="space-y-6">
                                     <div><label className="block text-xs font-bold text-gray-400 mb-2 uppercase">去程抵達時間</label><input type="time" className="w-full bg-[#F5F5F4] p-4 rounded-2xl text-lg font-bold outline-none text-center" defaultValue="10:00" /></div>
                                    <div><label className="block text-xs font-bold text-gray-400 mb-2 uppercase">回程出發時間</label><input type="time" className="w-full bg-[#F5F5F4] p-4 rounded-2xl text-lg font-bold outline-none text-center" defaultValue="16:00" /></div>
                                </div>
                            )}
                        </div>
                     )}
                    {step === 3 && (
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
                                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-[#F5F5F4] border-none rounded-xl py-3 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 appearance-none font-bold">
                                            {CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} {c.label}</option>))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                     </div>
                                    <input type="text" placeholder="或輸入具體預算..." className="w-full bg-[#F5F5F4] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#45846D]/50 transition-colors bg-transparent font-medium" value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-3 ml-1 uppercase">您想怎麼玩？(深度興趣)</label>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {Object.entries(INTEREST_DATA).map(([key, data]) => (
                                        <button key={key} onClick={() => setActiveInterestTab(key)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border transition-all ${activeInterestTab === key ? 'bg-[#1D1D1B] text-white border-[#1D1D1B]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{React.createElement(data.icon, { size: 16 })}{data.label}</button>
                                    ))}
                                </div>
                                <div className="bg-[#F5F5F4] rounded-2xl p-4 min-h-[120px] transition-all border border-gray-100 mt-2">
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
                                <textarea className="w-full bg-[#F5F5F4] rounded-2xl p-4 text-sm border-none outline-none focus:ring-2 focus:ring-[#45846D]/50 h-24 resize-none font-medium" placeholder="例如：不想吃生食、一定要去環球影城..." value={specificRequests} onChange={e => setSpecificRequests(e.target.value)} />
                            </div>
                        </div>
                    )}
                    {/* Step 5: Final Review */}
                    {step === 5 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            {/* Boarding Pass Style Card */}
                            <div className="bg-[#F5F5F4] rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative">
                                <div className="bg-[#2C5E4B] p-5 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mb-1">Boarding Pass</p>
                                            <h3 className="text-2xl font-serif font-bold tracking-wide">{destination}</h3>
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
                                            <p className="text-[10px] opacity-70 mb-0.5">FLIGHT</p>
                                            <p className="font-mono font-bold text-lg">{flightIn || '--'}</p>
                                        </div>
                                        <div className="flex flex-col items-center gap-0.5 opacity-80">
                                            <PlaneTakeoff className="w-4 h-4" />
                                            <ArrowLeftRight className="w-3 h-3" /> 
                                            <PlaneLanding className="w-4 h-4" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] opacity-70 mb-0.5">RETURN</p>
                                            <p className="font-mono font-bold text-lg">{flightOut || '--'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative h-6 bg-[#F5F5F4] -mt-3">
                                    <div className="absolute -left-3 top-0 w-6 h-6 bg-white rounded-full" />
                                    <div className="absolute -right-3 top-0 w-6 h-6 bg-white rounded-full" />
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
                                    {focusArea && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Focus Area</p>
                                            <span className="inline-block bg-[#45846D]/10 text-[#45846D] px-3 py-1 rounded-full text-xs font-bold">{focusArea}</span>
                                         </div>
                                    )}
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

                <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0 z-30">
                    {step < 5 ? (
                        <div className="flex flex-col gap-3">
                            <IOSButton fullWidth onClick={() => { 
                                if (step===1 && !destination) return alert('請輸入目的地');
                                if (step===1 && (!durationDays || durationDays <= 0)) return alert('請確認日期範圍');
                                setStep(s => s + 1); 
                            }}>
                                下一步
                            </IOSButton>
                            {step === 1 && <button onClick={handleManualCreate} className="text-gray-400 text-xs font-medium py-2 hover:text-gray-600 transition-colors">跳過 AI，手動建立空白行程</button>}
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => setStep(4)} className="flex-1 py-3 text-gray-500 font-bold text-sm bg-white border border-gray-200 rounded-full hover:bg-gray-50">修改</button>
                            <IOSButton fullWidth onClick={handleCreate} isLoading={loading} className="flex-[2]"><Sparkles className="w-4 h-4 mr-1" /> 生成夢幻行程</IOSButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};