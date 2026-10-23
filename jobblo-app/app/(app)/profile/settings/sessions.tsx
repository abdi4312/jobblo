import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Monitor,
  MonitorSmartphone,
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
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { ListRow } from '../../../../src/components/ui/ListRow';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { TC, tc } from '../../../../src/theme/colors';

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
  // The app reports its model ("iPhone 15 Pro"); browsers cannot, so they fall back below.
  const model = clean(session.deviceName ?? undefined);
  if (model) return model;
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
    // another device. The centralized 401 handling in api/client.ts (refresh, then
    // authStore.logout()) stays authoritative; no logout logic is duplicated here.
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
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await sessionsQuery.refetch(); } finally { setRefreshing(false); }
  };
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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
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

  const current = ordered.find((session) => session.isCurrent) ?? null;
  const others = ordered.filter((session) => !session.isCurrent);

  /** One device row. `isCurrent` comes from the server (session id vs the token's sid). */
  const renderSession = (session: ActiveSession, index: number) => {
    const kind = deviceKind(session);
    const DeviceIcon = kind === 'phone' ? Smartphone : kind === 'tablet' ? Tablet : Monitor;
    const locationLabel = formatLocation(session);
    const ipLabel = formatIp(session.ip);
    // Loopback resolves both the location and the IP to the same label; show it once.
    const ip = ipLabel === locationLabel ? '' : ipLabel;
    const isRevokingThis = revokeOne.isPending && revokeOne.variables === session._id;

    return (
      <View
        key={session._id}
        className={`flex-row items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-line-soft' : ''}`}
      >
        <View
          className={`h-11 w-11 items-center justify-center rounded-2xl ${session.isCurrent ? 'bg-tint' : 'bg-surface-2'}`}
        >
          <DeviceIcon size={20} color={session.isCurrent ? TC.brandText : tc('#63665F', 'muted')} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="shrink text-[0.9375rem] font-semibold text-ink" numberOfLines={1}>
              {deviceTitle(session)}
            </Text>
            {session.isCurrent ? (
              <View className="rounded-full bg-tint px-2 py-0.5">
                <Text className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-brand-text">Nåværende</Text>
              </View>
            ) : null}
          </View>
          {clean(session.deviceName ?? undefined) ? (
            <Text className="mt-0.5 text-[0.8125rem] font-medium text-brand-text" numberOfLines={1}>
              Jobblo-appen{clean(session.os) ? ` · ${clean(session.os)}` : ''}
            </Text>
          ) : null}
          <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>
            {locationLabel}
            {ip ? ` · ${ip}` : ''}
          </Text>
          <Text className="mt-0.5 text-[0.8125rem] text-subtle" numberOfLines={1}>
            Sist aktiv {formatLastUsed(session.lastUsed)}
          </Text>
        </View>
        {/* The current session has no revoke action: «Logg ut» on the profile screen ends
            it (authStore.logout() → POST /auth/logout deletes it by the token's session id). */}
        {!session.isCurrent ? (
          <Pressable
            onPress={() => {
              setFeedback(null);
              setConfirmation({ kind: 'one', session });
            }}
            disabled={busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Logg ut ${deviceTitle(session)}`}
            className={`rounded-full border border-[#EED8D4] px-3 py-1.5 ${busy ? 'opacity-60' : 'active:bg-danger-tint'}`}
          >
            {isRevokingThis ? (
              <ActivityIndicator size="small" color={tc('#B4544A', 'danger')} />
            ) : (
              <Text className="text-[0.8125rem] font-semibold text-[#B4544A] dark:text-danger">Logg ut</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} colors={[TC.brandText]} />}
      >
        <ScreenHeader title="Aktive økter" subtitle="Enheter som er logget inn på kontoen din." icon={MonitorSmartphone} />

        {feedback ? (
          <View
            className={`mb-4 flex-row items-center gap-2.5 rounded-2xl border px-4 py-3 ${
              feedback.tone === 'error' ? 'border-[#EED8D4] bg-danger-tint' : 'border-[#D1E7D9] bg-[#F2F9F4]'
            }`}
          >
            {feedback.tone === 'error' ? <ShieldAlert size={16} color="#8A3B33" /> : <CheckCircle2 size={16} color={TC.brandText} />}
            <Text className={`flex-1 text-[0.8125rem] leading-5 ${feedback.tone === 'error' ? 'text-[#8A3B33]' : 'text-[#173A24] dark:text-brand-text'}`}>
              {feedback.text}
            </Text>
          </View>
        ) : null}

        {/* A refetch failed but an older list is cached: say it may be stale. */}
        {sessionsQuery.isError && sessionsQuery.data ? (
          <Pressable
            onPress={() => void sessionsQuery.refetch()}
            className="mb-4 rounded-2xl border border-warn-line bg-warn-tint px-4 py-3 active:opacity-80"
          >
            <Text className="text-[0.8125rem] leading-5 text-warn">
              Listen kunne ikke oppdateres og kan være utdatert. Trykk for å prøve igjen.
            </Text>
          </Pressable>
        ) : null}

        {ordered.length === 0 ? (
          <EmptyState
            title="Ingen aktive økter funnet"
            message="Vi fant ingen registrerte innlogginger på kontoen din."
          />
        ) : (
          <>
            {current ? (
              <>
                <SectionLabel>Denne enheten</SectionLabel>
                <Card className="mb-6 overflow-hidden">{renderSession(current, 0)}</Card>
              </>
            ) : null}

            <View className="mb-2 flex-row items-center justify-between px-1">
              <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                Andre enheter{others.length ? ` (${others.length})` : ''}
              </Text>
              {others.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setFeedback(null);
                    setConfirmation({ kind: 'all', count: otherSessionsCount });
                  }}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                  className="flex-row items-center gap-1"
                >
                  <LogOut size={14} color={tc('#B4544A', 'danger')} />
                  <Text className="text-[0.8125rem] font-semibold text-[#B4544A] dark:text-danger">
                    {revokeOthers.isPending ? 'Logger ut…' : 'Logg ut alle'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Card className="mb-6 overflow-hidden">
              {others.length ? (
                others.map((session, index) => renderSession(session, index))
              ) : (
                <View className="flex-row items-center gap-3 px-4 py-4">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-tint">
                    <CheckCircle2 size={17} color={TC.brandText} />
                  </View>
                  <Text className="flex-1 text-[0.8125rem] leading-5 text-muted">
                    Ingen andre enheter er logget inn.
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}

        <SectionLabel>Sikkerhet</SectionLabel>
        <Card className="overflow-hidden">
          <ListRow
            icon={KeyRound}
            label="Endre passord"
            description="Ser du en enhet du ikke kjenner? Logg den ut og bytt passord."
            onPress={() => router.push('/profile/settings/password')}
          />
        </Card>
        <Text className="mt-4 px-1 text-[0.8125rem] leading-5 text-subtle">
          Sted og IP er omtrentlige og utledet fra nettverket. En utlogget enhet mister tilgangen ved
          sitt neste kall mot Jobblo.
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmation !== null}
        title={confirmation?.kind === 'all' ? 'Logg ut alle andre enheter?' : 'Logg ut denne enheten?'}
        message={
          confirmation?.kind === 'all'
            ? `${confirmation.count === 1 ? '1 annen økt' : `${confirmation.count} andre økter`} blir avsluttet. Denne enheten forblir innlogget.`
            : confirmation?.kind === 'one'
              ? `${deviceTitle(confirmation.session)} mister tilgangen til kontoen din.`
              : ''
        }
        confirmLabel={confirmation?.kind === 'all' ? 'Logg ut alle andre' : 'Logg ut enheten'}
        pendingLabel="Logger ut…"
        cancelLabel="Avbryt"
        destructive
        isPending={busy}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.kind === 'all') confirmRevokeOthers();
          else confirmRevokeOne(confirmation.session);
        }}
        onClose={() => setConfirmation(null)}
      />
    </SafeAreaView>
  );
}
