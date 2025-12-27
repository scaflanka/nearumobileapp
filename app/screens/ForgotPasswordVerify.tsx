import { API_BASE_URL } from '@/utils/auth';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ForgotPasswordVerify = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ contact: string; isEmail: string }>();

    const contact = Array.isArray(params.contact) ? params.contact[0] : params.contact;
    const isEmail = (Array.isArray(params.isEmail) ? params.isEmail[0] : params.isEmail) === 'true';

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleVerifyCode = async () => {
        if (!code.trim()) {
            setErrorMessage('Please enter the reset code.');
            return;
        }

        setLoading(true);
        setErrorMessage(null);

        const payload = {
            email: isEmail ? contact : null,
            phoneNumber: isEmail ? null : contact,
            code: code.trim(),
        };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/password/verify-code`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success: Navigate to reset password screen with resetId
                router.push({
                    pathname: '/screens/ForgotPasswordReset',
                    params: {
                        resetId: data.resetId,
                    }
                });
            } else {
                setErrorMessage(data.message || 'Invalid or expired reset code.');
            }
        } catch (error) {
            console.error('Error verifying reset code:', error);
            setErrorMessage('Unable to contact the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/logo/image.png')}
                        style={styles.logoImage}
                        contentFit="contain"
                    />
                </View>
                <Text style={styles.tagline}>Stay connected with your family</Text>
            </View>

            <View style={styles.formContent}>
                <Text style={styles.headerText}>Verify Code</Text>
                <Text style={styles.subText}>
                    Enter the code sent to your {isEmail ? 'email' : 'phone'}.
                </Text>

                <View style={styles.formContainer}>
                    {/* Read-only contact input */}
                    <Text style={styles.label}>Sent to</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, { opacity: 0.7 }]}
                            value={contact}
                            editable={false}
                        />
                    </View>

                    {/* Reset Code Input */}
                    <Text style={styles.label}>Reset Code</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Code"
                            placeholderTextColor="#9CA3AF"
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="none"
                            keyboardType="default"
                            editable={!loading}
                        />
                    </View>

                    {errorMessage && (
                        <Text style={[styles.messageText, styles.errorText]}>
                            {errorMessage}
                        </Text>
                    )}
                </View>

                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleVerifyCode}
                        disabled={loading || !code.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                Verify Code
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingTop: 80,
        flexGrow: 1,
    },
    backButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        zIndex: 10,
        padding: 8,
    },
    backButtonText: {
        fontSize: 36,
        color: '#1E3A8A',
        fontWeight: '300',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoImage: {
        width: 120,
        height: 120,
    },
    tagline: {
        fontSize: 16,
        color: '#1E3A8A',
        fontWeight: '500',
    },
    formContent: {
        flex: 1,
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E3A8A',
        marginBottom: 8,
        textAlign: 'center',
    },
    subText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 32,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    formContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#1E3A8A',
        marginBottom: 8,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginBottom: 16,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#374151',
    },
    messageText: {
        textAlign: 'center',
        marginBottom: 16,
    },
    errorText: {
        color: '#DC2626',
    },
    bottomContainer: {
        marginTop: 'auto',
    },
    button: {
        backgroundColor: '#113C9C', // Matching the requested blue
        borderRadius: 14,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ForgotPasswordVerify;
