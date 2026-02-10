import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAlert } from "../../context/AlertContext";

interface SosModalProps {
    isOpen: boolean;
    onClose: () => void;
    circleId?: string | number;
    circleName?: string;
}

const SosModal: React.FC<SosModalProps> = ({
    isOpen,
    onClose,
    circleId,
    circleName
}) => {
    const { showAlert } = useAlert();
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const handleSendSOS = async () => {
        if (!circleId) {
            showAlert({ title: "Error", message: "No circle selected", type: 'error' });
            return;
        }

        setSending(true);
        // Simulate sending SOS
        setTimeout(() => {
            setSending(false);
            showAlert({ title: "SOS Sent", message: "Your SOS alert has been sent to all circle members", type: 'success' });
            setMessage("");
            onClose();
        }, 1500);
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
                        <Ionicons name="chevron-back" size={24} color="#EF4444" />
                        <Text style={styles.headerTitle}>SOS Alert</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.alertCard}>
                        <Ionicons name="alert-circle" size={64} color="#EF4444" />
                        <Text style={styles.alertTitle}>Emergency SOS</Text>
                        <Text style={styles.alertDescription}>
                            Send an emergency alert to all members in {circleName || "your circle"}
                        </Text>
                    </View>

                    <View style={styles.messageSection}>
                        <Text style={styles.label}>Optional Message</Text>
                        <TextInput
                            style={styles.messageInput}
                            placeholder="Add a message (optional)"
                            placeholderTextColor="#9CA3AF"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.sosButton, sending && styles.sosButtonDisabled]}
                        onPress={handleSendSOS}
                        disabled={sending}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="warning" size={24} color="#fff" />
                                <Text style={styles.sosButtonText}>Send SOS Alert</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.infoSection}>
                        <Text style={styles.infoTitle}>What happens when you send an SOS?</Text>
                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                            <Text style={styles.infoText}>
                                All circle members receive an immediate notification
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                            <Text style={styles.infoText}>
                                Your current location is shared with the alert
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                            <Text style={styles.infoText}>
                                Members can quickly navigate to your location
                            </Text>
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
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backButton: { flexDirection: "row", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "600", color: "#EF4444", marginLeft: 4 },
    content: { padding: 20 },
    alertCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    alertTitle: { fontSize: 24, fontWeight: '700', color: '#991B1B', marginTop: 16, marginBottom: 8 },
    alertDescription: { fontSize: 14, color: '#7F1D1D', textAlign: 'center', lineHeight: 20 },
    messageSection: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
    messageInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minHeight: 100,
    },
    sosButton: {
        backgroundColor: '#EF4444',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    sosButtonDisabled: { opacity: 0.6 },
    sosButtonText: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 8 },
    infoSection: { marginTop: 16 },
    infoTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
    infoItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    infoText: { fontSize: 14, color: '#4B5563', marginLeft: 12, flex: 1, lineHeight: 20 },
});

export default SosModal;
