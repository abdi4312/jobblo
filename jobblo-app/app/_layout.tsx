import './global.css';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import AppProviders from '../src/providers/AppProviders';
import { subscribeToPushResponses } from '../src/services/pushNotifications.service';
import { NotificationRealtime } from '../src/components/NotificationRealtime';

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => subscribeToPushResponses((chatId) => router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId } })), [router]);

  return (
    <AppProviders>
      <NotificationRealtime />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      />
    </AppProviders>
  );
}
