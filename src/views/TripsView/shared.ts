import { ShoppingBag, Utensils, Camera, Sparkles, Landmark } from 'lucide-react';

export const CURRENCIES = [
    { code: 'TWD', label: '新台幣' }, 
    { code: 'JPY', label: '日圓' }, 
    { code: 'USD', label: '美元' }, 
    { code: 'KRW', label: '韓元' }, 
    { code: 'CNY', label: '人民幣' }, 
    { code: 'EUR', label: '歐元' }
];

export const INTEREST_DATA: Record<string, { label: string, icon: any, tags: string[] }> = {
    shopping: { label: '購物', icon: ShoppingBag, tags: ['藥妝/美妝', '精品/百貨', 'Outlet', '伴手禮', '文創/雜貨', '古著/二手', '電器/3C'] },
    food: { label: '美食', icon: Utensils, tags: ['拉麵/沾麵', '燒肉/烤肉', '壽司/海鮮', '甜點/咖啡', '居酒屋', '路邊攤', '米其林'] },
    sightseeing: { label: '景點', icon: Camera, tags: ['IG打卡點', '歷史古蹟', '自然風景', '主題樂園', '美術館', '展望台', '動物園'] },
    relax: { label: '放鬆', icon: Sparkles, tags: ['溫泉/SPA', '按摩', '公園漫步', '遊船', '夜景', '海邊'] },
    culture: { label: '文化', icon: Landmark, tags: ['神社/寺廟', '傳統體驗', '祭典活動', '在地市集', '博物館'] },
};