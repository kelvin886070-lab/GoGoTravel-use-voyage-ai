// src/services/cityEn.ts
// 🖼️ 封面B：城市中→英對照表（fallback 層）。
//   優先序：day.cityEn（生成時 LLM 輸出，涵蓋任何城市）→ 此表（舊資料/手動行程的常見城市）→ 原字（已是拉丁字母）→ null。
//   null＝不硬查（寧素勿錯：中文丟 Pexels 命中率低，寧可用 fallback 底圖）。
const MAP: Record<string, string> = {
    // 台灣
    '台北': 'Taipei', '臺北': 'Taipei', '新北': 'New Taipei', '桃園': 'Taoyuan', '新竹': 'Hsinchu',
    '台中': 'Taichung', '臺中': 'Taichung', '彰化': 'Changhua', '嘉義': 'Chiayi', '台南': 'Tainan',
    '臺南': 'Tainan', '高雄': 'Kaohsiung', '屏東': 'Pingtung', '宜蘭': 'Yilan', '花蓮': 'Hualien',
    '台東': 'Taitung', '臺東': 'Taitung', '澎湖': 'Penghu', '金門': 'Kinmen', '墾丁': 'Kenting', '小琉球': 'Liuqiu',
    // 日本
    '東京': 'Tokyo', '大阪': 'Osaka', '京都': 'Kyoto', '神戶': 'Kobe', '奈良': 'Nara', '橫濱': 'Yokohama',
    '名古屋': 'Nagoya', '札幌': 'Sapporo', '函館': 'Hakodate', '福岡': 'Fukuoka', '沖繩': 'Okinawa',
    '那霸': 'Naha', '廣島': 'Hiroshima', '仙台': 'Sendai', '金澤': 'Kanazawa', '箱根': 'Hakone', '鎌倉': 'Kamakura',
    // 韓國
    '首爾': 'Seoul', '釜山': 'Busan', '濟州': 'Jeju', '濟州島': 'Jeju', '大邱': 'Daegu',
    // 東南亞
    '曼谷': 'Bangkok', '清邁': 'Chiang Mai', '普吉': 'Phuket', '芭達雅': 'Pattaya', '新加坡': 'Singapore',
    '吉隆坡': 'Kuala Lumpur', '峴港': 'Da Nang', '河內': 'Hanoi', '胡志明市': 'Ho Chi Minh City',
    '峇里島': 'Bali', '宿霧': 'Cebu', '馬尼拉': 'Manila',
    // 中港澳
    '香港': 'Hong Kong', '澳門': 'Macau', '上海': 'Shanghai', '北京': 'Beijing', '成都': 'Chengdu',
    // 歐美澳
    '巴黎': 'Paris', '倫敦': 'London', '羅馬': 'Rome', '巴塞隆納': 'Barcelona', '阿姆斯特丹': 'Amsterdam',
    '布拉格': 'Prague', '維也納': 'Vienna', '哈修塔特': 'Hallstatt', '紐約': 'New York', '洛杉磯': 'Los Angeles',
    '舊金山': 'San Francisco', '西雅圖': 'Seattle', '雪梨': 'Sydney', '墨爾本': 'Melbourne', '倫敦市': 'London',
};

/** 城市名 → 英文查詢詞。拉丁字母原樣通過；對照不到回 null（呼叫端負責 fallback）。 */
export function cityToEn(city?: string): string | null {
    const c = (city || '').trim();
    if (!c) return null;
    if (MAP[c]) return MAP[c];
    if (/^[\x20-\x7E]+$/.test(c)) return c;   // 已是 ASCII（英文/拼音）→ 原樣用
    return null;
}
