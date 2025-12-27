import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Slot, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initializeCrashReporter } from "@/utils/crashReporter";
import { registerNotificationListeners } from "@/utils/notificationListeners";
import { requestNotificationPermissions } from "@/utils/permissions";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    initializeCrashReporter();
    requestNotificationPermissions();

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
        router.push(normalized);
      } catch (error) {
        console.warn("Failed to navigate from notification", { error, data, normalized });
      }
    };

    const unsubscribe = registerNotificationListeners({ onNavigate: navigateFromNotification });

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
