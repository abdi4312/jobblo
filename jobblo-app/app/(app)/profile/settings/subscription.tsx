import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, CalendarDays, CreditCard, ExternalLink, Package, Receipt, RotateCcw } from 'lucide-react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  useBillingPortal,
  useCancelPlanChange,
  useCancelSubscription,
  useCurrentSubscription,
  useResumeSubscription,
  useSubscriptionHistory,
} from '../../../../src/hooks/useSubscription';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { MEMBERSHIP_ENABLED } from '../../../../src/config/features';
import type { CurrentSubscription, PurchaseHistoryItem, PurchaseStatus } from '../../../../src/services/subscription.service';

/*
 * Mirrors the web SubscriptionView (frontend/src/components/profile/SettingsViews/
 * SubscriptionView.tsx): a dark green plan card with status, price, next payment and the
 * same actions, then "Kontakter", then "Kjøpshistorikk".
 */

const HERO = '#24402F'; // between the web gradient's #2d4a3e and #1a2e26

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Same wording and order as the web plan card. */
function statusLabel(s: CurrentSubscription) {
  if (s.status === 'past_due' || s.stripeStatus === 'unpaid') return 'Betaling forfalt';
  if (s.status === 'expired') return 'Utløpt';
  if (s.status === 'cancelled') return 'Avsluttet';
  if (s.cancelAtPeriodEnd) return 'Avsluttes ved periodens slutt';
  if (s.status === 'inactive') return 'Inaktiv';
  return 'Aktivt';
}

function dateLabel(s: CurrentSubscription) {
  if (s.cancelAtPeriodEnd) return 'Tilgang til';
  if (s.status === 'expired') return 'Utløpt';
  if (s.status === 'past_due') return 'Betalingsperiode slutt';
  return 'Neste betaling';
}

function mutationError(error: unknown, fallback: string) {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (response?.status === 403) return 'Du har ikke tilgang til dette abonnementet.';
  if (response?.status === 404) return 'Abonnementet ble ikke funnet.';
  return response?.data?.message || fallback;
}

function historyStatus(status?: PurchaseStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case 'succeeded': return { label: 'Fullført', color: '#2E6641', bg: 'bg-[#EAF1E9]' };
    case 'refunded': return { label: 'Refundert', color: '#63665F', bg: 'bg-[#F4F6F0]' };
    case 'failed': return { label: 'Feilet', color: '#B4544A', bg: 'bg-[#FBF4F2]' };
    case 'pending': return { label: 'Venter', color: '#B7791F', bg: 'bg-[#FBF5E9]' };
    default: return { label: 'Ukjent', color: '#63665F', bg: 'bg-[#F4F6F0]' };
  }
}

function historyAmount(item: PurchaseHistoryItem): string {
  if (typeof item.amount !== 'number') return '';
  const currency = item.currency === 'usd' ? 'USD' : 'kr';
  return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(item.amount)} ${currency}`;
}

/* ── Plan card ─────────────────────────────────────────────────────────── */

function HeroButton({
  label,
  onPress,
  variant = 'outline',
  icon,
  pending = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  icon?: React.ReactNode;
  pending?: boolean;
}) {
  const box =
    variant === 'solid' ? 'bg-white' : variant === 'outline' ? 'border border-white/30' : '';
  // The solid variant's colour comes from `style` below: NativeWind cannot compile a class
  // built at runtime from HERO.
  const text = variant === 'solid' ? '' : variant === 'outline' ? 'text-white' : 'text-white/75';
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      accessibilityRole="button"
      className={`h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 ${box} ${pending ? 'opacity-60' : 'active:opacity-80'}`}
    >
      {pending ? <ActivityIndicator size="small" color={variant === 'solid' ? HERO : '#FFFFFF'} /> : icon}
      <Text className={`text-[0.875rem] font-bold ${text}`} style={variant === 'solid' ? { color: HERO } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Screen ────────────────────────────────────────────────────────────── */

function SubscriptionScreen() {
  const router = useRouter();
  const query = useCurrentSubscription();
  const history = useSubscriptionHistory();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const cancelPlanChange = useCancelPlanChange();
  const portal = useBillingPortal();
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'pending' | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([query.refetch(), history.refetch()]); } finally { setRefreshing(false); }
  };

  if (query.isLoading)
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster abonnementet..." /></SafeAreaView>;
  if (query.isError)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <ErrorState title="Kunne ikke laste abonnementet" message="Abonnementet kunne ikke hentes akkurat nå." onAction={() => void query.refetch()} />
      </SafeAreaView>
    );

  const subscription = query.data ?? null;
  const contacts = subscription?.contacts;
  const progress = contacts && contacts.includedLimit > 0 ? Math.min(contacts.includedUsed / contacts.includedLimit, 1) : 0;
  const periodEnd = formatDate(subscription?.currentPeriodEnd || subscription?.renewalDate);
  const pendingDate = formatDate(subscription?.pendingPlan?.effectiveAt);
  const transactions = history.data ?? [];

  const openPortal = () =>
    portal.mutate(undefined, {
      onSuccess: async (url) => {
        if (!url) return Alert.alert('Kunne ikke åpne', 'Kunne ikke åpne betalingsadministrasjonen.');
        await WebBrowser.openBrowserAsync(url);
        void query.refetch();
      },
      onError: (error) => Alert.alert('Kunne ikke åpne', mutationError(error, 'Kunne ikke åpne betalingsadministrasjonen.')),
    });
  const doResume = () =>
    resume.mutate(undefined, {
      onError: (error) => Alert.alert('Kunne ikke gjenoppta', mutationError(error, 'Kunne ikke gjenoppta abonnementet.')),
    });
  const doCancel = () =>
    cancel.mutate(undefined, {
      onSettled: () => setConfirm(null),
      onError: (error) => Alert.alert('Kunne ikke si opp', mutationError(error, 'Kunne ikke si opp abonnementet.')),
    });
  const doCancelPlanChange = () =>
    cancelPlanChange.mutate(undefined, {
      onSettled: () => setConfirm(null),
      onError: (error) => Alert.alert('Kunne ikke avbryte', mutationError(error, 'Kunne ikke avbryte planendringen.')),
    });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" colors={['#2E6641']} />}
      >
        <ScreenHeader title="Abonnement" subtitle="Plan, kontakter og kjøp" icon={CreditCard} />

        {/* ── Gjeldende abonnement ── */}
        <View className="mb-2 flex-row items-center gap-1.5 px-1">
          <Package size={15} color="#2E6641" />
          <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">Gjeldende abonnement</Text>
        </View>
        <View className="mb-6 overflow-hidden rounded-2xl p-5" style={{ backgroundColor: HERO }}>
          {/* decorative glow, as on web */}
          <View pointerEvents="none" className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />

          <Text className="text-[0.75rem] font-medium uppercase tracking-[0.1em] text-white/70">Abonnementsstatus</Text>
          <Text className="mt-1 text-[1.75rem] font-black leading-tight text-white">
            {subscription?.hasPlan ? subscription.plan : 'Ingen aktivt abonnement'}
          </Text>
          <Text className="mt-1.5 text-[0.75rem] text-white/60">
            Kontotype: <Text className="font-bold text-white">{subscription?.planType === 'business' ? 'bedrift' : 'privat'}</Text>
          </Text>

          {subscription?.stripeSubscriptionId ? (
            <View className="mt-4 border-t border-white/15 pt-4">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="rounded-full bg-white/15 px-3 py-1">
                  <Text className="text-[0.75rem] font-semibold text-white">{statusLabel(subscription)}</Text>
                </View>
                {subscription.price != null ? (
                  <Text className="text-[0.8125rem] text-white">{subscription.price.toLocaleString('nb-NO')} kr per måned</Text>
                ) : null}
              </View>
              {periodEnd ? (
                <View className="mt-2.5 flex-row items-center gap-1.5">
                  <CalendarDays size={14} color="rgba(255,255,255,0.75)" />
                  <Text className="text-[0.8125rem] text-white/75">{dateLabel(subscription)} {periodEnd}</Text>
                </View>
              ) : null}

              {subscription.pendingPlan ? (
                <View className="mt-3 rounded-xl bg-white/10 px-3 py-2.5">
                  <Text className="text-[0.8125rem] leading-5 text-white">
                    Planlagt endring til {subscription.pendingPlan.plan}{pendingDate ? ` ${pendingDate}` : ''}. Du beholder {subscription.plan} frem til da.
                  </Text>
                </View>
              ) : null}
              {subscription.status === 'past_due' ? (
                <View className="mt-3 flex-row items-start gap-2">
                  <AlertTriangle size={15} color="#FDE68A" />
                  <Text className="flex-1 text-[0.8125rem] font-semibold leading-5 text-[#FDE68A]">
                    Betalingen er forsinket. Oppdater betalingsmåten for å beholde abonnementet.
                  </Text>
                </View>
              ) : null}

              <View className="mt-4 gap-2">
                <HeroButton label="Endre abonnement" variant="solid" onPress={() => router.push('/profile/membership')} />
                <HeroButton
                  label="Betalingsmåte og faktura"
                  icon={<ExternalLink size={15} color="#FFFFFF" />}
                  pending={portal.isPending}
                  onPress={openPortal}
                />
                {subscription.cancelAtPeriodEnd ? (
                  <HeroButton
                    label={subscription.pendingPlan ? 'Avbryt planlagt endring' : 'Fortsett abonnement'}
                    icon={<RotateCcw size={15} color="#FFFFFF" />}
                    pending={resume.isPending}
                    onPress={doResume}
                  />
                ) : ['active', 'past_due'].includes(subscription.status) ? (
                  <>
                    {subscription.pendingPlan ? (
                      <HeroButton label="Avbryt planlagt endring" pending={cancelPlanChange.isPending} onPress={() => setConfirm('pending')} />
                    ) : null}
                    <HeroButton label="Si opp abonnement" variant="ghost" pending={cancel.isPending} onPress={() => setConfirm('cancel')} />
                  </>
                ) : null}
              </View>
            </View>
          ) : (
            <View className="mt-4">
              <HeroButton
                label={subscription?.hasPlan ? 'Administrer plan' : subscription?.planType === 'business' ? 'Se bedriftsabonnementer' : 'Se abonnementer'}
                variant="solid"
                onPress={() => router.push('/profile/membership')}
              />
            </View>
          )}
        </View>

        {/* ── Kontakter ── */}
        <SectionLabel>Kontakter</SectionLabel>
        <Card className="mb-6 rounded-2xl p-5">
          {!contacts ? (
            <Text className="text-[0.875rem] text-[#63665F]">Laster kontaktinformasjon...</Text>
          ) : (
            <>
              <View className="flex-row gap-2">
                {([
                  ['Inkludert', contacts.includedLimit],
                  ['Brukt', contacts.includedUsed],
                  ['Igjen', contacts.includedRemaining],
                ] as const).map(([label, value]) => (
                  <View key={label} className="min-w-0 flex-1 rounded-xl bg-[#F5F6F1] p-3">
                    <Text className="text-[1.5rem] font-black tabular-nums text-[#0B0B0B]">{value}</Text>
                    <Text className="mt-0.5 text-[0.75rem] font-medium text-[#63665F]">{label}</Text>
                  </View>
                ))}
              </View>
              <Text className="mt-4 text-[0.8125rem] font-semibold text-[#63665F]">
                {contacts.includedUsed} / {contacts.includedLimit} brukt
              </Text>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-[#ECEDE7]">
                <View className="h-full rounded-full bg-[#2E6641]" style={{ width: `${progress * 100}%` }} />
              </View>

              <View className="mt-5 gap-2 border-t border-[#EFF0EA] pt-4">
                <Row label="Ekstra kontakt" value={contacts.perContactPrice === null ? 'Abonnement kreves' : `${contacts.perContactPrice} NOK`} />
                {contacts.contactUnlockMinutes !== null ? (
                  <Row
                    label="Tilgang til nye oppdrag"
                    value={contacts.contactUnlockMinutes === 0 ? 'Tilgang i sanntid' : `Tilgang etter ${contacts.contactUnlockMinutes} min`}
                  />
                ) : null}
              </View>

              <View className="mt-5 border-t border-[#EFF0EA] pt-4">
                <Text className="mb-2 text-[0.875rem] font-bold text-[#0B0B0B]">Betalte ekstra kontakter</Text>
                <View className="gap-2">
                  <Row label="Kjøpt" value={String(contacts.paidPurchased)} />
                  <Row label="Brukt" value={String(contacts.paidUsed)} />
                  <Row label="Tilgjengelig" value={String(contacts.paidAvailable)} />
                  <Row
                    label="Betalt for ekstra kontakter"
                    value={`${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(contacts.totalPaidForExtraContacts)} NOK`}
                  />
                </View>
              </View>
            </>
          )}
        </Card>

        {/* ── Kjøpshistorikk ── */}
        <SectionLabel>Kjøpshistorikk</SectionLabel>
        <Card className="overflow-hidden rounded-2xl">
          {history.isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#2E6641" />
              <Text className="mt-2 text-[0.8125rem] text-[#63665F]">Laster transaksjoner...</Text>
            </View>
          ) : history.isError ? (
            <View className="items-center px-4 py-6">
              <Text className="text-[0.875rem] text-[#63665F]">Kunne ikke hente kjøpshistorikken.</Text>
              <Pressable onPress={() => void history.refetch()} className="mt-3 rounded-full bg-[#2E6641] px-4 py-2">
                <Text className="text-[0.8125rem] font-semibold text-white">Prøv igjen</Text>
              </Pressable>
            </View>
          ) : transactions.length === 0 ? (
            <View className="items-center px-4 py-8">
              <CreditCard size={32} color="#CFD2C8" strokeWidth={1.5} />
              <Text className="mt-2 text-[0.875rem] font-medium text-[#63665F]">Ingen kjøpshistorikk funnet.</Text>
              <Pressable onPress={() => router.push('/profile/membership')} hitSlop={6} className="mt-2">
                <Text className="text-[0.875rem] font-bold text-[#2E6641]">Se planer</Text>
              </Pressable>
            </View>
          ) : (
            transactions.map((item, index) => {
              const s = historyStatus(item.status);
              const title = item.type === 'extra_contact' ? 'Ekstra kontakt' : item.planName || 'Medlemskap';
              return (
                <View key={item._id} className={`flex-row items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-[#EFF0EA]' : ''}`}>
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1E9]">
                    <Receipt size={16} color="#2E6641" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{title}</Text>
                    {formatDate(item.createdAt) ? (
                      <Text className="mt-0.5 text-[0.75rem] text-[#9B9E96]">{formatDate(item.createdAt)}</Text>
                    ) : null}
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-[0.875rem] font-bold tabular-nums text-[#0B0B0B]">{historyAmount(item)}</Text>
                    <View className={`rounded-full px-2 py-0.5 ${s.bg}`}>
                      <Text className="text-[0.625rem] font-bold uppercase tracking-[0.06em]" style={{ color: s.color }}>{s.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirm === 'cancel'}
        title="Si opp abonnementet?"
        message={`Du beholder tilgangen til ${periodEnd ?? 'ut den betalte perioden'}. Abonnementet fornyes ikke etter dette.`}
        confirmLabel="Si opp abonnementet"
        pendingLabel="Sier opp…"
        cancelLabel="Behold abonnementet"
        destructive
        isPending={cancel.isPending}
        onConfirm={doCancel}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'pending'}
        title="Avbryte planlagt nedgradering?"
        message={`Abonnementet fortsetter på ${subscription?.plan ?? 'nåværende plan'}. Planendringen til ${subscription?.pendingPlan?.plan ?? ''}${pendingDate ? ` ${pendingDate}` : ''} blir avbrutt.`}
        confirmLabel="Avbryt planlagt endring"
        pendingLabel="Avbryter…"
        cancelLabel="Behold endringen"
        isPending={cancelPlanChange.isPending}
        onConfirm={doCancelPlanChange}
        onClose={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-[0.875rem] text-[#63665F]">{label}</Text>
      <Text className="shrink text-right text-[0.875rem] font-bold text-[#0B0B0B]">{value}</Text>
    </View>
  );
}

/** Hidden in store builds, also against deep links (see src/config/features.ts). */
export default function SubscriptionScreenRoute() {
  return MEMBERSHIP_ENABLED ? <SubscriptionScreen /> : <Redirect href="/profile/settings" />;
}
