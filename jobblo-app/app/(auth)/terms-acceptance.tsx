import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { acceptTerms } from '@/services/auth.service';
import { userTerms } from '@/content/userTerms';

export default function TermsAcceptanceScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const response = await acceptTerms();
      await useAuthStore.getState().updateUser({
        acceptedTerms: response.acceptedTerms,
        termsVersion: response.termsVersion,
        termsAcceptedAt: new Date().toISOString(),
      });
      router.replace('/(app)');
    } catch (err) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          ?? (err as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : 'Kunne ikke registrere godkjenningen. Prøv igjen.';
      setError(typeof message === 'string' ? message : 'Kunne ikke registrere godkjenningen. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-page">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <View className="rounded-[28px] bg-surface p-5 shadow-sm">
          <Text className="text-[28px] font-bold leading-tight tracking-[-0.05em] text-ink">Godkjenn vilkårene</Text>
          <Text className="mt-2 text-[15px] leading-6 text-muted">
            For å fortsette å bruke Jobblo må du godkjenne de gjeldende brukervilkårene.
          </Text>

          {error ? (
            <View className="mt-4 rounded-xl border border-[#D8B0AB] bg-[#FCF5F4] px-3 py-2.5">
              <Text className="text-[13px] leading-5 text-[#B0453B]">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5 rounded-2xl border border-line bg-[#F5F6F1] p-3">
            <Text className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9B9E96]">Brukervilkår</Text>
            <Text className="mt-2 text-[13px] font-semibold text-ink">{userTerms.title}</Text>
            <Text className="mt-1 text-[11px] text-muted">Sist oppdatert: {userTerms.lastUpdatedDisplay}</Text>
            <Text className="mt-3 text-[12px] leading-5 text-muted">{userTerms.intro}</Text>
          </View>

          <View className="mt-5 gap-3">
            <Pressable
              onPress={() => router.push('/(app)/profile/settings/terms')}
              className="h-[46px] items-center justify-center rounded-xl border border-line bg-white"
            >
              <Text className="text-[15px] font-semibold text-brand">Vis full tekst</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleAccept()}
              disabled={isSubmitting}
              className="h-[46px] items-center justify-center rounded-xl bg-brand disabled:opacity-80"
            >
              <Text className="text-[15px] font-semibold text-white">
                {isSubmitting ? 'Godkjenner…' : 'Godta og fortsett'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void logout()}
              className="h-[46px] items-center justify-center rounded-xl bg-[#F0F1EB]"
            >
              <Text className="text-[15px] font-semibold text-ink">Logg ut</Text>
            </Pressable>
          </View>

          <Text className="mt-5 text-[11px] leading-5 text-muted">
            Logget inn som {typeof user?.email === 'string' && user.email.trim() ? user.email : 'bruker'}.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}