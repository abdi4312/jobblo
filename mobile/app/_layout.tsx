import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { useEffect } from "react";

const queryClient = new QueryClient();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const rootSegment = segments[0];
    const isAuthPage = rootSegment === "login" || rootSegment === "register";
    // Check if it's the root job-search or the tab job-search
    const isJobSearchPage =
      rootSegment === "job-search" ||
      (rootSegment === "(tabs)" && segments[1] === "job-search");

    if (!user) {
      // Guest logic: Only allow login, register, and job-search
      if (!isAuthPage && !isJobSearchPage) {
        // Redirect any other access to login
        router.replace("/login");
      }
    } else {
      // Logged in logic: Prevent access to login/register pages
      if (isAuthPage) {
        // Redirect to main tabs if already logged in
        router.replace("/(tabs)");
      }
    }
  }, [user, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="list/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="list/contributors/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="modal"
        options={{ presentation: "modal", title: "Modal" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
