import { Font } from '@react-pdf/renderer';

// ==========================================
// 註冊繁體中文字體 (Noto Sans TC)
// ==========================================
// 說明：@react-pdf 必須使用 .ttf 格式。這裡我們使用 jsDelivr CDN 提供的開源字體。
export const registerPDFFonts = () => {
    Font.register({
        family: 'NotoSansTC',
        fonts: [
            {
                // 常規體 (Regular)
                src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf',
                fontWeight: 'normal',
            },
            {
                // 粗體 (Bold) 用於大標題
                src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Bold.otf',
                fontWeight: 'bold',
            }
        ]
    });
};