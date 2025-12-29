import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeColors } from "./SettingsModal";

interface AccountModalProps {
    visible: boolean;
    onClose: () => void;
    colors: ThemeColors;

    // Profile Props
    profileNameInput: string;
    setProfileNameInput: (text: string) => void;
    // profileMetadataInput is hidden in new design or moved, but we'll keep it available if needed
    profileMetadataInput: string;
    setProfileMetadataInput: (text: string) => void;
    profileAvatarPreview: string | null;
    isSavingProfile: boolean;
    isPickingProfileImage: boolean;
    profileModalError: string | null;
    onPickProfileImage: () => void;
    onClearProfileImage: () => void;
    onSaveProfile: () => void;

    // New Contact Props
    email?: string;
    phone?: string;

    onPressLocationHistory: () => void;
    onPressLogout: () => void;
    isCircleCreator: boolean;
    onPressDeleteCircle: () => void;
    onPressLeaveCircle: () => void;
    isDeletingCircle: boolean;
    isLeavingCircle: boolean;
    canDeleteCircle: boolean;
    canLeaveCircle: boolean;
}

const AccountModal: React.FC<AccountModalProps> = ({
    visible,
    onClose,
    colors,

    profileNameInput,
    setProfileNameInput,
    profileAvatarPreview,
    isSavingProfile,
    isPickingProfileImage,
    profileModalError,
    onPickProfileImage,
    onSaveProfile,

    email,
    phone,

    onPressLocationHistory,
    onPressLogout,
    isCircleCreator,
    onPressDeleteCircle,
    onPressLeaveCircle,
    isDeletingCircle,
    isLeavingCircle,
    canDeleteCircle,
    canLeaveCircle,
}) => {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#0052CC" />
                        <Text style={styles.backText}>Account</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    {/* Blue Profile Header Section */}
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            <View style={[styles.avatarWrapper, { backgroundColor: '#00154D' }]}>
                                {profileAvatarPreview ? (
                                    <Image source={{ uri: profileAvatarPreview }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={styles.avatarInitials}>
                                        {(profileNameInput || "User").substring(0, 2).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.cameraBadge}
                                onPress={onPickProfileImage}
                                disabled={isSavingProfile || isPickingProfileImage}
                            >
                                {isPickingProfileImage ? (
                                    <ActivityIndicator size="small" color="#555" />
                                ) : (
                                    <Ionicons name="camera-outline" size={14} color="#555" />
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.nameInputContainer}>
                            <TextInput
                                style={styles.nameInput}
                                value={profileNameInput}
                                onChangeText={setProfileNameInput}
                                placeholder="Your Name"
                                placeholderTextColor="#A0A0A0"
                                onEndEditing={onSaveProfile} // Valid behavior for "Save on blur/enter" or we can add an explicit button
                            />
                        </View>
                    </View>

                    <View style={styles.bodyContent}>

                        {/* Account Details */}
                        <Text style={styles.sectionTitle}>Account Details</Text>
                        <View style={styles.detailsList}>
                            {/* Phone */}
                            <View style={styles.detailItem}>
                                <View style={styles.detailIconWrapper}>
                                    <Ionicons name="phone-portrait-outline" size={24} color="#00154D" />
                                </View>
                                <View style={styles.detailTextWrapper}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Phone Number</Text>
                                        <Text style={[styles.statusBadge, { color: '#22C55E' }]}>Verified</Text>
                                    </View>
                                    <Text style={styles.detailValue}>{phone || "Not set"}</Text>
                                </View>
                            </View>

                            {/* Email */}
                            <View style={styles.detailItem}>
                                <View style={styles.detailIconWrapper}>
                                    <MaterialCommunityIcons name="email-outline" size={24} color="#00154D" />
                                </View>
                                <View style={styles.detailTextWrapper}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Email Address</Text>
                                        <Text style={[styles.statusBadge, { color: '#FF3B30' }]}>Unverified</Text>
                                    </View>
                                    <Text style={styles.detailValue}>{email || "Not set"}</Text>
                                </View>
                                <View style={styles.alertIconWrapper}>
                                    <Ionicons name="alert-circle" size={24} color="#FF3B30" />
                                </View>
                            </View>
                        </View>

                        {/* Account Management */}
                        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Account Management</Text>
                        <View style={styles.actionsList}>

                            <TouchableOpacity style={styles.actionLink} onPress={onPressLocationHistory}>
                                <Text style={styles.actionLinkText}>View Location History</Text>
                            </TouchableOpacity>

                            {isCircleCreator ? (
                                <TouchableOpacity style={styles.actionLink} onPress={onPressDeleteCircle} disabled={isDeletingCircle}>
                                    {isDeletingCircle ? <ActivityIndicator color="#0052CC" /> : <Text style={styles.actionLinkText}>Delete Circle</Text>}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.actionLink} onPress={onPressLeaveCircle} disabled={isLeavingCircle}>
                                    {isLeavingCircle ? <ActivityIndicator color="#0052CC" /> : <Text style={styles.actionLinkText}>Leave Circle</Text>}
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.actionLink, { marginTop: 16 }]} onPress={onPressLogout}>
                                <Text style={styles.actionLinkText}>Log Out</Text>
                            </TouchableOpacity>

                            {profileModalError ? (
                                <Text style={styles.errorText}>{profileModalError}</Text>
                            ) : null}

                            {isSavingProfile && (
                                <Text style={styles.savingText}>Saving changes...</Text>
                            )}

                        </View>

                    </View>

                </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff", // White top bar as per standard, or blue if user wants top bar blue too. Image implies standard nav bar.
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    backText: {
        fontSize: 17,
        color: "#0052CC",
        marginLeft: 4,
        fontWeight: '500',
    },
    content: {
        paddingBottom: 40,
    },
    // Profile Header (Blue Section)
    profileHeader: {
        backgroundColor: "#E6F0FF",
        paddingVertical: 24,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatarWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarInitials: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "bold",
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#EAEAEC',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E6F0FF',
    },
    nameInputContainer: {
        flex: 1,
    },
    nameInput: {
        fontSize: 18,
        fontWeight: '600',
        color: '#00154D',
        paddingVertical: 4,
    },
    // Body
    bodyContent: {
        paddingHorizontal: 20,
        paddingTop: 32,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#00154D',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        paddingBottom: 8,
    },
    detailsList: {
        marginBottom: 16,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    detailIconWrapper: {
        width: 32,
        marginRight: 12,
        paddingTop: 2,
    },
    detailTextWrapper: {
        flex: 1,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    detailLabel: {
        fontSize: 14,
        color: '#0052CC',
        marginRight: 12,
    },
    statusBadge: {
        fontSize: 12,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 15,
        color: '#00154D',
    },
    alertIconWrapper: {
        marginLeft: 8,
        justifyContent: 'center',
    },
    // Actions
    actionsList: {
        paddingLeft: 4,
    },
    actionLink: {
        marginBottom: 20,
    },
    actionLinkText: {
        fontSize: 15,
        color: '#0052CC',
        fontWeight: '400',
    },
    errorText: {
        color: '#FF3B30',
        marginTop: 8,
    },
    savingText: {
        color: '#666',
        marginTop: 8,
        fontStyle: 'italic',
    }
});

export default AccountModal;
