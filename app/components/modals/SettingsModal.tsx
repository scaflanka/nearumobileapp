import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Exporting ThemeColors to maintain compatibility with other components
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
  onSmartNotifications: () => void;
  onLocationSharing?: () => void;
  onCircleManagement?: () => void;
  onAddPeople?: () => void;
  onAccount?: () => void;
  onDriveDetection?: () => void;
  onPrivacySecurity?: () => void;
  onChatSupport?: () => void;
  onAbout?: () => void;
  onLogout?: () => void;
  colors?: ThemeColors; // Optional, can use default if not provided
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onSmartNotifications,
  onLocationSharing,
  onCircleManagement,
  onAddPeople,
  onAccount,
  onDriveDetection,
  onPrivacySecurity,
  onChatSupport,
  onAbout,
  onLogout,
}) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#113C9C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>

          {/* Circle Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Circle Settings</Text>

            <SettingsItem
              icon={<Ionicons name="people-outline" size={22} color="#113C9C" />}
              label="Smart Notifications"
              onPress={onSmartNotifications}
            />
            <SettingsItem
              icon={<MaterialCommunityIcons name="car-connected" size={22} color="#113C9C" />}
              label="Location Sharing"
              onPress={onLocationSharing}
            />
            <SettingsItem
              icon={<Ionicons name="information-circle-outline" size={24} color="#113C9C" />}
              label="Circle Management"
              onPress={onCircleManagement}
            />
            <SettingsItem
              icon={<Ionicons name="help-circle-outline" size={24} color="#113C9C" />}
              label="Add People to Circle"
              onPress={onAddPeople}
            />
          </View>

          {/* App Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>App Settings</Text>

            <SettingsItem
              icon={<Ionicons name="person-outline" size={22} color="#113C9C" />}
              label="Account"
              onPress={onAccount}
            />
            <SettingsItem
              icon={<MaterialCommunityIcons name="car-traction-control" size={22} color="#113C9C" />}
              label="Drive Detection"
              onPress={onDriveDetection}
            />
            <SettingsItem
              icon={<Ionicons name="shield-checkmark-outline" size={22} color="#113C9C" />}
              label="Privacy & Security"
              onPress={onPrivacySecurity}
            />
            <SettingsItem
              icon={<Ionicons name="chatbubble-ellipses-outline" size={22} color="#113C9C" />}
              label="Chat with support"
              onPress={onChatSupport}
            />
            <SettingsItem
              icon={<Ionicons name="information-circle-outline" size={24} color="#113C9C" />}
              label="About"
              onPress={onAbout}
            />
            <SettingsItem
              icon={<Ionicons name="log-out-outline" size={24} color="#113C9C" />}
              label="Log out"
              onPress={onLogout}
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const SettingsItem = ({ icon, label, onPress }: { icon: React.ReactNode, label: string, onPress?: () => void }) => (
  <TouchableOpacity style={styles.itemRow} onPress={onPress}>
    <View style={styles.iconContainer}>
      {icon}
    </View>
    <Text style={styles.itemLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#113C9C",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 14,
    color: "#113C9C",
    fontWeight: "600",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 16,
  },
  itemLabel: {
    fontSize: 16,
    color: "#4b5563",
    fontWeight: "400",
  },
});

export default SettingsModal;
