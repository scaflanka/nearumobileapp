import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Slot, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { syncLocationQueue } from "@/services/BackgroundLocationService"; // Ensure this is imported to register task
import { initializeCrashReporter } from "@/utils/crashReporter";
import { registerNotificationListeners } from "@/utils/notificationListeners";
import { requestNotificationPermissions } from "@/utils/permissions";
import NetInfo from "@react-native-community/netinfo";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    initializeCrashReporter();
    requestNotificationPermissions();

    // Listen for network state changes to sync offline locations
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncLocationQueue();
      }
    });

    const navigateFromNotification = (data: Record<string, string | undefined>) => {
      const candidate =
        data.route ??
        data.path ??
        data.screen ??
        data.navigateTo ??
        data.target ??
        null;

      if (!candidate) {
        return;
      }

      const normalized = candidate.startsWith("/") ? candidate : `/screens/${candidate}`;

      try {
        router.push(normalized as any);
      } catch (error) {
        console.warn("Failed to navigate from notification", { error, data, normalized });
      }
    };

    const unsubscribe = registerNotificationListeners({ onNavigate: navigateFromNotification });

    return () => {
      unsubscribe?.();
      unsubscribeNetInfo();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
