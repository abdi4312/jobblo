import './global.css';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useRouter, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCallback, useEffect, useRef } from 'react';
import AppProviders from '../src/providers/AppProviders';
import { subscribeToPushResponses, type PushNotificationData } from '../src/services/pushNotifications.service';
import { NotificationRealtime } from '../src/components/NotificationRealtime';
import { useAuthStore } from '../src/store/authStore';
import { loadThemePreference } from '../src/theme/themePreference';
import { apiBaseUrl } from '../src/api/client';
import { captureError, setScreen, startMonitoring } from '../src/monitoring/reporter';

// Before the first render, so a crash while mounting is reported too.
void startMonitoring(apiBaseUrl);

/** Render crash anywhere below the root: report it and offer a retry instead of a white screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { kind: 'render' });
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Noe gikk galt</Text>
      <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>Feilen er rapportert. Prøv igjen, eller start appen på nytt.</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: '#2D4A3E', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Prøv igjen</Text>
      </Pressable>
    </View>
  );
}

// Dark mode only: light keeps React Navigation's default theme exactly as before.
const JOBBLO_DARK = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#121411', card: '#1C1F1B', border: '#2E322C', text: '#F2F3EE', primary: '#7DBE92' },
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const router = useRouter();
  const pathname = usePathname();
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

  useEffect(() => {
    void loadThemePreference();
  }, []);

  useEffect(() => setScreen(pathname), [pathname]);

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
      <ThemeProvider value={dark ? JOBBLO_DARK : DefaultTheme}>
        <NotificationRealtime />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: dark ? '#121411' : '#F8FAFC' },
          }}
        />
      </ThemeProvider>
    </AppProviders>
  );
}
