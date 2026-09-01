import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, CheckCircle2, Info, Phone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';

/**
 * Phone settings — profile contact phone number.
 *
 * Reuses the generic profile update flow (PUT /api/users/:id) with the `phone`
 * field. Backend `User.phone` is a plain `String` with `trim: true` and a `set`
 * hook that converts empty strings to `undefined` so they are not persisted.
 * There is no OTP, no SMS verification, no Twilio integration — the phone
 * number is stored as-is. Nothing in this screen may claim otherwise.
 *
 *   PhoneSettingsScreen
 *     → useProfile() / useUpdateProfile()            (src/hooks/useProfile.ts)
 *     → getCurrentProfile() / updateCurrentProfile() (src/services/profile.service.ts)
 *     → apiClient                                    (src/api/client.ts)
 *     → GET /api/auth/profile  /  PUT /api/users/:id
 */

const inputClass =
  'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]';

type Feedback = { tone: 'success' | 'error'; text: string };

function phoneOf(profile: { phone?: string } | undefined): string {
  return typeof profile?.phone === 'string' ? profile.phone : '';
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function saveErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined)
    return 'Ingen nettforbindelse. Sjekk internett og prøv igjen.';
  if (status === 400)
    return 'Telefonnummeret ble ikke godtatt. Kontroller feltet og prøv igjen.';
  if (status === 401) return 'Økten din er ikke lenger gyldig. Logg inn på nytt.';
  if (status === 403)
    return 'Du har ikke tilgang til å endre dette telefonnummeret.';
  if (status === 404)
    return 'Fant ikke profilen din. Prøv å laste inn siden på nytt.';
  if (status >= 500) return 'Serverfeil. Prøv igjen litt senere.';
  return 'Kunne ikke oppdatere telefonnummeret. Prøv igjen.';
}

export default function PhoneSettingsScreen() {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();

  const storedUserId = useAuthStore(
    (state) =>
      typeof state.user?._id === 'string' ? state.user._id : undefined
  );
  const userId =
    typeof profile?._id === 'string' ? profile._id : storedUserId;

  const serverPhone = phoneOf(profile);
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (profile && draft === null) setDraft(serverPhone);
  }, [profile, draft, serverPhone]);

  if (isLoading || draft === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster telefonnummer..." />
      </SafeAreaView>
    );
  }

  if (isError || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste telefonnummeret"
          message="Vi fikk ikke hentet profilen din. Sjekk internettforbindelsen og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const trimmed = draft.trim();
  const changed = trimmed !== serverPhone.trim();
  // Accept anything that looks like a plausible phone number: at least a few
  // digits, optionally starting with +, allowing spaces, dashes, parentheses.
  const hasDigits = /\d{3,}/.test(trimmed);
  const valid = trimmed === '' || hasDigits;
  const disabled = !changed || !valid || update.isPending || !userId;
  const validationHint =
    changed && trimmed !== '' && !hasDigits
      ? 'Skriv inn et gyldig telefonnummer.'
      : '';

  const save = () => {
    if (disabled || !userId) return;
    setFeedback(null);
    // Empty string is a valid way to clear the field — the backend's `set` hook
    // converts '' to undefined so it is not stored.
    update.mutate(
      { userId, data: { phone: trimmed } },
      {
        onSuccess: (saved) => {
          setDraft(phoneOf(saved) || trimmed);
          setFeedback({
            tone: 'success',
            text: 'Telefonnummeret er oppdatert.',
          });
        },
        onError: (error) =>
          setFeedback({ tone: 'error', text: saveErrorMessage(error) }),
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="mb-5 flex-row items-center self-start py-2"
          >
            <ArrowLeft size={18} color="#63665F" />
            <Text className="ml-2 text-sm font-medium text-[#63665F]">
              Innstillinger
            </Text>
          </Pressable>

          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="mb-5 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]">
                <Phone size={18} color="#2E6641" />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-lg font-bold text-[#0B0B0B]">
                  Telefonnummer
                </Text>
                <Text className="mt-1 text-xs leading-4 text-[#63665F]">
                  Kontaktinformasjon som vises på profilen din.
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">
                Telefonnummer
              </Text>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  setFeedback(null);
                }}
                placeholder="+47 912 34 567"
                placeholderTextColor="#9B9E96"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="done"
                onSubmitEditing={save}
                editable={!update.isPending}
                maxLength={30}
                accessibilityLabel="Telefonnummer"
                className={[
                  inputClass,
                  validationHint ? 'border-[#B4544A]' : '',
                ].join(' ')}
              />
              {validationHint ? (
                <Text className="mt-1.5 text-xs text-[#B4544A]">
                  {validationHint}
                </Text>
              ) : changed ? (
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">
                  Lagret nå: {serverPhone || 'ingen nummer'}
                </Text>
              ) : (
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">
                  Mellomrom og tegn beholdes som du skriver dem.
                </Text>
              )}
            </View>

            {feedback ? (
              <View
                className={[
                  'mb-4 flex-row items-start rounded-2xl border p-3',
                  feedback.tone === 'success'
                    ? 'border-[#E6E7E1] bg-[#EAF1E9]'
                    : 'border-[#B4544A] bg-[#FBF4F2]',
                ].join(' ')}
              >
                {feedback.tone === 'success' ? (
                  <CheckCircle2 size={16} color="#2E6641" />
                ) : (
                  <Info size={16} color="#B4544A" />
                )}
                <Text
                  className={[
                    'ml-2 min-w-0 flex-1 text-xs leading-4',
                    feedback.tone === 'success'
                      ? 'text-[#2E6641]'
                      : 'text-[#B4544A]',
                  ].join(' ')}
                >
                  {feedback.text}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={save}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              className="items-center rounded-xl bg-[#2E6641] py-3.5 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">
                {update.isPending
                  ? 'Lagrer...'
                  : 'Lagre telefonnummer'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-[#F4F6F0] p-4">
            <View className="flex-row items-start">
              <Info size={16} color="#63665F" />
              <View className="ml-2 min-w-0 flex-1">
                <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">
                  Om telefonnummeret
                </Text>
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">
                  Nummeret lagres på profilen din og kan vises til andre brukere
                  der det er relevant. Det brukes ikke til SMS-bekreftelse eller
                  oppringing fra denne appen.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
