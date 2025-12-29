import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL, authenticatedFetch } from "../../../utils/auth";
import { ThemeColors } from "./SettingsModal";

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
    colors: ThemeColors;
}

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    read: boolean;
    type?: string;
    data?: any;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({
    visible,
    onClose,
    colors,
}) => {
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError(null);
            // Assuming endpoint is /notifications based on standard REST patterns in this app
            // If /profile/notifications is used for history, maybe /notifications is for user alerts
            const response = await authenticatedFetch(`${API_BASE_URL}/notifications`, {
                headers: {
                    accept: "application/json",
                },
            });

            if (!response.ok) {
                // Fallback to empty if endpoint doesn't exist yet, to avoid showing error to user if backend isn't ready
                // Check status?
                if (response.status === 404) {
                    setNotifications([]);
                    return;
                }
                throw new Error("Failed to load notifications");
            }

            const json = await response.json();
            if (Array.isArray(json.data)) {
                setNotifications(json.data);
            } else if (Array.isArray(json)) {
                setNotifications(json);
            } else {
                setNotifications([]);
            }

        } catch (err) {
            console.warn("Error fetching notifications:", err);
            // setError("Could not load notifications."); // Optional: show error or just empty
            setNotifications([]); // Fail safe
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            fetchNotifications();
        }
    }, [visible]);

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <View style={[styles.notificationItem, !item.read && styles.unreadItem]}>
            <View style={styles.iconContainer}>
                <Ionicons name="notifications" size={24} color="#0052CC" />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={{ width: 24 }} />
                </View>

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#0052CC" />
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No notifications yet</Text>
                            </View>
                        }
                        refreshing={loading}
                        onRefresh={fetchNotifications}
                    />
                )}
            </View>
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
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    listContent: {
        paddingBottom: 20,
    },
    notificationItem: {
        flexDirection: "row",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    unreadItem: {
        backgroundColor: "#F0F7FF",
    },
    iconContainer: {
        marginRight: 16,
        justifyContent: "center",
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
        marginBottom: 4,
    },
    body: {
        fontSize: 14,
        color: "#444",
        marginBottom: 6,
    },
    time: {
        fontSize: 12,
        color: "#888",
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: "#888",
    }
});

export { NotificationsModal };

