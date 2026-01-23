import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface CircleManagementModalProps {
    visible: boolean;
    onClose: () => void;
    circleName: string;
    isCircleCreator: boolean;
    myRole?: string | null;
    onDeleteCircle: () => void;
    onLeaveCircle: () => void;
    onUpdateCircleName: (newName: string) => void;
    onAddPeople: () => void;
    isDeleting: boolean;
    isLeaving: boolean;
}

const SafetyNetworkIcon = () => (
    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
            {/* Top Person */}
            <View style={{ position: 'absolute', top: 5 }}>
                <Ionicons name="person-outline" size={16} color="#113C9C" />
            </View>
            {/* Bottom Left Person */}
            <View style={{ position: 'absolute', bottom: 8, left: 8 }}>
                <Ionicons name="person-outline" size={16} color="#113C9C" />
            </View>
            {/* Bottom Right Person */}
            <View style={{ position: 'absolute', bottom: 8, right: 8 }}>
                <Ionicons name="person-outline" size={16} color="#113C9C" />
            </View>

            {/* Green Arcs (Simulated with borders or positioning) */}
            {/* Simple approach: visual approximation using absolute positioned curved views or just implied by position */}
            {/* Since we can't do complex SVG paths easily without valid svgs, we will stick to the icon positioning which conveys the meaning strongly enough or add simple colored views */}
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#22C55E', opacity: 0.5, transform: [{ rotate: '45deg' }], borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' }} />
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#22C55E', opacity: 0.5, transform: [{ rotate: '165deg' }], borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' }} />
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#22C55E', opacity: 0.5, transform: [{ rotate: '285deg' }], borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' }} />
        </View>
    </View>
);

const CircleManagementModal: React.FC<CircleManagementModalProps> = ({
    visible,
    onClose,
    circleName,
    isCircleCreator,
    myRole,
    onDeleteCircle,
    onLeaveCircle,
    onUpdateCircleName,
    onAddPeople,
    isDeleting,
    isLeaving,
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [newCircleName, setNewCircleName] = useState(circleName);
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Sync local state when prop changes
    React.useEffect(() => {
        setNewCircleName(circleName);
    }, [circleName]);

    const handleSaveName = async () => {
        if (!newCircleName.trim()) {
            Alert.alert("Error", "Circle name cannot be empty.");
            return;
        }
        if (newCircleName.trim() === circleName) {
            setIsEditingName(false);
            return;
        }

        setIsUpdatingName(true);
        try {
            await onUpdateCircleName(newCircleName.trim());
            setIsEditingName(false);
        } catch (error) {
            // Error handling should ideally be done in parent or mapped here,
            // assuming parent handles alerts for now.
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleLeaveOrDelete = () => {
        if (isCircleCreator) {
            Alert.alert(
                "Delete Circle",
                "Are you sure you want to delete this circle? This action cannot be undone and all members will be removed.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: onDeleteCircle },
                ]
            );
        } else {
            Alert.alert(
                "Leave Circle",
                "Are you sure you want to leave this circle? You will stop sharing location with its members.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Leave", style: "destructive", onPress: onLeaveCircle },
                ]
            );
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#113C9C" />
                        <Text style={styles.headerTitle}>{circleName || "Circle Settings"}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Safety Network Banner */}
                    <View style={styles.bannerContainer}>
                        <View style={styles.bannerIconContainer}>
                            <SafetyNetworkIcon />
                        </View>
                        <View style={styles.bannerTextContainer}>
                            <Text style={styles.bannerTitle}>Expand your safety network</Text>
                            <Text style={styles.bannerDescription}>
                                We recommend to invite 3 to 4 members to your emergency contacts in your circle.
                            </Text>
                        </View>
                    </View>

                    {/* Pagination Dots (Visual Only) */}
                    <View style={styles.paginationContainer}>
                        <View style={[styles.dot, styles.activeDot]} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                    </View>

                    {/* Circle Details Section */}
                    <Text style={styles.sectionHeader}>Circle details</Text>
                    <View style={styles.separator} />

                    <View style={styles.menuItem}>
                        {isEditingName ? (
                            <View style={styles.editNameRow}>
                                <TextInput
                                    style={styles.nameInput}
                                    value={newCircleName}
                                    onChangeText={setNewCircleName}
                                    autoFocus
                                    placeholder="Enter circle name"
                                />
                                <TouchableOpacity onPress={handleSaveName} disabled={isUpdatingName} style={styles.saveButton}>
                                    {isUpdatingName ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.menuRow} onPress={() => setIsEditingName(true)}>
                                <Text style={styles.menuText}>Edit Circle Name</Text>
                            </TouchableOpacity>
                        )}
                    </View>


                    {/* Circle Management Section */}
                    <Text style={[styles.sectionHeader, { marginTop: 32 }]}>Circle Management</Text>
                    <View style={styles.separator} />

                    {/* My Role */}
                    <View style={styles.menuRow}>
                        <Text style={styles.menuText}>My Role</Text>
                        <Text style={styles.roleText}>{myRole || "Member"}</Text>
                    </View>

                    {/* Change Admin Status (Placeholder/Future) */}
                    {/* Only show if creator or admin context allows, but based on image, it's just a menu item */}
                    <TouchableOpacity style={styles.menuRow}>
                        <Text style={styles.menuText}>Change Admin Status</Text>
                    </TouchableOpacity>

                    {/* Add people to Circle */}
                    <TouchableOpacity style={styles.menuRow} onPress={onAddPeople}>
                        <Text style={styles.menuText}>Add people to Circle</Text>
                    </TouchableOpacity>

                    {/* Leave/Delete Circle */}
                    <TouchableOpacity style={styles.menuRow} onPress={handleLeaveOrDelete} disabled={isDeleting || isLeaving}>
                        {isDeleting || isLeaving ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                            <Text style={styles.menuText}>{isCircleCreator ? "Delete Circle" : "Leave Circle"}</Text>
                        )}
                    </TouchableOpacity>

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
        width: 60,
        height: 60,
        backgroundColor: "#fff",
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    bannerTextContainer: {
        flex: 1,
    },
    bannerTitle: {
        color: "#fff",
        fontSize: 15,
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
        backgroundColor: "#D1D5DB", // Gray-300
        marginHorizontal: 3,
    },
    activeDot: {
        backgroundColor: "#2563EB", // Blue-600 (adjust to match image blue)
    },
    sectionHeader: {
        fontSize: 14,
        color: "#113C9C",
        fontWeight: "600",
        marginBottom: 8,
    },
    separator: {
        height: 1,
        backgroundColor: "#E5E7EB",
        marginBottom: 16,
    },
    menuItem: {
        marginBottom: 24,
    },
    menuRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    menuText: {
        fontSize: 16,
        color: "#113C9C",
        fontWeight: "500",
    },
    roleText: {
        fontSize: 16,
        color: "#9CA3AF", // Light gray like the "Dad" text in image
        fontWeight: "400",
    },
    editNameRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    nameInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        color: "#1F2937",
        marginRight: 10,
    },
    saveButton: {
        backgroundColor: "#113C9C",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    saveButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
});

export default CircleManagementModal;
