import { ShoppingBag, Utensils, TreePine, Camera, Sparkles, Coffee, Music, Building } from 'lucide-react';

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

// ============================================================================
// 2. 靈感推薦引擎資料庫 (Destination Inspiration Dictionary)
// 公式：[國家中文, 國家英文, 區域中文, 城市中文, 城市英文, 核心地標/俗稱]
// ============================================================================

export interface DestinationNode {
    id: string;
    type: 'route' | 'city';  
    title: string;           
    subtitle: string;        
    keywords: string[];      
    dna: string[];           
    validMonths?: number[];  
    connectsWith?: string[]; 
}

export const DESTINATION_DICTIONARY: Record<'domestic' | 'international', DestinationNode[]> = {
    // ------------------------------------------------------------------------
    // 🇹🇼 國內旅遊 (Domestic) - LOCAL GEMS
    // ------------------------------------------------------------------------
    domestic: [
        // --- 📍 國內經典路線 (Route) ---
        { id: "tw-r-north", type: 'route', title: "📍 北部都會與近郊線", subtitle: "台北・新北・基隆｜夜景地標與老街海港", keywords: ["台灣", "taiwan", "北部", "台北", "新北", "基隆", "九份", "淡水", "野柳", "平溪"], dna: ["都會繁華", "夜市小吃", "大眾運輸便利"], connectsWith: ["宜蘭"] },
        { id: "tw-r-hakka", type: 'route', title: "📍 桃竹苗山林客庄線", subtitle: "桃園・新竹・苗栗｜老街鐵道與自然避暑", keywords: ["台灣", "taiwan", "桃園", "新竹", "苗栗", "大溪", "內灣", "南庄", "拉拉山"], dna: ["客家文化", "山林療癒", "老街漫遊", "自駕友善"], connectsWith: ["台中"] },
        { id: "tw-r-central", type: 'route', title: "📍 中部都會與濕地線", subtitle: "台中・彰化・雲林｜夜市王者與歷史古蹟", keywords: ["台灣", "taiwan", "中部", "台中", "彰化", "雲林", "逢甲", "高美濕地", "鹿港", "北港"], dna: ["在地美食", "宗教文化", "網美打卡", "夜市"], connectsWith: ["南投"] },
        { id: "tw-r-alishan", type: 'route', title: "📍 高山茶園與神木線", subtitle: "嘉義・南投｜阿里山日出與日月潭湖景", keywords: ["台灣", "taiwan", "南投", "嘉義", "阿里山", "日月潭", "清境", "溪頭"], dna: ["自然絕景", "森林療癒", "長輩友善", "慢活茶園"], connectsWith: ["台南"] },
        { id: "tw-r-south", type: 'route', title: "📍 南部雙城古都線", subtitle: "台南・高雄｜歷史古蹟與海港風情", keywords: ["台灣", "taiwan", "南部", "台南", "高雄", "安平", "駁二", "愛河", "西子灣", "奇美博物館"], dna: ["歷史人文", "在地美食", "海港景觀"], connectsWith: ["屏東"] },
        { id: "tw-r-kenting", type: 'route', title: "📍 國境之南度假線", subtitle: "屏東・墾丁・小琉球｜絕美海灘與浮潛", keywords: ["台灣", "taiwan", "屏東", "墾丁", "小琉球", "恆春", "海生館"], dna: ["海島度假", "水上活動", "陽光沙灘"], connectsWith: ["台東", "高雄"] },
        { id: "tw-r-east", type: 'route', title: "📍 花東縱谷與海岸線", subtitle: "花蓮・台東｜太魯閣峽谷與稻浪絕景", keywords: ["台灣", "taiwan", "東部", "花蓮", "台東", "太魯閣", "鹿野", "池上", "伯朗大道"], dna: ["大自然", "壯麗峽谷", "原住民文化", "慢活"], connectsWith: ["宜蘭", "綠島"] },
        
        // --- 🏙️ 國內城市單點 (City) ---
        { id: "tw-c-tpe", type: 'city', title: "🏙️ 台北 (Taipei)", subtitle: "高端購物、夜景地標與文青街區", keywords: ["台灣", "taiwan", "台北", "taipei", "信義區", "西門町", "士林", "北投", "大安", "中山", "大稻埕", "台北101"], dna: ["都會繁華", "購物天堂", "歷史街區"] },
        { id: "tw-c-ntpc", type: 'city', title: "🚂 新北 (New Taipei)", subtitle: "九份山城、淡水夕陽與平溪天燈", keywords: ["台灣", "taiwan", "新北", "new taipei", "瑞芳", "九份", "淡水", "野柳", "平溪", "十分", "烏來", "三峽"], dna: ["老街文化", "自然奇景", "鐵道風情"] },
        { id: "tw-c-kee", type: 'city', title: "🚢 基隆 (Keelung)", subtitle: "廟口夜市、和平島與彩色漁港", keywords: ["台灣", "taiwan", "基隆", "keelung", "廟口夜市", "和平島", "正濱漁港", "外木山"], dna: ["海港城市", "夜市美食", "雨都"] },
        { id: "tw-c-tyg", type: 'city', title: "✈️ 桃園 (Taoyuan)", subtitle: "大溪老街、拉拉山與石門水庫", keywords: ["台灣", "taiwan", "桃園", "taoyuan", "大溪", "復興", "拉拉山", "龍潭", "石門水庫", "中壢", "龜山", "outlet"], dna: ["自然山林", "老街小吃", "購物"] },
        { id: "tw-c-hsz", type: 'city', title: "🎐 新竹 (Hsinchu)", subtitle: "城隍廟小吃、內灣老街與山林露營", keywords: ["台灣", "taiwan", "新竹", "hsinchu", "城隍廟", "竹北", "橫山", "內灣", "五峰"], dna: ["廟口文化", "科技城", "山林露營"] },
        { id: "tw-c-mia", type: 'city', title: "🌸 苗栗 (Miaoli)", subtitle: "南庄客家風情、三義木雕與草莓季", keywords: ["台灣", "taiwan", "苗栗", "miaoli", "南庄", "三義", "大湖", "木雕", "草莓"], dna: ["客家文化", "農野體驗", "慢活"] },
        { id: "tw-c-txg", type: 'city', title: "☀️ 台中 (Taichung)", subtitle: "逢甲夜市、文創設計與高美濕地夕陽", keywords: ["台灣", "taiwan", "台中", "taichung", "西屯", "逢甲夜市", "一中街", "草悟道", "高美濕地", "麗寶樂園"], dna: ["美食夜市", "文創藝術", "網美打卡"] },
        { id: "tw-c-cha", type: 'city', title: "⛩️ 彰化 (Changhua)", subtitle: "八卦山大佛、鹿港古蹟與海牛文化", keywords: ["台灣", "taiwan", "彰化", "changhua", "八卦山", "鹿港", "芳苑", "大佛"], dna: ["歷史古蹟", "傳統文化", "宗教信仰"] },
        { id: "tw-c-yun", type: 'city', title: "🎪 雲林 (Yunlin)", subtitle: "北港朝天宮、古坑咖啡與在地生活", keywords: ["台灣", "taiwan", "雲林", "yunlin", "北港", "斗六", "古坑", "劍湖山"], dna: ["宗教文化", "農莊咖啡", "遊樂園"] },
        { id: "tw-c-nan", type: 'city', title: "⛰️ 南投 (Nantou)", subtitle: "日月潭湖景、清境農場與溪頭森林", keywords: ["台灣", "taiwan", "南投", "nantou", "魚池", "日月潭", "仁愛", "清境", "溪頭", "竹山", "埔里"], dna: ["自然絕景", "高山農場", "森林療癒"] },
        { id: "tw-c-chy", type: 'city', title: "🌲 嘉義 (Chiayi)", subtitle: "阿里山日出、神木與火雞肉飯", keywords: ["台灣", "taiwan", "嘉義", "chiayi", "雞肉飯", "阿里山", "民雄"], dna: ["高山森林", "鐵道日出", "在地美食"] },
        { id: "tw-c-tnn", type: 'city', title: "🏯 台南 (Tainan)", subtitle: "百年古蹟、文創巷弄與在地美食", keywords: ["台灣", "taiwan", "台南", "tainan", "中西區", "安平", "花園夜市", "奇美博物館"], dna: ["歷史古都", "巷弄美食", "文創"] },
        { id: "tw-c-khh", type: 'city', title: "🚢 高雄 (Kaohsiung)", subtitle: "駁二特區、西子灣海景與愛河夜景", keywords: ["台灣", "taiwan", "高雄", "kaohsiung", "鹽埕", "駁二", "西子灣", "旗津", "愛河", "蓮池潭"], dna: ["海港景觀", "藝文特區", "都會夜景"] },
        { id: "tw-c-pif", type: 'city', title: "🏖️ 屏東 (Pingtung)", subtitle: "墾丁海灘、海生館與東港海鮮", keywords: ["台灣", "taiwan", "屏東", "pingtung", "恆春", "墾丁", "東港", "海生館"], dna: ["陽光沙灘", "海鮮美食", "熱帶風情"] },
        { id: "tw-c-iln", type: 'city', title: "♨️ 宜蘭 (Yilan)", subtitle: "礁溪溫泉、羅東夜市與自然農場", keywords: ["台灣", "taiwan", "宜蘭", "yilan", "礁溪", "羅東", "冬山", "龜山島"], dna: ["溫泉SPA", "親子友善", "自然風光"] },
        { id: "tw-c-hun", type: 'city', title: "🌊 花蓮 (Hualien)", subtitle: "太魯閣峽谷、原民文化與無敵海景", keywords: ["台灣", "taiwan", "花蓮", "hualien", "太魯閣", "七星潭", "新城", "東大門夜市"], dna: ["壯麗自然", "原民文化", "海岸線"] },
        { id: "tw-c-ttt", type: 'city', title: "🎈 台東 (Taitung)", subtitle: "鹿野熱氣球、池上稻浪與慢活", keywords: ["台灣", "taiwan", "台東", "taitung", "鹿野", "熱氣球", "池上", "伯朗大道"], dna: ["慢活純淨", "田園風光", "大自然"] },
        
        // --- 🏝️ 國內離島單點 (Islands) ---
        { id: "tw-c-penghu", type: 'city', title: "🎆 澎湖 (Penghu)", subtitle: "花火節、雙心石滬與吉貝沙灘", keywords: ["台灣", "taiwan", "離島", "澎湖", "penghu", "馬公", "跨海大橋", "七美", "雙心石滬", "吉貝"], dna: ["海島度假", "水上活動", "機車環島"], validMonths: [4, 5, 6, 7, 8, 9] },
        { id: "tw-c-kinmen", type: 'city', title: "🏰 金門 (Kinmen)", subtitle: "閩南古厝、戰地風情與太湖", keywords: ["台灣", "taiwan", "離島", "金門", "kinmen", "金城", "太湖", "沙美老街", "小金門"], dna: ["歷史遺跡", "戰地風光", "閩南建築"] },
        { id: "tw-c-matsu", type: 'city', title: "🌌 馬祖 (Matsu)", subtitle: "藍眼淚、芹壁石屋與軍事秘境", keywords: ["台灣", "taiwan", "離島", "馬祖", "matsu", "南竿", "北竿", "芹壁", "東引", "藍眼淚"], dna: ["自然奇景", "閩東建築", "慢活"], validMonths: [4, 5, 6, 7] },
        { id: "tw-c-liuqiu", type: 'city', title: "🐢 小琉球 (Xiaoliuqiu)", subtitle: "海龜共游、花瓶岩與珊瑚礁", keywords: ["台灣", "taiwan", "離島", "小琉球", "liuqiu", "花瓶岩", "美人洞", "蛤板灣", "浮潛"], dna: ["潛水浮潛", "生態保育", "海島度假"] },
        { id: "tw-c-green", type: 'city', title: "🤿 綠島 (Green Island)", subtitle: "潛水天堂、朝日溫泉與燈塔", keywords: ["台灣", "taiwan", "離島", "綠島", "green island", "朝日溫泉", "綠島燈塔", "潛水"], dna: ["海底世界", "天然溫泉", "機車環島"] },
        { id: "tw-c-orchid", type: 'city', title: "🛶 蘭嶼 (Orchid Island)", subtitle: "達悟族文化、拼板舟與純淨海洋", keywords: ["台灣", "taiwan", "離島", "蘭嶼", "orchid island", "野銀部落", "東清灣", "情人洞", "達悟族"], dna: ["原住民文化", "純淨大自然", "深度體驗"] }
    ],

    // ------------------------------------------------------------------------
    // ✈️ 國外旅遊 (International) - 涵蓋全球路線與上百個城市地標
    // ------------------------------------------------------------------------
    international: [
        // ================== 🌍 經典路線大卡片 (Route) ==================
        // 日本
        { id: "intl-jp-r-keihanshin", type: 'route', title: "🇯🇵 京阪神經典線", subtitle: "京都・大阪・神戶｜經典文化線", keywords: ["日本", "japan", "jp", "關西", "大阪", "京都", "神戶"], dna: ["文化古蹟", "美食購物", "交通便利"], connectsWith: ["奈良", "宇治"] },
        { id: "intl-jp-r-kanto", type: 'route', title: "🇯🇵 關東絕景線", subtitle: "東京・箱根・富士山・鎌倉", keywords: ["日本", "japan", "jp", "關東", "東京", "箱根", "富士山", "鎌倉"], dna: ["都會繁華", "溫泉", "自然絕景"], connectsWith: ["橫濱", "輕井澤"] },
        { id: "intl-jp-r-hokkaido", type: 'route', title: "🇯🇵 北海道道央線", subtitle: "札幌・小樽・函館・富良野", keywords: ["日本", "japan", "jp", "北海道", "札幌", "小樽", "函館", "富良野"], dna: ["大自然", "自駕遊", "雪景", "花海"], connectsWith: ["美瑛"] },
        { id: "intl-jp-r-okinawa", type: 'route', title: "🇯🇵 沖繩跳島度假線", subtitle: "那霸・恩納村・石垣島", keywords: ["日本", "japan", "jp", "沖繩", "那霸", "恩納村", "石垣島"], dna: ["海島度假", "自駕遊", "親子友善"], connectsWith: ["宮古島"] },
        { id: "intl-jp-r-hokuriku", type: 'route', title: "🇯🇵 北陸童話雪景線", subtitle: "名古屋・白川鄉・立山黑部｜雪景與點燈", keywords: ["日本", "japan", "jp", "北陸", "名古屋", "白川鄉", "立山黑部", "合掌村"], dna: ["自然絕景", "傳統聚落", "雪景", "溫泉"], validMonths: [12, 1, 2], connectsWith: ["金澤", "高山"] },
        { id: "intl-jp-r-kyushu-n", type: 'route', title: "🇯🇵 北九州溫泉線", subtitle: "福岡・由布院・別府｜療癒之湯", keywords: ["日本", "japan", "jp", "九州", "福岡", "由布院", "別府", "溫泉"], dna: ["溫泉療癒", "特色鐵道", "美食"], connectsWith: ["熊本"] },
        { id: "intl-jp-r-tohoku", type: 'route', title: "🇯🇵 東北賞楓秘湯線", subtitle: "仙台・松島・山形・藏王", keywords: ["日本", "japan", "jp", "東北", "仙台", "松島", "山形", "藏王", "賞楓"], dna: ["自然景觀", "溫泉秘境", "紅葉"], validMonths: [9, 10, 11], connectsWith: ["青森", "秋田"] },
        { id: "intl-jp-r-kyushu-all", type: 'route', title: "🇯🇵 九州全覽線", subtitle: "福岡・熊本・鹿兒島・宮崎", keywords: ["日本", "japan", "jp", "九州", "福岡", "熊本", "鹿兒島", "宮崎"], dna: ["火山景觀", "溫泉", "特色鐵道"], connectsWith: ["長崎"] },
        { id: "intl-jp-r-shikoku", type: 'route', title: "🇯🇵 四國秘境線", subtitle: "高松・德島・高知・松山", keywords: ["日本", "japan", "jp", "四國", "高松", "德島", "高知", "松山"], dna: ["秘境探險", "藝術祭", "歷史古蹟"], connectsWith: ["岡山"] },
        // 韓國
        { id: "intl-kr-r-seoul", type: 'route', title: "🇰🇷 首爾與近郊線", subtitle: "首爾・南怡島・江陵", keywords: ["韓國", "korea", "kr", "首爾", "南怡島", "江陵"], dna: ["流行文化", "購物", "咖啡廳"], connectsWith: ["仁川"] },
        { id: "intl-kr-r-busan", type: 'route', title: "🇰🇷 東南歷史海景線", subtitle: "釜山・慶州", keywords: ["韓國", "korea", "kr", "釜山", "慶州"], dna: ["海景", "歷史古蹟", "海鮮"], connectsWith: ["大邱"] },
        { id: "intl-kr-r-jeju", type: 'route', title: "🇰🇷 濟州環島度假線", subtitle: "濟州全島", keywords: ["韓國", "korea", "kr", "濟州島"], dna: ["自然景觀", "度假", "自駕遊"], connectsWith: ["首爾"] },
        { id: "intl-kr-r-ktx", type: 'route', title: "🇰🇷 首爾釜山雙城線", subtitle: "首爾・釜山｜KTX高鐵串聯", keywords: ["韓國", "korea", "kr", "首爾", "釜山", "KTX"], dna: ["雙城遊", "高效率移動", "多元體驗"], connectsWith: ["慶州"] },
        { id: "intl-kr-r-ski", type: 'route', title: "🇰🇷 韓國極致滑雪線", subtitle: "首爾・江原道", keywords: ["韓國", "korea", "kr", "首爾", "江原道", "滑雪"], dna: ["冬季運動", "雪景", "度假村"], validMonths: [12, 1, 2], connectsWith: ["南怡島"] },
        // 泰國
        { id: "intl-th-r-bkk-pat", type: 'route', title: "🇹🇭 曼谷芭達雅線", subtitle: "曼谷・芭達雅｜都會與海灘", keywords: ["泰國", "thailand", "th", "曼谷", "芭達雅"], dna: ["夜生活", "平價奢華", "海灘度假"], connectsWith: ["華欣"] },
        { id: "intl-th-r-north", type: 'route', title: "🇹🇭 泰北群山古城線", subtitle: "清邁・清萊", keywords: ["泰國", "thailand", "th", "清邁", "清萊", "泰北"], dna: ["歷史古城", "文青咖啡", "大自然"], connectsWith: ["拜縣"] },
        { id: "intl-th-r-south", type: 'route', title: "🇹🇭 南部跳島度假線", subtitle: "普吉島・喀比・皮皮島", keywords: ["泰國", "thailand", "th", "普吉島", "喀比", "皮皮島"], dna: ["海島度假", "水上活動", "潛水"], connectsWith: ["攀牙灣"] },
        { id: "intl-th-r-bkk-hua", type: 'route', title: "🇹🇭 曼谷與皇室避暑線", subtitle: "曼谷・華欣", keywords: ["泰國", "thailand", "th", "曼谷", "華欣"], dna: ["奢華渡假", "親子友善", "文創市集"], connectsWith: ["大城"] },
        { id: "intl-th-r-samui", type: 'route', title: "🇹🇭 深度海島秘境線", subtitle: "蘇梅島・帕岸島・龜島", keywords: ["泰國", "thailand", "th", "蘇梅島", "帕岸島", "龜島"], dna: ["頂級Villa", "滿月派對", "潛水天堂"], connectsWith: ["曼谷"] },
        // 越南
        { id: "intl-vn-r-central", type: 'route', title: "🇻🇳 中越經典線", subtitle: "峴港・會安・順化", keywords: ["越南", "vietnam", "vn", "中越", "峴港", "會安", "順化"], dna: ["世界遺產", "法式風情", "海灘"], connectsWith: ["巴拿山"] },
        { id: "intl-vn-r-north", type: 'route', title: "🇻🇳 北越下龍灣線", subtitle: "河內・下龍灣・沙壩", keywords: ["越南", "vietnam", "vn", "北越", "河內", "下龍灣", "沙壩"], dna: ["自然奇景", "歷史文化", "高山梯田"], connectsWith: ["寧平"] },
        { id: "intl-vn-r-south", type: 'route', title: "🇻🇳 南越法式風情線", subtitle: "胡志明市・美奈", keywords: ["越南", "vietnam", "vn", "南越", "胡志明市", "美奈"], dna: ["法式建築", "沙漠地形", "咖啡文化"], connectsWith: ["大叻"] },
        { id: "intl-vn-r-phuquoc", type: 'route', title: "🇻🇳 富國島度假線", subtitle: "富國島 (免簽單點)", keywords: ["越南", "vietnam", "vn", "富國島"], dna: ["海島度假", "主題樂園", "夕陽沙灘"], connectsWith: ["胡志明市"] },
        // 中國
        { id: "intl-cn-r-jiangnan", type: 'route', title: "🇨🇳 江南水鄉線", subtitle: "上海・杭州・蘇州", keywords: ["中國", "china", "cn", "上海", "杭州", "蘇州", "江南"], dna: ["都會繁華", "歷史人文", "古典園林"], connectsWith: ["南京"] },
        { id: "intl-cn-r-history", type: 'route', title: "🇨🇳 歷史古都線", subtitle: "北京・西安", keywords: ["中國", "china", "cn", "北京", "西安"], dna: ["世界遺產", "壯麗古蹟", "歷史深度"], connectsWith: ["洛陽"] },
        { id: "intl-cn-r-sichuan", type: 'route', title: "🇨🇳 四川九寨溝線", subtitle: "成都・九寨溝", keywords: ["中國", "china", "cn", "四川", "成都", "九寨溝"], dna: ["大熊貓", "麻辣美食", "絕美自然"], connectsWith: ["重慶"] },
        { id: "intl-cn-r-zhangjiajie", type: 'route', title: "🇨🇳 張家界奇景線", subtitle: "張家界・鳳凰古城", keywords: ["中國", "china", "cn", "張家界", "鳳凰古城"], dna: ["奇岩地貌", "少數民族", "攝影天堂"], connectsWith: ["長沙"] },
        // 香港
        { id: "intl-hk-r-classic", type: 'route', title: "🇭🇰 經典都會線", subtitle: "香港島・尖沙咀・維港", keywords: ["香港", "hong kong", "hk", "香港島", "中環", "尖沙咀", "維多利亞港"], dna: ["百萬夜景", "美食購物", "都會繁華"], connectsWith: ["澳門"] },
        { id: "intl-hk-r-culture", type: 'route', title: "🇭🇰 港島文青線", subtitle: "中環・上環・西營盤", keywords: ["香港", "hong kong", "hk", "中環", "上環", "西營盤"], dna: ["咖啡店", "街拍", "文化融合"], connectsWith: ["堅尼地城"] },
        { id: "intl-hk-r-park", type: 'route', title: "🇭🇰 親子主題樂園線", subtitle: "香港迪士尼・海洋公園", keywords: ["香港", "hong kong", "hk", "迪士尼", "海洋公園"], dna: ["主題樂園", "親子友善", "娛樂"], connectsWith: ["昂坪360"] },
        { id: "intl-hk-r-island", type: 'route', title: "🇭🇰 離島度假線", subtitle: "大嶼山・長洲", keywords: ["香港", "hong kong", "hk", "大嶼山", "長洲", "天壇大佛"], dna: ["慢活度假", "海景", "在地小吃"], connectsWith: ["南丫島"] },
        { id: "intl-hk-r-local", type: 'route', title: "🇭🇰 在地文化美食線", subtitle: "深水埗・旺角・油麻地", keywords: ["香港", "hong kong", "hk", "深水埗", "旺角", "油麻地"], dna: ["平民美食", "夜市文化", "街頭探索"], connectsWith: ["黃大仙"] },
        // 新加坡 / 海島跨國
        { id: "intl-sg-r-my", type: 'route', title: "🇸🇬 新馬雙國線", subtitle: "新加坡・吉隆坡", keywords: ["新加坡", "singapore", "馬來西亞", "malaysia", "吉隆坡"], dna: ["跨國旅行", "都會繁華", "多元文化"], connectsWith: ["馬六甲"] },
        { id: "intl-sg-r-myth", type: 'route', title: "🇸🇬 新馬泰三國線", subtitle: "新加坡・馬來西亞・泰國", keywords: ["新加坡", "馬來西亞", "泰國", "新馬泰"], dna: ["長天數", "跨國體驗", "多元文化"], connectsWith: ["檳城"] },
        { id: "intl-ph-r-cebu", type: 'route', title: "🇵🇭 宿霧跳島線", subtitle: "宿霧・薄荷島", keywords: ["菲律賓", "philippines", "ph", "宿霧", "薄荷島"], dna: ["潛水天堂", "跳島", "生態保育"], connectsWith: ["馬尼拉"] },
        { id: "intl-id-r-bali", type: 'route', title: "🇮🇩 峇里龍目島線", subtitle: "峇里島・龍目島", keywords: ["印尼", "indonesia", "id", "峇里島", "龍目島"], dna: ["海島度假", "瑜珈退修", "水上活動"], connectsWith: ["吉利群島"] },
        // 大洋洲
        { id: "intl-au-r-east", type: 'route', title: "🇦🇺 東澳都會與海岸線", subtitle: "雪梨・墨爾本・黃金海岸", keywords: ["澳洲", "australia", "au", "東澳", "雪梨", "墨爾本", "布里斯本", "黃金海岸"], dna: ["自然生態", "陽光沙灘", "城市地標"], connectsWith: ["塔斯馬尼亞"] },
        { id: "intl-au-r-reef", type: 'route', title: "🇦🇺 大堡礁生態線", subtitle: "凱恩斯・大堡礁", keywords: ["澳洲", "australia", "au", "凱恩斯", "大堡礁"], dna: ["世界自然遺產", "潛水", "熱帶雨林"], connectsWith: ["布里斯本"] },
        { id: "intl-nz-r-south", type: 'route', title: "🇳🇿 紐西蘭南島壯遊", subtitle: "基督城・庫克山・皇后鎮・米佛峽灣", keywords: ["紐西蘭", "new zealand", "nz", "南島", "基督城", "庫克山", "皇后鎮", "米佛峽灣"], dna: ["自駕遊", "極致大自然", "極限運動"], connectsWith: ["奧克蘭"] },
        // 歐洲 (經典/單國/進階)
        { id: "intl-eu-r-golden", type: 'route', title: "🇪🇺 法瑞義黃金三角", subtitle: "巴黎・少女峰・米蘭・威尼斯", keywords: ["歐洲", "europe", "西歐", "法國", "巴黎", "瑞士", "少女峰", "義大利", "米蘭", "威尼斯"], dna: ["歐洲首選", "歷史建築", "壯麗山景"], connectsWith: ["羅馬"] },
        { id: "intl-eu-r-central", type: 'route', title: "🇪🇺 德奧捷中歐童話線", subtitle: "慕尼黑・維也納・布拉格", keywords: ["歐洲", "europe", "中歐", "德國", "慕尼黑", "奧地利", "維也納", "捷克", "布拉格"], dna: ["古典音樂", "中世紀小鎮", "浪漫氛圍"], connectsWith: ["布達佩斯"] },
        { id: "intl-eu-r-iberia", type: 'route', title: "🇪🇺 西葡伊比利半島", subtitle: "巴塞隆納・馬德里・里斯本", keywords: ["歐洲", "europe", "南歐", "西班牙", "巴塞隆納", "馬德里", "葡萄牙", "里斯本"], dna: ["高第建築", "地中海陽光", "熱情文化"], connectsWith: ["波多"] },
        { id: "intl-eu-r-benelux", type: 'route', title: "🇪🇺 荷比法低地國", subtitle: "阿姆斯特丹・布魯塞爾・巴黎", keywords: ["歐洲", "europe", "荷蘭", "阿姆斯特丹", "比利時", "布魯塞爾", "法國", "巴黎"], dna: ["跨國火車", "運河風情", "高效率"], connectsWith: ["倫敦"] },
        { id: "intl-eu-r-uk", type: 'route', title: "🇬🇧 英國大不列顛線", subtitle: "倫敦・愛丁堡・湖區", keywords: ["歐洲", "europe", "英國", "uk", "倫敦", "愛丁堡", "湖區"], dna: ["皇室歷史", "博物館", "高地風光"], connectsWith: ["劍橋", "牛津"] },
        { id: "intl-eu-r-italy", type: 'route', title: "🇮🇹 義大利經典文藝線", subtitle: "羅馬・佛羅倫斯・威尼斯", keywords: ["歐洲", "europe", "義大利", "italy", "羅馬", "佛羅倫斯", "威尼斯"], dna: ["世界遺產", "文藝復興", "美食"], connectsWith: ["米蘭"] },
        { id: "intl-eu-r-italy-s", type: 'route', title: "🇮🇹 南義海岸風情線", subtitle: "那不勒斯・阿瑪菲海岸", keywords: ["歐洲", "europe", "義大利", "italy", "南義", "那不勒斯", "阿瑪菲"], dna: ["地中海絕景", "懸崖小鎮", "悠閒度假"], connectsWith: ["卡布里島"] },
        { id: "intl-eu-r-swiss", type: 'route', title: "🇨🇭 瑞士全覽鐵道線", subtitle: "蘇黎世・琉森・因特拉肯・策馬特", keywords: ["歐洲", "europe", "瑞士", "switzerland", "蘇黎世", "琉森", "因特拉肯", "策馬特", "少女峰", "馬特洪峰"], dna: ["鐵道旅行", "湖光山色", "高預算"], connectsWith: ["日內瓦"] },
        { id: "intl-eu-r-france", type: 'route', title: "🇫🇷 法國深度與南法線", subtitle: "巴黎・南法普羅旺斯", keywords: ["歐洲", "europe", "法國", "france", "巴黎", "南法", "普羅旺斯"], dna: ["浪漫氛圍", "薰衣草", "藝術美酒"], connectsWith: ["蔚藍海岸"] },
        { id: "intl-eu-r-germany", type: 'route', title: "🇩🇪 德國浪漫大道線", subtitle: "慕尼黑・新天鵝堡", keywords: ["歐洲", "europe", "德國", "germany", "浪漫大道", "慕尼黑", "新天鵝堡"], dna: ["童話城堡", "巴伐利亞文化", "自駕遊"], connectsWith: ["法蘭克福"] },
        { id: "intl-eu-r-nordic", type: 'route', title: "🇳🇴 北歐峽灣極光線", subtitle: "哥本哈根・斯德哥爾摩・奧斯陸", keywords: ["歐洲", "europe", "北歐", "斯堪地那維亞", "丹麥", "哥本哈根", "瑞典", "斯德哥爾摩", "挪威", "奧斯陸", "峽灣"], dna: ["極簡設計", "壯麗峽谷", "極高預算"], connectsWith: ["冰島"] },
        { id: "intl-eu-r-greece", type: 'route', title: "🇬🇷 希臘愛琴海跳島", subtitle: "雅典・聖托里尼・米克諾斯", keywords: ["歐洲", "europe", "南歐", "希臘", "greece", "雅典", "聖托里尼", "米克諾斯", "愛琴海"], dna: ["藍白小鎮", "古希臘神話", "浪漫度假"], connectsWith: ["克里特島"] },
        { id: "intl-eu-r-east", type: 'route', title: "🇭🇺 東歐與巴爾幹線", subtitle: "布達佩斯・布加勒斯特・保加利亞", keywords: ["歐洲", "europe", "東歐", "巴爾幹", "匈牙利", "布達佩斯", "羅馬尼亞", "保加利亞"], dna: ["歷史探索", "多瑙河風情", "高CP值"], connectsWith: ["維也納"] },
        // 中東亞非
        { id: "intl-mea-r-uae", type: 'route', title: "🇦🇪 杜拜極致奢華線", subtitle: "杜拜・阿布達比", keywords: ["阿聯酋", "uae", "中東", "杜拜", "阿布達比"], dna: ["頂級奢華", "沙漠體驗", "現代建築"], connectsWith: ["沙迦"] },
        { id: "intl-mea-r-egypt", type: 'route', title: "🇪🇬 埃及古文明線", subtitle: "開羅・路克索・亞斯文", keywords: ["埃及", "egypt", "中東", "非洲", "開羅", "路克索", "亞斯文", "金字塔"], dna: ["古文明遺跡", "沙漠風情", "尼羅河遊船"], connectsWith: ["杜拜"] },
        { id: "intl-mea-r-turkey", type: 'route', title: "🇹🇷 土耳其跨洲奇幻", subtitle: "伊斯坦堡・卡帕多奇亞・棉堡・以弗所", keywords: ["土耳其", "turkey", "中東", "伊斯坦堡", "卡帕多奇亞", "棉堡", "以弗所", "熱氣球"], dna: ["跨洲文化", "熱氣球", "特殊地貌"], connectsWith: ["希臘"] },
        // 北美
        { id: "intl-na-r-us-west", type: 'route', title: "🇺🇸 美西基礎線", subtitle: "洛杉磯・拉斯維加斯・大峽谷", keywords: ["美國", "usa", "美西", "洛杉磯", "拉斯維加斯", "大峽谷"], dna: ["公路旅行", "影視娛樂", "壯闊峽谷"], connectsWith: ["舊金山"] },
        { id: "intl-na-r-us-east", type: 'route', title: "🇺🇸 美東大都會線", subtitle: "紐約・華盛頓・波士頓", keywords: ["美國", "usa", "美東", "紐約", "華盛頓", "波士頓"], dna: ["大都會", "歷史博物館", "常春藤名校"], connectsWith: ["多倫多"] },
        { id: "intl-na-r-us-park", type: 'route', title: "🇺🇸 國家公園進階線", subtitle: "拉斯維加斯・羚羊谷・優勝美地", keywords: ["美國", "usa", "國家公園", "拉斯維加斯", "羚羊谷", "優勝美地"], dna: ["絕美大自然", "攝影天堂", "深度自駕"], connectsWith: ["洛杉磯"] },
        { id: "intl-na-r-us-coast", type: 'route', title: "🇺🇸 加州海岸公路線", subtitle: "舊金山・1號公路・洛杉磯", keywords: ["美國", "usa", "加州", "舊金山", "1號公路", "洛杉磯", "海岸線"], dna: ["公路旅行", "太平洋海景", "慢活度假"], connectsWith: ["聖地牙哥"] },
        { id: "intl-na-r-us-fl", type: 'route', title: "🇺🇸 佛羅里達陽光線", subtitle: "奧蘭多・邁阿密", keywords: ["美國", "usa", "佛州", "佛羅里達", "奧蘭多", "邁阿密"], dna: ["世界級主題樂園", "熱帶海灘", "拉丁風情"], connectsWith: ["紐約"] },
        { id: "intl-na-r-ca-rocky", type: 'route', title: "🇨🇦 加拿大洛磯山脈", subtitle: "班夫・露易絲湖", keywords: ["加拿大", "canada", "ca", "洛磯山脈", "班夫", "露易絲湖"], dna: ["冰河地形", "國家公園", "野生動物"], connectsWith: ["溫哥華"] },
        { id: "intl-na-r-ca-east", type: 'route', title: "🇨🇦 加東楓葉法語線", subtitle: "多倫多・蒙特婁・魁北克", keywords: ["加拿大", "canada", "ca", "加東", "多倫多", "蒙特婁", "魁北克"], dna: ["法式風情", "秋季賞楓", "歷史老城"], connectsWith: ["渥太華"] },
        { id: "intl-na-r-border", type: 'route', title: "🇺🇸🇨🇦 美加邊境線", subtitle: "多倫多・尼加拉瀑布・紐約", keywords: ["美國", "加拿大", "美加", "多倫多", "尼加拉瀑布", "紐約"], dna: ["跨國旅行", "世界級瀑布", "高效率"], connectsWith: ["波士頓"] },


        // ================== 📍 熱門城市單點大補帖 (City) ==================
        
        // --- 亞洲: 日本 (Japan) ---
        { id: "c-jp-tyo", type: 'city', title: "🗼 東京 (Tokyo)", subtitle: "淺草寺、晴空塔、澀谷十字路口、迪士尼", keywords: ["日本", "japan", "jp", "東京", "tokyo", "淺草寺", "晴空塔", "澀谷", "迪士尼", "築地市場"], dna: ["都會繁華", "購物天堂"] },
        { id: "c-jp-osa", type: 'city', title: "🏯 大阪 (Osaka)", subtitle: "環球影城、道頓堀美食、大阪城公園", keywords: ["日本", "japan", "jp", "大阪", "osaka", "環球影城", "道頓堀", "心齋橋", "大阪城"], dna: ["在地美食", "主題樂園"] },
        { id: "c-jp-kyo", type: 'city', title: "⛩️ 京都 (Kyoto)", subtitle: "清水寺、金閣寺、伏見稻荷大社、嵐山", keywords: ["日本", "japan", "jp", "京都", "kyoto", "清水寺", "金閣寺", "伏見稻荷大社", "嵐山", "祇園"], dna: ["歷史古都", "傳統文化"] },
        { id: "c-jp-hkd", type: 'city', title: "❄️ 北海道 (Hokkaido)", subtitle: "小樽運河、富良野薰衣草、札幌大通公園", keywords: ["日本", "japan", "jp", "北海道", "hokkaido", "小樽", "富良野", "函館", "札幌", "滑雪"], dna: ["自然絕景", "雪景", "海鮮"] },
        { id: "c-jp-oka", type: 'city', title: "🐠 沖繩 (Okinawa)", subtitle: "美麗海水族館、國際通、萬座毛、潛水", keywords: ["日本", "japan", "jp", "沖繩", "okinawa", "美麗海水族館", "國際通", "萬座毛", "首里城", "潛水"], dna: ["海島度假", "自駕遊"] },
        { id: "c-jp-fuk", type: 'city', title: "🍜 福岡 (Fukuoka)", subtitle: "博多屋台小吃、太宰府天滿宮、大濠公園", keywords: ["日本", "japan", "jp", "福岡", "fukuoka", "博多", "太宰府", "大濠公園", "運河城"], dna: ["巷弄美食", "拉麵"] },
        { id: "c-jp-ngo", type: 'city', title: "🏯 名古屋 (Nagoya)", subtitle: "名古屋城、吉卜力公園、熱田神宮", keywords: ["日本", "japan", "jp", "名古屋", "nagoya", "名古屋城", "熱田神宮", "吉卜力", "樂高樂園", "鰻魚飯"], dna: ["歷史文化", "親子景點"] },
        { id: "c-jp-kob", type: 'city', title: "🥩 神戶 (Kobe)", subtitle: "神戶港夜景、北野異人館、有馬溫泉", keywords: ["日本", "japan", "jp", "神戶", "kobe", "神戶港", "北野異人館", "有馬溫泉", "神戶牛", "六甲山"], dna: ["浪漫夜景", "頂級美食"] },

        // --- 亞洲: 中國大陸 (China) ---
        { id: "c-cn-sha", type: 'city', title: "🇨🇳 上海 (Shanghai)", subtitle: "外灘夜景、東方明珠、迪士尼樂園", keywords: ["中國", "china", "cn", "上海", "shanghai", "外灘", "武康路", "迪士尼", "東方明珠", "豫園"], dna: ["都會繁華", "現代奇蹟"] },
        { id: "c-cn-bjs", type: 'city', title: "🇨🇳 北京 (Beijing)", subtitle: "紫禁城故宮、萬里長城、天壇、環球影城", keywords: ["中國", "china", "cn", "北京", "beijing", "故宮", "紫禁城", "長城", "天壇", "頤和園", "環球影城"], dna: ["歷史人文", "世界遺產"] },
        { id: "c-cn-hgh", type: 'city', title: "🇨🇳 杭州 (Hangzhou)", subtitle: "西湖十景、靈隱寺、西溪濕地", keywords: ["中國", "china", "cn", "杭州", "hangzhou", "西湖", "靈隱寺", "河坊街", "西溪濕地", "龍井"], dna: ["古典園林", "詩意風景"] },
        { id: "c-cn-dyg", type: 'city', title: "🇨🇳 張家界 (Zhangjiajie)", subtitle: "天門山洞、武陵源(阿凡達)、玻璃橋", keywords: ["中國", "china", "cn", "張家界", "zhangjiajie", "天門山", "武陵源", "大峽谷玻璃橋"], dna: ["奇岩地貌", "極致大自然"] },
        { id: "c-cn-ctu", type: 'city', title: "🇨🇳 成都 (Chengdu)", subtitle: "大熊貓基地、寬窄巷子、川劇變臉", keywords: ["中國", "china", "cn", "成都", "chengdu", "大熊貓", "寬窄巷子", "川劇", "麻辣火鍋"], dna: ["休閒慢活", "特色美食"] },
        { id: "c-cn-can", type: 'city', title: "🇨🇳 廣州 (Guangzhou)", subtitle: "廣州塔(小蠻腰)、珠江夜遊、沙面島", keywords: ["中國", "china", "cn", "廣州", "guangzhou", "廣州塔", "小蠻腰", "珠江", "沙面島", "粵式早茶"], dna: ["商貿重鎮", "傳統美食"] },
        { id: "c-cn-szx", type: 'city', title: "🇨🇳 深圳 (Shenzhen)", subtitle: "世界之窗、華強北、海上世界", keywords: ["中國", "china", "cn", "深圳", "shenzhen", "世界之窗", "華強北", "海上世界", "甘坑客家小鎮"], dna: ["現代科技", "主題樂園"] },
        { id: "c-cn-sia", type: 'city', title: "🇨🇳 西安 (Xian)", subtitle: "秦始皇兵馬俑、古城牆、大唐不夜城", keywords: ["中國", "china", "cn", "西安", "xian", "兵馬俑", "古城牆", "大唐不夜城", "回民街"], dna: ["千年古都", "歷史深度"] },
        { id: "c-cn-ckg", type: 'city', title: "🇨🇳 重慶 (Chongqing)", subtitle: "洪崖洞夜景、穿樓單軌、長江索道", keywords: ["中國", "china", "cn", "重慶", "chongqing", "洪崖洞", "李子壩", "長江索道", "魔幻山城"], dna: ["魔幻地貌", "夜景", "麻辣美食"] },

        // --- 亞洲: 韓國 (South Korea) ---
        { id: "c-kr-sel", type: 'city', title: "🇰🇷 首爾 (Seoul)", subtitle: "景福宮韓服、明洞與弘大、南山塔夜景", keywords: ["韓國", "korea", "kr", "首爾", "seoul", "景福宮", "明洞", "弘大", "樂天世界", "南山塔"], dna: ["流行文化", "購物美妝"] },
        { id: "c-kr-pus", type: 'city', title: "🏖️ 釜山 (Busan)", subtitle: "海雲台沙灘、甘川洞文化村、膠囊小火車", keywords: ["韓國", "korea", "kr", "釜山", "busan", "海雲台", "甘川洞", "海東龍宮寺", "膠囊列車"], dna: ["海港風情", "海鮮美食"] },
        { id: "c-kr-cju", type: 'city', title: "🌋 濟州島 (Jeju)", subtitle: "城山日出峰、漢拏山、黑豬肉料理", keywords: ["韓國", "korea", "kr", "濟州島", "jeju", "城山日出峰", "漢拏山", "黑豬肉", "神話世界"], dna: ["自然景觀", "海島度假"] },
        { id: "c-kr-kng", type: 'city', title: "☕ 江陵 (Gangneung)", subtitle: "正東津日出、咖啡街、BTS公車站", keywords: ["韓國", "korea", "kr", "江陵", "gangneung", "正東津", "烏竹軒", "咖啡街", "BTS"], dna: ["海岸風光", "文青咖啡"] },
        { id: "c-kr-icn", type: 'city', title: "🎡 仁川 (Incheon)", subtitle: "松島中央公園、中華街、童話村", keywords: ["韓國", "korea", "kr", "仁川", "incheon", "松島", "月尾島", "中華街", "童話村"], dna: ["現代都會", "家庭友善"] },
        { id: "c-kr-tae", type: 'city', title: "🎢 大邱 (Daegu)", subtitle: "E-WORLD樂園、西門市場、八公山", keywords: ["韓國", "korea", "kr", "大邱", "daegu", "E-WORLD", "西門市場", "八公山", "咖啡廳"], dna: ["主題樂園", "在地市場"] },
        { id: "c-kr-gju", type: 'city', title: "🏛️ 慶州 (Gyeongju)", subtitle: "佛國寺、皇理團路文青散策", keywords: ["韓國", "korea", "kr", "慶州", "gyeongju", "佛國寺", "瞻星臺", "皇理團路", "露天博物館"], dna: ["千年古都", "歷史古蹟"] },

        // --- 亞洲: 香港 (Hong Kong) ---
        { id: "c-hk-tst", type: 'city', title: "🇭🇰 尖沙咀 (Tsim Sha Tsui)", subtitle: "維港夜景、星光大道、海港城", keywords: ["香港", "hong kong", "hk", "尖沙咀", "tsim sha tsui", "維多利亞港", "星光大道", "海港城", "天星小輪"], dna: ["繁華都會", "百萬夜景"] },
        { id: "c-hk-cen", type: 'city', title: "🇭🇰 中環 (Central)", subtitle: "太平山纜車、大館、蘭桂坊酒吧街", keywords: ["香港", "hong kong", "hk", "中環", "central", "太平山", "大館", "半山手扶梯", "蘭桂坊"], dna: ["金融中心", "夜生活"] },
        { id: "c-hk-mk", type: 'city', title: "🇭🇰 旺角 (Mong Kok)", subtitle: "女人街、波鞋街、地道茶餐廳", keywords: ["香港", "hong kong", "hk", "旺角", "mong kok", "女人街", "波鞋街", "金魚街", "茶餐廳"], dna: ["街頭文化", "平民美食"] },
        { id: "c-hk-cwb", type: 'city', title: "🇭🇰 銅鑼灣 (Causeway Bay)", subtitle: "時代廣場、SOGO、叮叮車", keywords: ["香港", "hong kong", "hk", "銅鑼灣", "causeway bay", "時代廣場", "希慎廣場", "SOGO", "叮叮車"], dna: ["購物天堂", "潮流集散"] },
        { id: "c-hk-dl", type: 'city', title: "🎢 迪士尼園區 (Disneyland)", subtitle: "魔雪奇緣世界、城堡煙火秀", keywords: ["香港", "hong kong", "hk", "迪士尼", "disneyland", "魔雪奇緣", "煙火秀"], dna: ["主題樂園", "夢幻童話"] },
        { id: "c-hk-lan", type: 'city', title: "🚠 大嶼山 (Lantau Island)", subtitle: "昂坪360纜車、天壇大佛、大澳漁村", keywords: ["香港", "hong kong", "hk", "大嶼山", "lantau island", "昂坪", "天壇大佛", "大澳漁村"], dna: ["文化巡禮", "大自然"] },
        { id: "c-hk-ssp", type: 'city', title: "🇭🇰 深水埗 (Sham Shui Po)", subtitle: "嘉頓山日落、電子市集、米其林平民美食", keywords: ["香港", "hong kong", "hk", "深水埗", "sham shui po", "嘉頓山", "鴨寮街", "添好運"], dna: ["在地探索", "高CP值美食"] },

        // --- 東南亞: 越南 (Vietnam) ---
        { id: "c-vn-dad", type: 'city', title: "🇻🇳 峴港 (Da Nang)", subtitle: "巴拿山黃金佛手橋、美溪沙灘、龍橋", keywords: ["越南", "vietnam", "vn", "峴港", "da nang", "巴拿山", "佛手橋", "美溪沙灘", "五行山", "龍橋"], dna: ["海濱度假", "主題樂園"] },
        { id: "c-vn-pqc", type: 'city', title: "🏝️ 富國島 (Phu Quoc)", subtitle: "免簽勝地、太陽世界纜車、日落沙灘", keywords: ["越南", "vietnam", "vn", "富國島", "phu quoc", "免簽", "太陽世界纜車", "珍珠野生動物園", "日落沙灘"], dna: ["絕美海島", "奢華渡假"] },
        { id: "c-vn-hlb", type: 'city', title: "⛰️ 下龍灣 (Ha Long Bay)", subtitle: "世界自然遺產、過夜遊船、驚訝洞", keywords: ["越南", "vietnam", "vn", "下龍灣", "ha long bay", "世界遺產", "遊船", "驚訝洞", "英雄島"], dna: ["自然奇景", "慢活放鬆"] },
        { id: "c-vn-han", type: 'city', title: "🇻🇳 河內 (Hanoi)", subtitle: "三十六古街、還劍湖、聖若瑟主教座堂", keywords: ["越南", "vietnam", "vn", "河內", "hanoi", "三十六古街", "還劍湖", "文廟", "水上木偶劇"], dna: ["歷史古都", "法式建築"] },
        { id: "c-vn-sgn", type: 'city', title: "🇻🇳 胡志明市 (Ho Chi Minh)", subtitle: "粉紅教堂、咖啡公寓、古芝地道", keywords: ["越南", "vietnam", "vn", "胡志明市", "ho chi minh", "粉紅教堂", "咖啡公寓", "檳城市場", "古芝地道"], dna: ["法式風情", "咖啡文化"] },
        { id: "c-vn-hoi", type: 'city', title: "🏮 會安 (Hoi An)", subtitle: "世界遺產古鎮、燈籠夜景、秋盆河", keywords: ["越南", "vietnam", "vn", "會安", "hoi an", "古鎮", "燈籠", "奧黛", "秋盆河"], dna: ["歷史遺產", "浪漫氛圍"] },
        { id: "c-vn-dli", type: 'city', title: "🌸 大叻 (Da Lat)", subtitle: "高山避暑勝地、瘋狂屋、繡球花田", keywords: ["越南", "vietnam", "vn", "大叻", "da lat", "避暑", "瘋狂屋", "繡球花田"], dna: ["山林花海", "歐風小鎮"] },

        // --- 東南亞: 泰國 (Thailand) ---
        { id: "c-th-bkk", type: 'city', title: "🇹🇭 曼谷 (Bangkok)", subtitle: "鄭王廟、大皇宮、洽圖洽市集、高空酒吧", keywords: ["泰國", "thailand", "th", "曼谷", "bangkok", "鄭王廟", "大皇宮", "洽圖洽", "高空酒吧"], dna: ["夜生活", "購物天堂"] },
        { id: "c-th-cnx", type: 'city', title: "🐘 清邁 (Chiang Mai)", subtitle: "古城區、大象保護區、尼曼路文青店", keywords: ["泰國", "thailand", "th", "清邁", "chiang mai", "古城", "大象保護區", "尼曼路", "夜市"], dna: ["慢活", "文創藝術"] },
        { id: "c-th-hkt", type: 'city', title: "🏝️ 普吉島 (Phuket)", subtitle: "芭東海灘、跳島浮潛、普吉老城區", keywords: ["泰國", "thailand", "th", "普吉島", "phuket", "芭東", "跳島", "查龍寺", "普吉老城區"], dna: ["海島度假", "水上活動"] },
        { id: "c-th-pyx", type: 'city', title: "🏖️ 芭達雅 (Pattaya)", subtitle: "真理寺、格蘭島、人妖秀、步行街", keywords: ["泰國", "thailand", "th", "芭達雅", "pattaya", "真理寺", "格蘭島", "人妖秀", "步行街"], dna: ["夜生活", "海灘娛樂"] },
        { id: "c-th-hhq", type: 'city', title: "👑 華欣 (Hua Hin)", subtitle: "皇室避暑勝地、火車站古蹟、創意市集", keywords: ["泰國", "thailand", "th", "華欣", "hua hin", "皇室避暑", "火車站", "蟬鳴市集", "小威尼斯"], dna: ["悠閒度假", "親子友善"] },
        { id: "c-th-kbv", type: 'city', title: "🛶 喀比 (Krabi)", subtitle: "奧南沙灘、萊雷攀岩、皮皮島巡航", keywords: ["泰國", "thailand", "th", "喀比", "krabi", "奧南", "萊雷海灘", "皮皮島", "翡翠池"], dna: ["自然絕景", "戶外探險"] },
        { id: "c-th-usm", type: 'city', title: "🥥 蘇美島 (Koh Samui)", subtitle: "滿月派對、阿公阿媽石、奢華渡假村", keywords: ["泰國", "thailand", "th", "蘇美島", "koh samui", "滿月派對", "帕岸島", "查汶海灘", "阿公阿媽石"], dna: ["奢華渡假", "派對狂歡"] },

        // --- 東南亞: 新加坡 (Singapore) ---
        { id: "c-sg-mar", type: 'city', title: "🇸🇬 濱海灣 (Marina Bay)", subtitle: "金沙酒店、濱海灣花園(超級樹)、魚尾獅", keywords: ["新加坡", "singapore", "sg", "濱海灣", "marina bay", "金沙酒店", "濱海灣花園", "超級樹", "魚尾獅"], dna: ["都會地標", "現代建築"] },
        { id: "c-sg-sen", type: 'city', title: "🏝️ 聖淘沙 (Sentosa)", subtitle: "度假村、S.E.A.海洋館、西羅索海灘", keywords: ["新加坡", "singapore", "sg", "聖淘沙", "sentosa", "海洋館", "西羅索海灘"], dna: ["海島度假", "家庭娛樂"] },
        { id: "c-sg-uss", type: 'city', title: "🎢 環球影城 (USS)", subtitle: "變形金剛、木乃伊主題", keywords: ["新加坡", "singapore", "sg", "環球影城", "uss", "變形金剛", "木乃伊"], dna: ["主題樂園", "刺激體驗"] },
        { id: "c-sg-chi", type: 'city', title: "🏮 牛車水 (Chinatown)", subtitle: "佛牙寺龍華院、老巴剎美食", keywords: ["新加坡", "singapore", "sg", "牛車水", "chinatown", "佛牙寺", "老巴剎"], dna: ["傳統文化", "在地美食"] },
        { id: "c-sg-lit", type: 'city', title: "🛕 小印度 (Little India)", subtitle: "竹腳中心、五顏六色建築", keywords: ["新加坡", "singapore", "sg", "小印度", "little india", "竹腳中心", "興都廟"], dna: ["異國文化", "攝影打卡"] },
        { id: "c-sg-clk", type: 'city', title: "🍹 克拉碼頭 (Clarke Quay)", subtitle: "河岸酒吧、遊河船體驗、舊警察局", keywords: ["新加坡", "singapore", "sg", "克拉碼頭", "clarke quay", "酒吧", "遊河船", "舊警察局"], dna: ["夜生活", "浪漫河景"] },
        { id: "c-sg-orc", type: 'city', title: "🛍️ 烏節路 (Orchard Road)", subtitle: "國際百貨林立、精品購物天堂", keywords: ["新加坡", "singapore", "sg", "烏節路", "orchard road", "百貨", "義安城"], dna: ["購物狂歡", "奢華時尚"] },
        { id: "c-sg-jew", type: 'city', title: "✈️ 星耀樟宜 (Jewel)", subtitle: "雨漩渦室內瀑布、森林谷", keywords: ["新加坡", "singapore", "sg", "星耀樟宜", "jewel", "雨漩渦", "瀑布", "森林谷"], dna: ["建築奇觀", "機場必逛"] },

        // --- 東南亞: 馬來西亞 (Malaysia) ---
        { id: "c-my-kul", type: 'city', title: "🇲🇾 吉隆坡 (Kuala Lumpur)", subtitle: "雙子星塔、黑風洞、亞羅街美食", keywords: ["馬來西亞", "malaysia", "my", "吉隆坡", "kuala lumpur", "雙子星塔", "KLCC", "黑風洞", "亞羅街", "武吉免登"], dna: ["都會繁華", "多元文化"] },
        { id: "c-my-pen", type: 'city', title: "🎨 檳城 (Penang)", subtitle: "喬治市壁畫、極樂寺、姓氏橋、娘惹文化", keywords: ["馬來西亞", "malaysia", "my", "檳城", "penang", "喬治市", "壁畫", "極樂寺", "姓氏橋", "娘惹"], dna: ["歷史古都", "街頭藝術", "美食"] },
        { id: "c-my-lgk", type: 'city', title: "🦅 蘭卡威 (Langkawi)", subtitle: "巨鷹廣場、東方村纜車、跳島孕婦島潛水", keywords: ["馬來西亞", "malaysia", "my", "蘭卡威", "langkawi", "免稅", "巨鷹廣場", "東方村纜車", "孕婦島"], dna: ["海島度假", "免稅購物"] },
        { id: "c-my-mkz", type: 'city', title: "🏰 馬六甲 (Malacca)", subtitle: "荷蘭紅屋、雞場街、馬六甲河遊船", keywords: ["馬來西亞", "malaysia", "my", "馬六甲", "malacca", "荷蘭紅屋", "雞場街", "葡萄牙村"], dna: ["世界遺產", "殖民歷史"] },
        { id: "c-my-jhb", type: 'city', title: "🧱 新山 (Johor Bahru)", subtitle: "樂高樂園、名牌折扣購物中心(JPO)", keywords: ["馬來西亞", "malaysia", "my", "新山", "johor bahru", "樂高樂園", "LEGOLAND", "JPO"], dna: ["主題樂園", "邊境購物"] },
        { id: "c-my-bki", type: 'city', title: "🌅 沙巴 (Sabah)", subtitle: "神山國家公園、丹絨亞路夕陽、長鼻猴", keywords: ["馬來西亞", "malaysia", "my", "沙巴", "sabah", "亞庇", "神山", "丹絨亞路", "長鼻猴", "螢火蟲"], dna: ["熱帶雨林", "絕美夕陽", "生態探險"] },

        // --- 東南亞: 菲律賓 (Philippines) & 印尼 (Indonesia) ---
        { id: "c-ph-mph", type: 'city', title: "⛵ 長灘島 (Boracay)", subtitle: "麵粉白沙灘、星期五海灘、水上風帆", keywords: ["菲律賓", "philippines", "ph", "長灘島", "boracay", "白沙灘", "星期五海灘", "風帆", "聖母岩礁"], dna: ["頂級沙灘", "水上活動"] },
        { id: "c-ph-ceb", type: 'city', title: "🐋 宿霧 (Cebu)", subtitle: "與鯨鯊共游、聖嬰大教堂、麥哲倫十字架", keywords: ["菲律賓", "philippines", "ph", "宿霧", "cebu", "鯨鯊", "歐斯陸", "聖嬰大教堂", "麥哲倫十字架"], dna: ["潛水天堂", "歷史遺跡"] },
        { id: "c-ph-pps", type: 'city', title: "🛶 巴拉望 (Palawan)", subtitle: "地下河流、愛妮島潟湖、科隆島潛水", keywords: ["菲律賓", "philippines", "ph", "巴拉望", "palawan", "地下河流", "愛妮島", "科隆島", "沈船潛水"], dna: ["絕美祕境", "生態奇觀"] },
        { id: "c-ph-tag", type: 'city', title: "🐒 薄荷島 (Bohol)", subtitle: "巧克力山、眼鏡猴保護區、處女島", keywords: ["菲律賓", "philippines", "ph", "薄荷島", "bohol", "巧克力山", "眼鏡猴", "羅伯克河", "處女島"], dna: ["獨特生態", "跳島沙灘"] },
        { id: "c-ph-mnl", type: 'city', title: "🏛️ 馬尼拉 (Manila)", subtitle: "王城區古蹟、聖奧古斯丁教堂、馬尼拉灣", keywords: ["菲律賓", "philippines", "ph", "馬尼拉", "manila", "王城區", "聖奧古斯丁教堂", "黎剎公園", "馬尼拉灣夕陽"], dna: ["殖民歷史", "都會夕陽"] },
        { id: "c-id-dps", type: 'city', title: "🇮🇩 峇里島 (Bali)", subtitle: "海島Villa、烏布森林、庫塔海灘", keywords: ["印尼", "indonesia", "id", "峇里島", "bali", "烏布", "庫塔"], dna: ["奢華渡假", "瑜珈退修"] },
        { id: "c-id-cgk", type: 'city', title: "🇮🇩 雅加達 (Jakarta)", subtitle: "首都都會、購物中心、歷史博物館", keywords: ["印尼", "indonesia", "id", "雅加達", "jakarta", "首都", "歷史博物館"], dna: ["商貿重鎮", "都會繁華"] },
        { id: "c-id-jog", type: 'city', title: "🇮🇩 日惹 (Yogyakarta)", subtitle: "婆羅浮屠、普蘭巴南、古城文化", keywords: ["印尼", "indonesia", "id", "日惹", "yogyakarta", "婆羅浮屠", "普蘭巴南"], dna: ["世界遺產", "古老文明"] },
        { id: "c-id-sub", type: 'city', title: "🇮🇩 泗水 (Surabaya)", subtitle: "婆羅摩火山、野生動物園", keywords: ["印尼", "indonesia", "id", "泗水", "surabaya", "婆羅摩火山", "野生動物園"], dna: ["火山探險", "生態觀賞"] },
        { id: "c-id-lop", type: 'city', title: "🇮🇩 龍目島 (Lombok)", subtitle: "粉紅沙灘、吉利群島潛水", keywords: ["印尼", "indonesia", "id", "龍目島", "lombok", "粉紅沙灘", "吉利群島"], dna: ["絕美秘境", "潛水度假"] },

        // --- 中港澳: 澳門 (Macau) ---
        { id: "c-mo-mac", type: 'city', title: "🇲🇴 澳門半島 (Macau Peninsula)", subtitle: "大三巴牌坊、議事亭前地、歷史城區", keywords: ["澳門", "macau", "mo", "澳門半島", "大三巴", "議事亭前地", "歷史城區"], dna: ["世界遺產", "殖民風情"] },
        { id: "c-mo-cot", type: 'city', title: "🎰 路氹城 (Cotai)", subtitle: "奢華飯店、威尼斯人、博弈娛樂", keywords: ["澳門", "macau", "mo", "路氹", "cotai", "威尼斯人", "博弈娛樂", "購物中心"], dna: ["極致奢華", "度假村"] },
        { id: "c-mo-tai", type: 'city', title: "🇲🇴 氹仔 (Taipa)", subtitle: "官也街美食、龍環葡韻", keywords: ["澳門", "macau", "mo", "氹仔", "taipa", "官也街", "龍環葡韻"], dna: ["在地美食", "葡式建築"] },
        { id: "c-mo-col", type: 'city', title: "🇲🇴 路環 (Coloane)", subtitle: "安德魯蛋塔、聖方濟各聖堂、黑沙海灘", keywords: ["澳門", "macau", "mo", "路環", "coloane", "安德魯蛋塔", "聖方濟各聖堂", "黑沙海灘"], dna: ["悠閒慢活", "經典小吃"] },

        // --- 歐洲: 法國 (France) ---
        { id: "c-fr-par", type: 'city', title: "🇫🇷 巴黎 (Paris)", subtitle: "艾菲爾鐵塔、羅浮宮、凱旋門、塞納河遊船", keywords: ["歐洲", "europe", "法國", "france", "巴黎", "paris", "羅浮宮", "艾菲爾鐵塔", "凱旋門", "塞納河"], dna: ["藝術殿堂", "浪漫氛圍"] },
        { id: "c-fr-nce", type: 'city', title: "🌊 尼斯 (Nice)", subtitle: "天使灣、英國人步行道、蔚藍海岸渡假", keywords: ["歐洲", "europe", "法國", "france", "尼斯", "nice", "天使灣", "英國人步行道", "蔚藍海岸", "舊城區"], dna: ["地中海渡假", "陽光沙灘"] },
        { id: "c-fr-lys", type: 'city', title: "🍷 里昂 (Lyon)", subtitle: "美食之都、富維耶聖母院、壁畫藝術", keywords: ["歐洲", "europe", "法國", "france", "里昂", "lyon", "美食之都", "富維耶聖母院", "壁畫藝術", "索恩河"], dna: ["米其林美食", "歷史古城"] },
        { id: "c-fr-mrs", type: 'city', title: "⛵ 馬賽 (Marseille)", subtitle: "守護聖母聖殿、馬賽魚湯、卡蘭奎斯", keywords: ["歐洲", "europe", "法國", "france", "馬賽", "marseille", "守護聖母聖殿", "隆尚宮", "馬賽魚湯", "卡蘭奎斯國家公園"], dna: ["海港風情", "自然峽灣"] },
        { id: "c-fr-pro", type: 'city', title: "🪻 普羅旺斯 (Provence)", subtitle: "薰衣草花海、亞維儂藝術節、嘉德水道橋", keywords: ["歐洲", "europe", "法國", "france", "普羅旺斯", "provence", "薰衣草", "亞維儂", "嘉德水道橋", "向日葵"], dna: ["田園風光", "紫色浪漫"] },
        { id: "c-fr-bod", type: 'city', title: "🍷 波爾多 (Bordeaux)", subtitle: "紅酒故鄉、水鏡廣場、葡萄酒城博物館", keywords: ["歐洲", "europe", "法國", "france", "波爾多", "bordeaux", "紅酒", "交易所廣場", "水鏡", "葡萄酒城"], dna: ["酒莊巡禮", "典雅建築"] },
        { id: "c-fr-sxb", type: 'city', title: "🥨 史特拉斯堡 (Strasbourg)", subtitle: "小法國區、大教堂、歐洲聖誕市集發源地", keywords: ["歐洲", "europe", "法國", "france", "史特拉斯堡", "strasbourg", "小法國", "大教堂", "聖誕市集"], dna: ["童話木屋", "節慶氛圍"] },
        { id: "c-fr-msm", type: 'city', title: "🏰 聖米歇爾山 (Mont Saint-Michel)", subtitle: "修道院奇景、潮汐景觀、中世紀孤島", keywords: ["歐洲", "europe", "法國", "france", "聖米歇爾山", "mont saint-michel", "修道院", "潮汐", "孤島"], dna: ["世界遺產", "神聖奇景"] },

        // --- 歐洲: 義大利 (Italy) ---
        { id: "c-it-rom", type: 'city', title: "🇮🇹 羅馬 (Rome)", subtitle: "羅馬競技場、萬神殿、許願池、梵蒂岡", keywords: ["歐洲", "europe", "義大利", "italy", "羅馬", "rome", "競技場", "萬神殿", "許願池", "梵蒂岡"], dna: ["古羅馬歷史", "世界遺產"] },
        { id: "c-it-vce", type: 'city', title: "🛶 威尼斯 (Venice)", subtitle: "聖馬可廣場、貢多拉遊船、彩色島", keywords: ["歐洲", "europe", "義大利", "italy", "威尼斯", "venice", "聖馬可廣場", "貢多拉", "嘆息橋", "彩色島"], dna: ["浪漫水都", "歷史古蹟"] },
        { id: "c-it-flr", type: 'city', title: "🎨 佛羅倫斯 (Florence)", subtitle: "聖母百花大教堂、烏菲茲美術館、大衛像", keywords: ["歐洲", "europe", "義大利", "italy", "佛羅倫斯", "florence", "聖母百花大教堂", "烏菲茲美術館", "大衛像", "丁骨牛排"], dna: ["文藝復興", "藝術殿堂"] },
        { id: "c-it-mil", type: 'city', title: "👗 米蘭 (Milan)", subtitle: "米蘭大教堂、艾曼紐二世迴廊、最後的晚餐", keywords: ["歐洲", "europe", "義大利", "italy", "米蘭", "milan", "米蘭大教堂", "艾曼紐二世迴廊", "最後的晚餐", "時尚購物"], dna: ["精品時尚", "壯麗建築"] },
        { id: "c-it-psa", type: 'city', title: "🗼 比薩 (Pisa)", subtitle: "比薩斜塔、奇蹟廣場、洗禮堂", keywords: ["歐洲", "europe", "義大利", "italy", "比薩", "pisa", "比薩斜塔", "奇蹟廣場", "洗禮堂"], dna: ["世界奇觀", "必拍地標"] },
        { id: "c-it-nap", type: 'city', title: "🍕 那不勒斯 (Naples)", subtitle: "義式披薩發源地、龐貝古城、新堡", keywords: ["歐洲", "europe", "義大利", "italy", "那不勒斯", "naples", "拿坡里", "披薩", "龐貝古城", "新堡"], dna: ["南義風情", "歷史遺跡"] },
        { id: "c-it-ama", type: 'city', title: "🍋 阿瑪菲海岸 (Amalfi Coast)", subtitle: "波西塔諾懸崖小鎮、檸檬酒、絕美海景", keywords: ["歐洲", "europe", "義大利", "italy", "阿瑪菲海岸", "amalfi coast", "波西塔諾", "檸檬酒", "海景步道"], dna: ["地中海絕景", "懸崖浪漫"] },
        { id: "c-it-cin", type: 'city', title: "🏘️ 五漁村 (Cinque Terre)", subtitle: "懸崖彩色屋、愛之路、地中海徒步路線", keywords: ["歐洲", "europe", "義大利", "italy", "五漁村", "cinque terre", "懸崖彩色屋", "愛之路", "地中海"], dna: ["世外桃源", "海岸健行"] },

        // --- 歐洲: 瑞士 (Switzerland) ---
        { id: "c-ch-zrh", type: 'city', title: "🇨🇭 蘇黎世 (Zurich)", subtitle: "利馬特河畔、班霍夫大街購物、大教堂", keywords: ["歐洲", "europe", "瑞士", "switzerland", "蘇黎世", "zurich", "利馬特河", "班霍夫大街", "蘇黎世大教堂"], dna: ["高消費都會", "治安優良"] },
        { id: "c-ch-luc", type: 'city', title: "🦢 琉森 (Lucerne)", subtitle: "卡貝爾木橋、垂死獅子像、皮拉圖斯山", keywords: ["歐洲", "europe", "瑞士", "switzerland", "琉森", "lucerne", "盧森", "卡貝爾木橋", "垂死獅子像", "皮拉圖斯山", "琉森湖"], dna: ["湖光山色", "中世紀橋樑"] },
        { id: "c-ch-int", type: 'city', title: "🪂 因特拉肯 (Interlaken)", subtitle: "兩湖之間、少女峰門戶、滑翔傘體驗", keywords: ["歐洲", "europe", "瑞士", "switzerland", "因特拉肯", "interlaken", "兩湖", "少女峰門戶", "滑翔傘", "布里恩茨湖"], dna: ["戶外活動", "湖泊美景"] },
        { id: "c-ch-zrm", type: 'city', title: "🏔️ 策馬特 (Zermatt)", subtitle: "馬特洪峰、冰河列車終點、無煙小鎮", keywords: ["歐洲", "europe", "瑞士", "switzerland", "策馬特", "zermatt", "馬特洪峰", "冰河列車", "無煙小鎮", "高納葛拉特"], dna: ["壯麗雪山", "環保山城"] },
        { id: "c-ch-gva", type: 'city', title: "⛲ 日內瓦 (Geneva)", subtitle: "大噴泉、萬國宮(聯合國)、日內瓦湖", keywords: ["歐洲", "europe", "瑞士", "switzerland", "日內瓦", "geneva", "大噴泉", "萬國宮", "鐘錶博物館", "日內瓦湖"], dna: ["國際都會", "湖畔優雅"] },
        { id: "c-ch-lau", type: 'city', title: "🍇 洛桑 (Lausanne)", subtitle: "奧林匹克首都、拉沃葡萄園梯田", keywords: ["歐洲", "europe", "瑞士", "switzerland", "洛桑", "lausanne", "奧林匹克", "洛桑大教堂", "拉沃葡萄園"], dna: ["奧運歷史", "世界遺產葡萄園"] },
        { id: "c-ch-jun", type: 'city', title: "🚞 少女峰山區 (Jungfrau Region)", subtitle: "歐洲之巔火車站、艾格快線、瀑布鎮", keywords: ["歐洲", "europe", "瑞士", "switzerland", "少女峰", "jungfrau", "歐洲之巔", "艾格快線", "格林德瓦", "瀑布鎮"], dna: ["極致阿爾卑斯", "鐵道工程奇蹟"] },
        { id: "c-ch-stm", type: 'city', title: "🎿 聖莫里茲 (St. Moritz)", subtitle: "奢華滑雪勝地、伯連納列車、香檳氣候", keywords: ["歐洲", "europe", "瑞士", "switzerland", "聖莫里茲", "st moritz", "滑雪", "伯連納列車", "香檳氣候", "高山湖泊"], dna: ["頂級冬季度假", "陽光雪景"] },

        // --- 歐洲: 德國 (Germany) ---
        { id: "c-de-ber", type: 'city', title: "🇩🇪 柏林 (Berlin)", subtitle: "布蘭登堡門、柏林圍牆遺址、博物館島", keywords: ["歐洲", "europe", "德國", "germany", "柏林", "berlin", "布蘭登堡門", "柏林圍牆", "博物館島", "國會大廈"], dna: ["歷史反思", "現代藝術"] },
        { id: "c-de-muc", type: 'city', title: "🍺 慕尼黑 (Munich)", subtitle: "瑪利亞廣場、皇家啤酒屋、BMW博物館", keywords: ["歐洲", "europe", "德國", "germany", "慕尼黑", "munich", "瑪利亞廣場", "皇家啤酒屋", "BMW", "啤酒節"], dna: ["巴伐利亞文化", "啤酒歡樂"] },
        { id: "c-de-fra", type: 'city', title: "🏙️ 法蘭克福 (Frankfurt)", subtitle: "羅馬廣場、美茵河畔、歐元塔、歌德故居", keywords: ["歐洲", "europe", "德國", "germany", "法蘭克福", "frankfurt", "羅馬廣場", "美茵河", "歐元塔", "歌德故居"], dna: ["金融樞紐", "老城對比"] },
        { id: "c-de-cgn", type: 'city', title: "⛪ 科隆 (Cologne)", subtitle: "科隆大教堂、霍亨索倫大橋(愛情鎖)", keywords: ["歐洲", "europe", "德國", "germany", "科隆", "cologne", "科隆大教堂", "霍亨索倫大橋", "4711古龍水"], dna: ["哥德式巔峰", "浪漫萊茵河"] },
        { id: "c-de-ham", type: 'city', title: "⚓ 漢堡 (Hamburg)", subtitle: "微縮景觀世界、倉庫城、易北河愛樂廳", keywords: ["歐洲", "europe", "德國", "germany", "漢堡", "hamburg", "微縮景觀世界", "倉庫城", "易北河愛樂廳"], dna: ["紅磚水都", "微縮模型"] },
        { id: "c-de-hei", type: 'city', title: "🎓 海德堡 (Heidelberg)", subtitle: "海德堡城堡、學生監獄、哲學家小徑", keywords: ["歐洲", "europe", "德國", "germany", "海德堡", "heidelberg", "海德堡城堡", "學生監獄", "哲學家小徑", "老橋"], dna: ["大學城", "浪漫主義"] },
        { id: "c-de-neu", type: 'city', title: "🏰 新天鵝堡 (Neuschwanstein)", subtitle: "迪士尼城堡原型、瑪麗恩鐵橋、夢幻山景", keywords: ["歐洲", "europe", "德國", "germany", "新天鵝堡", "neuschwanstein", "迪士尼城堡原型", "瑪麗恩鐵橋", "富森"], dna: ["童話夢境", "絕美城堡"] },
        { id: "c-de-blk", type: 'city', title: "🌲 黑森林 (Black Forest)", subtitle: "咕咕鐘發源地、黑森林蛋糕、蒂蒂湖", keywords: ["歐洲", "europe", "德國", "germany", "黑森林", "black forest", "咕咕鐘", "黑森林蛋糕", "蒂蒂湖", "健行"], dna: ["森林童話", "自然健行"] },

        // --- 歐洲: 英國 (United Kingdom) ---
        { id: "c-uk-lon", type: 'city', title: "🇬🇧 倫敦 (London)", subtitle: "大笨鐘、倫敦塔橋、大英博物館、西區劇院", keywords: ["歐洲", "europe", "英國", "uk", "倫敦", "london", "大笨鐘", "倫敦塔橋", "大英博物館", "西區劇院"], dna: ["皇室歷史", "博物館"] },
        { id: "c-uk-edi", type: 'city', title: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 愛丁堡 (Edinburgh)", subtitle: "愛丁堡城堡、皇家一哩路、亞瑟王座", keywords: ["歐洲", "europe", "英國", "uk", "蘇格蘭", "愛丁堡", "edinburgh", "愛丁堡城堡", "皇家一哩路", "亞瑟王座", "軍樂節"], dna: ["中世紀氛圍", "蘇格蘭風情"] },
        { id: "c-uk-man", type: 'city', title: "⚽ 曼徹斯特 (Manchester)", subtitle: "老特拉福球場(曼聯)、北區文青風", keywords: ["歐洲", "europe", "英國", "uk", "曼徹斯特", "manchester", "老特拉福", "曼聯", "科學產業博物館"], dna: ["工業革命", "足球狂熱"] },
        { id: "c-uk-liv", type: 'city', title: "🎸 利物浦 (Liverpool)", subtitle: "披頭四故事館、阿爾伯特碼頭", keywords: ["歐洲", "europe", "英國", "uk", "利物浦", "liverpool", "披頭四", "阿爾伯特碼頭", "利物浦大教堂"], dna: ["音樂朝聖", "港口復興"] },
        { id: "c-uk-oxf", type: 'city', title: "🎓 牛津 (Oxford)", subtitle: "牛津大學、哈利波特取景地、博德利圖書館", keywords: ["歐洲", "europe", "英國", "uk", "牛津", "oxford", "牛津大學", "哈利波特", "基督堂學院", "博德利圖書館"], dna: ["頂尖學府", "魔法氛圍"] },
        { id: "c-uk-cam", type: 'city', title: "🛶 劍橋 (Cambridge)", subtitle: "康河撐篙、國王學院、數學橋", keywords: ["歐洲", "europe", "英國", "uk", "劍橋", "cambridge", "康河撐篙", "國王學院", "三一學院", "數學橋"], dna: ["學術氣息", "河畔優雅"] },
        { id: "c-uk-lak", type: 'city', title: "🦆 湖區 (Lake District)", subtitle: "溫德米爾湖、彼得兔之家、壯闊自然健行", keywords: ["歐洲", "europe", "英國", "uk", "湖區", "lake district", "溫德米爾", "彼得兔", "健行"], dna: ["詩意大自然", "童話故鄉"] },
        { id: "c-uk-sth", type: 'city', title: "🗿 巨石陣 (Stonehenge)", subtitle: "史前巨石奇景、世界文化遺產", keywords: ["歐洲", "europe", "英國", "uk", "巨石陣", "stonehenge", "史前巨石", "天文排列"], dna: ["神秘遺跡", "史前文明"] },

        // --- 歐洲: 西班牙 (Spain) ---
        { id: "c-es-bcn", type: 'city', title: "🇪🇸 巴塞隆納 (Barcelona)", subtitle: "聖家堂、奎爾公園、高第建築", keywords: ["歐洲", "europe", "西班牙", "spain", "巴塞隆納", "barcelona", "聖家堂", "奎爾公園", "高第", "蘭布拉大道", "米拉之家"], dna: ["奇幻建築", "熱情文化"] },
        { id: "c-es-mad", type: 'city', title: "🇪🇸 馬德里 (Madrid)", subtitle: "普拉多博物館、馬德里王宮、太陽門廣場", keywords: ["歐洲", "europe", "西班牙", "spain", "馬德里", "madrid", "普拉多博物館", "馬德里王宮", "太陽門廣場", "聖米格爾市場"], dna: ["皇室大氣", "藝術館藏"] },
        { id: "c-es-sev", type: 'city', title: "💃 塞維亞 (Seville)", subtitle: "西班牙廣場、佛朗明哥舞、都市陽傘", keywords: ["歐洲", "europe", "西班牙", "spain", "塞維亞", "seville", "西班牙廣場", "塞維亞大教堂", "佛朗明哥舞", "都市陽傘"], dna: ["安達盧西亞風情", "熱情舞蹈"] },
        { id: "c-es-gra", type: 'city', title: "🕌 格拉納達 (Granada)", subtitle: "阿爾罕布拉宮、伊斯蘭建築風情", keywords: ["歐洲", "europe", "西班牙", "spain", "格拉納達", "granada", "阿爾罕布拉宮", "阿爾拜辛", "伊斯蘭建築"], dna: ["摩爾人文化", "宮殿絕景"] },
        { id: "c-es-vlc", type: 'city', title: "🥘 瓦倫西亞 (Valencia)", subtitle: "藝術科學城、燉飯發源地、法雅節", keywords: ["歐洲", "europe", "西班牙", "spain", "瓦倫西亞", "valencia", "藝術科學城", "燉飯", "法雅節", "絲綢交易所"], dna: ["前衛建築", "節慶美食"] },
        { id: "c-es-pmi", type: 'city', title: "🏖️ 馬略卡島 (Mallorca)", subtitle: "絕美海灣、帕爾馬主教座堂、蕭邦故居", keywords: ["歐洲", "europe", "西班牙", "spain", "馬略卡島", "mallorca", "海灣", "帕爾馬主教座堂", "蕭邦故居"], dna: ["地中海度假", "陽光沙灘"] },
        { id: "c-es-ibz", type: 'city', title: "🪩 伊比薩 (Ibiza)", subtitle: "電音派對聖地、傳奇夜店、湛藍海灘", keywords: ["歐洲", "europe", "西班牙", "spain", "伊比薩", "ibiza", "電音派對", "夜店", "世界遺產老城"], dna: ["狂歡夜生活", "海島派對"] },

        // --- 歐洲: 荷蘭 (Netherlands) ---
        { id: "c-nl-ams", type: 'city', title: "🇳🇱 阿姆斯特丹 (Amsterdam)", subtitle: "運河巡航、梵谷博物館、安妮之家、紅燈區", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "阿姆斯特丹", "amsterdam", "運河", "梵谷", "安妮之家", "紅燈區"], dna: ["運河風情", "藝術繪畫", "自由文化"] },
        { id: "c-nl-rtm", type: 'city', title: "🏢 鹿特丹 (Rotterdam)", subtitle: "方塊屋、時尚市場、小孩堤防、現代建築", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "鹿特丹", "rotterdam", "方塊屋", "時尚市場", "小孩堤防"], dna: ["前衛建築", "設計之都"] },
        { id: "c-nl-hag", type: 'city', title: "🏛️ 海牙 (The Hague)", subtitle: "莫瑞泰斯皇家美術館、和平宮、席凡寧根", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "海牙", "the hague", "莫瑞泰斯", "戴珍珠耳環的少女", "和平宮", "席凡寧根"], dna: ["皇家氣派", "國際法都"] },
        { id: "c-nl-utr", type: 'city', title: "⛪ 烏特勒支 (Utrecht)", subtitle: "主教塔、雙層運河、米飛兔博物館", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "烏特勒支", "utrecht", "主教塔", "雙層運河", "米飛兔"], dna: ["大學城", "雙層運河"] },
        { id: "c-nl-gie", type: 'city', title: "🛶 羊角村 (Giethoorn)", subtitle: "北方威尼斯、平底船遊河、蘆葦屋頂", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "羊角村", "giethoorn", "北方威尼斯", "平底船", "蘆葦屋頂"], dna: ["童話水鄉", "無車世外桃源"] },
        { id: "c-nl-kin", type: 'city', title: "🎐 風車村 (Kinderdijk)", subtitle: "世界遺產風車群、抽水站歷史", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "風車村", "kinderdijk", "世界遺產", "風車群", "桑斯安斯"], dna: ["經典風車", "水利工程"] },
        { id: "c-nl-keu", type: 'city', title: "🌷 庫肯霍夫花園 (Keukenhof)", subtitle: "鬱金香花海(春季限定)、荷蘭後花園", keywords: ["歐洲", "europe", "荷蘭", "netherlands", "庫肯霍夫", "keukenhof", "鬱金香", "花海"], dna: ["百萬花海", "春季限定"], validMonths: [3, 4, 5] },

        // --- 歐洲: 奧地利 (Austria) ---
        { id: "c-at-vie", type: 'city', title: "🇦🇹 維也納 (Vienna)", subtitle: "美泉宮、聖史蒂芬大教堂、歌劇院、咖啡館", keywords: ["歐洲", "europe", "奧地利", "austria", "維也納", "vienna", "美泉宮", "聖史蒂芬", "歌劇院", "咖啡館"], dna: ["古典音樂", "皇室宮殿"] },
        { id: "c-at-szg", type: 'city', title: "🎵 薩爾茨堡 (Salzburg)", subtitle: "莫札特故居、真善美拍攝地、要塞", keywords: ["歐洲", "europe", "奧地利", "austria", "薩爾茨堡", "salzburg", "莫札特", "真善美", "米拉貝爾花園"], dna: ["音樂之都", "巴洛克建築"] },
        { id: "c-at-hal", type: 'city', title: "🦢 哈修塔特 (Hallstatt)", subtitle: "最美湖畔小鎮、古鹽礦、人骨教堂", keywords: ["歐洲", "europe", "奧地利", "austria", "哈修塔特", "hallstatt", "湖畔小鎮", "古鹽礦", "人骨教堂"], dna: ["童話仙境", "湖光山色"] },
        { id: "c-at-inn", type: 'city', title: "🎿 因斯布魯克 (Innsbruck)", subtitle: "黃金屋頂、阿爾卑斯山景、施華洛世奇", keywords: ["歐洲", "europe", "奧地利", "austria", "因斯布魯克", "innsbruck", "黃金屋頂", "阿爾卑斯", "施華洛世奇"], dna: ["雪山之城", "水晶世界"] },
        { id: "c-at-grz", type: 'city', title: "👽 格拉茲 (Graz)", subtitle: "鐘塔老城區、現代美術館(外星人)、城堡山", keywords: ["歐洲", "europe", "奧地利", "austria", "格拉茲", "graz", "鐘塔", "現代美術館", "城堡山"], dna: ["前衛藝術", "紅屋頂老城"] },
        { id: "c-at-lnz", type: 'city', title: "🍰 林茲 (Linz)", subtitle: "登山電車、電子藝術中心、林茲蛋糕", keywords: ["歐洲", "europe", "奧地利", "austria", "林茲", "linz", "登山電車", "電子藝術中心", "林茲蛋糕"], dna: ["科技藝術", "甜點"] },
        { id: "c-at-dan", type: 'city', title: "🚲 多瑙河流域 (Danube Region)", subtitle: "瓦豪河谷、梅爾克修道院、葡萄園單車", keywords: ["歐洲", "europe", "奧地利", "austria", "多瑙河", "danube", "瓦豪河谷", "梅爾克修道院", "葡萄園"], dna: ["河谷風光", "單車品酒"] },

        // --- 歐洲: 捷克 (Czech) & 比利時 (Belgium) & 匈牙利 (Hungary) ---
        { id: "c-cz-prg", type: 'city', title: "🇨🇿 布拉格 (Prague)", subtitle: "查理大橋、天文鐘、布拉格城堡、舊城廣場", keywords: ["歐洲", "europe", "捷克", "czech", "布拉格", "prague", "查理大橋", "天文鐘", "布拉格城堡"], dna: ["中世紀浪漫", "童話之城"] },
        { id: "c-cz-ck", type: 'city', title: "🏰 庫倫洛夫 (Český Krumlov)", subtitle: "世界遺產彩繪塔、童話紅瓦小鎮", keywords: ["歐洲", "europe", "捷克", "czech", "庫倫洛夫", "cesky krumlov", "CK小鎮", "彩繪塔"], dna: ["紅瓦童話", "小鎮漫遊"] },
        { id: "c-cz-kv", type: 'city', title: "♨️ 卡羅維瓦利 (Karlovy Vary)", subtitle: "溫泉杯散步、電影節勝地、莫札特咖啡館", keywords: ["歐洲", "europe", "捷克", "czech", "卡羅維瓦利", "karlovy vary", "KV小鎮", "溫泉杯"], dna: ["飲泉文化", "優雅療癒"] },
        { id: "c-be-bru", type: 'city', title: "🇧🇪 布魯塞爾 (Brussels)", subtitle: "大廣場、尿尿小童、原子球塔、鬆餅巧克力", keywords: ["歐洲", "europe", "比利時", "belgium", "布魯塞爾", "brussels", "大廣場", "尿尿小童", "原子球塔"], dna: ["歐盟心臟", "巧克力甜點"] },
        { id: "c-be-bgg", type: 'city', title: "🛶 布魯日 (Bruges)", subtitle: "北方威尼斯、中世紀運河、鐘樓、愛之湖", keywords: ["歐洲", "europe", "比利時", "belgium", "布魯日", "bruges", "北方威尼斯", "運河", "鐘樓"], dna: ["中世紀水都", "浪漫靜謐"] },
        { id: "c-hu-bud", type: 'city', title: "🇭🇺 布達佩斯 (Budapest)", subtitle: "多瑙河珍珠、國會大廈、漁人堡、塞切尼溫泉", keywords: ["歐洲", "europe", "匈牙利", "hungary", "布達佩斯", "budapest", "國會大廈", "漁人堡", "塞切尼溫泉"], dna: ["多瑙河夜景", "百年浴場"] },

        // --- 歐洲: 希臘 (Greece) & 冰島 (Iceland) & 北歐 (Nordic) ---
        { id: "c-gr-ath", type: 'city', title: "🇬🇷 雅典 (Athens)", subtitle: "帕德嫩神廟、衛城博物館、憲法廣場", keywords: ["歐洲", "europe", "希臘", "greece", "雅典", "athens", "帕德嫩神廟", "衛城", "憲法廣場"], dna: ["古希臘神話", "歷史遺跡"] },
        { id: "c-gr-jtr", type: 'city', title: "⛪ 聖托里尼 (Santorini)", subtitle: "藍頂教堂、伊亞夕照、費拉懸崖、黑沙灘", keywords: ["歐洲", "europe", "希臘", "greece", "聖托里尼", "santorini", "藍頂教堂", "伊亞", "費拉"], dna: ["愛琴海浪漫", "絕美夕陽"] },
        { id: "c-gr-jmk", type: 'city', title: "🏖️ 米克諾斯 (Mykonos)", subtitle: "卡托米利風車、小威尼斯、天堂海灘", keywords: ["歐洲", "europe", "希臘", "greece", "米克諾斯", "mykonos", "風車", "小威尼斯", "天堂海灘"], dna: ["白色迷宮", "海島派對"] },
        { id: "c-is-rek", type: 'city', title: "🇮🇸 雷克雅維克 (Reykjavik)", subtitle: "教堂、彩色街道、托寧湖", keywords: ["歐洲", "europe", "冰島", "iceland", "雷克雅維克", "reykjavik", "哈爾格林姆教堂", "太陽航海者"], dna: ["極北首都", "設計文青"] },
        { id: "c-is-gci", type: 'city', title: "🌋 黃金圈 (Golden Circle)", subtitle: "辛格韋德利國家公園、古佛斯瀑布、間歇泉", keywords: ["歐洲", "europe", "冰島", "iceland", "黃金圈", "golden circle", "辛格韋德利", "古佛斯瀑布", "蓋錫爾"], dna: ["地質奇觀", "壯闊瀑布"] },
        { id: "c-is-blu", type: 'city', title: "♨️ 藍湖 (Blue Lagoon)", subtitle: "地熱溫泉水療、矽泥面膜、夢幻藍泉", keywords: ["歐洲", "europe", "冰島", "iceland", "藍湖", "blue lagoon", "溫泉水療", "矽泥面膜"], dna: ["夢幻泉水", "極致放鬆"] },
        { id: "c-se-sto", type: 'city', title: "🇸🇪 斯德哥爾摩 (Stockholm)", subtitle: "北方威尼斯、瓦薩沉船、老城區、地鐵藝術", keywords: ["歐洲", "europe", "瑞典", "sweden", "斯德哥爾摩", "stockholm", "瓦薩", "老城區", "地鐵藝術"], dna: ["群島水都", "極簡設計"] },
        { id: "c-dk-cph", type: 'city', title: "🇩🇰 哥本哈根 (Copenhagen)", subtitle: "小美人魚雕像、新港彩色房子、緹沃麗樂園", keywords: ["歐洲", "europe", "丹麥", "denmark", "哥本哈根", "copenhagen", "小美人魚", "新港", "緹沃麗"], dna: ["童話國度", "單車城市"] },

        // --- 美洲 (Americas) ---
        { id: "c-us-nyc", type: 'city', title: "🗽 紐約 (New York)", subtitle: "時代廣場、自由女神、中央公園、百老匯", keywords: ["美國", "usa", "america", "紐約", "new york", "nyc", "時代廣場", "自由女神", "中央公園", "百老匯", "帝國大廈"], dna: ["大都會", "世界中心", "藝術博物館"] },
        { id: "c-us-lax", type: 'city', title: "🎬 洛杉磯 (Los Angeles)", subtitle: "好萊塢星光大道、環球影城、聖莫尼卡", keywords: ["美國", "usa", "america", "洛杉磯", "los angeles", "la", "好萊塢", "環球影城", "聖莫尼卡", "天文台"], dna: ["影視娛樂", "陽光沙灘", "主題樂園"] },
        { id: "c-us-sfo", type: 'city', title: "🌉 舊金山 (San Francisco)", subtitle: "金門大橋、漁人碼頭、九曲花街、惡魔島", keywords: ["美國", "usa", "america", "舊金山", "san francisco", "金門大橋", "漁人碼頭", "九曲花街", "惡魔島", "叮噹車"], dna: ["海灣風情", "高低起伏", "科技重鎮"] },
        { id: "c-us-las", type: 'city', title: "🎰 拉斯維加斯 (Las Vegas)", subtitle: "豪華賭場、太陽馬戲團、噴泉秀、大峽谷門戶", keywords: ["美國", "usa", "america", "拉斯維加斯", "las vegas", "賭城", "大峽谷", "太陽馬戲團"], dna: ["極致娛樂", "奢華夜生活", "沙漠不夜城"] },
        { id: "c-us-sea", type: 'city', title: "☕ 西雅圖 (Seattle)", subtitle: "太空針塔、派克市場(首家星巴克)", keywords: ["美國", "usa", "america", "西雅圖", "seattle", "太空針塔", "派克市場", "星巴克"], dna: ["咖啡文化", "科技浪漫"] },
        { id: "c-us-orl", type: 'city', title: "🎢 奧蘭多 (Orlando)", subtitle: "迪士尼世界、環球影城度假區、樂高樂園", keywords: ["美國", "usa", "america", "奧蘭多", "orlando", "迪士尼世界", "環球影城", "樂高樂園", "航天中心"], dna: ["世界級樂園", "家庭狂歡"] },
        { id: "c-us-hnl", type: 'city', title: "🌺 夏威夷 (Hawaii)", subtitle: "威基基海灘、珍珠港、火山國家公園", keywords: ["美國", "usa", "america", "夏威夷", "hawaii", "威基基", "珍珠港", "火山國家公園", "大峽谷"], dna: ["熱帶天堂", "火山奇觀"] },
        { id: "c-ca-yvr", type: 'city', title: "🍁 溫哥華 (Vancouver)", subtitle: "史丹利公園、滑雪勝地與自然風光", keywords: ["加拿大", "canada", "ca", "溫哥華", "vancouver", "史丹利公園", "洛磯山脈", "滑雪"], dna: ["宜居城市", "山海交界"] },
        { id: "c-ca-yyz", type: 'city', title: "🏙️ 多倫多 (Toronto)", subtitle: "CN塔、尼加拉大瀑布、釀酒廠區", keywords: ["加拿大", "canada", "ca", "多倫多", "toronto", "CN塔", "尼加拉瀑布", "釀酒廠"], dna: ["多元文化", "壯闊瀑布"] },
        { id: "c-ca-ban", type: 'city', title: "🏔️ 班夫 (Banff)", subtitle: "露易絲湖、冰原大道、洛磯山脈", keywords: ["加拿大", "canada", "ca", "班夫", "banff", "露易絲湖", "冰原大道", "洛磯山脈"], dna: ["冰河地形", "野生動物"] },
        { id: "c-ca-yzf", type: 'city', title: "🌌 黃刀鎮 (Yellowknife)", subtitle: "極光觀賞、冰上釣魚", keywords: ["加拿大", "canada", "ca", "黃刀鎮", "yellowknife", "極光", "冰上釣魚"], dna: ["極光之都", "極地體驗"] },

        // --- 大洋洲 (Oceania) ---
        { id: "c-au-syd", type: 'city', title: "🇦🇺 雪梨 (Sydney)", subtitle: "歌劇院、港灣大橋、邦代海灘、藍山", keywords: ["澳洲", "australia", "au", "雪梨", "sydney", "歌劇院", "港灣大橋", "邦代海灘", "藍山"], dna: ["陽光沙灘", "海港地標"] },
        { id: "c-au-mel", type: 'city', title: "☕ 墨爾本 (Melbourne)", subtitle: "大洋路、菲利普島企鵝、咖啡街頭、古董電車", keywords: ["澳洲", "australia", "au", "墨爾本", "melbourne", "大洋路", "企鵝", "古董電車"], dna: ["咖啡文化", "藝術街頭"] },
        { id: "c-au-bne", type: 'city', title: "🐨 布里斯本 (Brisbane)", subtitle: "龍柏無尾熊、故事橋、南岸公園", keywords: ["澳洲", "australia", "au", "布里斯本", "brisbane", "無尾熊", "故事橋", "南岸公園"], dna: ["陽光之都", "生態親近"] },
        { id: "c-au-ool", type: 'city', title: "🏄 黃金海岸 (Gold Coast)", subtitle: "衝浪者天堂、四大主題樂園", keywords: ["澳洲", "australia", "au", "黃金海岸", "gold coast", "衝浪者天堂", "主題樂園", "Q1大廈"], dna: ["衝浪聖地", "樂園狂歡"] },
        { id: "c-au-cns", type: 'city', title: "🤿 凱恩斯 (Cairns)", subtitle: "大堡礁浮潛、熱帶雨林、空中纜車", keywords: ["澳洲", "australia", "au", "凱恩斯", "cairns", "大堡礁", "熱帶雨林", "空中纜車"], dna: ["珊瑚礁潛水", "世界遺產"] },
        { id: "c-nz-akl", type: 'city', title: "🇳🇿 奧克蘭 (Auckland)", subtitle: "天空塔、帆船之都、伊甸山", keywords: ["紐西蘭", "new zealand", "nz", "奧克蘭", "auckland", "天空塔", "帆船之都", "哈比村"], dna: ["火山地形", "千帆之都"] },
        { id: "c-nz-zqn", type: 'city', title: "🪂 皇后鎮 (Queenstown)", subtitle: "高空彈跳、噴射快艇、滑雪聖地", keywords: ["紐西蘭", "new zealand", "nz", "皇后鎮", "queenstown", "高空彈跳", "噴射快艇", "瓦卡蒂普湖", "滑雪"], dna: ["極限運動", "湖光山色"] },
        { id: "c-nz-chc", type: 'city', title: "🌸 基督城 (Christchurch)", subtitle: "花園城市、雅芳河撐船、硬紙板教堂", keywords: ["紐西蘭", "new zealand", "nz", "基督城", "christchurch", "花園城市", "雅芳河", "硬紙板教堂"], dna: ["英倫風情", "浴火重生"] },
        { id: "c-nz-mif", type: 'city', title: "🏔️ 米佛峽灣 (Milford Sound)", subtitle: "冰河地形、瀑布巡航、海豹與企鵝", keywords: ["紐西蘭", "new zealand", "nz", "米佛峽灣", "milford sound", "冰河地形", "瀑布巡航"], dna: ["世界八大奇景", "壯闊峽灣"] },

        // --- 中東與亞非 (MEA) ---
        { id: "c-ae-dxb", type: 'city', title: "🇦🇪 杜拜 (Dubai)", subtitle: "哈里發塔、帆船飯店、奢華購物、沙漠衝沙", keywords: ["阿聯酋", "uae", "中東", "杜拜", "dubai", "哈里發塔", "帆船飯店", "沙漠", "衝沙"], dna: ["極致奢華", "現代建築奇蹟"] },
        { id: "c-ae-auh", type: 'city', title: "🕌 阿布達比 (Abu Dhabi)", subtitle: "大清真寺、羅浮宮分館、法拉利世界", keywords: ["阿聯酋", "uae", "中東", "阿布達比", "abu dhabi", "大清真寺", "羅浮宮", "法拉利"], dna: ["文化瑰寶", "主題樂園"] },
        { id: "c-tr-ist", type: 'city', title: "🇹🇷 伊斯坦堡 (Istanbul)", subtitle: "藍色清真寺、大巴札、歐亞交界", keywords: ["土耳其", "turkey", "伊斯坦堡", "istanbul", "藍色清真寺", "大巴札", "歐亞交界"], dna: ["跨洲文化", "古老帝國"] },
        { id: "c-tr-cap", type: 'city', title: "🎈 卡帕多奇亞 (Cappadocia)", subtitle: "熱氣球、洞穴飯店、地下城", keywords: ["土耳其", "turkey", "卡帕多奇亞", "cappadocia", "熱氣球", "洞穴飯店", "地下城"], dna: ["奇幻地貌", "夢幻天空"] },
        { id: "c-tr-pam", type: 'city', title: "☁️ 棉堡 (Pamukkale)", subtitle: "石灰岩溫泉、希拉波利斯古城", keywords: ["土耳其", "turkey", "棉堡", "pamukkale", "石灰岩溫泉", "古城"], dna: ["地質奇觀", "古羅馬溫泉"] }
    ]
};