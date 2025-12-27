import { API_BASE_URL } from '@/utils/auth';
import { flushPendingFcmToken, persistFcmToken, registerDeviceAndGetFCMToken } from '@/utils/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './authStyles';

const LogInScreen = () => {
    const params = useLocalSearchParams<{ email?: string | string[]; message?: string | string[] }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const initialEmail = useMemo(() => {
        const value = params.email;
        return Array.isArray(value) ? value[0] ?? '' : value ?? '';
    }, [params.email]);

    const initialMessage = useMemo(() => {
        const value = params.message;
        return Array.isArray(value) ? value[0] : value;
    }, [params.message]);

    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(initialMessage ?? null);
    const [needsVerification, setNeedsVerification] = useState(false);

    useEffect(() => {
        if (initialEmail) {
            setEmail(initialEmail);
        }
    }, [initialEmail]);

    useEffect(() => {
        if (initialMessage) {
            setInfoMessage(initialMessage);
        }
    }, [initialMessage]);

    const storeTokensAndNavigate = useCallback(
        async (token: string, refreshToken?: string) => {
            await AsyncStorage.setItem('authToken', token);
            if (refreshToken) {
                await AsyncStorage.setItem('refreshToken', refreshToken);
            }

            try {
                await flushPendingFcmToken();
                const fcmToken = await registerDeviceAndGetFCMToken();
                if (fcmToken) {
                    await persistFcmToken(fcmToken);
                }
            } catch (error) {
                console.error('Error registering FCM token after login:', error);
            }

            router.replace('/screens/MapScreen');
        },
        [router],
    );

    const handleLogin = useCallback(async () => {
        if (!email.trim()) {
            setErrorMessage('Please enter your email.');
            return;
        }

        if (!password.trim()) {
            setErrorMessage('Please enter your password.');
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        setInfoMessage(null);
        setNeedsVerification(false);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
                await storeTokensAndNavigate(data.token, data.refreshToken);
                setPassword('');
                return;
            }

            if (response.status === 403) {
                setNeedsVerification(true);
                setInfoMessage(data.message || 'Please verify your email before logging in.');
                return;
            }

            setErrorMessage(data.message || 'Invalid credentials. Please try again.');
        } catch (error) {
            console.error('Error logging in:', error);
            setErrorMessage('Unable to contact the server. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [email, password, storeTokensAndNavigate]);

    const navigateToVerification = useCallback(() => {
        if (!email.trim()) {
            setErrorMessage('Please enter your email first.');
            return;
        }

        router.push({ pathname: '/screens/VerifyEmailScreen', params: { email } });
    }, [email, router]);

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
                <Text style={styles.headerText}>Welcome back!
                    Enter your credentials</Text>
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
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => router.push('/screens/ForgotPasswordRequest')}>
                        <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                    </TouchableOpacity>

                    {needsVerification && (
                        <TouchableOpacity style={styles.forgotPasswordButton} onPress={navigateToVerification}>
                            <Text style={styles.forgotPasswordText}>Verify your email</Text>
                        </TouchableOpacity>
                    )}

                    {(infoMessage || errorMessage) && (
                        <Text style={[styles.messageText, errorMessage ? styles.errorText : styles.infoText]}>
                            {errorMessage || infoMessage}
                        </Text>
                    )}
                </View>

                <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <TouchableOpacity
                        style={[styles.continueButton, email.trim() && password.trim() && styles.continueButtonActive]}
                        onPress={handleLogin}
                        disabled={loading || !email.trim() || !password.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color={email.trim() && password.trim() ? '#8B5CF6' : '#fff'} />
                        ) : (
                            <Text
                                style={[styles.continueButtonText, email.trim() && password.trim() && styles.continueButtonTextActive]}
                            >
                                Sign In
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/screens/MobileLogIn')}>
                        <Text style={styles.phoneSignInText}>Sign in with phone number</Text>
                    </TouchableOpacity>

                    <View style={styles.signUpContainer}>
                        <Text style={styles.signUpText}>Need an account?</Text>
                        <TouchableOpacity onPress={() => router.push('/screens/RegisterScreen')}>
                            <Text style={styles.signUpLink}>Register</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

export default LogInScreen;