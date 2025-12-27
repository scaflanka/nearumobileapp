import { API_BASE_URL } from '@/utils/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from './authStyles';

const DEFAULT_PROMPT = 'Enter the verification code sent to your email.';

const VerifyEmailScreen = () => {
    const params = useLocalSearchParams<{ email?: string | string[]; message?: string | string[] }>();
    const router = useRouter();

    const initialEmail = useMemo(() => {
        const value = params.email;
        return Array.isArray(value) ? value[0] ?? '' : value ?? '';
    }, [params.email]);

    const initialMessage = useMemo(() => {
        const value = params.message;
        return Array.isArray(value) ? value[0] : value;
    }, [params.message]);

    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(initialMessage ?? DEFAULT_PROMPT);

    const handleVerify = async () => {
        if (!email.trim()) {
            setErrorMessage('Please enter your email.');
            return;
        }

        if (!code.trim()) {
            setErrorMessage('Please enter the verification code.');
            return;
        }

        setLoading(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const message = data.message || 'Email verified successfully. You can sign in now.';
                router.replace({ pathname: '/screens/LogInScreen', params: { email, message } });
                return;
            }

            setErrorMessage(data.message || 'Verification failed. Please try again.');
        } catch (error) {
            console.error('Error verifying email:', error);
            setErrorMessage('Unable to contact the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!email.trim()) {
            setErrorMessage('Please enter your email to resend the code.');
            return;
        }

        setResendLoading(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/resend-email-verification`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setInfoMessage(data.message || DEFAULT_PROMPT);
                return;
            }

            setErrorMessage(data.message || 'Unable to resend verification code.');
        } catch (error) {
            console.error('Error resending verification code:', error);
            setErrorMessage('Unable to contact the server. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <Text style={styles.headerText}>Verify your email</Text>
            </View>

            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!loading && !resendLoading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Verification code"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="characters"
                            editable={!loading}
                        />
                    </View>

                    {(infoMessage || errorMessage) && (
                        <Text style={[styles.messageText, errorMessage ? styles.errorText : styles.infoText]}>
                            {errorMessage || infoMessage}
                        </Text>
                    )}
                </View>

                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={[styles.continueButton, email.trim() && code.trim() && styles.continueButtonActive]}
                        onPress={handleVerify}
                        disabled={loading || !email.trim() || !code.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color={email.trim() && code.trim() ? '#8B5CF6' : '#fff'} />
                        ) : (
                            <Text style={[styles.continueButtonText, email.trim() && code.trim() && styles.continueButtonTextActive]}>
                                Verify Email
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.continueButton, styles.secondaryButton]}
                        onPress={handleResendCode}
                        disabled={resendLoading || loading}
                    >
                        {resendLoading ? (
                            <ActivityIndicator color="#8B5CF6" />
                        ) : (
                            <Text style={styles.secondaryButtonText}>Resend Code</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.signUpContainer}>
                        <Text style={styles.signUpText}>Ready to sign in?</Text>
                        <TouchableOpacity onPress={() => router.replace({ pathname: '/screens/LogInScreen', params: { email } })}>
                            <Text style={styles.signUpLink}>Back to login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

export default VerifyEmailScreen;
