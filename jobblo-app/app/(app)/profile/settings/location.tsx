import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, CheckCircle2, Info, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';

/**
 * Location settings — profile country only.
 *
 * This screen is deliberately a thin wrapper around the EXISTING profile update
 * flow: it reuses `useProfile()` / `useUpdateProfile()` → profile.service.ts →
 * api/client.ts → PUT /api/users/:id. There is no location.service.ts for this,
 * because `country` is simply another allow-listed profile field on the backend
 * (see `allowedUpdates` in controllers/userController.js). The unrelated
 * src/services/location.service.ts serves the JOB location tree and must not be
 * used here.
 *
 * Scope matches the web Location settings view exactly (frontend/src/components/
 * profile/SettingsViews/LocationView.tsx): one free-text country field. There is
 * no GPS, no device geolocation, no map, no coordinates and no municipality or
 * county selection in this screen, because the user profile does not store those.
 * A job's location (address, city, coordinates, countyCode, municipalityCode,
 * areaCode) is a separate domain owned by the Create Job flow.
 */

const inputClass = 'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]';

type Feedback = { tone: 'success' | 'error'; text: string };

/** Read the server's country as a string. `CurrentProfile` allows unknown keys. */
function countryOf(profile: { country?: string } | undefined): string {
  return typeof profile?.country === 'string' ? profile.country : '';
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * Norwegian, user-facing messages only. Backend 400s from this endpoint are
 * internal English strings ('No valid fields provided for update', 'Invalid user
 * ID format') and Mongo failures are funnelled through sendMongoError, so no
 * server text is forwarded verbatim — nothing raw from Mongo or Axios is shown.
 *
 * A network failure or a 5xx never clears auth here: this screen only sets a
 * banner. Session expiry stays the job of the centralized 401 handling in
 * api/client.ts, which this screen does not duplicate.
 */
function saveErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined) return 'Ingen nettforbindelse. Sjekk internett og prøv igjen.';
  if (status === 400) return 'Landet kunne ikke lagres. Kontroller feltet og prøv igjen.';
  if (status === 401) return 'Økten din er ikke lenger gyldig. Logg inn på nytt.';
  if (status === 403) return 'Du har ikke tilgang til å endre denne profilen.';
  if (status === 404) return 'Fant ikke profilen din. Prøv å laste inn siden på nytt.';
  if (status >= 500) return 'Serverfeil. Prøv igjen litt senere.';
  return 'Kunne ikke lagre landet. Prøv igjen.';
}

export default function LocationSettingsScreen() {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();

  // The profile query is authoritative for the id we put in the path; the
  // persisted store is only a fallback. Ownership itself is NOT decided here —
  // the backend derives it from the access token (`authorizeUser` compares
  // `req.userId` with the :id in the path and answers 403 on a mismatch), so a
  // tampered id cannot edit another account.
  const storedUserId = useAuthStore((state) => (typeof state.user?._id === 'string' ? state.user._id : undefined));
  const userId = typeof profile?._id === 'string' ? profile._id : storedUserId;

  const serverCountry = countryOf(profile);
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Seed the field from the server profile once it arrives. The server value
  // stays the baseline afterwards, so a successful save (which refetches the
  // profile) settles the form back to "unchanged" on its own.
  useEffect(() => {
    if (profile && draft === null) setDraft(serverCountry);
  }, [profile, draft, serverCountry]);

  if (isLoading || draft === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster lokasjon..." />
      </SafeAreaView>
    );
  }

  if (isError || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste lokasjonen"
          message="Vi fikk ikke hentet profilen din. Sjekk internettforbindelsen og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  // Compared trimmed so stray whitespace never triggers a pointless request.
  const changed = draft.trim() !== serverCountry.trim();
  // `country` is optional on the backend model (no `required`, no enum), so an
  // empty value is a legitimate way to clear it — it is not blocked here.
  const disabled = !changed || update.isPending || !userId;

  const save = () => {
    if (disabled || !userId) return;
    setFeedback(null);
    update.mutate(
      { userId, data: { country: draft.trim() } },
      {
        onSuccess: (saved) => {
          // Trust the server response, not the local draft.
          setDraft(countryOf(saved));
          setFeedback({ tone: 'success', text: 'Lokasjonen din er oppdatert.' });
        },
        onError: (error) => setFeedback({ tone: 'error', text: saveErrorMessage(error) }),
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2">
            <ArrowLeft size={18} color="#63665F" />
            <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
          </Pressable>

          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="mb-5 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]">
                <MapPin size={18} color="#2E6641" />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-lg font-bold text-[#0B0B0B]">Lokasjon</Text>
                <Text className="mt-1 text-xs leading-4 text-[#63665F]">Landet som vises på profilen din.</Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">Land</Text>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  setFeedback(null);
                }}
                placeholder="Norge"
                placeholderTextColor="#9B9E96"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={save}
                editable={!update.isPending}
                maxLength={80}
                accessibilityLabel="Land"
                className={inputClass}
              />
              <Text className="mt-1.5 text-xs leading-4 text-[#63665F]">Skriv landet slik du vil at det skal vises, for eksempel «Norge».</Text>
            </View>

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
                {update.isPending ? 'Oppdaterer...' : 'Oppdater lokasjon'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 flex-row items-start rounded-3xl border border-[#E6E7E1] bg-[#F4F6F0] p-4">
            <Info size={16} color="#63665F" />
            <Text className="ml-2 min-w-0 flex-1 text-xs leading-4 text-[#63665F]">
              Dette er landet på profilen din. Stedet for et oppdrag settes for hver enkelt jobb når du legger den ut, og endres ikke her.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
