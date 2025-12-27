import { API_BASE_URL } from '@/utils/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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

const localStyles = StyleSheet.create({
  helperText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefixInput: {
    flexShrink: 0,
    width: 90,
    textAlign: 'center',
    fontSize: 24,
    paddingHorizontal: 16,
  },
  phoneInput: {
    flex: 1,
    textAlign: 'left',
    fontSize: 24,
    paddingHorizontal: 16,
  },
  nameInput: {
    fontSize: 24,
    paddingHorizontal: 16,
  },
});

const sanitizeDigits = (value: string) => value.replace(/[^0-9]/g, '');

const normalizePhoneNumber = (prefix: string, rawNumber: string) => {
  const prefixDigits = sanitizeDigits(prefix);
  const normalizedPrefix = prefixDigits ? `+${prefixDigits}` : '';
  const normalizedNumber = sanitizeDigits(rawNumber).replace(/^0+/, '');
  const formattedNumber = normalizedPrefix && normalizedNumber ? `${normalizedPrefix}${normalizedNumber}` : '';
  return { normalizedPrefix, normalizedNumber, formattedNumber };
};

const parseParam = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const ensurePrefixFormat = (value: string) => {
  const sanitized = value.replace(/[^0-9+]/g, '');
  const stripped = sanitized.startsWith('+') ? sanitized.slice(1) : sanitized.replace(/^\++/, '');
  const digitsOnly = sanitizeDigits(stripped);
  return digitsOnly ? `+${digitsOnly}` : '+94';
};

const MobileLogInScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    phonePrefix?: string | string[];
    phoneDigits?: string | string[];
    name?: string | string[];
  }>();

  const rawPrefixParam = parseParam(params.phonePrefix);
  const rawDigitsParam = parseParam(params.phoneDigits);
  const rawNameParam = parseParam(params.name);

  const [phonePrefix, setPhonePrefix] = useState(() => (rawPrefixParam ? ensurePrefixFormat(rawPrefixParam) : '+94'));
  const [mobileNumber, setMobileNumber] = useState(() => sanitizeDigits(rawDigitsParam));
  const [name, setName] = useState(() => rawNameParam);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (rawPrefixParam) {
      setPhonePrefix(ensurePrefixFormat(rawPrefixParam));
    }
    if (rawDigitsParam) {
      setMobileNumber(sanitizeDigits(rawDigitsParam));
    }
    if (rawNameParam) {
      setName(rawNameParam);
    }
  }, [rawDigitsParam, rawNameParam, rawPrefixParam]);

  const isFormValid = useMemo(() => {
    const digits = sanitizeDigits(mobileNumber);
    return name.trim().length > 0 && phonePrefix.trim().length > 0 && digits.length >= 6;
  }, [mobileNumber, name, phonePrefix]);

  const handleSendOtp = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedName = name.trim();
    const { normalizedPrefix, normalizedNumber, formattedNumber } = normalizePhoneNumber(phonePrefix, mobileNumber);

    if (!trimmedName) {
      setErrorMessage('Please enter your name.');
      return;
    }

    if (!normalizedPrefix) {
      setErrorMessage('Please include your country code.');
      return;
    }

    if (!normalizedNumber || normalizedNumber.length < 6) {
      setErrorMessage('Enter a valid mobile number.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/phone/send-otp`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formattedNumber, name: trimmedName }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== false) {
        const message = data?.message || 'OTP sent successfully.';
        setInfoMessage(message);

        const devCode = typeof data?.otp === 'string' ? data.otp : typeof data?.code === 'string' ? data.code : null;
        Alert.alert('OTP sent', devCode && __DEV__ ? `Use code ${devCode}` : message);

        router.push({
          pathname: '/screens/PhoneOTPScreen',
          params: {
            phoneNumber: formattedNumber,
            name: trimmedName,
            phonePrefix: normalizedPrefix,
            phoneDigits: normalizedNumber,
          },
        });
      } else {
        setErrorMessage(data?.message || 'Unable to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send OTP', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
        <Text style={styles.headerText}>Sign in with your phone number</Text>
      </View>

      <Text style={localStyles.helperText}>
        We will send a 6-digit code to verify your number. SMS is not enabled for development builds, so the code appears
        in app alerts when available.
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, localStyles.nameInput]}
              placeholder="Full Name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={name}
              onChangeText={setName}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={[styles.inputGroup, localStyles.phoneRow]}>
            <TextInput
              style={[styles.input, localStyles.prefixInput]}
              placeholder="+94"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={phonePrefix}
              onChangeText={(value) => {
                const sanitized = value.replace(/[^0-9+]/g, '');
                const stripped = sanitized.startsWith('+') ? sanitized.slice(1) : sanitized.replace(/^\++/, '');
                const digitsOnly = sanitizeDigits(stripped);
                setPhonePrefix(`+${digitsOnly}`);
              }}
              editable={!loading}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, localStyles.phoneInput]}
              placeholder="Phone number"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={mobileNumber}
              onChangeText={(value) => setMobileNumber(value.replace(/[^0-9]/g, ''))}
              editable={!loading}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => router.push('/screens/ForgotPasswordRequest')}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {(infoMessage || errorMessage) && (
            <Text
              style={[
                styles.messageText,
                infoMessage ? styles.infoText : styles.errorText,
              ]}
            >
              {infoMessage || errorMessage}
            </Text>
          )}
        </View>

        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.continueButton, isFormValid && styles.continueButtonActive]}
            onPress={handleSendOtp}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={isFormValid ? '#8B5CF6' : '#fff'} />
            ) : (
              <Text style={[styles.continueButtonText, isFormValid && styles.continueButtonTextActive]}>
                Send OTP
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/screens/LogInScreen')}>
            <Text style={styles.phoneSignInText}>Sign in with Email</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default MobileLogInScreen;
