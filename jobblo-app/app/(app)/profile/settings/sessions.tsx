import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  KeyRound,
  LogOut,
  MapPin,
  Monitor,
  ShieldAlert,
  Smartphone,
  Tablet,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  useActiveSessions,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from '../../../../src/hooks/useSessions';
import type { ActiveSession } from '../../../../src/services/auth.service';
import { Dialog } from '../../../../src/components/ui/Dialog';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';

/* ------------------------------------------------------------------ *
 * Presentation helpers
 *
 * Everything below is cosmetic only. None of it is security-significant:
 * the icon, the device label and the location are derived from a
 * self-reported User-Agent string and an IP lookup, so they are treated as
 * approximate diagnostics. The ONLY trustworthy device identity on this screen
 * is the server-computed `isCurrent` flag.
 * ------------------------------------------------------------------ */

/** Backend defaults unresolved User-Agent fields to the literal string 'Unknown'. */
function clean(value?: string): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  return /^(unknown|undefined|null)$/i.test(text) ? '' : text;
}

type DeviceKind = 'phone' | 'tablet' | 'desktop';

/**
 * Coarse form-factor guess used only to pick an icon.
 * Tablet is tested first because Android tablets report both 'android' and
 * 'tablet', and we want the more specific match to win.
 */
function deviceKind(session: ActiveSession): DeviceKind {
  const haystack = `${session.device ?? ''} ${session.os ?? ''} ${session.browser ?? ''}`.toLowerCase();
  if (haystack.includes('tablet') || haystack.includes('ipad')) return 'tablet';
  if (
    haystack.includes('mobile') ||
    haystack.includes('android') ||
    haystack.includes('iphone') ||
    haystack.includes('ios')
  ) {
    return 'phone';
  }
  return 'desktop';
}

/**
 * Mirrors the web Sessions view, which titles each row `browser · os`.
 * Falls back to a truthful "unknown" label instead of rendering the literal
 * string "Unknown · Unknown" the way an unguarded join would.
 */
function deviceTitle(session: ActiveSession): string {
  const parts = [clean(session.browser), clean(session.os)].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  const kind = deviceKind(session);
  return kind === 'phone' ? 'Ukjent mobil' : kind === 'tablet' ? 'Ukjent nettbrett' : 'Ukjent enhet';
}

const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost']);

/** Avoids showing a raw '::1' to the user for same-machine/dev connections. */
function formatIp(ip?: string): string {
  const text = clean(ip);
  if (!text) return '';
  return LOOPBACK.has(text.toLowerCase()) ? 'Lokal tilkobling' : text;
}

/** Approximate, IP-derived city/country. Never GPS. */
function formatLocation(session: ActiveSession): string {
  const location = clean(session.location);
  if (!location) return 'Ukjent sted';
  if (location.toLowerCase() === 'localhost') return 'Lokal tilkobling';
  return location;
}

/**
 * `lastUsed` is the last time this session made an authenticated request — the
 * auth middleware stamps it on every call. It is explicitly NOT a presence
 * signal: a recent timestamp does not mean the device is online right now, and
 * the backend has no presence state, so no "online now" is ever rendered.
 */
function formatLastUsed(value?: string): string {
  if (!value) return 'Ukjent tidspunkt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ukjent tidspunkt';
  try {
    return date.toLocaleString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    // Hermes builds without full ICU can throw on a locale argument. The
    // fallback is UTC, so it is labelled UTC rather than being passed off as
    // local time (up to 2 hours out in Norway).
    return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * Fixed, local copy for every failure mode.
 *
 * Server strings are deliberately never passed through: `sendServerError`
 * returns `error.message` outside production, which can contain Mongo/driver
 * internals. Mapping to our own text guarantees no stack trace or DB error text
 * can surface in the UI.
 */
function revokeErrorMessage(error: unknown): { tone: 'info' | 'error'; text: string } {
  const status = statusOf(error);
  if (status === 404) {
    // Already revoked from another device, or expired via the TTL index.
    // Not an error worth alarming the user about — the list has been resynced.
    return { tone: 'info', text: 'Denne økten var allerede logget ut. Listen er oppdatert.' };
  }
  if (status === 403) {
    return { tone: 'error', text: 'Du har ikke tilgang til å logge ut denne økten.' };
  }
  if (status === 401) {
    // The current session itself is no longer valid — most likely revoked from
    // another device. The centralized 401 handling stays authoritative and no
    // logout logic is duplicated here. Being precise about what that handling
    // actually does: api/client.ts removes the stored 'token' and 'user' keys
    // but does NOT call authStore.logout(), so isAuthenticated stays true until
    // the next hydrate(). That is a pre-existing app-wide gap affecting every
    // endpoint, not something this screen introduces or should patch around.
    return { tone: 'error', text: 'Økten din er ikke lenger gyldig. Logg inn på nytt.' };
  }
  if (status === undefined) {
    return { tone: 'error', text: 'Ingen nettforbindelse. Sjekk internett og prøv igjen.' };
  }
  if (status >= 500) {
    return { tone: 'error', text: 'Serverfeil. Prøv igjen litt senere.' };
  }
  return { tone: 'error', text: 'Kunne ikke logge ut økten. Prøv igjen.' };
}

type Confirmation =
  | { kind: 'one'; session: ActiveSession }
  | { kind: 'all'; count: number }
  | null;

type Feedback = { tone: 'info' | 'error'; text: string } | null;

export default function ActiveSessionsScreen() {
  const router = useRouter();
  const sessionsQuery = useActiveSessions();
  const revokeOne = useRevokeSessionMutation();
  const revokeOthers = useRevokeOtherSessionsMutation();

  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  /**
   * Server order is `lastUsed` descending and is left intact; the current
   * session is only lifted to the top for readability. Backend ordering is not
   * changed for visual reasons. Memoized on the query data itself rather than on
   * a `?? []` expression, which would be a fresh array identity every render.
   */
  const ordered = useMemo(() => {
    const list = sessionsQuery.data ?? [];
    return [...list].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }, [sessionsQuery.data]);

  const sessions = ordered;

  const otherSessionsCount = sessions.filter((session) => !session.isCurrent).length;
  const busy = revokeOne.isPending || revokeOthers.isPending;

  const confirmRevokeOne = (session: ActiveSession) => {
    setConfirmation(null);
    setFeedback(null);
    // Only the public session id is sent. No userId, no token: the backend
    // derives the owner from the authenticated request and constrains the
    // delete by { _id, userId }.
    revokeOne.mutate(session._id, {
      onSuccess: () => setFeedback({ tone: 'info', text: 'Enheten er logget ut.' }),
      onError: (error) => setFeedback(revokeErrorMessage(error)),
    });
  };

  const confirmRevokeOthers = () => {
    setConfirmation(null);
    setFeedback(null);
    revokeOthers.mutate(undefined, {
      onSuccess: (result) => {
        const count = typeof result?.count === 'number' ? result.count : 0;
        setFeedback({
          tone: 'info',
          text:
            count === 0
              ? 'Ingen andre økter var aktive.'
              : count === 1
                ? '1 annen enhet er logget ut.'
                : `${count} andre enheter er logget ut.`,
        });
      },
      onError: (error) => setFeedback(revokeErrorMessage(error)),
    });
  };

  if (sessionsQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster aktive økter..." />
      </SafeAreaView>
    );
  }

  // Only take over the whole screen when there is nothing to show. A background
  // refetch that fails after a successful revoke leaves `data` populated while
  // flipping status to 'error'; blanking the screen there would hide both the
  // still-valid list and the confirmation that the revoke worked.
  if (sessionsQuery.isError && !sessionsQuery.data) {
    const status = statusOf(sessionsQuery.error);
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title={status === 401 ? 'Pålogging kreves' : 'Kunne ikke laste øktene'}
          message={
            status === 401
              ? 'Du må være innlogget for å se dine aktive økter.'
              : status !== undefined && status >= 500
                ? 'Serverfeil. Prøv igjen litt senere.'
                : status === undefined
                  ? 'Ingen nettforbindelse. Sjekk internett og prøv igjen.'
                  : 'Listen over aktive økter kunne ikke hentes akkurat nå.'
          }
          actionLabel="Prøv igjen"
          onAction={() => void sessionsQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-5 flex-row items-center self-start py-2"
        >
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
        </Pressable>

        <View className="mb-5">
          <Text className="text-[1.5rem] font-bold leading-tight text-[#0B0B0B]">Aktive økter</Text>
          <Text className="mt-1 text-[0.9375rem] leading-6 text-[#63665F]">
            Administrer dine aktive innlogginger på forskjellige enheter og nettlesere.
          </Text>
        </View>

        {feedback ? (
          <View
            className={[
              'mb-4 rounded-2xl border px-4 py-3',
              feedback.tone === 'error'
                ? 'border-[#EED8D4] bg-[#FBF4F2]'
                : 'border-[#D1E7D9] bg-[#F2F9F4]',
            ].join(' ')}
          >
            <Text
              className={[
                'text-[0.8125rem] leading-5',
                feedback.tone === 'error' ? 'text-[#8A3B33]' : 'text-[#173A24]',
              ].join(' ')}
            >
              {feedback.text}
            </Text>
          </View>
        ) : null}

        {/* Shown when a refetch failed but a previously loaded list is still in
            cache, so the user knows the list may be out of date instead of
            silently trusting a stale view. */}
        {sessionsQuery.isError && sessionsQuery.data ? (
          <Pressable
            onPress={() => void sessionsQuery.refetch()}
            className="mb-4 rounded-2xl border border-[#F1E1C4] bg-[#FBF5E9] px-4 py-3 active:opacity-80"
          >
            <Text className="text-[0.8125rem] leading-5 text-[#614109]">
              Listen kunne ikke oppdateres og kan være utdatert. Trykk for å prøve igjen.
            </Text>
          </Pressable>
        ) : null}

        {otherSessionsCount > 0 ? (
          <Pressable
            onPress={() => {
              setFeedback(null);
              setConfirmation({ kind: 'all', count: otherSessionsCount });
            }}
            disabled={busy}
            className={[
              'mb-4 flex-row items-center justify-center rounded-2xl border border-[#EED8D4] bg-white px-4 py-3.5',
              busy ? 'opacity-60' : 'active:bg-[#FBF4F2]',
            ].join(' ')}
          >
            <LogOut size={16} color="#B4544A" />
            <Text className="ml-2 flex-shrink text-[0.875rem] font-semibold text-[#B4544A]">
              {revokeOthers.isPending
                ? 'Logger ut...'
                : `Logg ut alle andre (${otherSessionsCount})`}
            </Text>
          </Pressable>
        ) : null}

        {ordered.length === 0 ? (
          /* Truthful empty state. No local "this device" row is manufactured — if
             the server returns nothing, we say nothing was found. */
          <EmptyState
            title="Ingen aktive økter funnet"
            message="Vi fant ingen registrerte innlogginger på kontoen din."
          />
        ) : (
          ordered.map((session) => {
            const kind = deviceKind(session);
            const DeviceIcon = kind === 'phone' ? Smartphone : kind === 'tablet' ? Tablet : Monitor;
            const locationLabel = formatLocation(session);
            const ipLabel = formatIp(session.ip);
            // Loopback resolves both the location and the IP to the same label,
            // so suppress the duplicate rather than printing it twice.
            const ip = ipLabel === locationLabel ? '' : ipLabel;
            const isRevokingThis = revokeOne.isPending && revokeOne.variables === session._id;

            return (
              <View
                key={session._id}
                className={[
                  'mb-3 rounded-3xl border p-4',
                  session.isCurrent ? 'border-[#D1E7D9] bg-[#F7FBF8]' : 'border-[#E6E7E1] bg-white',
                ].join(' ')}
              >
                <View className="flex-row items-start">
                  <View
                    className={[
                      'h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                      session.isCurrent ? 'bg-[#DCEDE2]' : 'bg-[#F4F6F0]',
                    ].join(' ')}
                  >
                    <DeviceIcon size={20} color={session.isCurrent ? '#2E6641' : '#63665F'} />
                  </View>

                  <View className="ml-3 min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center">
                      <Text className="text-[0.9375rem] font-bold text-[#0B0B0B]">
                        {deviceTitle(session)}
                      </Text>
                      {/* `isCurrent` comes from the server comparing this session's
                          _id against the `sid` claim of the presented token. It is
                          never inferred from device name, IP, platform, lastUsed or
                          list position. */}
                      {session.isCurrent ? (
                        <View className="ml-2 rounded-full bg-[#DCEDE2] px-2 py-0.5">
                          <Text className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[#173A24]">
                            Nåværende
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="mt-2 flex-row items-start">
                      <View className="mt-0.5">
                        <MapPin size={13} color="#9B9E96" />
                      </View>
                      <Text className="ml-1.5 flex-1 text-[0.8125rem] leading-5 text-[#63665F]">
                        {locationLabel}
                        {ip ? <Text className="text-[#9B9E96]">{`  ·  ${ip}`}</Text> : null}
                      </Text>
                    </View>

                    <View className="mt-1 flex-row items-start">
                      <View className="mt-0.5">
                        <Clock size={13} color="#9B9E96" />
                      </View>
                      <Text className="ml-1.5 flex-1 text-[0.8125rem] leading-5 text-[#63665F]">
                        Sist aktiv {formatLastUsed(session.lastUsed)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* The current session intentionally has no revoke action here.
                    Note this is NOT the same as "logging out ends this session
                    server-side": mobile logout (authStore.logout) is local only —
                    it clears the stored token, the query cache, the chat socket
                    and this device's push token, but never calls the backend.
                    `authController.logout` deletes the Session row by the
                    refreshToken *cookie*, which the RN client never holds, so
                    this device's row survives until the 7-day TTL on
                    Session.expiresAt. Ending the current session server-side
                    from mobile is therefore not implemented, and the copy below
                    must not imply otherwise. */}
                {session.isCurrent ? (
                  <Text className="mt-3 text-[0.75rem] leading-5 text-[#63665F]">
                    Dette er enheten du bruker nå, så den kan ikke logges ut herfra. Bruk «Logg ut»
                    på profilsiden for å logge ut av appen på denne enheten.
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => {
                      setFeedback(null);
                      setConfirmation({ kind: 'one', session });
                    }}
                    disabled={busy}
                    className={[
                      'mt-3 flex-row items-center justify-center rounded-2xl border border-[#EED8D4] bg-white px-4 py-2.5',
                      busy ? 'opacity-60' : 'active:bg-[#FBF4F2]',
                    ].join(' ')}
                  >
                    <LogOut size={14} color="#B4544A" />
                    <Text className="ml-2 text-[0.8125rem] font-semibold text-[#B4544A]">
                      {isRevokingThis ? 'Logger ut...' : 'Logg ut'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        <View className="mt-2 rounded-3xl border border-[#F1E1C4] bg-[#FBF5E9] p-5">
          <View className="flex-row items-start">
            <View className="mt-0.5 shrink-0">
              <ShieldAlert size={18} color="#B7791F" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[0.875rem] font-bold text-[#614109]">Sikkerhetsmerknad</Text>
              <Text className="mt-1.5 text-[0.8125rem] leading-6 text-[#614109]">
                Hvis du ser en enhet eller et sted du ikke kjenner igjen, bør du logge ut økten
                umiddelbart og endre passordet ditt. Sted og IP er omtrentlige opplysninger utledet
                fra nettverket, ikke nøyaktig posisjon.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/profile/settings/password')}
            className="mt-4 flex-row items-center rounded-2xl border border-[#F0DDB7] bg-white px-4 py-3 active:bg-[#FBF5E9]"
          >
            <KeyRound size={16} color="#B7791F" />
            <Text className="ml-2 flex-1 text-[0.875rem] font-semibold text-[#614109]">
              Endre passord
            </Text>
            <ChevronRight size={16} color="#B7791F" />
          </Pressable>
        </View>

        <Text className="mt-5 px-1 text-[0.75rem] leading-5 text-[#9B9E96]">
          Når du logger ut en økt, mister enheten tilgangen umiddelbart ved sitt neste kall mot
          Jobblo.
        </Text>
      </ScrollView>

      <Dialog visible={confirmation !== null} onClose={() => setConfirmation(null)}>
        <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">
          {confirmation?.kind === 'all' ? 'Logg ut alle andre enheter?' : 'Logg ut denne enheten?'}
        </Text>
        <Text className="mt-2 text-[0.875rem] leading-6 text-[#63665F]">
          {confirmation?.kind === 'all'
            ? `Er du sikker på at du vil logge ut alle andre enheter? ${
                confirmation.count === 1 ? '1 annen økt' : `${confirmation.count} andre økter`
              } blir avsluttet. Denne enheten forblir innlogget.`
            : confirmation?.kind === 'one'
              ? `Er du sikker på at du vil logge ut denne enheten? ${deviceTitle(
                  confirmation.session
                )} mister tilgangen til kontoen din.`
              : ''}
        </Text>

        <View className="mt-5">
          <Pressable
            onPress={() => {
              if (!confirmation) return;
              if (confirmation.kind === 'all') confirmRevokeOthers();
              else confirmRevokeOne(confirmation.session);
            }}
            disabled={busy}
            className={[
              'flex-row items-center justify-center rounded-2xl px-5 py-3.5',
              busy ? 'opacity-60' : '',
            ].join(' ')}
            style={{ backgroundColor: '#B4544A' }}
          >
            <LogOut size={16} color="#FFFFFF" />
            <Text className="ml-2 text-[0.9375rem] font-semibold text-white">
              {confirmation?.kind === 'all' ? 'Logg ut alle andre' : 'Logg ut enheten'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirmation(null)}
            className="mt-2.5 items-center justify-center rounded-2xl border border-[#E6E7E1] bg-white px-5 py-3.5 active:bg-[#F4F6F0]"
          >
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Avbryt</Text>
          </Pressable>
        </View>
      </Dialog>
    </SafeAreaView>
  );
}
