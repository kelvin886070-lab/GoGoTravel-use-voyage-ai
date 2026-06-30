// src/utils/pdfStyles.ts

import { StyleSheet } from '@react-pdf/renderer';

// ==========================================
// Kelvin Trip: PDF 專屬 Design System (V7.0 終極旗艦版)
// ==========================================
export const pdfStyles = StyleSheet.create({
    // --- 全局基底 ---
    page: {
        fontFamily: 'NotoSansTC',
        backgroundColor: '#FAFAFA',
        padding: 40,
        paddingBottom: 65, 
        flexDirection: 'column',
    },
    
    // --- 1. 封面：Midnight Charcoal 極致黑夜 ---
    coverPage: {
        fontFamily: 'NotoSansTC',
        backgroundColor: '#18181B', 
        padding: 0,
        flexDirection: 'column',
    },
    coverTop: {
        height: '60%',            
        width: '100%',
        position: 'relative',
        backgroundColor: '#000000',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.9, 
    },
    coverBottom: {
        height: '40%',            
        width: '100%',
        backgroundColor: '#18181B', 
        padding: 40,
        paddingHorizontal: 45,
        justifyContent: 'space-between',
    },
    coverTitleGroup: {
        flexDirection: 'column',
    },
    coverTag: {
        backgroundColor: '#45846D', 
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 3,
        alignSelf: 'flex-start',
        marginBottom: 14,
    },
    coverTagText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 1.5,
    },
    coverTitle: {
        fontSize: 48, 
        fontWeight: 'bold',
        color: '#FFFFFF', 
        letterSpacing: 2,
        marginBottom: 8,
    },
    coverSubtitle: {
        fontSize: 12,
        color: '#A1A1AA',
        letterSpacing: 2,
    },
    // 🎨 封面改版：優雅的路線標題（取代綠色方塊）
    coverRoute: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#6F9E8C',
        letterSpacing: 4,
        marginBottom: 16,
    },
    coverMode: {
        fontSize: 9,
        letterSpacing: 2,
        color: '#6F9E8C',
        marginTop: 10,
    },
    // 旅伴在上、分隔線在下（直向）
    coverMetaGroup: {
        flexDirection: 'column',
        width: '100%',
    },
    coverDivider: {
        borderTopWidth: 1,
        borderTopColor: '#3F3F46',
        marginTop: 12,
        width: '100%',
    },
    coverCompanion: {
        fontSize: 10,
        color: '#E4E2DD',
        fontWeight: 'bold',
        letterSpacing: 1,
    },

    // --- 2. 核心資訊頁：Trip DNA & Apple Wallet 票夾 ---
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1D1D1B',
        marginBottom: 16,
        letterSpacing: 1,
    },
    dnaContainer: {
        backgroundColor: '#F4F4F5',
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        width: '100%',
        alignItems: 'center',
    },
    dnaText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1D1D1B',
        letterSpacing: 1,
    },
    // 雙欄數據儀表板 (天數 & 花費總額)
    dashboardGrid: {
        flexDirection: 'column',
        width: '100%',
    },
    dashboardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 12,
    },
    dashboardCard: {
        width: '48.5%',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'column',
        alignItems: 'center',
    },
    statsNumber: {
        fontSize: 24, // 🛡️ 微調縮小以容納 "TWD 45,000" 長字串
        fontWeight: 'bold',
        color: '#45846D',
        marginBottom: 4,
    },
    // 🪄 旅程數據：純整數的大數字用拉丁襯線（雜誌 Wrapped 感）
    statsNumberBig: {
        fontSize: 32,
        fontFamily: 'Times-Roman',
        fontWeight: 'bold',
        color: '#45846D',
        marginBottom: 4,
    },
    statsLabel: {
        fontSize: 10,
        color: '#71717A',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    // Apple Wallet 全寬票卡
    walletPass: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'column',
        marginBottom: 14, // 增加票卡間距
    },
    walletPassHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
        paddingBottom: 8,
    },
    walletPassType: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#45846D',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    walletPassMainTitle: {
        fontSize: 22, 
        fontWeight: 'bold',
        color: '#1D1D1B',
        marginBottom: 8,
        lineHeight: 1.3,
        width: '100%', 
    },
    walletPassSubText: {
        fontSize: 11,
        color: '#71717A',
        lineHeight: 1.6,
        width: '100%', 
    },

    // --- 3. 每日破題扉頁 (Chapter Divider) ---
    dayDivider: {
        marginTop: 15,
        marginBottom: 35, 
        width: '100%',
        flexDirection: 'column',
    },
    // 🛡️ 7.0 新增：水平併排的標題容器
    dayDividerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        width: '100%',
    },
    dayDividerTitle: {
        fontSize: 46,
        fontFamily: 'Times-Roman', // 🪄 拉丁襯線：DAY 標題（純英數）
        fontWeight: 'bold',
        color: '#1D1D1B',
        marginRight: 16, // 與靈魂標籤的間距
        letterSpacing: 2,
    },
    // 🛡️ 7.0 更新：無 Emoji 版本的高級極簡標籤
    dayDividerVibe: {
        backgroundColor: '#45846D', // 🪄 雜誌風：實心主題綠
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    dayDividerVibeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    dayDividerDate: {
        fontSize: 12,
        color: '#A1A1AA',
        letterSpacing: 2,
    },

    // --- 4. 每日行程 (精密雙欄時間軸) ---
    timelineContainer: {
        flexDirection: 'row',
        width: '100%', 
    },
    timelineLeft: {
        width: 55,
        alignItems: 'center',
        position: 'relative',
    },
    timelineLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '50%',
        width: 1,
        backgroundColor: '#E5E7EB',
        zIndex: 1,
    },
    timeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#45846D', // 🪄 雜誌風：時間用主題綠點綴
        marginTop: 14,
        backgroundColor: '#FAFAFA',
        paddingVertical: 3,
        zIndex: 2,
    },
    timelineContent: {
        flex: 1,
        width: '100%',
        paddingLeft: 15,
        paddingBottom: 22, 
        flexDirection: 'column',
    },
    activityCard: {
        // 🪄 雜誌風：柔和紙感卡片——保留「分組」邊界，但用暖米色淡底+極淡細線取代冷硬灰框
        backgroundColor: '#FBFAF6',
        borderRadius: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: '#EDEAE2',
        width: '100%',
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 5,
        width: '100%',
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1D1D1B',
        flex: 1, 
        paddingRight: 10,
    },
    activityTypeTag: {
        fontSize: 8,
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: 4,
        fontWeight: 'bold',
    },
    descContainer: {
        // 🪄 雜誌風：移除灰底框，改乾淨內文
        marginTop: 8,
        backgroundColor: 'transparent',
        borderRadius: 0,
        width: '100%',
    },
    descText: {
        fontSize: 11,
        color: '#52525B',
        lineHeight: 1.7,
        width: '100%',
    },
    transportCard: {
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    transportText: {
        fontSize: 11,
        color: '#A1A1AA', 
        fontWeight: 'bold',
        flex: 1,
    },

    // --- 5. 餘韻：不規則拍立得相片牆 ---
    galleryTitleGroup: {
        marginBottom: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 12,
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',           
        width: '100%',
        gap: 12,                    
    },
    polaroidCard: {
        width: '31.3%',              
        backgroundColor: '#FFFFFF',
        padding: 8,
        paddingBottom: 20,          
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#E4E2DD',
        flexDirection: 'column',
        marginBottom: 10,
    },
    polaroidImage: {
        width: '100%',
        height: 110,
        objectFit: 'cover',
        marginBottom: 8,
    },
    polaroidCaption: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#4B5563',
        textAlign: 'center',
        width: '100%',
    },

    // --- 6. 國際版型頁尾 ---
    imageContainer: {
        borderRadius: 4,
        marginBottom: 8,
        width: '100%',
    },
    image: {
        width: '100%',
        maxHeight: 180,
        objectFit: 'cover',
    },
    footer: {
        position: 'absolute',
        bottom: 25,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#A1A1AA',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase', 
    }
});