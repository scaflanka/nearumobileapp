import { API_BASE_URL } from '@/utils/auth';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ForgotPasswordRequest = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleRequestReset = async () => {
        if (!input.trim()) {
            setErrorMessage('Please enter your email or phone number.');
            return;
        }

        setLoading(true);
        setErrorMessage(null);

        const isEmail = input.includes('@');
        const payload = {
            email: isEmail ? input.trim() : null,
            phoneNumber: isEmail ? null : input.trim(),
        };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/password/request-reset`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                // Success: Navigate to verification screen
                router.push({
                    pathname: '/screens/ForgotPasswordVerify',
                    params: {
                        contact: input.trim(),
                        isEmail: isEmail ? 'true' : 'false',
                    }
                });
            } else {
                setErrorMessage(data.message || 'Failed to send reset code. Please try again.');
            }
        } catch (error) {
            console.error('Error requesting password reset:', error);
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
                {/* Logo */}
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
                <Text style={styles.headerText}>Forgot Password</Text>
                <Text style={styles.subText}>
                    Enter your email or mobile number to receive a reset code.
                </Text>

                <View style={styles.formContainer}>
                    <Text style={styles.label}>Email or Mobile Number</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email or phone"
                            placeholderTextColor="#9CA3AF"
                            value={input}
                            onChangeText={setInput}
                            autoCapitalize="none"
                            keyboardType="email-address"
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
                        onPress={handleRequestReset}
                        disabled={loading || !input.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                Send Reset Code
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
        width: 120, // Reduced slightly for better fit if needed, keeping consistent ratio
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

export default ForgotPasswordRequest;
