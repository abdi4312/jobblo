import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Loader2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useLoginMutation } from '@/hooks/useLoginMutation';
import { apiBaseUrl } from '@/api/client';
import { GoogleMark, VippsWordmark } from '@/components/auth/SocialAuthLogos';
import { completeOAuthSignIn } from '@/hooks/useOAuthLoginCompletion';
import { runOAuthSession, type OAuthProvider } from '@/utils/oauthAuthSession';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { error?: string; message?: string } } };
    const serverMessage = err.response?.data?.error ?? err.response?.data?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }
  }

  return fallback;
}

/**
 * Vipps first, in Vipps' own orange, then Google — the same order, artwork and colours as the
 * website's components/SocialAuthButtons/AuthButton.tsx.
 *
 * The Vipps wordmark IS the brand name, so it replaces the word instead of sitting beside it:
 * the button reads "Fortsett med [Vipps]". Because that leaves the label without the provider
 * name in text, the accessible name is spelled out on the Pressable.
 */
function SocialButton({
  provider,
  disabled,
  onPress,
}: {
  provider: OAuthProvider;
  disabled: boolean;
  onPress: () => void;
}) {
  const isVipps = provider === 'vipps';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={isVipps ? 'Fortsett med Vipps' : 'Fortsett med Google'}
      className={`h-[46px] flex-row items-center justify-center gap-2.5 rounded-xl px-4 ${isVipps ? 'bg-[#FF5B24]' : 'border border-line bg-white'
        } ${disabled ? 'opacity-60' : ''}`}
    >
      {isVipps ? (
        <>
          <Text className="text-[15px] font-semibold text-white">Fortsett med</Text>
          <VippsWordmark />
        </>
      ) : (
        <>
          <GoogleMark />
          <Text className="text-[15px] font-semibold text-ink">Fortsett med Google</Text>
        </>
      )}
    </Pressable>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  /** Which provider's browser trip is in flight, so a second tap cannot start another. */
  const [socialProvider, setSocialProvider] = useState<OAuthProvider | null>(null);
  const [socialError, setSocialError] = useState('');

  const serverMessage = useMemo(
    () =>
      loginMutation.error
        ? getErrorMessage(loginMutation.error, 'Innlogging mislyktes. Sjekk e-post og passord.')
        : '',
    [loginMutation.error]
  );

  /** One card, whichever way the sign-in was attempted. */
  const errorMessage = socialError || serverMessage;

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};
    const normalizedEmail = form.email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Vennligst skriv inn e-post';
    } else if (!emailPattern.test(normalizedEmail)) {
      nextErrors.email = 'Vennligst skriv inn en gyldig e-post';
    }

    if (!form.password) {
      nextErrors.password = 'Vennligst skriv inn passord';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSocialError('');

    loginMutation.mutate(
      { email: form.email.trim().toLowerCase(), password: form.password },
      {
        onSuccess: () => router.replace('/(app)'),
      }
    );
  };

  /**
   * Google and Vipps, one path.
   *
   * `runOAuthSession` reports only what it saw of the browser trip; a returned URL is a claim,
   * not a session. The URL goes to `completeOAuthSignIn`, which verifies the token against
   * `/auth/profile` before anybody is signed in.
   *
   * On iOS this is the ONLY observer of the return: ASWebAuthenticationSession delivers the
   * callback to the session, so no deep link fires and app/(auth)/oauth-success.tsx never
   * mounts. On Android the deep link does arrive and that screen mounts as well — both call
   * the same single-flight completion, so the second one joins instead of signing in twice.
   *
   * Nothing here navigates. app/(auth)/_layout.tsx redirects to /(app) once the session exists.
   */
  const handleSocialAuth = async (provider: OAuthProvider) => {
    if (socialProvider) return;

    setSocialProvider(provider);
    setSocialError('');
    // A stale password error above a fresh provider attempt reads as if the provider failed.
    loginMutation.reset();

    try {
      const session = await runOAuthSession(provider, apiBaseUrl);

      if (session.outcome === 'not_opened') {
        setSocialError('Vi klarte ikke å åpne innloggingsvinduet. Prøv igjen.');
        return;
      }
      // The browser closed without a return URL. Never treat that as a sign-in.
      if (session.outcome === 'dismissed') {
        setSocialError('Innloggingen ble avbrutt.');
        return;
      }

      const result = await completeOAuthSignIn(session.url);
      if (result.status === 'failed') setSocialError(result.message);
    } finally {
      setSocialProvider(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-page">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center justify-center px-5 py-6">
            <View className="w-full rounded-[28px] bg-surface shadow-sm">
              <View className="px-5 pb-7 pt-6">
                <Text className="text-[30px] font-bold leading-tight tracking-[-0.05em] text-ink">
                  Velkommen tilbake
                </Text>
                <Text className="mt-2 text-[15px] leading-6 text-muted">
                  Logg inn for å legge ut oppdrag eller finne ditt neste.
                </Text>

                <View className="mt-6 gap-2.5">
                  <SocialButton
                    provider="vipps"
                    disabled={socialProvider !== null}
                    onPress={() => void handleSocialAuth('vipps')}
                  />
                  <SocialButton
                    provider="google"
                    disabled={socialProvider !== null}
                    onPress={() => void handleSocialAuth('google')}
                  />
                </View>

                <View className="my-6 flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-line" />
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9B9E96]">
                    eller
                  </Text>
                  <View className="h-px flex-1 bg-line" />
                </View>

                {errorMessage ? (
                  <View className="mb-4 rounded-xl border border-[#D8B0AB] bg-[#FCF5F4] px-3 py-2.5">
                    <Text className="text-[13px] leading-5 text-[#B0453B]">{errorMessage}</Text>
                  </View>
                ) : null}

                <View className="gap-4">
                  <View className="gap-2">
                    <Text className="text-[13px] font-medium text-ink">E-postadresse</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      keyboardType="email-address"
                      value={form.email}
                      placeholder="deg@eksempel.no"
                      placeholderTextColor="#9B9E96"
                      onChangeText={(value) => {
                        setForm((current) => ({ ...current, email: value }));
                        setErrors((current) => ({ ...current, email: undefined }));
                      }}
                      className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.email ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                        }`}
                    />
                    {errors.email ? <Text className="text-[12px] text-[#B0453B]">{errors.email}</Text> : null}
                  </View>

                  <View className="gap-2">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-[13px] font-medium text-ink">Passord</Text>
                      <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
                        <Text className="text-[12px] font-medium text-brand">Glemt passord?</Text>
                      </Pressable>
                    </View>

                    <View className="relative">
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="current-password"
                        secureTextEntry={!showPassword}
                        value={form.password}
                        placeholder="Ditt passord"
                        placeholderTextColor="#9B9E96"
                        onChangeText={(value) => {
                          setForm((current) => ({ ...current, password: value }));
                          setErrors((current) => ({ ...current, password: undefined }));
                        }}
                        className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 pr-12 text-[15px] text-ink ${errors.password ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                          }`}
                      />
                      <Pressable
                        onPress={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-0 h-[46px] items-center justify-center"
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#63665F" />
                        ) : (
                          <Eye size={18} color="#63665F" />
                        )}
                      </Pressable>
                    </View>
                    {errors.password ? (
                      <Text className="text-[12px] text-[#B0453B]">{errors.password}</Text>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={handleSubmit}
                    disabled={loginMutation.isPending}
                    className={`mt-2 h-[46px] flex-row items-center justify-center rounded-xl bg-brand ${loginMutation.isPending ? 'opacity-80' : ''
                      }`}
                  >
                    {loginMutation.isPending ? (
                      <Loader2 size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text className="text-[15px] font-semibold text-white">
                      {loginMutation.isPending ? 'Logger inn…' : 'Logg inn'}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => router.push('/(auth)/register')}
                  className="mt-6 flex-row justify-center"
                >
                  <Text className="text-[14px] text-muted">Ny på Jobblo? </Text>
                  <Text className="text-[14px] font-semibold text-brand">Opprett gratis konto</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
