// src/components/pdf/TripPDFDocument.tsx
import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { pdfStyles as s } from '../../utils/pdfStyles';
import { registerPDFFonts } from '../../utils/pdfFonts';
import { 
    sanitizeTextForPDF, 
    formatPDFDate, 
    getActivityTheme,
    getActivityLabel,
    isSignificantTransport,
    getTripStats,
    getTripCounts,
    getFeaturedHotels,
    getFeaturedTransports,
    getGalleryImages,
    getSafeDescription,
    truncateText,
    getTripDNA,
    getTripTotalCost 
} from '../../utils/pdfUtils';
import type { Trip } from '../../types';

// 初始化掛載開源繁體中文字體
registerPDFFonts();

interface TripPDFDocumentProps {
    trip: Trip;
}

export const TripPDFDocument: React.FC<TripPDFDocumentProps> = ({ trip }) => {
    const sanitizedDestination = sanitizeTextForPDF(trip.destination);
    const originCity = sanitizeTextForPDF(trip.origin || 'TPE');
    
    // 數據萃取
    const { totalDays } = getTripStats(trip);
    const counts = getTripCounts(trip);
    const featuredHotels = getFeaturedHotels(trip);
    const featuredTransports = getFeaturedTransports(trip);
    const galleryImages = getGalleryImages(trip);
    
    // 🛡️ 9.1 優化：精確設定 X 與 Y 軸百分比，確保符合 React-PDF 解析規格
    const coverPositionY = trip.coverImagePositionY ?? 50;
    
    const currentCurrency = (trip as any).currency || 'TWD';
    const totalCostString = getTripTotalCost(trip, currentCurrency);
    const tripDNA = getTripDNA(trip);

    // 🪄 Phase B：旅程結束後（今天 > endDate）自動切換為「回憶錄」模式
    const isMemoir = (() => {
        if (!trip.endDate) return false;
        const end = new Date(trip.endDate);
        end.setHours(23, 59, 59, 999);
        return new Date().getTime() > end.getTime();
    })();

    // 回憶錄照片頁（memoir 模式前移到封面後讓照片先登場；否則放最後）
    const galleryPage = galleryImages.length > 0 ? (
        <Page size="A4" style={s.page}>
            <View style={s.galleryTitleGroup}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1D1D1B' }}>
                    {isMemoir ? '旅途回憶錄' : 'MEMORY GALLERY'}
                </Text>
                <Text style={{ fontSize: 10, color: '#71717A', marginTop: 2, letterSpacing: 1 }}>旅途精彩回憶集錦</Text>
            </View>

            <View style={s.galleryGrid}>
                {galleryImages.map((img, idx) => (
                    <View key={idx} style={s.polaroidCard} wrap={false}>
                        <Image
                            src={img.url}
                            style={{ ...s.polaroidImage, objectPosition: `50% ${img.positionY}%` }}
                        />
                        <Text style={s.polaroidCaption}>
                            {truncateText(`Day ${img.day}  ${img.caption}`, 12)}
                        </Text>
                    </View>
                ))}
            </View>

            <Text style={s.footer} render={({ pageNumber }) => (
                `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}    PAGE ${pageNumber}`
            )} fixed />
        </Page>
    ) : null;

    return (
        <Document title={`${sanitizedDestination} 行程表 - Kelvin Trip`}>
            
            {/* === 1. 封面頁 (9.1 適配：修正百分比位置語法) === */}
            <Page size="A4" style={s.coverPage}>
                <View style={s.coverTop}>
                    {trip.coverImage ? (
                        <Image 
                            src={trip.coverImage} 
                            style={{ 
                                ...s.coverImage, 
                                objectPosition: `50% ${coverPositionY}%` // 🛡️ 修正為標準二維數值，避免 React-PDF 潔癖黑底
                            }} 
                        />
                    ) : null}
                </View>
                
                <View style={s.coverBottom}>
                    <View style={s.coverTitleGroup}>
                        <Text style={s.coverRoute}>{`FROM ${originCity}`}</Text>
                        <Text style={s.coverTitle}>{sanitizedDestination}</Text>
                        <Text style={s.coverSubtitle}>
                            {`${formatPDFDate(trip.startDate)}  ${formatPDFDate(trip.endDate)}`}
                        </Text>
                        <Text style={s.coverMode}>
                            {isMemoir ? '回憶錄 · MEMOIR' : '行程書 · ITINERARY'}
                        </Text>
                    </View>

                    {/* 🎨 旅伴在分隔線「上方」，中文標籤（未來 i18n 可切換語言） */}
                    <View style={s.coverMetaGroup}>
                        {trip.members && trip.members.length > 0 ? (
                            <Text style={s.coverCompanion}>
                                {`旅伴 · ${sanitizeTextForPDF(trip.members.map(m => m.name).join(', '))}`}
                            </Text>
                        ) : null}
                        <View style={s.coverDivider} />
                    </View>
                </View>
                
                <Text style={s.footer} fixed>
                    {`KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}    COVER`}
                </Text>
            </Page>

            {/* 🪄 回憶錄模式：照片頁前移，打開先看到回憶 */}
            {isMemoir ? galleryPage : null}

            {/* === 2. 核心資訊頁 === */}
            <Page size="A4" style={s.page}>
                <Text style={s.sectionTitle}>行程核心資訊</Text>
                
                <View style={s.dnaContainer}>
                    <Text style={s.dnaText}>{`這趟旅程包含：${tripDNA}`}</Text>
                </View>

                <View style={s.dashboardGrid}>
                    <View style={s.dashboardRow}>
                        <View style={s.dashboardCard}>
                            <Text style={s.statsNumberBig}>{totalDays.toString()}</Text>
                            <Text style={s.statsLabel}>Total Days / 總天數</Text>
                        </View>
                        <View style={s.dashboardCard}>
                            {/* 有金額用襯線（與其他數字一致）；"尚未估算"(中文) 才退回黑體 */}
                            <Text style={totalCostString === '尚未估算' ? s.statsNumber : [s.statsNumberBig, { fontSize: 26 }]}>
                                {totalCostString}
                            </Text>
                            <Text style={s.statsLabel}>Estimated Cost / 預估總花費</Text>
                        </View>
                    </View>
                    {/* 🪄 旅程數據（Wrapped 感）：景點 / 美食 大數字 */}
                    <View style={s.dashboardRow}>
                        <View style={s.dashboardCard}>
                            <Text style={s.statsNumberBig}>{counts.spots.toString()}</Text>
                            <Text style={s.statsLabel}>Spots / 景點探索</Text>
                        </View>
                        <View style={s.dashboardCard}>
                            <Text style={s.statsNumberBig}>{counts.foods.toString()}</Text>
                            <Text style={s.statsLabel}>Foodie / 美食尋味</Text>
                        </View>
                    </View>

                    <View style={s.walletPass}>
                        <View style={s.walletPassHeader}>
                            <Text style={s.walletPassType}>住宿精選</Text>
                        </View>
                        {featuredHotels.length > 0 ? (
                            featuredHotels.slice(0, 3).map((hotel, idx) => (
                                <View key={idx} style={{ marginBottom: idx !== featuredHotels.slice(0, 3).length - 1 ? 14 : 0 }}>
                                    <Text style={s.walletPassMainTitle}>
                                        {hotel.location ? getSafeDescription(hotel.location) : getSafeDescription(hotel.title)}
                                    </Text>
                                    {hotel.location ? (
                                        <Text style={s.walletPassSubText}>
                                            {getSafeDescription(hotel.title)}
                                        </Text>
                                    ) : null}
                                </View>
                            ))
                        ) : (
                            <Text style={s.walletPassSubText}>暫無標註住宿資訊</Text>
                        )}
                    </View>

                    <View style={s.walletPass}>
                        <View style={s.walletPassHeader}>
                            <Text style={s.walletPassType}>關鍵交通</Text>
                        </View>
                        {featuredTransports.length > 0 ? (
                            featuredTransports.slice(0, 3).map((trans, idx) => (
                                <View key={idx} style={{ marginBottom: idx !== featuredTransports.slice(0, 3).length - 1 ? 14 : 0 }}>
                                    <Text style={s.walletPassMainTitle}>
                                        {getSafeDescription(trans.title)}
                                    </Text>
                                    {trans.description ? (
                                        <Text style={s.walletPassSubText}>
                                            {getSafeDescription(trans.description)}
                                        </Text>
                                    ) : null}
                                </View>
                            ))
                        ) : (
                            <Text style={s.walletPassSubText}>暫無跨境航班或高鐵</Text>
                        )}
                    </View>
                </View>
                
                <Text style={s.footer} render={({ pageNumber }) => (
                    `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}    PAGE ${pageNumber}`
                )} fixed />
            </Page>

            {/* === 3. 每日行程頁 (9.1 修正：全面阻斷斷頁時間分離) === */}
            {trip.days.map((day, dIdx) => {
                // 🪄 Phase B：隱藏「當地點到點移動」(type === 'transport')，只留景點/美食/住宿與跨城市飛機/火車
                const validActivities = day.activities.filter(a => isSignificantTransport(a) && a.type !== 'transport');
                if (validActivities.length === 0) return null;

                return (
                    <Page key={dIdx} size="A4" style={s.page}>
                        <View style={s.dayDivider}>
                            <View style={s.dayDividerHeader}>
                                <Text style={s.dayDividerTitle}>{`DAY ${day.day}`}</Text>
                                <View style={s.dayDividerVibe}>
                                    <Text style={s.dayDividerVibeText}>
                                        {day.vibeTag || '探索未知的驚喜旅程'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={s.dayDividerDate}>{formatPDFDate(day.date)}</Text>
                        </View>

                        {validActivities.map((act, aIdx) => {
                            const isTransport = act.type.toLowerCase() === 'transport';
                            const theme = getActivityTheme(act.type);

                            return (
                                // 🛡️ 9.1 修正：將 wrap={false} 提升至整行容器，防禦左側時間與右側卡片在分頁邊緣被切開
                                <View key={aIdx} style={s.timelineContainer} wrap={false}>
                                    <View style={s.timelineLeft}>
                                        <View style={s.timelineLine} />
                                        <Text style={s.timeText}>{act.time}</Text>
                                    </View>

                                    {/* 🛡️ 9.1 修正：移除此處的 wrap 限制，將其權限完全交由外層 Container 控制 */}
                                    <View style={s.timelineContent}>
                                        {isTransport ? (
                                            <View style={s.transportCard}>
                                                <Text style={s.transportText}>
                                                    {` ${sanitizeTextForPDF(act.title)}${act.description ? ` (${sanitizeTextForPDF(act.description)})` : ''}`}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={s.activityCard}>
                                                <View style={s.activityHeader}>
                                                    <Text style={s.activityTitle}>
                                                        {sanitizeTextForPDF(act.title)}
                                                    </Text>
                                                    <Text style={[s.activityTypeTag, { color: theme.color, backgroundColor: theme.bgColor }]}>
                                                        {getActivityLabel(act.type)}
                                                    </Text>
                                                </View>
                                                
                                                {act.location ? (
                                                    <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
                                                        {`Location: ${sanitizeTextForPDF(act.location)}`}
                                                    </Text>
                                                ) : null}

                                                {(act.expenseImage || act.description) ? (
                                                    <View style={s.descContainer}>
                                                        {act.expenseImage ? (
                                                            <View style={s.imageContainer}>
                                                                <Image
                                                                    src={act.expenseImage}
                                                                    style={{
                                                                        ...s.image,
                                                                        height: 160,          // 固定框景，objectPosition 才會生效
                                                                        objectFit: 'cover',
                                                                        objectPosition: `50% ${act.imagePositionY ?? 50}%`,
                                                                    }}
                                                                />
                                                            </View>
                                                        ) : null}
                                                        {act.description ? (
                                                            <Text style={s.descText}>
                                                                {getSafeDescription(act.description)}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                        
                        <Text style={s.footer} render={({ pageNumber }) => (
                            `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}    PAGE ${pageNumber}`
                        )} fixed />
                    </Page>
                );
            })}

            {/* === 4. 餘韻頁（非回憶錄模式時放最後） === */}
            {!isMemoir ? galleryPage : null}
        </Document>
    );
};