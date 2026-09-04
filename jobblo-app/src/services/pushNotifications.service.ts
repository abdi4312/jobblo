import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

const TOKEN_KEY = 'jobblo.push-token';
type NotificationModule = typeof import('expo-notifications');
let pushTokenSubscription: { remove: () => void } | null = null;
let notificationBootstrapPromise: Promise<boolean> | null = null;

function loadNotifications(): NotificationModule | null {
  try {
    return require('expo-notifications') as NotificationModule;
  } catch {
    return null;
  }
}

function isExpoGo() {
  return (Constants as unknown as { appOwnership?: string }).appOwnership === 'expo';
}

export function configurePushNotifications() {
  if (notificationBootstrapPromise) return notificationBootstrapPromise;
  notificationBootstrapPromise = (async () => {
    if (Platform.OS === 'web' || isExpoGo()) return false;
    const notifications = loadNotifications();
    if (!notifications) return false;

    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync('messages', {
        name: 'Meldinger',
        importance: 5,
        sound: 'default',
        enableVibrate: true,
      });
    }
    return true;
  })();
  return notificationBootstrapPromise;
}

export async function getPushPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  if (Platform.OS === 'web' || isExpoGo()) return 'unavailable';
  const notifications = loadNotifications();
  if (!notifications) return 'unavailable';
  const result = await notifications.getPermissionsAsync();
  return result.status;
}

export async function registerPushNotifications() {
  if (Platform.OS === 'web' || isExpoGo()) return { status: 'unavailable' as const, registered: false };
  const notifications = loadNotifications();
  if (!notifications) return { status: 'unavailable' as const, registered: false };

  await configurePushNotifications();

  let permission = await notifications.getPermissionsAsync();
  if (permission.status === 'undetermined') permission = await notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { status: permission.status, registered: false };

  if (Platform.OS !== 'android') {
    console.warn('[push] direct FCM registration is currently Android-only');
    return { status: 'granted' as const, registered: false };
  }

  const registerNativeToken = async (token: string) => {
    const masked = token.length > 10 ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'short';
    console.log('[push] native FCM token obtained:', masked);
    try {
      await apiClient.post('/push-tokens', {
        token,
        platform: Platform.OS,
        deviceId: Constants.deviceId || undefined,
      });
      await AsyncStorage.setItem(TOKEN_KEY, token);
      console.log('[push] backend token registration succeeded');
    } catch (error) {
      console.error('[push] backend token registration failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  };

  const token = (await notifications.getDevicePushTokenAsync()).data;
  await registerNativeToken(String(token));
  pushTokenSubscription?.remove();
  pushTokenSubscription = notifications.addPushTokenListener(({ data }) => {
    void registerNativeToken(String(data)).catch(() => undefined);
  });
  return { status: 'granted' as const, registered: true };
}

export async function deactivateRegisteredPushToken() {
  pushTokenSubscription?.remove();
  pushTokenSubscription = null;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try { await apiClient.delete('/push-tokens/current', { data: { token } }); } finally { await AsyncStorage.removeItem(TOKEN_KEY); }
}

export async function getRegisteredPushToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export type PushNotificationData = {
  notificationId?: string;
  type?: string;
  chatId?: string;
  serviceId?: string;
  jobId?: string;
  requestId?: string;
  applicationId?: string;
};

export function subscribeToPushResponses(onNotification: (data: PushNotificationData) => void) {
  if (Platform.OS === 'web' || isExpoGo()) return () => undefined;
  const notifications = loadNotifications();
  if (!notifications) return () => undefined;
  const subscription = notifications.addNotificationResponseReceivedListener((response) => {
    const data = {
      ...(response.notification.request.content.data as PushNotificationData),
      notificationId: response.notification.request.identifier,
    };
    if (!data || typeof data.type !== 'string') return;
    onNotification(data);
  });
  void notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const data = {
      ...(response.notification.request.content.data as PushNotificationData),
      notificationId: response.notification.request.identifier,
    };
    if (data && typeof data.type === 'string') onNotification(data);
  });
  return () => subscription.remove();
}
