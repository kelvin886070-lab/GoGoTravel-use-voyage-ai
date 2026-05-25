// src/components/pdf/TripPDFDocument.tsx
import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { pdfStyles as s } from '../../utils/pdfStyles';
import { registerPDFFonts } from '../../utils/pdfFonts';
import { 
    sanitizeTextForPDF, 
    formatPDFDate, 
    getActivityTheme, 
    isSignificantTransport,
    getTripStats,
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
    const featuredHotels = getFeaturedHotels(trip);
    const featuredTransports = getFeaturedTransports(trip);
    const galleryImages = getGalleryImages(trip);
    
    // 🛡️ 9.0 優化：取得封面 Y 軸偏移量 (預設 50% 置中)
    const coverPositionY = trip.coverImagePositionY ?? 50;
    
    const currentCurrency = (trip as any).currency || 'TWD';
    const totalCostString = getTripTotalCost(trip, currentCurrency);
    const tripDNA = getTripDNA(trip);

    return (
        <Document title={`${sanitizedDestination} 行程表 - Kelvin Trip`}>
            
            {/* === 1. 封面頁 (9.0 適配：套用無損座標 Y 軸裁切) === */}
            <Page size="A4" style={s.coverPage}>
                <View style={s.coverTop}>
                    {trip.coverImage ? (
                        <Image 
                            src={trip.coverImage} 
                            style={{ 
                                ...s.coverImage, 
                                objectPosition: `center ${coverPositionY}%` // 👈 9.0 核心：套用無損 Y 軸座標
                            }} 
                        />
                    ) : null}
                </View>
                
                <View style={s.coverBottom}>
                    <View style={s.coverTitleGroup}>
                        <View style={s.coverTag}>
                            <Text style={s.coverTagText}>{`FROM ${originCity}`}</Text>
                        </View>
                        <Text style={s.coverTitle}>{sanitizedDestination}</Text>
                        <Text style={s.coverSubtitle}>
                            {`${formatPDFDate(trip.startDate)} — ${formatPDFDate(trip.endDate)}`}
                        </Text>
                    </View>
                    
                    <View style={s.coverMetaGroup}>
                        {trip.members && trip.members.length > 0 ? (
                            <Text style={s.coverCompanion}>
                                {`COMPANION: ${sanitizeTextForPDF(trip.members.map(m => m.name).join(', '))}`}
                            </Text>
                        ) : null}
                    </View>
                </View>
                
                <Text style={s.footer} fixed>
                    {`KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}  —  COVER`}
                </Text>
            </Page>

            {/* === 2. 核心資訊頁 === */}
            <Page size="A4" style={s.page}>
                <Text style={s.sectionTitle}>行程核心資訊</Text>
                
                <View style={s.dnaContainer}>
                    <Text style={s.dnaText}>{`這趟旅程包含：${tripDNA}`}</Text>
                </View>

                <View style={s.dashboardGrid}>
                    <View style={s.dashboardRow}>
                        <View style={s.dashboardCard}>
                            <Text style={s.statsNumber}>{totalDays.toString()}</Text>
                            <Text style={s.statsLabel}>Total Days / 總天數</Text>
                        </View>
                        <View style={s.dashboardCard}>
                            <Text style={s.statsNumber}>{totalCostString}</Text>
                            <Text style={s.statsLabel}>Estimated Cost / 預估總花費</Text>
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
                    `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}  —  PAGE ${pageNumber}`
                )} fixed />
            </Page>

            {/* === 3. 每日行程頁 (8.1 同步 + 9.0 適配) === */}
            {trip.days.map((day, dIdx) => {
                const validActivities = day.activities.filter(isSignificantTransport);
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
                                <View key={aIdx} style={s.timelineContainer}>
                                    <View style={s.timelineLeft}>
                                        <View style={s.timelineLine} />
                                        <Text style={s.timeText}>{act.time}</Text>
                                    </View>

                                    <View style={s.timelineContent} wrap={false}>
                                        {isTransport ? (
                                            <View style={s.transportCard}>
                                                <Text style={s.transportText}>
                                                    {`—— ${sanitizeTextForPDF(act.title)}${act.description ? ` (${sanitizeTextForPDF(act.description)})` : ''}`}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={s.activityCard}>
                                                <View style={s.activityHeader}>
                                                    <Text style={s.activityTitle}>
                                                        {sanitizeTextForPDF(act.title)}
                                                    </Text>
                                                    <Text style={[s.activityTypeTag, { color: theme.color, backgroundColor: theme.bgColor }]}>
                                                        {act.type.toUpperCase()}
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
                                                                <Image src={act.expenseImage} style={s.image} />
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
                            `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}  —  PAGE ${pageNumber}`
                        )} fixed />
                    </Page>
                );
            })}

            {/* === 4. 餘韻頁 === */}
            {galleryImages.length > 0 ? (
                <Page size="A4" style={s.page}>
                    <View style={s.galleryTitleGroup}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1D1D1B' }}>MEMORY GALLERY</Text>
                        <Text style={{ fontSize: 10, color: '#71717A', marginTop: 2, letterSpacing: 1 }}>旅途精彩回憶集錦</Text>
                    </View>
                    
                    <View style={s.galleryGrid}>
                        {galleryImages.map((img, idx) => (
                            <View key={idx} style={s.polaroidCard} wrap={false}>
                                <Image src={img.url} style={s.polaroidImage} />
                                <Text style={s.polaroidCaption}>
                                    {truncateText(`Day ${img.day} · ${img.caption}`, 12)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <Text style={s.footer} render={({ pageNumber }) => (
                        `KELVIN TRIP  |  ${sanitizedDestination.toUpperCase()}  —  PAGE ${pageNumber}`
                    )} fixed />
                </Page>
            ) : null}
        </Document>
    );
};