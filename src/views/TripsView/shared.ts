import { ShoppingBag, Utensils, TreePine, Camera, Coffee, Music, Building } from 'lucide-react';

// ============================================================================
// 1. 共用靜態資料 (Interests & Currencies)
// ============================================================================
export const INTEREST_DATA = {
    shopping: { 
        icon: ShoppingBag, 
        label: '質感選物', 
        tags: ['風格概念店', '國際一線精品', '在地特色市集', '獨立設計師品牌', '質感伴手禮', '大型 Outlet'] 
    },
    food: { 
        icon: Utensils, 
        label: '舌尖饗宴', 
        tags: ['米其林摘星', '視覺系景觀餐廳', '在地人氣小吃', '頂級海鮮盛宴', '傳統文化料理', '網美咖啡與甜點'] 
    },
    nature: { 
        icon: TreePine, 
        label: '探索自然', 
        tags: ['絕美秘境探索', '壯麗國家公園', '海島水上活動', '輕奢露營 Glamping', '冬季滑雪', '山林健行步道'] 
    },
    photo: { 
        icon: Camera, 
        label: '視覺探索', 
        tags: ['地標級美景', '電影與MV取景地', '絕美天際夜景', '特色風格建築', '當地人文街拍', '隱藏版視角'] 
    },
    culture: { 
        icon: Building, 
        label: '人文薈萃', 
        tags: ['世界遺產巡禮', '百年古城漫遊', '當代藝術展覽', '宗教與神廟建築', '在地深度體驗', '國家級博物館'] 
    },
    relax: { 
        icon: Coffee, 
        label: '奢華療癒', 
        tags: ['無邊際泳池', '頂級溫泉SPA', '奢華渡假村', '身心靈瑜珈', '海島發呆亭', '在地傳統按摩'] 
    },
    entertainment: { 
        icon: Music, 
        label: '沉浸娛樂', 
        tags: ['國際主題樂園', '高空酒吧與微醺', '音樂祭與演唱會', '熱血運動賽事', '豪華賭場體驗', '沉浸式劇場'] 
    },
};

export const CURRENCIES = [
    { code: 'TWD', label: '新台幣' }, { code: 'JPY', label: '日圓' },
    { code: 'KRW', label: '韓元' }, { code: 'USD', label: '美金' },
    { code: 'EUR', label: '歐元' }, { code: 'THB', label: '泰銖' },
    { code: 'CNY', label: '人民幣' }
];

// （2026-08-01 生成表單重設計・戰略性刪除）DESTINATION_DICTIONARY 靈感辭典已移除：
//   ①「熱門靈感/路線卡」＝旅行社型錄語言，與受眾定義（反大眾套裝）正面衝突，且新入口以心願盒三層櫥窗取代通用靈感；
//   ②順遊建議與玩法標籤改由「目的地感知 LLM＋按城市全域快取」承接（批C 定案），無限覆蓋、零策展債。
