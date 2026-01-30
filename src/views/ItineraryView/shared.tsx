import React from 'react';
import { 
    Utensils, Car, Tag as TagIcon, Camera, Bed, Banknote, Bus, Plane, 
    StickyNote, UserCheck, Ticket, Coffee, Pill, Sparkles 
} from 'lucide-react';
import type { Member } from '../../types'; // 請確認 types 的相對路徑是否正確 (../../types.ts)

// --- Constants ---

export const CURRENCY_SYMBOLS = {
    'TWD': 'NT$', 'USD': '$', 'JPY': '¥', 'KRW': '₩', 'EUR': '€', 'CNY': '¥', 'HKD': 'HK$'
} as const;

export const CATEGORIES = [
    { id: 'food', label: '美食', icon: Utensils, tagClass: 'bg-orange-100 text-orange-600 border-orange-200', chartClass: 'bg-orange-500' },
    { id: 'commute', label: '交通費', icon: Car, tagClass: 'bg-blue-100 text-blue-600 border-blue-200', chartClass: 'bg-blue-500' }, 
    { id: 'shopping', label: '購物', icon: TagIcon, tagClass: 'bg-pink-100 text-pink-600 border-pink-200', chartClass: 'bg-pink-500' },
    { id: 'sightseeing', label: '景點', icon: Camera, tagClass: 'bg-indigo-100 text-indigo-600 border-indigo-200', chartClass: 'bg-indigo-500' },
    { id: 'hotel', label: '住宿', icon: Bed, tagClass: 'bg-purple-100 text-purple-600 border-purple-200', chartClass: 'bg-purple-500' },
    { id: 'gift', label: '伴手禮', icon: TagIcon, tagClass: 'bg-rose-100 text-rose-600 border-rose-200', chartClass: 'bg-rose-500' },
    { id: 'bar', label: '酒吧', icon: Utensils, tagClass: 'bg-violet-100 text-violet-600 border-violet-200', chartClass: 'bg-violet-500' },
    { id: 'activity', label: '體驗', icon: Sparkles, tagClass: 'bg-cyan-100 text-cyan-600 border-cyan-200', chartClass: 'bg-cyan-500' },
    { id: 'tickets', label: '票券', icon: Ticket, tagClass: 'bg-sky-100 text-sky-600 border-sky-200', chartClass: 'bg-sky-500' },
    { id: 'snacks', label: '點心', icon: Coffee, tagClass: 'bg-amber-100 text-amber-600 border-amber-200', chartClass: 'bg-amber-500' },
    { id: 'health', label: '藥妝', icon: Pill, tagClass: 'bg-teal-100 text-teal-600 border-teal-200', chartClass: 'bg-teal-500' },
    { id: 'expense', label: '一般支出', icon: Banknote, tagClass: 'bg-green-100 text-green-600 border-green-200', chartClass: 'bg-green-500' },
    { id: 'other', label: '其他', icon: Banknote, tagClass: 'bg-gray-100 text-gray-600 border-gray-200', chartClass: 'bg-gray-400' },
    { id: 'transport', label: '移動', icon: Bus, tagClass: 'bg-gray-100 text-gray-600', chartClass: 'bg-gray-400', isSystem: true }, 
    { id: 'flight', label: '航班', icon: Plane, tagClass: 'bg-emerald-100 text-emerald-600', chartClass: 'bg-emerald-500', isSystem: true },
    { id: 'note', label: '備註', icon: StickyNote, tagClass: 'bg-yellow-100 text-yellow-600', chartClass: 'bg-yellow-500', isSystem: true },
    { id: 'process', label: '程序', icon: UserCheck, tagClass: 'bg-slate-100 text-slate-600', chartClass: 'bg-slate-500', isSystem: true },
];

// --- Helper Functions ---

export const parseCost = (costStr?: string | number): number => {
    if (costStr === undefined || costStr === null || costStr === '') return 0;
    if (typeof costStr === 'number') return costStr;
    const cleanStr = costStr.toString().replace(/,/g, '');
    const match = cleanStr.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
    return 0;
};

export const getMemberName = (members: Member[] | undefined, id?: string) => {
    if (!members || !id) return '我';
    const m = members.find(m => m.id === id);
    return m ? m.name : '我';
};

export const getMemberAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

export const isSystemType = (type: string) => {
    const cat = CATEGORIES.find(c => c.id === type);
    return cat ? !!cat.isSystem : false;
};

// --- Shared Components ---

export const Tag: React.FC<{ type: string }> = ({ type }) => {
    const cat = CATEGORIES.find(c => c.id === type) || CATEGORIES.find(c => c.id === 'other');
    const Icon = cat?.icon || TagIcon;
    const tagClass = cat?.tagClass || 'bg-gray-100 text-gray-600';
    const label = cat?.label || type;

    return (
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1 w-fit ${tagClass} bg-opacity-10 text-opacity-100`}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
};