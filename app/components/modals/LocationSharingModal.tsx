import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LocationSharingModalProps {
    visible: boolean;
    onClose: () => void;
    isSharing: boolean;
    onToggleSharing: (value: boolean) => void;
    currentUser?: {
        name?: string;
        avatarUrl?: string | null;
        initials?: string;
    };
}

const DevicePermissionsIcon = () => (
    <View style={{
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#FFF',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative'
    }}>
        <Ionicons name="phone-portrait-outline" size={32} color="#113C9C" style={{ marginRight: 2 }} />
        <View style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'transparent'
        }}>
            <Ionicons name="location" size={20} color="#EF4444" />
        </View>
    </View>
);

const LocationSharingModal: React.FC<LocationSharingModalProps> = ({
    visible,
    onClose,
    isSharing,
    onToggleSharing,
    currentUser,
}) => {

    const renderAvatar = () => {
        if (currentUser?.avatarUrl) {
            return (
                <Image source={{ uri: currentUser.avatarUrl }} style={styles.avatarImage} />
            );
        }
        return (
            <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                    {currentUser?.initials || currentUser?.name?.substring(0, 2).toUpperCase() || "ME"}
                </Text>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#113C9C" />
                        <Text style={styles.headerTitle}>Location Sharing</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Device Permissions Banner */}
                    <View style={styles.bannerContainer}>
                        <View style={styles.bannerIconContainer}>
                            <DevicePermissionsIcon />
                        </View>
                        <View style={styles.bannerTextContainer}>
                            <Text style={styles.bannerTitle}>Device Permissions</Text>
                            <Text style={styles.bannerDescription}>
                                NEARU requires your device's location permission to be “on”. Allow this in your phone settings
                            </Text>
                        </View>
                    </View>

                    {/* Pagination Dots (Visual Only) */}
                    <View style={styles.paginationContainer}>
                        <View style={[styles.dot, styles.activeDot]} />
                        <View style={styles.dot} />
                    </View>

                    {/* Your Location Sharing Section */}
                    <Text style={styles.sectionTitle}>Your Location Sharing</Text>
                    <View style={styles.userRow}>
                        <View style={styles.userInfo}>
                            {renderAvatar()}
                            <View style={styles.statusDot} />
                            <Text style={styles.userName}>{currentUser?.name || "Me"}</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#767577", true: "#113C9C" }}
                            thumbColor={"#fff"}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={onToggleSharing}
                            value={isSharing}
                        />
                    </View>

                    {/* Circle Member Status Section */}
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Circle member status</Text>
                    <Text style={styles.emptyStatusText}>None</Text>

                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#113C9C",
        marginLeft: 4,
    },
    content: {
        padding: 20,
    },
    bannerContainer: {
        backgroundColor: "#113C9C",
        borderRadius: 12,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    bannerIconContainer: {
        marginRight: 16,
    },
    // bannerBadge removed as it's now internal to DevicePermissionsIcon
    bannerTextContainer: {
        flex: 1,
    },
    bannerTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 4,
    },
    bannerDescription: {
        color: "#fff",
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.9,
    },
    paginationContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 30,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#E5E7EB",
        marginHorizontal: 3,
    },
    activeDot: {
        backgroundColor: "#113C9C",
    },
    sectionTitle: {
        fontSize: 15,
        color: "#113C9C",
        marginBottom: 12,
        fontWeight: "500",
    },
    userRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#EFF6FF", // Light blue bg
        padding: 16,
        borderRadius: 12, // Slight border radius if needed, usually full width in list but image shows card-like or just background
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#ccc",
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#111827", // Dark background like image
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitials: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#22C55E", // Green dot
        borderWidth: 2,
        borderColor: "#fff",
        position: "absolute",
        left: 28, // adjust based on avatar size
        top: 0,
    },
    userName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#113C9C",
        marginLeft: 12,
    },
    emptyStatusText: {
        fontSize: 14,
        color: "#6B7280",
    },
});

export default LocationSharingModal;
