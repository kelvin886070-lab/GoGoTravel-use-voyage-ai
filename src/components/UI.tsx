import React, { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Copy, MessageCircle } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const IOSButton: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', fullWidth, isLoading, className = '', ...props 
}) => {
  const baseStyles = "active:scale-95 transition-transform duration-200 font-semibold text-[17px] py-3 px-6 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100";
  const variants = {
    primary: "bg-ios-blue text-white shadow-sm hover:brightness-110",
    secondary: "bg-white text-ios-blue shadow-sm hover:bg-gray-50",
    ghost: "bg-transparent text-ios-blue hover:bg-gray-100/50",
    danger: "bg-ios-red text-white shadow-sm hover:brightness-110"
  };
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className} ${isLoading ? 'opacity-80' : ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin w-5 h-5" />}
      {children}
    </button>
  );
};

export const IOSIconButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => (
    <button 
        className={`w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors ${className}`} 
        {...props}
    >
        {children}
    </button>
);

export const IOSCard: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-ios-card rounded-2xl shadow-sm p-5 ${className}`}>
    {title && <h3 className="text-lg font-semibold mb-3 text-gray-900">{title}</h3>}
    {children}
  </div>
);

export const IOSInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    // 修正 1: 加上 text-base (16px)，防止 iOS Safari 在輸入時自動放大畫面
    className="w-full bg-ios-bg p-4 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 transition-all text-base"
    {...props}
  />
);

export const IOSHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="pt-12 pb-4 px-5 bg-ios-bg/80 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-end border-b border-gray-200/50">
    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
    {action}
  </div>
);

// --- Share Sheet ---

interface IOSShareSheetProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
}

export const IOSShareSheet: React.FC<IOSShareSheetProps> = ({ isOpen, onClose, url, title }) => {
    const [copied, setCopied] = useState(false);
    
    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            onClose();
        }, 1500);
    };

    const handleLineShare = () => {
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(title + '\n' + url)}`;
        window.location.href = lineUrl;
        onClose();
    };

    return (
        <>
             {/* 修正 2: 提高 z-index 到 60，確保覆蓋在 TabBar 之上 */}
             <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose} style={{ touchAction: 'none' }} />
             <div className="fixed bottom-0 left-0 right-0 bg-gray-100 rounded-t-3xl z-[60] pb-safe animate-in slide-in-from-bottom duration-300 max-w-md mx-auto overflow-hidden">
                <div className="p-4 flex gap-4 overflow-x-auto no-scrollbar bg-white/50 backdrop-blur-md m-4 rounded-2xl border border-white/50">
                     <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer" onClick={handleLineShare}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" className="w-14 h-14 rounded-xl shadow-sm" alt="LINE" />
                        <span className="text-[10px] font-medium text-gray-600">LINE</span>
                    </div>
                     {/* Fake AirDrop */}
                     <div className="flex flex-col items-center gap-2 min-w-[70px] opacity-50 grayscale">
                        <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center">
                             <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-blue-500"></div>
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-600">AirDrop</span>
                    </div>
                </div>

                <div className="mx-4 mb-2 bg-white/80 backdrop-blur-xl rounded-xl overflow-hidden divide-y divide-gray-200/50">
                     <button onClick={handleCopy} className="w-full p-4 flex items-center justify-between active:bg-gray-200 transition-colors">
                        <span className="font-medium text-gray-900">複製連結</span>
                        <Copy className="w-5 h-5 text-gray-500" />
                    </button>
                      <button onClick={handleLineShare} className="w-full p-4 flex items-center justify-between active:bg-gray-200 transition-colors">
                        <span className="font-medium text-gray-900">分享至 LINE</span>
                        <MessageCircle className="w-5 h-5 text-green-500" />
                    </button>
                 </div>

                <div className="mx-4 mb-6">
                     <button onClick={onClose} className="w-full bg-white font-bold text-ios-blue py-3 rounded-xl active:bg-gray-200 transition-colors">
                        取消
                      </button>
                </div>

                {copied && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/75 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md animate-in fade-in zoom-in">
                        已複製連結
                    </div>
                )}
             </div>
        </>
    );
};

// --- New Components for Date Picking ---

interface IOSDateInputProps {
    value: string;
    onClick: () => void;
    placeholder?: string;
    className?: string;
}

export const IOSDateInput: React.FC<IOSDateInputProps> = ({ value, onClick, placeholder = '選擇日期', className = '' }) => (
    <div 
        onClick={onClick}
        className={`w-full bg-transparent cursor-pointer py-1 ${className}`}
    >
        {value ? (
            <span className="text-sm font-medium text-gray-700">{value}</span>
        ) : (
            <span className="text-sm font-medium text-gray-400">{placeholder}</span>
        )}
    </div>
);

interface IOSDatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (date: string) => void;
    title?: string;
    initialDate?: string;
}

export const IOSDatePicker: React.FC<IOSDatePickerProps> = ({ isOpen, onClose, onSelect, title = "選擇日期", initialDate }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || '');

    useEffect(() => {
        if (isOpen) {
            if (initialDate) {
                setViewDate(new Date(initialDate));
                setSelectedDate(initialDate);
            } else {
                 setViewDate(new Date());
            }
        }
    }, [isOpen, initialDate]);

    if (!isOpen) return null;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));
    
    const handleDayClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelectedDate(dateStr);
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
        return sYear === year && sMonth === month + 1 && sDay === day;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    };
    
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
        <>
            {/* 修正 3: 提高 z-index 到 60，與 ShareSheet 一致 */}
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose} style={{ touchAction: 'none' }} />
            
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[60] pb-safe animate-in slide-in-from-bottom duration-300 shadow-2xl overflow-hidden max-w-md mx-auto">
                 {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <button onClick={onClose} className="text-gray-500 p-2 rounded-full hover:bg-gray-100">
                        取消
                    </button>
                    <span className="font-bold text-lg text-gray-900">{title}</span>
                    <button onClick={() => { if(selectedDate) onSelect(selectedDate); onClose(); }} className="text-ios-blue font-bold p-2">
                        完成
                    </button>
                </div>

                {/* Calendar Controls */}
                <div className="p-4">
                    <div className="flex justify-between items-center mb-6">
                         <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-lg font-bold text-gray-800">
                             {year}年 {month + 1}月
                        </span>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                             <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 mb-2">
                         {weekDays.map(d => (
                            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                     <div className="grid grid-cols-7 gap-y-2">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const selected = isSelected(day);
                            const today = isToday(day);
                            
                            return (
                                <div key={day} className="flex justify-center">
                                    <button
                                         onClick={() => handleDayClick(day)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200
                                             ${selected 
                                                ? 'bg-ios-blue text-white shadow-md scale-105' 
                                                : 'text-gray-900 hover:bg-gray-100 active:scale-95'
                                            }
                                            ${today && !selected ? 'text-ios-blue font-bold bg-blue-50' : ''}
                                        `}
                                    >
                                         {day}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="h-8"></div> {/* Bottom Spacer */}
            </div>
        </>
    );
};

// --- Made By Footer ---

export const MadeByFooter: React.FC = () => (
  <div className="w-full py-8 flex flex-col items-center justify-center opacity-40 select-none">
    <div className="w-12 h-px bg-gray-400 mb-4"></div>
    <span className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">
      Made by Kelvin
    </span>
  </div>
);