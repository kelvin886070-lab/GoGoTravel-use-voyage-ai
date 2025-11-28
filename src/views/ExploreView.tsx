
import React, { useState } from 'react';
import { Plane, Hotel, Car, Ticket, Search, MapPin, Calendar, Users, ArrowRight } from 'lucide-react';
import { IOSHeader, IOSCard, IOSButton, IOSInput, IOSDateInput, IOSDatePicker } from '../components/UI';

type BookingType = 'flight' | 'hotel' | 'car' | 'ticket';

export const ExploreView: React.FC = () => {
    const [activeType, setActiveType] = useState<BookingType>('flight');

    return (
        <div className="min-h-screen pb-24">
            <IOSHeader title="探索" />
            
            <div className="px-5 mt-6 space-y-8">
                {/* Navigation Icons */}
                <div className="grid grid-cols-4 gap-4 px-2">
                    <BookingCategory 
                        icon={<Plane />} 
                        label="機票" 
                        active={activeType === 'flight'} 
                        onClick={() => setActiveType('flight')}
                    />
                    <BookingCategory 
                        icon={<Hotel />} 
                        label="住宿" 
                        active={activeType === 'hotel'}
                        onClick={() => setActiveType('hotel')}
                    />
                    <BookingCategory 
                        icon={<Car />} 
                        label="租車" 
                        active={activeType === 'car'}
                        onClick={() => setActiveType('car')}
                    />
                    <BookingCategory 
                        icon={<Ticket />} 
                        label="門票" 
                        active={activeType === 'ticket'}
                        onClick={() => setActiveType('ticket')}
                    />
                </div>

                {/* Dynamic Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {activeType === 'flight' && <FlightSearch />}
                    {activeType === 'hotel' && <HotelSearch />}
                    {activeType === 'car' && <CarSearch />}
                    {activeType === 'ticket' && <TicketSearch />}
                </div>
            </div>
        </div>
    );
};

const BookingCategory: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-3 group">
        <div className={`w-[70px] h-[70px] rounded-[22px] flex items-center justify-center shadow-md transition-all duration-300 ${active ? 'bg-ios-blue text-white scale-110 shadow-blue-200/50' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-8 h-8' })}
        </div>
        <span className={`text-xs font-bold tracking-wide transition-colors ${active ? 'text-ios-blue' : 'text-gray-400'}`}>{label}</span>
    </button>
);

const GlassCard: React.FC<{ title: string, subtitle?: string, children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-ios-blue/5 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="mb-6 relative z-10">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="relative z-10">{children}</div>
    </div>
);

const InputGroup: React.FC<{ icon: React.ReactNode, label: string, children: React.ReactNode }> = ({ icon, label, children }) => (
    <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 transition-colors focus-within:bg-white focus-within:border-ios-blue/30 focus-within:ring-2 focus-within:ring-ios-blue/10 min-h-[72px] flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
            <div className="text-gray-400 scale-75 origin-left">{icon}</div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
        </div>
        {children}
    </div>
);

const FlightSearch = () => {
    const [dates, setDates] = useState({ start: '', end: '' });
    const [origin, setOrigin] = useState('台北');
    const [dest, setDest] = useState('');
    const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);

    const handleSearch = () => {
        if (!dest) {
            alert('請輸入目的地');
            return;
        }
        // Use Google Search Flight query as a flexible fallback
        const query = `flights from ${origin} to ${dest} ${dates.start ? 'on ' + dates.start : ''}`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    return (
        <GlassCard title="搜尋航班" subtitle="探索世界各地的最佳航線">
            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                         <InputGroup icon={<MapPin />} label="出發地">
                            <input 
                                className="w-full bg-transparent font-bold text-lg outline-none placeholder-gray-300 uppercase" 
                                placeholder="例如: TPE"
                                value={origin}
                                onChange={e => setOrigin(e.target.value)}
                            />
                            <div className="text-xs text-gray-400">目前位置</div>
                         </InputGroup>
                    </div>
                    <div className="flex items-center justify-center text-gray-300">
                        <ArrowRight className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <InputGroup icon={<MapPin />} label="目的地">
                            <input 
                                className="w-full bg-transparent font-bold text-lg outline-none placeholder-gray-300 uppercase" 
                                placeholder="例如: TYO" 
                                value={dest}
                                onChange={e => setDest(e.target.value)}
                            />
                            <div className="text-xs text-gray-400">輸入機場或城市</div>
                        </InputGroup>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <InputGroup icon={<Calendar />} label="出發日期">
                        <IOSDateInput 
                            value={dates.start} 
                            onClick={() => setPickerOpen('start')} 
                            placeholder="選擇去程"
                        />
                    </InputGroup>
                    <InputGroup icon={<Calendar />} label="回程日期">
                         <IOSDateInput 
                            value={dates.end} 
                            onClick={() => setPickerOpen('end')} 
                            placeholder="選擇回程"
                        />
                    </InputGroup>
                </div>

                <InputGroup icon={<Users />} label="乘客人數">
                    <input className="w-full bg-transparent font-medium outline-none" placeholder="1 成人, 經濟艙" />
                </InputGroup>

                <IOSButton fullWidth className="mt-4 shadow-lg shadow-blue-200" onClick={handleSearch}>
                    搜尋航班 (Google)
                </IOSButton>

                <IOSDatePicker 
                    isOpen={pickerOpen !== null}
                    title={pickerOpen === 'start' ? '選擇出發日期' : '選擇回程日期'}
                    onClose={() => setPickerOpen(null)}
                    initialDate={pickerOpen === 'start' ? dates.start : dates.end}
                    onSelect={(d) => setDates(prev => ({ ...prev, [pickerOpen!]: d }))}
                />
            </div>
        </GlassCard>
    );
};

const HotelSearch = () => {
    const [dates, setDates] = useState({ start: '', end: '' });
    const [dest, setDest] = useState('');
    const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);

    const handleSearch = () => {
        if (!dest) {
            alert('請輸入目的地');
            return;
        }
        // Link to Booking.com search
        const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest)}`;
        window.open(url, '_blank');
    };

    return (
        <GlassCard title="預訂住宿" subtitle="尋找舒適的旅途落腳處">
            <div className="space-y-4">
                <InputGroup icon={<Search />} label="目的地">
                    <input 
                        className="w-full bg-transparent font-bold text-lg outline-none placeholder-gray-300" 
                        placeholder="城市、區域或飯店名稱" 
                        value={dest}
                        onChange={e => setDest(e.target.value)}
                    />
                </InputGroup>

                <div className="grid grid-cols-2 gap-3">
                     <InputGroup icon={<Calendar />} label="入住日期">
                         <IOSDateInput 
                            value={dates.start} 
                            onClick={() => setPickerOpen('start')} 
                            placeholder="選擇入住"
                        />
                    </InputGroup>
                    <InputGroup icon={<Calendar />} label="退房日期">
                         <IOSDateInput 
                            value={dates.end} 
                            onClick={() => setPickerOpen('end')} 
                            placeholder="選擇退房"
                        />
                    </InputGroup>
                </div>

                <div className="flex gap-3">
                     <div className="flex-1">
                        <InputGroup icon={<Users />} label="成人">
                             <input type="number" className="w-full bg-transparent font-medium outline-none" placeholder="2" />
                        </InputGroup>
                     </div>
                     <div className="flex-1">
                        <InputGroup icon={<Users />} label="兒童">
                             <input type="number" className="w-full bg-transparent font-medium outline-none" placeholder="0" />
                        </InputGroup>
                     </div>
                </div>
                
                <IOSButton fullWidth className="mt-4 shadow-lg shadow-blue-200" onClick={handleSearch}>
                    搜尋 Booking.com
                </IOSButton>

                <IOSDatePicker 
                    isOpen={pickerOpen !== null}
                    title={pickerOpen === 'start' ? '選擇入住日期' : '選擇退房日期'}
                    onClose={() => setPickerOpen(null)}
                    initialDate={pickerOpen === 'start' ? dates.start : dates.end}
                    onSelect={(d) => setDates(prev => ({ ...prev, [pickerOpen!]: d }))}
                />
            </div>
        </GlassCard>
    );
};

const CarSearch = () => {
    const [dates, setDates] = useState({ start: '', end: '' });
    const [location, setLocation] = useState('');
    const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);

    const handleSearch = () => {
        if (!location) {
             alert('請輸入取車地點');
             return;
        }
        // Link to Google Maps Car Rental search as it handles text queries well
        const url = `https://www.google.com/maps/search/car+rental+in+${encodeURIComponent(location)}`;
        window.open(url, '_blank');
    };

    return (
        <GlassCard title="租車服務" subtitle="自由自在的公路旅行">
            <div className="space-y-4">
                <InputGroup icon={<MapPin />} label="取車地點">
                     <input 
                        className="w-full bg-transparent font-bold text-lg outline-none placeholder-gray-300" 
                        placeholder="機場或城市" 
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                    />
                </InputGroup>

                <div className="grid grid-cols-2 gap-3">
                    <InputGroup icon={<Calendar />} label="取車日期">
                         <IOSDateInput 
                            value={dates.start} 
                            onClick={() => setPickerOpen('start')} 
                            placeholder="選擇取車"
                        />
                    </InputGroup>
                    <InputGroup icon={<Calendar />} label="還車日期">
                         <IOSDateInput 
                            value={dates.end} 
                            onClick={() => setPickerOpen('end')} 
                            placeholder="選擇還車"
                        />
                    </InputGroup>
                </div>
                
                 <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="return-diff" className="rounded text-ios-blue focus:ring-ios-blue" />
                    <label htmlFor="return-diff" className="text-sm text-gray-600">甲地乙還</label>
                </div>

                <IOSButton fullWidth className="mt-4 shadow-lg shadow-blue-200" onClick={handleSearch}>
                    搜尋租車 (Google Maps)
                </IOSButton>

                <IOSDatePicker 
                    isOpen={pickerOpen !== null}
                    title={pickerOpen === 'start' ? '選擇取車日期' : '選擇還車日期'}
                    onClose={() => setPickerOpen(null)}
                    initialDate={pickerOpen === 'start' ? dates.start : dates.end}
                    onSelect={(d) => setDates(prev => ({ ...prev, [pickerOpen!]: d }))}
                />
            </div>
        </GlassCard>
    );
};

const TicketSearch = () => {
    const [keyword, setKeyword] = useState('');

    const handleSearch = (term?: string) => {
        const query = term || keyword;
        if (!query) {
             alert('請輸入關鍵字');
             return;
        }
        // Link to Klook search
        window.open(`https://www.klook.com/zh-TW/search/?text=${encodeURIComponent(query)}`, '_blank');
    };

    return (
        <GlassCard title="活動體驗" subtitle="發掘當地的精彩活動">
            <div className="space-y-5">
                <div className="relative">
                    <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                    <input 
                        placeholder="搜尋景點、樂園、交通卡..." 
                        className="w-full bg-gray-50 border border-gray-100 pl-12 p-4 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">熱門關鍵字</h4>
                    <div className="flex flex-wrap gap-2">
                        {['迪士尼樂園', '環球影城', '和服體驗', '富士山一日遊', '晴空塔', '新幹線'].map(tag => (
                            <button 
                                key={tag} 
                                onClick={() => handleSearch(tag)}
                                className="bg-gray-50 border border-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-ios-blue hover:text-white hover:border-ios-blue hover:shadow-md transition-all duration-200"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-2">
                    <IOSButton fullWidth className="shadow-lg shadow-blue-200" onClick={() => handleSearch()}>
                        探索所有活動 (Klook)
                    </IOSButton>
                </div>
            </div>
        </GlassCard>
    );
};
