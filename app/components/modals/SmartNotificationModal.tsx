import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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

const STORAGE_KEY = "smart_notifications_enabled";

interface SmartNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChanged?: (enabled: boolean) => void;
    userName?: string;
    userAvatarUrl?: string | null;
}

const SmartNotificationModal: React.FC<SmartNotificationModalProps> = ({
    isOpen,
    onClose,
    onSettingsChanged,
    userName = "User",
    userAvatarUrl = null,
}) => {
    const [isEnabled, setIsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const value = await AsyncStorage.getItem(STORAGE_KEY);
            setIsEnabled(value !== "false"); // Default to true
        } catch (e) {
            console.warn("Failed to load smart notification settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (value: boolean) => {
        setIsEnabled(value);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false");
            if (onSettingsChanged) {
                onSettingsChanged(value);
            }
        } catch (error) {
            console.error("Failed to save smart notification settings", error);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#113C9C" />
                        <Text style={styles.headerTitle}>Smart Notification</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Premium Card */}
                    <View style={styles.permissionsCard}>
                        <View style={styles.permissionIconWrapper}>
                            <View style={styles.phoneIconCircle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.batteryContainer}>
                                        <View style={styles.batteryFill} />
                                    </View>
                                    <View style={styles.batteryTip} />
                                </View>
                            </View>
                        </View>
                        <View style={styles.permissionTextWrapper}>
                            <Text style={styles.permissionTitle}>Low battery notification</Text>
                            <Text style={styles.permissionSubtitle}>
                                Receive notification when a member phone battery drops below 10%
                            </Text>
                        </View>
                    </View>

                    {/* Carousel Dots */}
                    <View style={styles.dotsContainer}>
                        <View style={[styles.dot, styles.activeDot]} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                    </View>

                    {/* Notification Types List */}
                    <View style={styles.optionsList}>
                        <Text style={styles.optionItem}>Low battery notifications</Text>
                        <Text style={styles.optionItem}>Circle joined notifications</Text>
                        <Text style={styles.optionItem}>Security notifications</Text>
                        <Text style={styles.optionItem}>Places notifications</Text>
                    </View>

                    {/* User Toggle Row */}
                    <View style={styles.userToggleRow}>
                        <View style={styles.avatarWrapper}>
                            <View style={styles.avatarMain}>
                                {userAvatarUrl ? (
                                    <Image source={{ uri: userAvatarUrl }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={styles.avatarText}>
                                        {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.onlineStatusDot} />
                        </View>

                        <Text style={styles.userNameText}>{userName}</Text>

                        {loading ? (
                            <ActivityIndicator color="#113C9C" />
                        ) : (
                            <Switch
                                trackColor={{ false: "#D1D5DB", true: "#113C9C" }}
                                thumbColor={"#fff"}
                                ios_backgroundColor="#D1D5DB"
                                onValueChange={handleToggle}
                                value={isEnabled}
                            />
                        )}
                    </View>

                    {/* What happen if you turn off? section */}
                    <View style={styles.explanationSection}>
                        <Text style={styles.explanationTitle}>What happen if you turn off?</Text>
                        <Text style={styles.explanationSubtitle}>When this feature status is off</Text>

                        <View style={styles.bulletPoint}>
                            <View style={styles.bullet} />
                            <Text style={styles.bulletText}>Location status will be Disabled</Text>
                        </View>

                        <View style={styles.bulletPoint}>
                            <View style={styles.bullet} />
                            <Text style={styles.bulletText}>Device will not be show on Individual Driver Report or monthly Driving Summary</Text>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "500",
        color: "#113C9C",
        marginLeft: 12
    },
    content: {
        paddingTop: 10,
        paddingBottom: 40,
    },
    permissionsCard: {
        backgroundColor: '#113C9C',
        borderRadius: 20,
        marginHorizontal: 20,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    permissionIconWrapper: {
        marginRight: 16,
    },
    phoneIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    batteryContainer: {
        width: 44,
        height: 22,
        borderWidth: 2,
        borderColor: '#EF4444',
        borderRadius: 4,
        padding: 2,
        justifyContent: 'flex-start',
        flexDirection: 'row',
    },
    batteryFill: {
        backgroundColor: '#EF4444',
        height: '100%',
        width: '15%',
        borderRadius: 1,
    },
    batteryTip: {
        width: 3,
        height: 8,
        backgroundColor: '#EF4444',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    permissionTextWrapper: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    permissionSubtitle: {
        fontSize: 13,
        color: '#FFFFFF',
        lineHeight: 18,
        opacity: 0.9,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 24,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D1D5DB',
    },
    activeDot: {
        backgroundColor: '#113C9C',
    },
    optionsList: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    optionItem: {
        fontSize: 16,
        color: '#111827',
        marginBottom: 16,
        fontWeight: '400',
    },
    userToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F0FE',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 16,
    },
    avatarMain: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#001B4D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    onlineStatusDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#E8F0FE',
    },
    userNameText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#113C9C',
    },
    explanationSection: {
        paddingHorizontal: 20,
    },
    explanationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#113C9C',
        marginBottom: 12,
    },
    explanationSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    bulletPoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingRight: 10,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#113C9C',
        marginTop: 6,
        marginRight: 12,
    },
    bulletText: {
        fontSize: 14,
        color: '#113C9C',
        lineHeight: 20,
        flex: 1,
    },
});

export default SmartNotificationModal;
