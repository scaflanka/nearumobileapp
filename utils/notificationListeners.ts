import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { Alert, Platform, ToastAndroid } from "react-native";

export type NotificationNavigationHandler = (data: Record<string, string | undefined>) => void;

export interface NotificationListenerOptions {
  onNavigate?: NotificationNavigationHandler;
}

const backgroundHandlerTag = "BackgroundNotification";

let notificationReceptionEnabled = false;
let activeListenerCleanup: (() => void) | null = null;

try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    const messageId =
      remoteMessage.messageId ?? remoteMessage.data?.messageId ?? remoteMessage.data?.id ?? "unknown";
    console.log(`${backgroundHandlerTag}: message received`, messageId, remoteMessage.data);
  });
} catch (error) {
  console.warn("Failed to register background message handler", error);
}

const getTitleAndBody = (
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): { title: string; body: string | undefined } => {
  const fallbackTitle = remoteMessage.notification?.title ?? remoteMessage.data?.title ?? "Notification";
  const fallbackBody =
    remoteMessage.notification?.body ??
    remoteMessage.data?.body ??
    remoteMessage.data?.message ??
    remoteMessage.data?.alert ??
    undefined;

  return {
    title: fallbackTitle,
    body: fallbackBody,
  };
};

const displayForegroundAlert = (title: string, body?: string) => {
  if (!title && !body) {
    return;
  }

  if (Platform.OS === "android") {
    const toastContent = body ? `${title ? `${title}: ` : ""}${body}` : title;
    ToastAndroid.showWithGravity(toastContent, ToastAndroid.LONG, ToastAndroid.TOP);
    return;
  }

  Alert.alert(title || "Notification", body);
};

const handleNavigationIntent = (
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  onNavigate?: NotificationNavigationHandler
) => {
  if (!onNavigate) {
    return;
  }

  const data = remoteMessage.data ?? {};
  if (!data || Object.keys(data).length === 0) {
    return;
  }

  try {
    onNavigate(data);
  } catch (handlerError) {
    console.warn("Notification navigation handler threw", handlerError);
  }
};

export const registerNotificationListeners = (
  options?: NotificationListenerOptions
): (() => void) => {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  let unsubscribeForeground: (() => void) | undefined;
  let unsubscribeNotificationOpened: (() => void) | undefined;

  try {
    unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      const { title, body } = getTitleAndBody(remoteMessage);
      displayForegroundAlert(title, body);
      handleNavigationIntent(remoteMessage, options?.onNavigate);
    });
  } catch (error) {
    console.warn("Failed to register foreground notification listener", error);
  }

  try {
    unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      handleNavigationIntent(remoteMessage, options?.onNavigate);
    });
  } catch (error) {
    console.warn("Failed to register notification opened listener", error);
  }

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        handleNavigationIntent(remoteMessage, options?.onNavigate);
      }
    })
    .catch((error) => {
      console.warn("Failed to get initial notification", error);
    });

  return () => {
    try {
      unsubscribeForeground?.();
    } catch (error) {
      console.warn("Error cleaning up foreground listener", error);
    }

    try {
      unsubscribeNotificationOpened?.();
    } catch (error) {
      console.warn("Error cleaning up opened listener", error);
    }
  };
};

export const setNotificationReceptionEnabled = async (enabled: boolean): Promise<void> => {
  if (enabled) {
    if (notificationReceptionEnabled) {
      return;
    }

    try {
      activeListenerCleanup?.();
    } catch (cleanupError) {
      console.warn("Error clearing existing notification listeners", cleanupError);
    }

    try {
      activeListenerCleanup = registerNotificationListeners();
      notificationReceptionEnabled = true;
    } catch (registrationError) {
      notificationReceptionEnabled = false;
      activeListenerCleanup = null;
      throw registrationError;
    }

    return;
  }

  if (!notificationReceptionEnabled) {
    return;
  }

  notificationReceptionEnabled = false;

  if (activeListenerCleanup) {
    try {
      activeListenerCleanup();
    } catch (cleanupError) {
      console.warn("Error cleaning up notification listeners", cleanupError);
    }
    activeListenerCleanup = null;
  }
};
