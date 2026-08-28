import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useOAuthLoginCompletion } from '@/hooks/useOAuthLoginCompletion';

/**
 * Where a Google or Vipps sign-in lands when the app receives a real deep link.
 *
 * On Android that is what happens: the browser redirect reaches the app, expo-router routes
 * here, and this screen completes the sign-in. On iOS the callback is delivered to
 * ASWebAuthenticationSession instead, so no deep link is emitted and this screen is never
 * mounted — the login screen's own runner completes it. Both paths call the same
 * single-flight `completeOAuthSignIn`, so whichever observer gets there second joins the
 * first one's promise rather than issuing a second `/auth/profile` request.
 *
 * Nothing here navigates on success. `app/(auth)/_layout.tsx` redirects to `/(app)` as soon
 * as `isAuthenticated` flips, from whichever screen is actually on top; a second navigator
 * pushing at the same time is how duplicate screens happen.
 *
 * The token in the URL is never rendered and never logged. It is read by the hook, verified
 * against the server, and handed to the auth store.
 */
export default function OAuthSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[]; error?: string | string[] }>();
  const { state, message } = useOAuthLoginCompletion(params);

  if (state === 'failed') {
    return (
      <SafeAreaView className="flex-1 bg-page">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <View className="rounded-[28px] bg-surface p-8 shadow-sm">
            <View className="mx-auto h-12 w-12 items-center justify-center rounded-full bg-[#FCF5F4]">
              <AlertCircle size={22} color="#B0453B" />
            </View>
            <Text className="mt-5 text-center text-[20px] font-bold text-ink">
              Innloggingen mislyktes
            </Text>
            <Text className="mt-2.5 text-center text-[14px] leading-6 text-muted">{message}</Text>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              className="mt-7 h-[46px] items-center justify-center rounded-xl bg-brand"
            >
              <Text className="text-[15px] font-semibold text-white">Tilbake til innlogging</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // `signed-in` keeps the same spinner: the redirect in the layout is already on its way, and
  // swapping in a success card first would flash for a frame and then disappear.
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-page">
      <ActivityIndicator size="large" color="#2E6641" />
      <Text className="mt-4 text-[15px] text-muted">Fullfører innloggingen…</Text>
    </SafeAreaView>
  );
}
