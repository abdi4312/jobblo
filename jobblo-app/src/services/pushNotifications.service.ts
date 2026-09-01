import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

const TOKEN_KEY = 'jobblo.push-token';
type NotificationModule = typeof import('expo-notifications');

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

  let permission = await notifications.getPermissionsAsync();
  if (permission.status === 'undetermined') permission = await notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { status: permission.status, registered: false };

  if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('messages', { name: 'Meldinger', importance: 4, sound: 'default' });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  const token = (await notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await apiClient.post('/push-tokens', { token, platform: Platform.OS, deviceId: Constants.deviceId || undefined });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return { status: 'granted' as const, registered: true };
}

export async function deactivateRegisteredPushToken() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try { await apiClient.delete('/push-tokens/current', { data: { token } }); } finally { await AsyncStorage.removeItem(TOKEN_KEY); }
}

export async function getRegisteredPushToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function subscribeToPushResponses(onChatMessage: (chatId: string) => void) {
  if (Platform.OS === 'web' || isExpoGo()) return () => undefined;
  const notifications = loadNotifications();
  if (!notifications) return () => undefined;
  const subscription = notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string; chatId?: string };
    if (data.type === 'chat_message' && data.chatId) onChatMessage(data.chatId);
  });
  return () => subscription.remove();
}