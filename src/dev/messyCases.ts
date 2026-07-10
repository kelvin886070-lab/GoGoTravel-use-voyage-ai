// src/dev/messyCases.ts
// 🔬 對抗式稽核：手寫「髒輸入」案例（口語/模糊、同名連鎖）。自動弄髒只能做「抽 context」「去英文」，
//    這兩種要靠你出手。改完存檔，再於 Console 跑 `await __geoBench()`。
//
// 規則：
//   kind='口語'：truthTitle 必填 —— 填你「29 筆心願裡」的完整標題，我拿它的座標當真值來量距離。
//   kind='連鎖'：truthTitle 留空 —— 沒有單一真值，只看「信心旗標會不會正確地說『我不確定』」。
//   context：使用者若會附城市就填，想模擬「什麼都沒給」就留空字串。

export interface MessyCase {
    query: string;          // 使用者實際會打的字（故意零碎/口語/模糊）
    context?: string;       // 附帶的城市/地區；留空模擬「沒給」
    truthTitle?: string;    // 對應的真實心願標題（口語必填；連鎖留空）
    kind: '口語' | '連鎖';
}

export const messyCases: MessyCase[] = [
        // ── 實戰聊天紀錄口語化測試 ───────────────────────────────
    { 
        query: '中西區那間 自然熟 吃午餐。他們家主打蔬食和義大利麵，環境很舒服、很慵懶', 
        context: '台南', 
        truthTitle: '自然熟 clean & wild eats', 
        kind: '口語' 
    },
    { 
        query: '綠町抹茶甜點專門店。這家身為抹茶控絕對要點爆！他們的抹茶千層跟芭菲真的濃郁到不行', 
        context: '台南', 
        truthTitle: '綠町抹茶甜點專門店', 
        kind: '口語' 
    },
    { 
        query: '古意人咖啡。那裡真的超妙，沒什麼招牌，隱密在巷弄裡面，坐在那裡喝杯冰美式或手沖', 
        context: '台南', 
        truthTitle: '古意人咖啡', 
        kind: '口語' 
    },
    { 
        query: '一家叫做 貓島廚房 的店。一進去裡面真的都是貓咪，一邊擼貓一邊吃他們的熱騰騰燉飯', 
        context: '台南', 
        truthTitle: '貓島廚房 Isle of Cats Kitchen', 
        kind: '口語' 
    },
    { 
        query: 'IPA cellar Sparrow brew。這家精釀啤酒的選擇超多，點杯滿滿啤酒花香的 IPA', 
        context: '台南', 
        truthTitle: 'IPA cellar Sparrow brew', 
        kind: '口語' 
    },

];
