import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { CircleMember } from "../../types/models";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

import { MAP_THEME_LIGHT } from "../../constants/MapThemes";

interface MemberJourneysModalProps {
    visible: boolean;
    onClose: () => void;
    member: CircleMember | null;
    insets: { top: number; bottom: number; left: number; right: number };
}

export const MemberJourneysModal: React.FC<MemberJourneysModalProps> = ({
    visible,
    onClose,
    member,
    insets,
}) => {
    const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

    const {
        displayName,
        avatarUrl,
        batteryPercent,
        journeys,
        topSpeed,
        totalDrives,
        totalMiles,
    } = useMemo(() => {
        if (!member) {
            return {
                displayName: "Unknown",
                avatarUrl: "",
                batteryPercent: null,
                journeys: [],
                topSpeed: 0,
                totalDrives: 0,
                totalMiles: 0,
            };
        }

        const name =
            member.Membership?.nickname ?? member.name ?? member.email ?? "Member";
        const avatar =
            member.avatar || `${DEFAULT_AVATAR}${encodeURIComponent(name)}`;
        let batt: number | null = null;
        if (typeof member.batteryLevel === "number") {
            batt = member.batteryLevel;
        } else if (member.batteryLevel && typeof member.batteryLevel === "object") {
            batt = member.batteryLevel.batteryLevel ?? null;
        }
        const percent = batt !== null ? Math.round(batt) : null;
        const memberJourneys = member.journeys || [];

        // Simple aggregate stats logic
        let speedSum = 0;
        let computedTopSpeed = 0;
        let dist = 0;

        memberJourneys.forEach((j) => {
            // Mock data processing for demo purposes, replace with real data if available
            // Assumption: journey might have 'distance' or we calculate roughly.
            // Using a random placeholder logic for "Top Speed" if not in data.
            const jSpeed = Math.floor(Math.random() * 60) + 20; // 20-80 mph
            if (jSpeed > computedTopSpeed) computedTopSpeed = jSpeed;

            dist += (j.history?.length || 0) * 0.5; // Rough estimate miles
        });

        console.log("MemberJourneysModal", avatarUrl);

        return {
            displayName: name,
            avatarUrl: avatar,
            batteryPercent: percent,
            journeys: memberJourneys,
            topSpeed: computedTopSpeed, // Placeholder logic
            totalDrives: memberJourneys.length,
            totalMiles: Math.round(dist),
        };
    }, [member]);

    if (!member) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <View style={[styles.container, { paddingTop: 20 }]}>
                {/* Header Bar */}
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#113C9C" />
                        <Text style={styles.headerTitle}>{displayName}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.refreshButton}>
                        <Ionicons name="refresh" size={20} color="#113C9C" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Main User Card */}
                    <View style={styles.userCard}>
                        <View style={styles.userInfoRow}>
                            <View>
                                <Image source={{ uri: avatarUrl }} style={styles.bigAvatar} />
                                <View style={styles.statusIndicator} />
                                <View style={[styles.batteryBadge, { zIndex: 10 }]}>
                                    <Ionicons
                                        name={batteryPercent && batteryPercent < 20 ? "battery-dead" : "battery-full"}
                                        size={12}
                                        color={batteryPercent && batteryPercent < 20 ? "#EF4444" : "#22C55E"}
                                    />
                                    <Text style={[styles.batteryText, { color: batteryPercent && batteryPercent < 20 ? "#EF4444" : "#22C55E" }]}>
                                        {batteryPercent !== null ? `${batteryPercent}%` : 'N/A'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.userDetails}>
                                <Text style={styles.userName}>{displayName}</Text>
                                {/* Mock address or status */}
                                <Text style={styles.userStatus}>Sultan Street, Al Rawdah</Text>
                                <Text style={styles.userSince}>Member</Text>
                            </View>
                            <View style={styles.actionButtons}>
                                <TouchableOpacity style={styles.actionIcon}>
                                    <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionIcon}>
                                    <Ionicons name="location-outline" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Weekly Driver Report */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Weekly Driver Report</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Ionicons name="speedometer-outline" size={24} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>Top Speed</Text>
                            <Text style={styles.statValue}>{topSpeed} mph</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Ionicons name="car-sport-outline" size={24} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>Total Drives</Text>
                            <Text style={styles.statValue}>{totalDrives}</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <MaterialCommunityIcons name="map-marker-path" size={24} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>Total Miles</Text>
                            <Text style={styles.statValue}>{totalMiles}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Journeys List */}
                    {journeys.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No trips recorded today.</Text>
                        </View>
                    ) : (
                        journeys.map((journey, idx) => {
                            const journeyHistory = journey.history || [];
                            const startTime = journey.startTime ? new Date(journey.startTime) : new Date();
                            const endTime = journey.endTime ? new Date(journey.endTime) : new Date();

                            const durationMs = endTime.getTime() - startTime.getTime();
                            const hours = Math.floor(durationMs / (1000 * 60 * 60));
                            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                            const timeString = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}`;
                            const durationString = `${hours > 0 ? `${hours} hr ` : ''}${minutes} min`;

                            // Simple distance approximation if not available
                            const miles = (journeyHistory.length * 0.1).toFixed(1);

                            return (
                                <View key={idx} style={styles.tripCard}>
                                    <View style={styles.tripHeader}>
                                        <View style={styles.tripIconBg}>
                                            <MaterialCommunityIcons name="map-marker-path" size={24} color="#fff" />
                                        </View>
                                        <View>
                                            <Text style={styles.tripTitle}>{miles} mi Trip</Text>
                                            <Text style={styles.tripTime}>{timeString} ({durationString})</Text>
                                        </View>
                                    </View>

                                    {/* Map Snapshot */}
                                    {journeyHistory.length >= 2 && (
                                        <View style={styles.mapContainer}>
                                            <MapView
                                                style={styles.map}
                                                initialRegion={{
                                                    latitude: (journeyHistory[0].latitude + journeyHistory[journeyHistory.length - 1].latitude) / 2,
                                                    longitude: (journeyHistory[0].longitude + journeyHistory[journeyHistory.length - 1].longitude) / 2,
                                                    latitudeDelta: Math.abs(journeyHistory[0].latitude - journeyHistory[journeyHistory.length - 1].latitude) * 1.5 + 0.005,
                                                    longitudeDelta: Math.abs(journeyHistory[0].longitude - journeyHistory[journeyHistory.length - 1].longitude) * 1.5 + 0.005,
                                                }}
                                                pointerEvents="none" // Static map
                                                provider={PROVIDER_GOOGLE}
                                                customMapStyle={MAP_THEME_LIGHT}
                                            >
                                                <Polyline
                                                    coordinates={journeyHistory.map(j => ({ latitude: j.latitude, longitude: j.longitude }))}
                                                    strokeColor="#000000"
                                                    strokeWidth={3}
                                                />
                                                {/* Start Marker */}
                                                <Marker coordinate={journeyHistory[0]}>
                                                    <View style={styles.startMarker} />
                                                </Marker>
                                                {/* End Marker */}
                                                <Marker coordinate={journeyHistory[journeyHistory.length - 1]}>
                                                    <View style={styles.endMarker} />
                                                </Marker>
                                            </MapView>
                                        </View>
                                    )}

                                    {/* Location Details */}
                                    <View style={styles.locationDetails}>
                                        <View style={styles.locationRow}>
                                            <View style={styles.locationIconBg}>
                                                <Ionicons name="location" size={20} color="#fff" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.locationName}>Building 42, King Fahd Road, Al Olaya District</Text>
                                                <Text style={styles.locationTime}>{timeString} ({durationString})</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity style={styles.addToPlacesButton}>
                                            <Text style={styles.addToPlacesText}>Add to Places</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}

                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    headerBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 16,
        color: "#4B5563",
        marginLeft: 4,
    },
    refreshButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    userCard: {
        marginTop: 10,
        marginBottom: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        // Note: Shadow handled by elevation on Android usually, but specific style requested
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    bigAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F3F4F6',
    },
    statusIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#22C55E', // Online/Driving status
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    batteryBadge: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: [{ translateX: -20 }],
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    batteryText: {
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 2,
    },
    userDetails: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    userStatus: {
        fontSize: 13,
        color: '#113C9C', // Primary Blue
        marginTop: 2,
        fontWeight: '500',
    },
    userSince: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
        fontWeight: '400',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#113C9C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#113C9C',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
    },
    statIconContainer: {
        width: '100%',
        height: 50,
        backgroundColor: '#001A72', // Dark blue from image
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#113C9C',
        fontWeight: '500',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 11,
        color: '#113C9C',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginBottom: 24,
    },

    // Trip Card Styles
    tripCard: {
        marginBottom: 32,
    },
    tripHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tripIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#001A72',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    tripTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#113C9C',
    },
    tripTime: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    mapContainer: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#F3F4F6',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    startMarker: {
        width: 12,
        height: 12,
        backgroundColor: '#113C9C',
        borderRadius: 2,
    },
    endMarker: {
        width: 12,
        height: 12,
        backgroundColor: '#113C9C',
        borderRadius: 2,
    },

    locationDetails: {
        paddingLeft: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    locationIconBg: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#113C9C',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    locationName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#113C9C',
        lineHeight: 20,
    },
    locationTime: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    addToPlacesButton: {
        alignSelf: 'flex-start',
        backgroundColor: '#113C9C',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        marginLeft: 44, // Align with text
    },
    addToPlacesText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    }
});
