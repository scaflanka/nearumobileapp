import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Alert,
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
import {
    resendPhoneOtp,
    sendEmailVerification,
    sendPhoneOtp,
    storeTokens,
    verifyEmail,
    verifyPhoneOtp
} from "../../../utils/auth";
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
    onVerifyEmail?: (email: string) => Promise<void>;
    // Deprecated props for phone verification as we handle it directly
    onVerifyPhone?: (phone: string) => Promise<void>;
    onSubmitEmailVerification?: (email: string, code: string) => Promise<void>;
    onSubmitPhoneVerification?: (phone: string, code: string) => Promise<void>;
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

    // New verification props
    onVerifyEmail,
    onVerifyPhone,
    onSubmitEmailVerification,
    onSubmitPhoneVerification,

}) => {
    const insets = useSafeAreaInsets();

    // Local State for Verification Flow
    const [verificationType, setVerificationType] = React.useState<'email' | 'phone' | null>(null);
    const [verificationStep, setVerificationStep] = React.useState<'input' | 'otp'>('input');
    const [verificationInput, setVerificationInput] = React.useState('');
    const [otpInput, setOtpInput] = React.useState('');
    const [verificationError, setVerificationError] = React.useState<string | null>(null);
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [isResending, setIsResending] = React.useState(false);

    const handleInitiateVerification = async () => {
        if (!verificationInput) {
            setVerificationError("Please enter a valid value");
            return;
        }
        setIsVerifying(true);
        setVerificationError(null);
        try {
            if (verificationType === 'email') {
                await sendEmailVerification(verificationInput);
                if (__DEV__) {
                    Alert.alert("Dev", "Code sent! Check your email (or server logs).");
                }
                setVerificationStep('otp');
            } else if (verificationType === 'phone') {
                // Use direct API call for phone
                const result = await sendPhoneOtp(verificationInput, profileNameInput);
                if (result.success) {
                    if (__DEV__ && result.otp) {
                        Alert.alert("Dev Mode", `OTP is: ${result.otp}`);
                    }
                    setVerificationStep('otp');
                }
            } else {
                setVerificationError("Verification method not implemented or missing handler");
            }
        } catch (e: any) {
            console.error(e);
            setVerificationError(e.message || 'Failed to send code');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendOtp = async () => {
        if (!verificationInput) return;

        setIsResending(true);
        setVerificationError(null);
        try {
            if (verificationType === 'phone') {
                const result = await resendPhoneOtp(verificationInput);
                if (__DEV__ && result.otp) {
                    Alert.alert("Dev Mode", `OTP is: ${result.otp}`);
                }
                Alert.alert("Success", "OTP code resent successfully");
            } else if (verificationType === 'email') {
                await sendEmailVerification(verificationInput);
                Alert.alert("Success", "Verification code resent successfully");
            }

        } catch (e: any) {
            console.error(e);
            setVerificationError(e.message || "Failed to resend code");
        } finally {
            setIsResending(false);
        }
    };

    const handleSubmitVerification = async () => {
        if (!otpInput) {
            setVerificationError("Please enter the code");
            return;
        }
        setIsVerifying(true);
        setVerificationError(null);
        try {
            if (verificationType === 'email') {
                const result = await verifyEmail(verificationInput, otpInput);
                if (result.success) {
                    Alert.alert("Success", "Email verified!");
                    // Trigger profile update/refresh
                    onSaveProfile();
                }
            } else if (verificationType === 'phone') {
                // Use direct API call for phone
                const result = await verifyPhoneOtp(verificationInput, otpInput, profileNameInput);
                if (result.success && result.token) {
                    await storeTokens(result.token, result.refreshToken);

                    // Call profile update to sync battery level or other metadata if needed
                    // as per user instructions: "after call PUT /api/profile"
                    // Although Verify returns user object, we follow instruction to ensure consistency
                    onSaveProfile();

                    Alert.alert("Success", "Phone number verified!");
                }
            }
            // Reset on success
            setVerificationType(null);
            setVerificationInput('');
            setOtpInput('');
            setVerificationStep('input');
        } catch (e: any) {
            console.error(e);
            setVerificationError(e.message || 'Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

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
                                        {phone ? (
                                            <Text style={[styles.statusBadge, { color: '#22C55E' }]}>Verified</Text>
                                        ) : (
                                            <TouchableOpacity onPress={() => {
                                                setVerificationType('phone');
                                                setVerificationStep('input');
                                                setVerificationInput('');
                                                setVerificationError(null);
                                            }}>
                                                <Text style={[styles.statusBadge, { color: '#0052CC', textDecorationLine: 'underline' }]}>Add</Text>
                                            </TouchableOpacity>
                                        )}
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
                                        {email ? (
                                            <Text style={[styles.statusBadge, { color: '#22C55E' }]}>Verified</Text>
                                        ) : (
                                            <TouchableOpacity onPress={() => {
                                                setVerificationType('email');
                                                setVerificationStep('input');
                                                setVerificationInput('');
                                                setVerificationError(null);
                                            }}>
                                                <Text style={[styles.statusBadge, { color: '#0052CC', textDecorationLine: 'underline' }]}>Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <Text style={styles.detailValue}>{email || "Not set"}</Text>
                                </View>
                                {!email && (
                                    <View style={styles.alertIconWrapper}>
                                        <Ionicons name="alert-circle" size={24} color="#FF3B30" />
                                    </View>
                                )}
                            </View>

                            {/* Verification Inline Modal/Area */}
                            {verificationType && (
                                <View style={styles.verificationContainer}>
                                    <Text style={styles.verificationTitle}>
                                        {verificationStep === 'input'
                                            ? `Add ${verificationType === 'email' ? 'Email' : 'Phone Number'}`
                                            : `Verify ${verificationType === 'email' ? 'Email' : 'Phone Number'}`}
                                    </Text>

                                    {verificationStep === 'input' ? (
                                        <>
                                            <TextInput
                                                style={styles.verificationInput}
                                                placeholder={verificationType === 'email' ? "Enter email address" : "Enter phone number"}
                                                value={verificationInput}
                                                onChangeText={setVerificationInput}
                                                autoCapitalize="none"
                                                keyboardType={verificationType === 'email' ? 'email-address' : 'phone-pad'}
                                            />
                                            <View style={styles.verificationButtons}>
                                                <TouchableOpacity
                                                    style={styles.verificationCancelButton}
                                                    onPress={() => setVerificationType(null)}
                                                >
                                                    <Text style={styles.verificationCancelText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.verificationSubmitButton}
                                                    onPress={handleInitiateVerification}
                                                    disabled={isVerifying}
                                                >
                                                    {isVerifying ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={styles.verificationSubmitText}>Send Code</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.verificationSubtitle}>
                                                Enter the code sent to {verificationInput} from your {verificationType === 'email' ? 'email' : 'SMS'}
                                            </Text>
                                            <TextInput
                                                style={styles.verificationInput}
                                                placeholder="Enter verification code"
                                                value={otpInput}
                                                onChangeText={setOtpInput}
                                                keyboardType="number-pad"
                                            />
                                            <View style={styles.verificationButtons}>
                                                {verificationType === 'phone' && (
                                                    <TouchableOpacity
                                                        style={styles.verificationCancelButton}
                                                        onPress={handleResendOtp}
                                                        disabled={isResending}
                                                    >
                                                        {isResending ? <ActivityIndicator size="small" color="#6B7281" /> : <Text style={styles.verificationCancelText}>Resend Code</Text>}
                                                    </TouchableOpacity>
                                                )}

                                                <TouchableOpacity
                                                    style={styles.verificationCancelButton}
                                                    onPress={() => {
                                                        setVerificationStep('input');
                                                        setVerificationError(null);
                                                    }}
                                                >
                                                    <Text style={styles.verificationCancelText}>Back</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.verificationSubmitButton}
                                                    onPress={handleSubmitVerification}
                                                    disabled={isVerifying}
                                                >
                                                    {isVerifying ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={styles.verificationSubmitText}>Verify</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </>
                                    )}

                                    {verificationError ? (
                                        <Text style={styles.errorText}>{verificationError}</Text>
                                    ) : null}
                                </View>
                            )}
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
        color: '#6B7281', // Gray-500
        marginBottom: 16,
        textTransform: 'uppercase',
    },
    detailsList: {
        marginBottom: 24,
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    detailTextWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7281',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
    },
    statusBadge: {
        fontSize: 12,
        fontWeight: '600',
    },
    alertIconWrapper: {
        marginLeft: 12,
    },
    // Verification Inline
    verificationContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    verificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    verificationSubtitle: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 12,
    },
    verificationInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111827',
        marginBottom: 12,
    },
    verificationButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    verificationCancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    verificationCancelText: {
        color: '#6B7281',
        fontWeight: '500',
    },
    verificationSubmitButton: {
        backgroundColor: '#0052CC',
        borderRadius: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    verificationSubmitText: {
        color: '#fff',
        fontWeight: '500',
    },
    // Action Links
    actionsList: {
        // paddingTop: 8
    },
    actionLink: {
        paddingVertical: 12,
    },
    actionLinkText: {
        fontSize: 16,
        color: '#0052CC',
        fontWeight: '500',
    },
    errorText: {
        marginTop: 12,
        color: "#DC2626",
        fontSize: 14,
        textAlign: 'center',
    },
    savingText: {
        textAlign: 'center',
        marginTop: 10,
        color: '#6B7280',
    },
});


export default AccountModal;
