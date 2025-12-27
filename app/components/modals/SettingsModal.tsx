import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Switch,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ThemeColors = {
  primary: string;
  accent: string;
  white: string;
  black: string;
  gray: string;
  lightGray: string;
  success: string;
};

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (value: boolean) => void;
  isUpdatingNotifications: boolean;
  locationSharingEnabled: boolean;
  onToggleLocationSharing: (value: boolean) => void;
  isUpdatingLocationSharing: boolean;
  colors: ThemeColors;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  notificationsEnabled,
  onToggleNotifications,
  isUpdatingNotifications,
  locationSharingEnabled,
  onToggleLocationSharing,
  isUpdatingLocationSharing,
  colors,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Choose how we share updates with your circle.</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrapper}>
              <Text style={styles.toggleTitle}>Notifications</Text>
              <Text style={styles.toggleDescription}>
                Receive arrival, SOS, and circle alerts on this device.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={onToggleNotifications}
              disabled={isUpdatingNotifications}
              trackColor={{ false: "#D1D5DB", true: colors.primary }}
              thumbColor={
                Platform.OS === "android"
                  ? notificationsEnabled
                    ? colors.white
                    : "#f4f3f4"
                  : undefined
              }
              ios_backgroundColor="#D1D5DB"
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowLast]}>
            <View style={styles.toggleTextWrapper}>
              <Text style={styles.toggleTitle}>Location sharing</Text>
              <Text style={styles.toggleDescription}>
                Share your live location with the selected circle.
              </Text>
            </View>
            <Switch
              value={locationSharingEnabled}
              onValueChange={onToggleLocationSharing}
              disabled={isUpdatingLocationSharing}
              trackColor={{ false: "#D1D5DB", true: colors.primary }}
              thumbColor={
                Platform.OS === "android"
                  ? locationSharingEnabled
                    ? colors.white
                    : "#f4f3f4"
                  : undefined
              }
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    card: {
      width: "100%",
      backgroundColor: colors.white,
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.black,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.lightGray,
      alignItems: "center",
      justifyContent: "center",
    },
    subtitle: {
      fontSize: 13,
      color: colors.gray,
      marginBottom: 18,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.lightGray,
    },
    toggleRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    toggleTextWrapper: {
      flex: 1,
      paddingRight: 16,
    },
    toggleTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.black,
    },
    toggleDescription: {
      fontSize: 13,
      color: colors.gray,
      marginTop: 4,
    },
  });

export default SettingsModal;
