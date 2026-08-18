import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useLoginMutation } from '@/hooks/useLoginMutation';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const apiOrigin = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

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

function SocialButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: 'vipps' | 'bankid' | 'google';
  onPress: () => void;
}) {
  const styleMap = {
    vipps: 'bg-[#FF5B24]',
    bankid: 'border border-line bg-white',
    google: 'border border-line bg-white',
  };

  const textStyleMap = {
    vipps: 'text-white',
    bankid: 'text-ink',
    google: 'text-ink',
  };

  const prefix =
    variant === 'vipps' ? <Text className="text-base font-black text-white">Vipps</Text> : null;

  return (
    <Pressable
      onPress={onPress}
      className={`h-[46px] flex-row items-center justify-center gap-2 rounded-xl px-4 ${styleMap[variant]}`}
    >
      {variant === 'bankid' ? <ShieldCheck size={18} color="#2E6641" /> : null}
      {variant === 'google' ? <Text className="text-base font-bold text-[#4285F4]">G</Text> : null}
      {prefix}
      <Text className={`text-[15px] font-semibold ${textStyleMap[variant]}`}>Fortsett med {label}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const serverMessage = useMemo(
    () =>
      loginMutation.error
        ? getErrorMessage(loginMutation.error, 'Innlogging mislyktes. Sjekk e-post og passord.')
        : '',
    [loginMutation.error]
  );

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

    loginMutation.mutate(
      { email: form.email.trim().toLowerCase(), password: form.password },
      {
        onSuccess: () => router.replace('/(app)'),
      }
    );
  };

  const handleExternalAuth = async (provider: 'vipps' | 'bankid' | 'google') => {
    const target = `${apiOrigin}/api/auth/${provider === 'bankid' ? 'idura' : provider}`;
    await Linking.openURL(target);
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

                <View className="mt-6 gap-3">
                  <SocialButton label="Vipps" variant="vipps" onPress={() => handleExternalAuth('vipps')} />
                  <SocialButton
                    label="BankID"
                    variant="bankid"
                    onPress={() => handleExternalAuth('bankid')}
                  />
                  <SocialButton
                    label="Google"
                    variant="google"
                    onPress={() => handleExternalAuth('google')}
                  />
                </View>

                <View className="my-6 flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-line" />
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9B9E96]">
                    eller
                  </Text>
                  <View className="h-px flex-1 bg-line" />
                </View>

                {serverMessage ? (
                  <View className="mb-4 rounded-xl border border-[#D8B0AB] bg-[#FCF5F4] px-3 py-2.5">
                    <Text className="text-[13px] leading-5 text-[#B0453B]">{serverMessage}</Text>
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
                      <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)}>
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
                  onPress={() => router.push('/(auth)/register' as any)}
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
