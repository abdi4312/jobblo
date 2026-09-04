import './global.css';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import AppProviders from '../src/providers/AppProviders';
import { subscribeToPushResponses, type PushNotificationData } from '../src/services/pushNotifications.service';
import { NotificationRealtime } from '../src/components/NotificationRealtime';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydratedRef = useRef(hydrated);
  const authenticatedRef = useRef(isAuthenticated);
  const pendingNotificationRef = useRef<PushNotificationData | null>(null);
  const handledNotificationRef = useRef<string | null>(null);
  hydratedRef.current = hydrated;
  authenticatedRef.current = isAuthenticated;

  const routeNotification = useCallback((data: PushNotificationData) => {
    const key = data.notificationId || JSON.stringify(data);
    if (handledNotificationRef.current === key) return;
    handledNotificationRef.current = key;
    if (!hydratedRef.current || !authenticatedRef.current) {
      pendingNotificationRef.current = data;
      return;
    }

    if (data.type === 'chat_message' && data.chatId) {
      router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId: data.chatId } });
    } else if (data.type === 'job_request') {
      const serviceId = data.serviceId || data.jobId;
      if (!serviceId) return;
      router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId } });
    } else if (data.type === 'application_status') {
      router.push('/(app)/my-applications');
    }
  }, [router]);

  useEffect(() => subscribeToPushResponses(routeNotification), [routeNotification]);

  useEffect(() => {
    const pending = pendingNotificationRef.current;
    if (!pending || !hydrated || !isAuthenticated) return;
    pendingNotificationRef.current = null;
    const key = pending.notificationId || JSON.stringify(pending);
    handledNotificationRef.current = null;
    routeNotification({ ...pending, notificationId: key });
  }, [hydrated, isAuthenticated, routeNotification]);

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
