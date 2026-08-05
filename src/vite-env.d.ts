
// solarlunar 有型別檔，但它的 package.json "exports" 沒有把 types 對外，TS 解析不到。
// 在這裡補上最小宣告（只宣告我們用到的那一支）——比 @ts-ignore 誠實，也能保住型別檢查。
declare module 'solarlunar' {
    interface SolarLunarResult {
        monthCn: string;
        dayCn: string;
    }
    const api: { solar2lunar: (y: number, m: number, d: number) => SolarLunarResult };
    export default api;
}
