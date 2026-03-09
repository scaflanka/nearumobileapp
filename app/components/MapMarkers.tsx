import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Callout, Marker } from "react-native-maps";

const COLORS = {
    primary: "#113C9C",
    accent: "#EF4444",
    white: "#FFFFFF",
    black: "#1A1A1A",
    gray: "#6B7280",
    lightGray: "#F3F4F6",
    success: "#22C55E",
};

/**
 * Standardized constants for marker sizing.
 */
const GLOBAL_MARKER_SIZE = 32;
const getPointerSize = (size: number) => Math.max(2, size / 12);
const getBorderWeight = (size: number) => Math.max(1, size / 16);

/**
 * MarkerView: A pure UI component representing a marker.
 * This does NOT include the react-native-maps Marker wrapper.
 */
export const MarkerView: React.FC<{
    children?: React.ReactNode;
    pinColor?: string;
    backgroundColor?: string;
    size?: number;
}> = ({ children, pinColor, backgroundColor, size = GLOBAL_MARKER_SIZE }) => {
    const pointerSize = getPointerSize(size);
    const borderWeight = getBorderWeight(size);

    return (
        <View style={[styles.markerContainer, { width: size, height: size + pointerSize }]}>
            <View style={[styles.avatarCircle, {
                width: size,
                height: size,
                borderRadius: size / 5,
                borderWidth: borderWeight,
                borderColor: pinColor || COLORS.primary,
                backgroundColor: backgroundColor || 'white',
            }]}>
                {children}
            </View>
            <View style={[styles.pointerTriangle, {
                borderLeftWidth: pointerSize * 0.75,
                borderRightWidth: pointerSize * 0.75,
                borderTopWidth: pointerSize,
                borderTopColor: pinColor || COLORS.primary,
                marginTop: -0.5
            }]} />
        </View>
    );
};

export const AdvancedMarker: React.FC<any> = ({ children, coordinate, title, zIndex, onPress, pinColor, backgroundColor, size = GLOBAL_MARKER_SIZE, ...props }) => {
    const pointerSize = getPointerSize(size);
    return (
        <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 1 }}
            title={title}
            zIndex={zIndex}
            onPress={onPress}
            {...props}
            style={{ width: size, height: size + pointerSize, position: "absolute" }}
        >
            <MarkerView pinColor={pinColor} backgroundColor={backgroundColor} size={size}>
                {children}
            </MarkerView>
        </Marker>
    );
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
    size?: number;
    driveDetectionEnabled?: boolean;
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
    size = GLOBAL_MARKER_SIZE,
    driveDetectionEnabled = false,
}) => {
    const [tracksView, setTracksView] = React.useState(true);

    React.useEffect(() => {
        const timer = setTimeout(() => setTracksView(false), 1000);
        return () => clearTimeout(timer);
    }, [avatarUrl, displayName]);

    const accentColor = isCurrentUser ? "#2563EB" : "#22C55E";
    const speedValue = typeof speed === 'number' ? Math.round(speed) : 0;
    const speedDisplayLabel = `${speedValue} kmh-1`;
    const markerTitle = `${driveDetectionEnabled ? `${speedDisplayLabel}` : 'Driving'}`;

    const markerRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (driveDetectionEnabled && markerRef.current) {
            // small delay to ensure marker is rendered before showing callout
            const timer = setTimeout(() => {
                markerRef.current?.showCallout();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [driveDetectionEnabled, markerTitle]);

    const pointerSize = getPointerSize(size);

    return (
        <Marker
            ref={markerRef}
            coordinate={{ latitude: coordinate.latitude, longitude: coordinate.longitude }}
            title={markerTitle}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={isCurrentUser ? 3 : 2}
            onPress={onPress}
            tracksViewChanges={tracksView}
            style={{ minWidth: size, alignItems: 'center' }}
        >


            <Callout tooltip>
                <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{displayName}</Text>
                    {speedValue > 0 && (
                        <Text style={styles.calloutText}>{speedValue} km/h</Text>
                    )}
                    <View style={styles.calloutTriangle} />
                </View>
            </Callout>
            <MarkerView pinColor={accentColor} size={size}>
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                {/* {driveDetectionEnabled && (
                    <View style={styles.speedBadgeContainer}>
                        <View style={styles.speedBadgeInner}>
                            <MaterialCommunityIcons name="speedometer" size={12} color={COLORS.white} />
                            <Text style={styles.speedText}>{speedDisplayLabel}</Text>
                        </View>
                    </View>
                )} */}
            </MarkerView>
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
    size?: number;
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
    size = GLOBAL_MARKER_SIZE,
}) => {
    const circleStrokeColor = isAssignedToCurrentUser ? ASSIGNED_LOCATION_STROKE_COLOR : "rgba(239, 68, 68, 0.6)";
    const circleFillColor = isAssignedToCurrentUser ? ASSIGNED_LOCATION_FILL_COLOR : "rgba(239, 68, 68, 0.15)";
    const iconName = (() => {
        const normalized = (locationType || placeType || '').trim().toLowerCase();
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
    })();
    const accentColor = isAssignedToCurrentUser ? '#FACC15' : '#EF4444';

    const pointerSize = getPointerSize(size);
    const iconSize = Math.round(size * 0.65);

    const markerRef = React.useRef<any>(null);

    // React.useEffect(() => {
    //     if (markerRef.current) {
    //         const timer = setTimeout(() => {
    //             markerRef.current?.showCallout();
    //         }, 600);
    //         return () => clearTimeout(timer);
    //     }
    // }, [title]);

    return (
        <Marker
            ref={markerRef}
            coordinate={coordinate}
            title={title}
            description={description}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={isAssignedToCurrentUser ? 2 : 1}
            onPress={onPress}
            style={{ width: size, height: size + pointerSize }}
        >
            <MarkerView pinColor={accentColor} backgroundColor={'#FFF'} size={size}>
                <Ionicons name={iconName as any} size={iconSize} color={accentColor} />
            </MarkerView>
        </Marker>
    );

};

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    avatarCircle: {
        backgroundColor: 'white',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
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
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    speedBadgeContainer: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1.5,
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
        fontSize: 1,
        fontWeight: '900',
        color: 'white',
        textAlign: 'center',
    },
    calloutContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.black,
        marginBottom: 2,
    },
    calloutText: {
        fontSize: 12,
        color: COLORS.gray,
    },
    calloutTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 0,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: COLORS.white,
        position: 'absolute',
        bottom: -6,
    },
});
