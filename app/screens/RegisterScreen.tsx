import { API_BASE_URL } from '@/utils/auth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from './authStyles';

const MIN_PASSWORD_LENGTH = 6;

const RegisterScreen = () => {
	const router = useRouter();

	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);

	const validate = () => {
		if (!name.trim()) {
			setErrorMessage('Please enter your name.');
			return false;
		}

		if (!email.trim()) {
			setErrorMessage('Please enter your email.');
			return false;
		}

		if (!password) {
			setErrorMessage('Please enter your password.');
			return false;
		}

		if (password.length < MIN_PASSWORD_LENGTH) {
			setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
			return false;
		}

		if (password !== confirmPassword) {
			setErrorMessage('Passwords do not match.');
			return false;
		}

		return true;
	};

	const handleRegister = async () => {
		if (!validate()) {
			return;
		}

		setLoading(true);
		setErrorMessage(null);
		setInfoMessage(null);

		try {
			const response = await fetch(`${API_BASE_URL}/auth/register`, {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email, password, name }),
			});

			const data = await response.json();

			if (response.status === 201 || (response.ok && data.success)) {
				const message = data.message || 'Account created. Check your email for the verification code.';
				setInfoMessage(message);
				router.replace({
					pathname: '/screens/VerifyEmailScreen',
					params: { email, message },
				});
				return;
			}

			setErrorMessage(data.message || 'Registration failed. Please try again.');
		} catch (error) {
			console.error('Error registering user:', error);
			setErrorMessage('Unable to contact the server. Please try again.');
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
				<Text style={styles.headerText}>Create your account</Text>
			</View>

			<View style={styles.formContainer}>
				<View style={styles.inputContainer}>
					<View style={styles.inputGroup}>
						<TextInput
							style={styles.input}
							placeholder="Name"
							placeholderTextColor="rgba(255, 255, 255, 0.5)"
							value={name}
							onChangeText={setName}
							autoCapitalize="words"
							editable={!loading}
						/>
					</View>

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

					<View style={styles.inputGroup}>
						<TextInput
							style={styles.input}
							placeholder="Confirm password"
							placeholderTextColor="rgba(255, 255, 255, 0.5)"
							value={confirmPassword}
							onChangeText={setConfirmPassword}
							secureTextEntry
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
						style={[
							styles.continueButton,
							name.trim() && email.trim() && password && confirmPassword && styles.continueButtonActive,
						]}
						onPress={handleRegister}
						disabled={
							loading ||
							!name.trim() ||
							!email.trim() ||
							!password ||
							!confirmPassword
						}
					>
						{loading ? (
							<ActivityIndicator color={name.trim() && email.trim() && password && confirmPassword ? '#8B5CF6' : '#fff'} />
						) : (
							<Text
								style={[
									styles.continueButtonText,
									name.trim() && email.trim() && password && confirmPassword && styles.continueButtonTextActive,
								]}
							>
								Register
							</Text>
						)}
					</TouchableOpacity>

					<View style={styles.signUpContainer}>
						<Text style={styles.signUpText}>Already have an account?</Text>
						<TouchableOpacity onPress={() => router.replace({ pathname: '/screens/LogInScreen', params: { email } })}>
							<Text style={styles.signUpLink}>Sign in</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</ScrollView>
	);
};

export default RegisterScreen;
