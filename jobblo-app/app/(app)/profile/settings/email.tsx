import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AtSign, CheckCircle2, Info } from 'lucide-react-native';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';

/**
 * Email settings — the account's login e-mail.
 *
 * This screen reuses the EXISTING profile update flow rather than a dedicated
 * email endpoint, because a static audit found that no email-change flow exists
 * on the backend: there is no `change-email`, `send-email-otp` or `verify-email`
 * route, no `emailVerified` / `verificationToken` field on `models/User.js`, and
 * the web equivalent (frontend/src/components/profile/SettingsViews/EmailView.tsx)
 * edits `email` through the same generic profile update. `email` is present in
 * the normal-user `allowedUpdates` allow-list of `updateUser`.
 *
 *   EmailSettingsScreen
 *     → useProfile() / useUpdateProfile()            (src/hooks/useProfile.ts)
 *     → getCurrentProfile() / updateCurrentProfile() (src/services/profile.service.ts)
 *     → apiClient                                    (src/api/client.ts)
 *     → GET /api/auth/profile  /  PUT /api/users/:id
 *
 * No email.service.ts was created and there is no Axios or fetch call in here.
 *
 * IMPORTANT for copy: the change requires re-entering the current password (the
 * backend answers 403 CURRENT_PASSWORD_REQUIRED without it), but is NOT otherwise
 * verified — no confirmation link and no OTP is sent to either address. Nothing
 * in this screen may claim otherwise, and no `Verifisert` / `Bekreftet` badge is
 * shown, because the backend has no field that would prove it.
 */

const inputClass = 'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]';

/**
 * The same shape check used by mobile login, register and forgot-password, and by
 * the backend's `forgotPassword`. Deliberately not a full RFC validator — the
 * backend stays authoritative. Rejects '', 'abc', 'abc@' and '@example.com'.
 */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Backend `User.email` is declared `lowercase: true, trim: true`, and login,
 * register and forgot-password all look accounts up by `trim().toLowerCase()`.
 * Mobile normalizes identically so the same address never resolves to two
 * different strings across web, mobile and backend.
 */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

type Feedback = { tone: 'success' | 'error'; text: string };

function emailOf(profile: { email?: string } | undefined): string {
  return typeof profile?.email === 'string' ? profile.email : '';
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/** Server text is only trusted when it cannot be a raw driver string. */
function safeServerMessage(error: unknown): string {
  const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (typeof message !== 'string' || !message.trim()) return '';
  return /E11000|index:|dup key|MongoError/i.test(message) ? '' : message.trim();
}

/**
 * Norwegian messages only; nothing raw from Mongo or Axios reaches the user.
 *
 * A duplicate address is already standardized by the backend: `updateUser` funnels
 * the failure through `sendMongoError`, which translates code 11000 into
 * `409 { error: 'E-postadressen er allerede i bruk.' }`. That curated message is
 * preferred so mobile does not invent a second contract, with a local fallback if
 * it is ever absent.
 *
 * Neither a network failure nor a 5xx clears auth here — this screen only renders
 * a banner. Session expiry stays the job of the centralized 401 handling in
 * api/client.ts, which is not duplicated.
 */
function saveErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined) return 'Ingen nettforbindelse. Sjekk internett og prøv igjen.';
  if (status === 409) return safeServerMessage(error) || 'Denne e-postadressen er allerede i bruk.';
  if (status === 400) return 'E-postadressen ble ikke godtatt. Kontroller den og prøv igjen.';
  if (status === 401) return 'Økten din er ikke lenger gyldig. Logg inn på nytt.';
  if (status === 403) return safeServerMessage(error) || 'Du har ikke tilgang til å endre denne e-postadressen.';
  if (status === 404) return 'Fant ikke profilen din. Prøv å laste inn siden på nytt.';
  if (status >= 500) return 'Serverfeil. Prøv igjen litt senere.';
  return 'Kunne ikke oppdatere e-postadressen. Prøv igjen.';
}

export default function EmailSettingsScreen() {
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();

  // The profile query is authoritative for the id in the path; the persisted
  // store is only a fallback. Ownership is NOT decided here — `updateUser` calls
  // `authorizeUser(req, id)`, which compares the token-derived `req.userId` with
  // the :id in the path and answers 403 unless they match, so a tampered id
  // cannot change another account's e-mail.
  const storedUserId = useAuthStore((state) => (typeof state.user?._id === 'string' ? state.user._id : undefined));
  const userId = typeof profile?._id === 'string' ? profile._id : storedUserId;

  const serverEmail = emailOf(profile);
  const [draft, setDraft] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Seed from the server profile, not from persisted Zustand state. The server
  // value stays the baseline, so a successful save (which refetches the profile)
  // settles the form back to "unchanged" on its own.
  useEffect(() => {
    if (profile && draft === null) setDraft(serverEmail);
  }, [profile, draft, serverEmail]);

  if (isLoading || draft === null) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster e-postadresse..." />
      </SafeAreaView>
    );
  }

  if (isError || !profile) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste e-postadressen"
          message="Vi fikk ikke hentet profilen din. Sjekk internettforbindelsen og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const normalized = normalizeEmail(draft);
  const changed = normalized !== normalizeEmail(serverEmail);
  const valid = emailPattern.test(normalized);
  const disabled = !changed || !valid || !currentPassword || update.isPending || !userId;
  // Only nag about the shape once something has actually been typed and changed.
  const validationHint = changed && !valid ? 'Skriv inn en gyldig e-postadresse.' : '';

  const save = () => {
    if (disabled || !userId) return;
    setFeedback(null);
    // Only the e-mail and the confirming current password are sent — never the whole
    // user object, and never role, verified, subscription, Stripe fields or phone.
    update.mutate(
      { userId, data: { email: normalized, currentPassword } },
      {
        onSuccess: (saved) => {
          // Show what the server stored, not the local draft.
          setDraft(emailOf(saved) || normalized);
          setCurrentPassword('');
          setFeedback({ tone: 'success', text: 'E-postadressen er oppdatert.' });
        },
        onError: (error) => setFeedback({ tone: 'error', text: saveErrorMessage(error) }),
      }
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <ScreenHeader title="E-postadresse" subtitle="Adressen du logger inn med." icon={AtSign} />

          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="mb-4">
              <Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">E-postadresse</Text>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  setFeedback(null);
                }}
                placeholder="navn@example.com"
                placeholderTextColor="#9B9E96"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                spellCheck={false}
                returnKeyType="done"
                onSubmitEditing={save}
                editable={!update.isPending}
                maxLength={254}
                accessibilityLabel="E-postadresse"
                className={[inputClass, validationHint ? 'border-[#B4544A]' : ''].join(' ')}
              />
              {validationHint ? (
                <Text className="mt-1.5 text-xs text-[#B4544A]">{validationHint}</Text>
              ) : changed ? (
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">Lagret nå: {serverEmail || 'ingen adresse'}</Text>
              ) : (
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">Store bokstaver og mellomrom fjernes automatisk.</Text>
              )}
            </View>

            {changed ? (
              <View className="mb-4">
                <Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">Nåværende passord</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={(value) => {
                    setCurrentPassword(value);
                    setFeedback(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  editable={!update.isPending}
                  accessibilityLabel="Nåværende passord"
                  className={inputClass}
                />
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">
                  Av sikkerhetshensyn må du bekrefte med passordet ditt for å endre e-postadressen.
                </Text>
              </View>
            ) : null}

            {feedback ? (
              <View
                className={[
                  'mb-4 flex-row items-start rounded-2xl border p-3',
                  feedback.tone === 'success' ? 'border-[#E6E7E1] bg-[#EAF1E9]' : 'border-[#B4544A] bg-[#FBF4F2]',
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
                    feedback.tone === 'success' ? 'text-[#2E6641]' : 'text-[#B4544A]',
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
                {update.isPending ? 'Oppdaterer...' : 'Oppdater e-post'}
              </Text>
            </Pressable>
          </View>

          {/*
            Every claim below was verified against the backend:
            - login: `User.findOne({ email: normalizedEmail })` in authController.login
            - forgot-password: same lookup, and the OTP is mailed to `user.email`
            - support: supportController overwrites the address with
              `User.findById(req.userId).select('email')` for authenticated users
            - no verification exists, so the absence is stated rather than hidden
          */}
          <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-[#F4F6F0] p-4">
            <View className="flex-row items-start">
              <Info size={16} color="#63665F" />
              <View className="ml-2 min-w-0 flex-1">
                <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">Dette skjer når du endrer adressen</Text>
                <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">
                  Endringen skjer med en gang, og du bruker den nye adressen neste gang du logger inn. Vi sender ingen
                  bekreftelseslenke, så pass på at adressen er riktig.
                </Text>
                <Text className="mt-2 text-xs leading-4 text-[#63665F]">
                  Koden for glemt passord og svar fra kundesenteret går også til den nye adressen. Du blir ikke logget ut,
                  verken på denne enheten eller på andre.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
