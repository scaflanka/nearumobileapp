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
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, authenticatedFetch } from "../../../utils/auth";
import { useAlert } from "../../context/AlertContext";

interface Notification {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
}

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({
    isOpen,
    onClose
}) => {
    const { showAlert } = useAlert();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await authenticatedFetch(`${API_BASE_URL}/notifications`);
            if (response.ok) {
                const data = await response.json();
                setNotifications(Array.isArray(data) ? data : data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await authenticatedFetch(`${API_BASE_URL}/notifications/${id}/read`, {
                method: 'PUT'
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error("Failed to mark notification as read", error);
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
                        <Text style={styles.headerTitle}>Notifications</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#113C9C" />
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.notificationItem, !item.read && styles.unreadItem]}
                                onPress={() => handleMarkAsRead(item.id)}
                            >
                                <View style={styles.notificationContent}>
                                    <Text style={styles.notificationTitle}>{item.title}</Text>
                                    <Text style={styles.notificationMessage}>{item.message}</Text>
                                    <Text style={styles.notificationTime}>
                                        {new Date(item.createdAt).toLocaleString()}
                                    </Text>
                                </View>
                                {!item.read && <View style={styles.unreadDot} />}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
                                <Text style={styles.emptyText}>No notifications</Text>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backButton: { flexDirection: "row", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "600", color: "#113C9C", marginLeft: 4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16 },
    notificationItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    unreadItem: {
        backgroundColor: '#EFF6FF',
        borderColor: '#113C9C',
    },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
    notificationMessage: { fontSize: 14, color: '#4B5563', marginBottom: 8 },
    notificationTime: { fontSize: 12, color: '#9CA3AF' },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#113C9C',
        marginLeft: 8,
        marginTop: 6,
    },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
});

export default NotificationsModal;
