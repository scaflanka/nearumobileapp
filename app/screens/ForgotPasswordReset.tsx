import { API_BASE_URL } from '@/utils/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './authStyles';

const ForgotPasswordReset = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ resetId: string }>();

    const resetId = Array.isArray(params.resetId) ? params.resetId[0] : params.resetId;

    const [newPassword, setNewPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleResetPassword = async () => {
        if (!newPassword.trim() || !retypePassword.trim()) {
            setErrorMessage('Please enter and confirm your new password.');
            return;
        }

        if (newPassword !== retypePassword) {
            setErrorMessage('Passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            setErrorMessage('Password must be at least 8 characters long.');
            return;
        }

        setLoading(true);
        setErrorMessage(null);

        const payload = {
            resetId: resetId,
            newPassword: newPassword,
        };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/password/reset`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Alert.alert(
                    "Success",
                    "Your password has been reset successfully. Please log in with your new password.",
                    [
                        { text: "OK", onPress: () => router.replace('/screens/LogInScreen') }
                    ]
                );
            } else {
                setErrorMessage(data.message || 'Failed to reset password. Please try again.');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
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
            <View style={styles.header}>
                <Text style={styles.headerText}>Reset Password</Text>
                <Text style={[styles.messageText, styles.infoText, { marginTop: 10 }]}>
                    Create a new password for your account.
                </Text>
            </View>

            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="New Password"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Retype New Password"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={retypePassword}
                            onChangeText={setRetypePassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    {errorMessage && (
                        <Text style={[styles.messageText, styles.errorText]}>
                            {errorMessage}
                        </Text>
                    )}
                </View>

                <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <TouchableOpacity
                        style={[styles.continueButton, newPassword.trim() && retypePassword.trim() && styles.continueButtonActive]}
                        onPress={handleResetPassword}
                        disabled={loading || !newPassword.trim() || !retypePassword.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color={newPassword.trim() ? '#8B5CF6' : '#fff'} />
                        ) : (
                            <Text style={[styles.continueButtonText, newPassword.trim() && styles.continueButtonTextActive]}>
                                Reset Password
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

export default ForgotPasswordReset;
