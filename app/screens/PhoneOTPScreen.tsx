import { API_BASE_URL } from '@/utils/auth';
import { flushPendingFcmToken, persistFcmToken, registerDeviceAndGetFCMToken } from '@/utils/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import styles from './authStyles';

const RESEND_INTERVAL_SECONDS = 30;

const localStyles = StyleSheet.create({
  helperText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  otpInput: {
    letterSpacing: 12,
    fontSize: 28,
  },
  phoneText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 8,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  resendText: {
    color: '#D4FF00',
    fontWeight: '600',
    fontSize: 16,
  },
  resendDisabledText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  editNumberButton: {
    alignSelf: 'center',
    marginTop: 12,
  },
  editNumberText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  devOtpHint: {
    color: '#D4FF00',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
});

const parseParam = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const PhoneOTPScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    phoneNumber?: string | string[];
    phonePrefix?: string | string[];
    phoneDigits?: string | string[];
    name?: string | string[];
  }>();
  const phoneNumber = useMemo(() => parseParam(params.phoneNumber), [params.phoneNumber]);
  const name = useMemo(() => parseParam(params.name), [params.name]);
  const phonePrefixParam = useMemo(() => parseParam(params.phonePrefix), [params.phonePrefix]);
  const phoneDigitsParam = useMemo(() => parseParam(params.phoneDigits), [params.phoneDigits]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [secondsUntilResend, setSecondsUntilResend] = useState(RESEND_INTERVAL_SECONDS);

  const derivedContact = useMemo(() => {
    if (!phoneNumber) {
      return { prefix: '', digits: '' };
    }
    const match = phoneNumber.match(/^(\+\d{1,4})/);
    const prefix = match ? match[1] : '';
    const digits = prefix ? phoneNumber.slice(prefix.length) : phoneNumber;
    return { prefix, digits };
  }, [phoneNumber]);

  const editPhonePrefix = phonePrefixParam || derivedContact.prefix;
  const editPhoneDigits = phoneDigitsParam || derivedContact.digits;

  useEffect(() => {
    setSecondsUntilResend(RESEND_INTERVAL_SECONDS);
  }, [phoneNumber]);

  useEffect(() => {
    if (secondsUntilResend <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsUntilResend((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsUntilResend]);

  const formattedPhoneDisplay = phoneNumber || 'your phone number';

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
        console.error('Error registering FCM token after OTP verification:', error);
      }

      router.replace('/screens/MapScreen');
    },
    [router],
  );

  const handleVerifyOtp = useCallback(async () => {
    if (!phoneNumber) {
      setErrorMessage('Missing phone number. Please restart the login process.');
      return;
    }

    if (!code || code.trim().length < 4) {
      setErrorMessage('Enter the OTP sent to your phone.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/phone/verify-otp`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, code: code.trim(), name: name.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.token) {
        setInfoMessage(data?.message || 'Phone number verified successfully.');
        await storeTokensAndNavigate(data.token, data.refreshToken);
        return;
      }

      if (response.status === 400 || response.status === 401) {
        setErrorMessage(data?.message || 'Invalid or expired OTP. Please try again.');
        return;
      }

      setErrorMessage(data?.message || 'Unable to verify the OTP. Please try again.');
    } catch (error) {
      console.error('Failed to verify OTP', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, name, phoneNumber, storeTokensAndNavigate]);

  const handleResendOtp = useCallback(async () => {
    if (!phoneNumber) {
      setErrorMessage('Missing phone number. Please restart the login process.');
      return;
    }

    setResendLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/phone/resend-otp`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setInfoMessage(data?.message || 'A new OTP has been sent.');
        setSecondsUntilResend(RESEND_INTERVAL_SECONDS);

        const devCode = typeof data?.otp === 'string' ? data.otp : typeof data?.code === 'string' ? data.code : null;
        if (devCode) {
          setDevOtpHint(`Development OTP: ${devCode}`);
          if (__DEV__) {
            Alert.alert('OTP resent', `Use code ${devCode}`);
          }
        }

        return;
      }

      setErrorMessage(data?.message || 'Unable to resend OTP at the moment.');
    } catch (error) {
      console.error('Failed to resend OTP', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    if (__DEV__) {
      setDevOtpHint((existing) => existing ?? 'Check alert dialogs for the OTP in development builds.');
    }
  }, []);

  const canResend = secondsUntilResend <= 0 && !resendLoading;

  if (!phoneNumber) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 }]}
      >
        <Text style={[styles.headerText, { marginBottom: 16 }]}>Missing phone number</Text>
        <Text style={[styles.infoText, { textAlign: 'center' }]}>We could not find a phone number for this session. Please restart the sign-in flow and try again.</Text>
        <TouchableOpacity style={[styles.continueButton, styles.continueButtonActive, { marginTop: 24 }]} onPress={() => router.replace('/screens/MobileLogIn')}>
          <Text style={styles.continueButtonTextActive}>Back to Phone Login</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerText}>Enter the code we sent</Text>
      </View>

      <Text style={localStyles.phoneText}>We sent an OTP to {formattedPhoneDisplay}</Text>
      <Text style={localStyles.helperText}>Enter the 6-digit code below to verify your phone number.</Text>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, localStyles.otpInput]}
              placeholder="••••••"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ''))}
              editable={!loading}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {(infoMessage || errorMessage) && (
            <Text style={[styles.messageText, errorMessage ? styles.errorText : styles.infoText]}>
              {errorMessage || infoMessage}
            </Text>
          )}

          {devOtpHint && __DEV__ && <Text style={localStyles.devOtpHint}>{devOtpHint}</Text>}
        </View>

        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.continueButton, code.trim().length >= 4 && styles.continueButtonActive]}
            onPress={handleVerifyOtp}
            disabled={loading || code.trim().length < 4}
          >
            {loading ? (
              <ActivityIndicator color={code.trim().length >= 4 ? '#8B5CF6' : '#fff'} />
            ) : (
              <Text style={[styles.continueButtonText, code.trim().length >= 4 && styles.continueButtonTextActive]}>
                Verify
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={localStyles.resendButton} onPress={handleResendOtp} disabled={!canResend}>
            <Text
              style={[
                localStyles.resendText,
                !canResend && localStyles.resendDisabledText,
              ]}
            >
              {canResend ? 'Resend code' : `Resend in ${secondsUntilResend}s`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.editNumberButton}
            onPress={() =>
              router.replace({
                pathname: '/screens/MobileLogIn',
                params: {
                  phonePrefix: editPhonePrefix,
                  phoneDigits: editPhoneDigits,
                  name,
                },
              })
            }
          >
            <Text style={localStyles.editNumberText}>Edit phone number</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default PhoneOTPScreen;
