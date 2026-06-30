// src/utils/pdfUtils.ts

import type { Trip, Activity } from '../types';

// ==========================================
// 🛡️ 第一道防線：資料淨化與格式化
// ==========================================

export const sanitizeTextForPDF = (text?: string): string => {
    if (!text) return '';
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}]/gu;
    return text.replace(emojiRegex, '').replace(/\s+/g, ' ').trim();
};

export const injectZeroWidthSpaces = (text?: string): string => {
    if (!text) return '';
    const cjkRegex = /([\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF])/g;
    return text.replace(cjkRegex, '$1\u200B');
};

export const getSafeDescription = (text?: string): string => {
    return injectZeroWidthSpaces(sanitizeTextForPDF(text));
};

export const truncateText = (text?: string, maxLength: number = 15): string => {
    if (!text) return '';
    const sanitized = sanitizeTextForPDF(text);
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) + '...' : sanitized;
};

export const formatPDFDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '.');
};

// ==========================================
// 🎨 第二道防線：動態色彩與幽靈濾網
// ==========================================

export interface ActivityTheme {
    color: string;
    bgColor: string;
}

// 🪄 Phase B：PDF 類別標籤用「App 裡的中文」（對應 CATEGORIES）。
// 未來做語言切換時，這裡可改成依語系回傳對應語言。
const ACTIVITY_LABELS_ZH: Record<string, string> = {
    food: '美食', commute: '交通費', shopping: '購物', sightseeing: '景點',
    hotel: '住宿', gift: '伴手禮', bar: '酒吧', activity: '體驗', tickets: '票券',
    snacks: '點心', health: '藥妝', expense: '一般支出', other: '其他',
    cafe: '咖啡', relax: '放鬆', culture: '文化',
    transport: '移動', flight: '航班', train: '火車', note: '備註', process: '程序',
};
export const getActivityLabel = (type?: string): string => {
    if (!type) return '其他';
    return ACTIVITY_LABELS_ZH[type.toLowerCase()] || type;
};

export const getActivityTheme = (type: string): ActivityTheme => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
        case 'food':
        case 'snack':
        case 'cafe':
            return { color: '#E07A5F', bgColor: '#FDF3F0' }; 
        case 'transport':
        case 'flight':
        case 'train':
            return { color: '#3D5A80', bgColor: '#F0F4F8' }; 
        case 'shopping':
        case 'souvenir':
            return { color: '#D94A8C', bgColor: '#FDF0F5' }; 
        case 'sightseeing':
        case 'experience':
        case 'culture':
            return { color: '#2A9D8F', bgColor: '#EAF6F5' }; 
        case 'hotel':
            return { color: '#835CA3', bgColor: '#F5F0F8' }; 
        case 'bar':
        case 'relax':
            return { color: '#5F4B8B', bgColor: '#F0EDF5' }; 
        case 'pharmacy':
        case 'ticket':
            return { color: '#5ABCB9', bgColor: '#EFF9F9' }; 
        default:
            return { color: '#45846D', bgColor: '#ECFDF5' }; 
    }
};

export const isSignificantTransport = (act: Activity): boolean => {
    if (act.type !== 'transport' && act.type !== 'flight' && act.type !== 'train') return true;
    if (act.type === 'flight' || act.type === 'train') return true;

    const ghostTitleRegex = /移動|預估/;
    const ghostDescRegex = /系統自動填補|點擊可修改/;

    const isGhostTitle = ghostTitleRegex.test(act.title);
    const descText = act.description?.trim() || '';
    const isGhostDesc = descText === '' || ghostDescRegex.test(descText);
    const hasImage = Boolean(act.expenseImage);

    if (isGhostTitle && isGhostDesc && !hasImage) return false; 
    return true; 
};

// ==========================================
// 🧬 第三道防線：7.0 智慧資料萃取引擎 (已移除舊版 getDailyVibe)
// ==========================================

export const getTripStats = (trip: Trip) => {
    const totalDays = trip.days.length;
    return { totalDays };
};

// 🪄 旅程數據頁：景點 / 美食 / 照片數
export const getTripCounts = (trip: Trip) => {
    let spots = 0, foods = 0, photos = 0;
    trip.days.forEach(d => d.activities.forEach(a => {
        const t = (a.type || '').toLowerCase();
        if (t === 'sightseeing' || t === 'culture') spots++;
        if (t === 'food' || t === 'cafe' || t === 'snacks') foods++;
        if (a.expenseImage) photos++;
    }));
    return { spots, foods, photos };
};

/**
 * 💰 7.0 新增：花費加總計算機 (防禦型)
 */
export const getTripTotalCost = (trip: Trip, currencyCode: string = 'TWD'): string => {
    let total = 0;
    
    trip.days.forEach(day => {
        day.activities.forEach(act => {
            if (act.cost !== undefined && act.cost !== null) {
                if (typeof act.cost === 'number') {
                    total += act.cost;
                } else if (typeof act.cost === 'string') {
                    // 防禦：拔除所有非數字、非小數點的字元
                    const numericString = act.cost.replace(/[^\d.-]/g, '');
                    if (numericString) {
                        const parsed = parseFloat(numericString);
                        if (!isNaN(parsed)) {
                            total += parsed;
                        }
                    }
                }
            }
        });
    });

    // 若完全沒有花費，優雅地回傳尚未估算
    if (total === 0) return '尚未估算';

    // 格式化：帶上幣別與千分位逗號
    return `${currencyCode} ${total.toLocaleString()}`;
};

/**
 * 🧬 7.0 更新：拔除 Emoji，回歸純粹的高級感排版
 */
export const getTripDNA = (trip: Trip): string => {
    const counts: Record<string, { count: number; label: string }> = {
        food: { count: 0, label: '頓美食尋味' },
        sightseeing: { count: 0, label: '個景點探索' },
        culture: { count: 0, label: '趟文化巡禮' },
        shopping: { count: 0, label: '次都會血拼' },
        bar: { count: 0, label: '場微醺放鬆' }
    };

    trip.days.forEach(day => {
        day.activities.forEach(act => {
            const type = act.type.toLowerCase();
            if (type === 'food' || type === 'snack' || type === 'cafe') counts.food.count++;
            else if (type === 'sightseeing' || type === 'experience') counts.sightseeing.count++;
            else if (type === 'culture') counts.culture.count++;
            else if (type === 'shopping' || type === 'souvenir') counts.shopping.count++;
            else if (type === 'bar' || type === 'relax') counts.bar.count++;
        });
    });

    const sortedDNA = Object.values(counts)
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    if (sortedDNA.length === 0) return '探索未知的驚喜旅程';
    return sortedDNA.map(dna => `${dna.count} ${dna.label}`).join(' ｜ ');
};

export const getFeaturedHotels = (trip: Trip): Activity[] => {
    return trip.days.flatMap(d => d.activities).filter(a => a.type === 'hotel');
};

export const getFeaturedTransports = (trip: Trip): Activity[] => {
    return trip.days.flatMap(d => d.activities).filter(a => (a.type === 'flight' || a.type === 'train') && isSignificantTransport(a));
};

export interface GalleryImage {
    url: string;
    caption: string;
    day: number;
    positionY: number; // 使用者在 App 拖曳調整的 Y 軸裁切位置
}

export const getGalleryImages = (trip: Trip): GalleryImage[] => {
    const images: GalleryImage[] = [];
    trip.days.forEach(day => {
        day.activities.forEach(act => {
            if (act.expenseImage) {
                images.push({
                    url: act.expenseImage,
                    caption: sanitizeTextForPDF(act.title),
                    day: day.day,
                    positionY: act.imagePositionY ?? 50
                });
            }
        });
    });
    return images;
};