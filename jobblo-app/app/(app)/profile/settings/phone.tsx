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
import { CheckCircle2, Info, Phone } from 'lucide-react-native';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { TC, tc } from '../../../../src/theme/colors';

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
  'rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink';

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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <LoadingIndicator message="Laster telefonnummer..." />
      </SafeAreaView>
    );
  }

  if (isError || !profile) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
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
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        >
          <ScreenHeader title="Telefonnummer" subtitle="Kontaktinformasjon som vises på profilen din." icon={Phone} />

          <View className="rounded-3xl border border-line bg-surface p-5">
            <View className="mb-4">
              <Text className="mb-1.5 text-[0.8125rem] font-semibold text-ink">
                Telefonnummer
              </Text>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  setFeedback(null);
                }}
                placeholder="+47 912 34 567"
                placeholderTextColor={TC.placeholder}
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
                  validationHint ? 'border-[#B4544A] dark:border-danger' : '',
                ].join(' ')}
              />
              {validationHint ? (
                <Text className="mt-1.5 text-[0.8125rem] text-[#B4544A] dark:text-danger">
                  {validationHint}
                </Text>
              ) : changed ? (
                <Text className="mt-1.5 text-[0.8125rem] leading-4 text-muted">
                  Lagret nå: {serverPhone || 'ingen nummer'}
                </Text>
              ) : (
                <Text className="mt-1.5 text-[0.8125rem] leading-4 text-muted">
                  Mellomrom og tegn beholdes som du skriver dem.
                </Text>
              )}
            </View>

            {feedback ? (
              <View
                className={[
                  'mb-4 flex-row items-start rounded-2xl border p-3',
                  feedback.tone === 'success'
                    ? 'border-line bg-tint'
                    : 'border-[#B4544A] dark:border-danger bg-danger-tint',
                ].join(' ')}
              >
                {feedback.tone === 'success' ? (
                  <CheckCircle2 size={16} color={TC.brandText} />
                ) : (
                  <Info size={16} color={tc('#B4544A', 'danger')} />
                )}
                <Text
                  className={[
                    'ml-2 min-w-0 flex-1 text-[0.8125rem] leading-4',
                    feedback.tone === 'success'
                      ? 'text-brand-text'
                      : 'text-[#B4544A] dark:text-danger',
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
              className="items-center rounded-xl bg-brand py-3.5 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">
                {update.isPending
                  ? 'Lagrer...'
                  : 'Lagre telefonnummer'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-3xl border border-line bg-surface-2 p-4">
            <View className="flex-row items-start">
              <Info size={16} color={tc('#63665F', 'muted')} />
              <View className="ml-2 min-w-0 flex-1">
                <Text className="text-[0.8125rem] font-semibold text-ink">
                  Om telefonnummeret
                </Text>
                <Text className="mt-1.5 text-[0.8125rem] leading-4 text-muted">
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
