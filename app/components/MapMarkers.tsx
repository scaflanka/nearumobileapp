import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Circle, Marker } from "react-native-maps";

const COLORS = {
    primary: "#113C9C",
    accent: "#EF4444",
    white: "#FFFFFF",
    black: "#1A1A1A",
    gray: "#6B7280",
    lightGray: "#F3F4F6",
    success: "#22C55E",
};

interface MemberMarkerProps {
    memberId: string | null;
    coordinate: { latitude: number; longitude: number; battery?: string | null };
    displayName: string;
    avatarUrl: string;
    speed?: number | null;
    isCurrentUser: boolean;
    relation?: string | null;
    onPress?: () => void;
}

export const MemberMarker: React.FC<MemberMarkerProps> = React.memo(({
    memberId,
    coordinate,
    displayName,
    avatarUrl,
    speed,
    isCurrentUser,
    relation,
    onPress,
}) => {
    const [tracksView, setTracksView] = React.useState(true);

    React.useEffect(() => {
        // Stop tracking view changes after a short delay to allow initial render
        const timer = setTimeout(() => setTracksView(false), 1000);
        return () => clearTimeout(timer);
    }, [avatarUrl, displayName]); // Re-track if major visuals change

    const accentColor = isCurrentUser ? "#2563EB" : "#22C55E";
    const markerTitle = relation && relation !== 'Other' ? `${displayName} (${relation})` : displayName;

    // Show speed badge if speed is a number (even 0)
    const showSpeedBadge = typeof speed === 'number';
    const speedDisplay = showSpeedBadge ? `${Math.round(speed)}` : null;

    return (
        <Marker
            coordinate={{ latitude: coordinate.latitude, longitude: coordinate.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title={markerTitle}
            zIndex={isCurrentUser ? 3 : 2}
            onPress={onPress}
            tracksViewChanges={tracksView}
        >
            <View style={styles.markerContainer}>
                <View style={[styles.avatarCircle, { borderColor: accentColor }]}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                </View>
                <View style={[styles.pointerTriangle, { borderTopColor: accentColor }]} />
                {showSpeedBadge && (
                    <View style={styles.speedBadgeContainer}>
                        <View style={styles.speedBadgeInner}>
                            <MaterialCommunityIcons
                                name="speedometer"
                                size={16}
                                color={COLORS.white}
                            />
                            <Text style={styles.speedText}>
                                {speedDisplay}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Marker>
    );
});

interface LocationMarkerProps {
    coordinate: { latitude: number; longitude: number };
    title: string;
    description?: string;
    radius: number;
    placeType?: string | null;
    locationType?: string | null;
    isAssignedToCurrentUser?: boolean;
    onPress?: () => void;
}

const ASSIGNED_LOCATION_STROKE_COLOR = "rgba(79, 53, 155, 0.6)";
const ASSIGNED_LOCATION_FILL_COLOR = "rgba(79, 53, 155, 0.18)";

export const LocationMarker: React.FC<LocationMarkerProps> = ({
    coordinate,
    title,
    description,
    radius,
    placeType,
    locationType,
    isAssignedToCurrentUser,
    onPress,
}) => {
    const circleStrokeColor = isAssignedToCurrentUser
        ? ASSIGNED_LOCATION_STROKE_COLOR
        : "rgba(239, 68, 68, 0.6)";
    const circleFillColor = isAssignedToCurrentUser
        ? ASSIGNED_LOCATION_FILL_COLOR
        : "rgba(239, 68, 68, 0.15)";

    return (
        <>
            <Circle
                center={coordinate}
                radius={radius}
                strokeColor={circleStrokeColor}
                fillColor={circleFillColor}
                strokeWidth={2}
            />

            {/* Helper to pick icon based on placeType */}
            {(() => {
                const getIconName = (type?: string | null) => {
                    const normalized = type?.trim().toLowerCase();
                    switch (normalized) {
                        case 'home': return 'home';
                        case 'office': return 'briefcase';
                        case 'school': return 'school';
                        case 'gym': return 'fitness';
                        case 'hotel': return 'bed';
                        case 'ground': return 'map';
                        case 'business': return 'business';
                        case 'center': return 'location-sharp';
                        default: return 'location-sharp';
                    }
                };

                const iconName = getIconName(locationType || placeType);
                const accentColor = isAssignedToCurrentUser ? '#FACC15' : '#EF4444';

                return (
                    <Marker
                        coordinate={coordinate}
                        title={title}
                        description={description}
                        zIndex={isAssignedToCurrentUser ? 2 : 1}
                        anchor={{ x: 0.5, y: 1 }}
                        onPress={onPress}
                    >
                        <View style={styles.markerContainer}>
                            <View style={[styles.avatarCircle, { borderColor: accentColor, backgroundColor: '#FFF' }]}>
                                <Ionicons
                                    name={iconName as any}
                                    size={18}
                                    color={accentColor}
                                />
                            </View>
                            <View style={[styles.pointerTriangle, { borderTopColor: accentColor }]} />
                        </View>
                    </Marker>
                );
            })()}
        </>
    );
};

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12, // Added padding to prevent cropping of absolutely positioned badges
    },
    avatarCircle: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        backgroundColor: 'white',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    pointerTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderTopWidth: 3,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -2,
    },
    speedBadgeContainer: {
        position: 'absolute',
        top: -8,
        right: -10,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 3,
        zIndex: 10,
    },
    speedBadgeInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    speedText: {
        fontSize: 10,
        fontWeight: '800',
        color: 'white',
        textAlign: 'center',
    },
});
