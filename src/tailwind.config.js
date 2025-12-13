/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 我們定義一個 'brand' 系列，方便管理
        brand: {
          green: '#45846D',  // 主色：森林綠 (按鈕、重點)
          beige: '#E4E2DD',  // 背景：米灰 (全域背景)
          black: '#1D1D1B',  // 文字：柔黑 (標題、內文)
          white: '#FFFFFF',  // 卡片：純白 (區塊背景)
          red: '#EF5350',    // 警示：磚紅 (登出、錯誤)
          input: '#F5F5F4',  // 輸入框：極淺灰 (比白色稍微暗一點點)
        },
        // 保留你原本的 iOS 設定，以備不時之需
        ios: {
          bg: '#F2F2F7',
          card: '#FFFFFF',
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          gray: '#8E8E93',
          separator: '#C6C6C8',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      padding: {
        'safe': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      }
    },
  },
  plugins: [],
}