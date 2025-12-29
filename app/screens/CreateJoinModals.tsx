import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#4F359B",
  white: "#FFFFFF",
  black: "#1A1A1A",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
  border: "#E5E7EB",
  error: "#EF4444",
};

// ==================== CREATE CIRCLE MODAL ====================
interface CreateCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (circleName: string) => Promise<void>;
}

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [circleName, setCircleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!circleName.trim()) {
      setError("Please enter a circle name");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onCreate(circleName.trim());
      setCircleName("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create circle");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCircleName("");
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Create a Circle</Text>
            <Text style={styles.modalSubtitle}>
              Create a private circle to share location with family and friends
            </Text>
          </View>

          {/* Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Circle Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Family, Work Team, Friends"
              placeholderTextColor={COLORS.gray}
              value={circleName}
              onChangeText={(text) => {
                setCircleName(text);
                setError("");
              }}
              maxLength={50}
              autoFocus
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Buttons */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.createButton]}
              onPress={handleCreate}
              disabled={loading || !circleName.trim()}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Circle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ==================== JOIN CIRCLE MODAL ====================
interface JoinCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (pin: string) => Promise<void>;
}

// ==================== JOIN CIRCLE MODAL ====================
interface JoinCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (pin: string) => Promise<void>;
}

export const JoinCircleModal: React.FC<JoinCircleModalProps> = ({
  isOpen,
  onClose,
  onJoin,
}) => {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleJoin = async () => {
    const pin = otp.join("");
    if (pin.length !== 6) {
      setError("Please enter a complete 6-digit PIN");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onJoin(pin);
      setOtp(new Array(6).fill(""));
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid PIN or failed to join circle");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOtp(new Array(6).fill(""));
    setError("");
    onClose();
  };

  const handleChange = (text: string, index: number) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError("");

    // Move to next input if text is entered
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButtonHeader}
              onPress={handleClose}
            >
              <View style={styles.backButtonContent}>
                <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                <Text style={styles.backButtonTextHeader}>Back</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Enter the Invite Code</Text>
          </View>

          {/* PIN Input */}
          <View style={styles.inputContainer}>
            <View style={styles.otpContainer}>
              {/* First group of 3 */}
              {otp.slice(0, 3).map((digit, index) => (
                <View key={index} style={styles.otpBox}>
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={styles.otpInput}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                </View>
              ))}

              <Text style={styles.otpDash}>-</Text>

              {/* Second group of 3 */}
              {otp.slice(3, 6).map((digit, index) => {
                const realIndex = index + 3;
                return (
                  <View key={realIndex} style={styles.otpBox}>
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[realIndex] = ref;
                      }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(text) => handleChange(text, realIndex)}
                      onKeyPress={(e) => handleKeyPress(e, realIndex)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!loading}
                    />
                  </View>
                );
              })}
            </View>

            <Text style={styles.helperText}>
              Get the code from the{'\n'}person setting up circle
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Buttons */}
          <View style={styles.modalButtonsColumn}>
            <TouchableOpacity
              style={[styles.modalButton, styles.createButton]}
              onPress={handleJoin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.createButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // New styles for split OTP input
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  otpBox: {
    width: 45,
    height: 55,
    borderRadius: 8,
    backgroundColor: "#E8F0FE", // Light blue tint like screenshot
    justifyContent: "center",
    alignItems: "center",
  },
  otpInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primary,
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
  otpDash: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.gray,
    marginHorizontal: 4,
  },
  helperText: {
    textAlign: "center",
    color: COLORS.primary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 6,
    marginLeft: 4,
    textAlign: "center",
  },
  // Button styles update
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButtonsColumn: {
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  modalButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30, // More rounded for "Continue" button
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    backgroundColor: COLORS.primary,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  // Skip button
  skipButton: {
    alignItems: 'center',
    padding: 8,
  },
  skipButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray,
  },
  // Header updates
  backButtonHeader: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonTextHeader: {
    color: COLORS.primary,
    fontSize: 16,
    marginLeft: 4,
  },
});

export default { CreateCircleModal, JoinCircleModal };