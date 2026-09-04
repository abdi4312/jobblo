import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { StyleSheet, View } from "react-native";
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { configurePushNotifications, registerPushNotifications } from '../services/pushNotifications.service';
import { queryClient } from './queryClient';

function PushRegistration() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  useEffect(() => {
    void configurePushNotifications().catch((error) => console.error('[push] bootstrap failed:', error));
    if (isAuthenticated) void registerPushNotifications().catch(() => undefined);
  }, [isAuthenticated]);
  return null;
}

/**
 * Restores the persisted session once, on mount, before any route guard runs.
 *
 * Every auth gate (`app/index.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`)
 * waits for `hydrated` instead of reading `isAuthenticated` directly, so a stored token
 * is never mistaken for a signed-out user on cold start.
 */
function AuthHydration() {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}

// Re-exported so existing `import { queryClient } from '.../AppProviders'` call sites keep
// working; the instance itself now lives in ./queryClient to keep this module out of a cycle.
export { queryClient };

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydration />
      <PushRegistration />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={styles.root}>{children}</View>
          <StatusBar style="auto" />
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
});
