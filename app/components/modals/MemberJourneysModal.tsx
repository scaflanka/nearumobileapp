import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, authenticatedFetch } from "../../../utils/auth";
import { CircleMember, Journey, JourneyHistoryPoint } from "../../types/models";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MemberJourneysModalProps {
    isOpen: boolean;
    onClose: () => void;
    circleId?: string | number;
    memberId?: string | number;
}

const COLORS = {
    primary: "#113C9C",
    secondary: "#002B7F",
    accent: "#4ADE80",
    textMain: "#111827",
    textSub: "#6B7280",
    bgLight: "#F3F4F6",
    white: "#FFFFFF",
    blueLight: "#E8F0FE",
    error: "#EF4444",
};

// --- Helpers ---
const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const formatTimeRange = (start: string, end: string) => {
    try {
        const s = new Date(start);
        const e = new Date(end);
        const format = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
        return `${format(s)} - ${format(e)}`;
    } catch {
        return "N/A";
    }
};

const getDuration = (start: string, end: string) => {
    try {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        const diffMs = e - s;
        if (diffMs < 0) return "0 min";
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hrs} hr ${remainingMins} min`;
    } catch {
        return "N/A";
    }
};

const calculateJourneyStats = (history: JourneyHistoryPoint[]) => {
    let totalDist = 0;
    let maxSpeed = 0;

    for (let i = 0; i < history.length - 1; i++) {
        const p1 = history[i];
        const p2 = history[i + 1];
        const d = haversineDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        totalDist += d;

        const timeDiff = (new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime()) / 3600000; // in hours
        if (timeDiff > 0) {
            const speed = (d / 1609.34) / timeDiff; // mph
            if (speed > maxSpeed && speed < 150) maxSpeed = speed; // Filter out GPS jumps
        }
    }

    return {
        distanceMiles: (totalDist / 1609.34).toFixed(1),
        topSpeedMph: Math.round(maxSpeed),
    };
};

const MemberJourneysModal: React.FC<MemberJourneysModalProps> = ({
    isOpen,
    onClose,
    circleId,
    memberId
}) => {
    const [loading, setLoading] = useState(false);
    const [memberData, setMemberData] = useState<CircleMember | null>(null);
    const [journeys, setJourneys] = useState<Journey[]>([]);

    const fetchHistory = useCallback(async () => {
        if (!circleId || !memberId) return;
        setLoading(true);
        try {
            const response = await authenticatedFetch(
                `${API_BASE_URL}/circles/${circleId}/history?page=1&perPage=100`
            );
            if (response.ok) {
                const payload = await response.json();
                const historyData = payload?.data;
                const membersWithHistory = historyData?.members || [];
                const creatorData = historyData?.creator;

                let foundMember = null;
                if (creatorData && String(creatorData.id) === String(memberId)) {
                    foundMember = creatorData;
                } else {
                    foundMember = membersWithHistory.find((m: any) => String(m.id) === String(memberId));
                }

                if (foundMember) {
                    setMemberData(foundMember);
                    setJourneys(foundMember.journeys || []);
                }
            }
        } catch (error) {
            console.warn("Failed to fetch member journeys", error);
        } finally {
            setLoading(false);
        }
    }, [circleId, memberId]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const weeklyStats = useMemo(() => {
        let topSpeed = 0;
        let totalMiles = 0;
        let totalDrives = 0;

        journeys.forEach(j => {
            const stats = calculateJourneyStats(j.history || []);
            if (stats.topSpeedMph > topSpeed) topSpeed = stats.topSpeedMph;
            totalMiles += parseFloat(stats.distanceMiles);
            if (parseFloat(stats.distanceMiles) > 0.1) totalDrives++;
        });

        return {
            topSpeed: topSpeed || 0,
            totalDrives,
            totalMiles: totalMiles.toFixed(1)
        };
    }, [journeys]);

    if (!isOpen) return null;

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                <View>
                    <Text style={styles.headerTitle}>{memberData?.name || "Member"}</Text>
                    <Text style={styles.headerSubtitle}>Last Update now</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchHistory} style={styles.refreshButton}>
                <Ionicons name="refresh" size={22} color={COLORS.primary} />
            </TouchableOpacity>
        </View>
    );

    const renderProfileBar = () => {
        const batteryPercent = memberData?.batteryLevel?.batteryLevel ?? 0;
        return (
            <View style={styles.profileBar}>
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: memberData?.avatar || "https://ui-avatars.com/api/?name=" + (memberData?.name || "User") }}
                        style={styles.avatar}
                    />
                    <View style={styles.statusDot} />
                    <View style={styles.batteryBadge}>
                        <Text style={styles.batteryText}>{batteryPercent}%</Text>
                    </View>
                </View>

                <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{memberData?.name}</Text>
                    <Text style={styles.profileAddress} numberOfLines={1}>
                        {memberData?.currentLocation?.name || "Location unknown"}
                    </Text>
                    <Text style={styles.profileDate}>Since 12 December</Text>
                </View>

                <View style={styles.profileIcons}>
                    <View style={styles.deviceIcon}>
                        <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.white} />
                    </View>
                    <View style={styles.blueIndicator} />
                </View>
            </View>
        );
    };

    const renderStatsSummary = () => (
        <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Weekly Driver Report</Text>
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <View style={styles.statIconCircle}>
                        <MaterialCommunityIcons name="speedometer" size={24} color={COLORS.white} />
                    </View>
                    <Text style={styles.statValue}>{weeklyStats.topSpeed} mph</Text>
                    <Text style={styles.statLabel}>Top Speed</Text>
                </View>
                <View style={styles.statBox}>
                    <View style={styles.statIconCircle}>
                        <MaterialCommunityIcons name="car-side" size={24} color={COLORS.white} />
                    </View>
                    <Text style={styles.statValue}>{weeklyStats.totalDrives}</Text>
                    <Text style={styles.statLabel}>Total Drives</Text>
                </View>
                <View style={styles.statBox}>
                    <View style={styles.statIconCircle}>
                        <MaterialCommunityIcons name="map-marker-distance" size={24} color={COLORS.white} />
                    </View>
                    <Text style={styles.statValue}>{weeklyStats.totalMiles} mi</Text>
                    <Text style={styles.statLabel}>Total Miles</Text>
                </View>
            </View>
        </View>
    );

    const renderJourneyItem = ({ item }: { item: Journey }) => {
        const stats = calculateJourneyStats(item.history || []);
        const durationStr = getDuration(item.startTime, item.endTime);
        const timeRange = formatTimeRange(item.startTime, item.endTime);

        // Determine if it's a "Stay" or a "Trip"
        const isStay = parseFloat(stats.distanceMiles) < 0.05;

        if (isStay) {
            const stayLocation = item.history?.[0]?.name || "Unknown Location";
            return (
                <View style={styles.journeyItem}>
                    <View style={styles.journeyHeader}>
                        <View style={[styles.journeyIconBox, { backgroundColor: COLORS.secondary }]}>
                            <Ionicons name="location" size={20} color={COLORS.white} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.stayTitle}>{stayLocation}</Text>
                            <Text style={styles.journeyTime}>{timeRange} ({durationStr})</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.addToPlacesBtn}>
                        <Text style={styles.addToPlacesText}>Add to Places</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.journeyItem}>
                <View style={styles.journeyHeader}>
                    <View style={styles.journeyIconBox}>
                        <Ionicons name="shuffle" size={20} color={COLORS.white} />
                    </View>
                    <View>
                        <Text style={styles.journeyTitle}>{stats.distanceMiles} mi Trip</Text>
                        <Text style={styles.journeyTime}>{timeRange} ({durationStr})</Text>
                    </View>
                </View>

                <View style={styles.mapPreviewContainer}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={styles.mapPreview}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                        liteMode={Platform.OS === 'android'}
                        initialRegion={item.history?.[0] ? {
                            latitude: Number(item.history[0].latitude),
                            longitude: Number(item.history[0].longitude),
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        } : undefined}
                    >
                        {item.history && item.history.length > 1 && (
                            <Polyline
                                coordinates={item.history.map(p => ({
                                    latitude: Number(p.latitude),
                                    longitude: Number(p.longitude),
                                }))}
                                strokeWidth={4}
                                strokeColor={COLORS.primary}
                            />
                        )}
                    </MapView>
                    <View style={styles.topSpeedPill}>
                        <MaterialCommunityIcons name="speedometer" size={14} color={COLORS.secondary} />
                        <Text style={styles.topSpeedPillLabel}>Top Speed</Text>
                        <Text style={styles.topSpeedPillValue}>{stats.topSpeedMph} mph</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                {renderHeader()}
                {loading && journeys.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={journeys}
                        keyExtractor={(item, index) => index.toString()}
                        ListHeaderComponent={
                            <>
                                {renderProfileBar()}
                                {renderStatsSummary()}
                            </>
                        }
                        renderItem={renderJourneyItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="car-outline" size={64} color="#D1D5DB" />
                                <Text style={styles.emptyTitle}>No Journeys Yet</Text>
                                <Text style={styles.emptyText}>Driving activity will appear here once detected.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    backButton: { flexDirection: "row", alignItems: "center" },
    headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textMain },
    headerSubtitle: { fontSize: 12, color: COLORS.textSub },
    refreshButton: { padding: 4 },
    profileBar: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    avatarContainer: { position: 'relative', marginRight: 12 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.bgLight },
    statusDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.accent,
        borderWidth: 2,
        borderColor: COLORS.white
    },
    batteryBadge: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        alignItems: 'center',
        paddingVertical: 1
    },
    batteryText: { fontSize: 9, fontWeight: '700', color: COLORS.error },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 18, fontWeight: "700", color: COLORS.textMain, marginBottom: 2 },
    profileAddress: { fontSize: 13, color: COLORS.primary, fontWeight: '500', marginBottom: 2 },
    profileDate: { fontSize: 12, color: COLORS.textSub },
    profileIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    deviceIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    blueIndicator: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondary },
    statsContainer: { padding: 16 },
    statsTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: 20
    },
    statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    statBox: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: COLORS.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    statValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
    statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSub, textTransform: 'uppercase' },
    listContent: { paddingBottom: 40 },
    journeyItem: { padding: 16, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
    journeyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    journeyIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    journeyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
    stayTitle: { fontSize: 15, fontWeight: "600", color: COLORS.primary, flexShrink: 1 },
    journeyTime: { fontSize: 13, color: COLORS.textSub },
    addToPlacesBtn: {
        marginTop: 8,
        backgroundColor: COLORS.secondary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'flex-start'
    },
    addToPlacesText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
    mapPreviewContainer: {
        width: '100%',
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: COLORS.bgLight,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: "#E5E7EB"
    },
    mapPreview: { width: '100%', height: '100%' },
    topSpeedPill: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "rgba(232, 240, 254, 0.9)",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.blueLight,
    },
    topSpeedPillLabel: { fontSize: 12, color: COLORS.textSub },
    topSpeedPillValue: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginTop: 16 },
    emptyText: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginTop: 8 },
});

export default MemberJourneysModal;
