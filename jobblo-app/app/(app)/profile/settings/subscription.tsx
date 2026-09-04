import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Receipt, RefreshCcw, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCancelSubscription, useCurrentSubscription, useResumeSubscription, useSubscriptionHistory } from '../../../../src/hooks/useSubscription';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { CurrentSubscription, PurchaseHistoryItem, PurchaseStatus } from '../../../../src/services/subscription.service';

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function status(subscription: CurrentSubscription) {
  if (subscription.cancelAtPeriodEnd) return { label: 'Avsluttes ved periodens slutt', color: '#B7791F' };
  if (subscription.stripeStatus === 'past_due' || subscription.stripeStatus === 'unpaid') return { label: 'Betaling kreves', color: '#B4544A' };
  if (subscription.stripeStatus === 'incomplete') return { label: 'Ikke fullført', color: '#B7791F' };
  if (subscription.stripeStatus === 'canceled' || subscription.status === 'cancelled') return { label: 'Avsluttet', color: '#63665F' };
  if (subscription.stripeStatus === 'active' || subscription.stripeStatus === 'trialing' || subscription.status === 'active') return { label: 'Aktivt', color: '#2E6641' };
  if (subscription.status === 'inactive' || subscription.status === 'expired') return { label: 'Inaktivt', color: '#63665F' };
  return { label: 'Status ukjent', color: '#63665F' };
}

function mutationError(error: unknown, fallback: string) {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (response?.status === 403) return 'Du har ikke tilgang til dette abonnementet.';
  if (response?.status === 404) return 'Abonnementet ble ikke funnet.';
  return response?.data?.message || fallback;
}

/* ── Purchase history helpers ─────────────────────────────────────────────── */

function historyStatus(status?: PurchaseStatus): { label: string; color: string } {
  switch (status) {
    case 'succeeded': return { label: 'Betalt', color: '#2E6641' };
    case 'refunded': return { label: 'Refundert', color: '#63665F' };
    case 'failed': return { label: 'Feilet', color: '#B4544A' };
    case 'pending': return { label: 'Venter', color: '#B7791F' };
    default: return { label: 'Status ukjent', color: '#63665F' };
  }
}

function historyDate(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function historyAmount(item: PurchaseHistoryItem): string {
  if (typeof item.amount !== 'number') return '';
  const currency = item.currency === 'usd' ? 'USD' : 'kr';
  return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(item.amount)} ${currency}`;
}

function unlockLabel(minutes: number | null): string {
  if (minutes === null) return 'Ikke aktuelt';
  return minutes === 0 ? 'Tilgang i sanntid' : `Tilgang etter ${minutes} min`;
}

function ContactDetails({ subscription }: { subscription: CurrentSubscription }) {
  const contacts = subscription.contacts ?? {
    includedLimit: 0,
    includedUsed: 0,
    includedRemaining: 0,
    perContactPrice: null,
    contactUnlockMinutes: null,
    paidPurchased: 0,
    paidUsed: 0,
    paidAvailable: 0,
    totalPaidForExtraContacts: 0,
    currency: 'nok',
  };
  const progress = contacts.includedLimit > 0
    ? Math.min(contacts.includedUsed / contacts.includedLimit, 1)
    : 0;
  const amount = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(
    contacts.totalPaidForExtraContacts
  );

  return (
    <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
      <Text className="text-sm font-semibold text-[#0B0B0B]">Kontakter</Text>
      <View className="mt-4 flex-row gap-2">
        {[
          ['Inkludert', contacts.includedLimit],
          ['Brukt', contacts.includedUsed],
          ['Igjen', contacts.includedRemaining],
        ].map(([label, value]) => (
          <View key={String(label)} className="min-w-0 flex-1 rounded-2xl bg-[#F5F6F1] p-3">
            <Text className="text-2xl font-bold text-[#0B0B0B]">{value}</Text>
            <Text className="mt-1 text-xs text-[#63665F]">{label}</Text>
          </View>
        ))}
      </View>
      <Text className="mt-4 text-xs font-medium text-[#63665F]">
        {contacts.includedUsed} / {contacts.includedLimit} brukt
      </Text>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6E7E1]">
        <View className="h-full rounded-full bg-[#2E6641]" style={{ width: `${progress * 100}%` }} />
      </View>

      <View className="mt-5 border-t border-[#E6E7E1] pt-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm text-[#63665F]">Ekstra kontakt</Text>
          <Text className="text-sm font-semibold text-[#0B0B0B]">
            {contacts.perContactPrice === null ? 'Abonnement kreves' : `${contacts.perContactPrice} NOK`}
          </Text>
        </View>
        {contacts.contactUnlockMinutes !== null ? (
          <View className="mt-2 flex-row items-center justify-between gap-3">
            <Text className="text-sm text-[#63665F]">Tilgang til nye oppdrag</Text>
            <Text className="text-sm font-semibold text-[#0B0B0B]">{unlockLabel(contacts.contactUnlockMinutes)}</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-5 border-t border-[#E6E7E1] pt-4">
        <Text className="text-sm font-semibold text-[#0B0B0B]">Betalte ekstra kontakter</Text>
        <View className="mt-3 gap-2">
          <View className="flex-row justify-between gap-3"><Text className="text-sm text-[#63665F]">Kjøpt</Text><Text className="text-sm font-semibold text-[#0B0B0B]">{contacts.paidPurchased}</Text></View>
          <View className="flex-row justify-between gap-3"><Text className="text-sm text-[#63665F]">Brukt</Text><Text className="text-sm font-semibold text-[#0B0B0B]">{contacts.paidUsed}</Text></View>
          <View className="flex-row justify-between gap-3"><Text className="text-sm text-[#63665F]">Tilgjengelig</Text><Text className="text-sm font-semibold text-[#0B0B0B]">{contacts.paidAvailable}</Text></View>
          <View className="flex-row justify-between gap-3"><Text className="text-sm text-[#63665F]">Betalt for ekstra kontakter</Text><Text className="text-sm font-semibold text-[#0B0B0B]">{amount} NOK</Text></View>
        </View>
      </View>
    </View>
  );
}

function HistoryRow({ item }: { item: PurchaseHistoryItem }) {
  const plan = typeof item.planName === 'string' ? item.planName : 'Medlemskap';
  const status = historyStatus(item.status);
  const date = historyDate(item.createdAt);
  const amount = historyAmount(item);
  return (
    <View className="border-b border-[#E6E7E1] py-3 last:border-b-0">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-sm font-semibold text-[#0B0B0B]" numberOfLines={1}>{plan}</Text>
        <Text className="shrink-0 text-sm font-medium text-[#0B0B0B]">{amount}</Text>
      </View>
      <View className="mt-1 flex-row items-center justify-between gap-2">
        {date ? <Text className="text-[0.75rem] text-[#9B9E96]">{date}</Text> : <View />}
        <View className="rounded-full bg-[#F4F6F0] px-2 py-0.5">
          <Text className="text-[0.6875rem] font-semibold" style={{ color: status.color }}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

function HistorySection({ history }: { history: { isLoading: boolean; isError: boolean; data?: PurchaseHistoryItem[] | null; refetch: () => void } }) {
  // Only membership/subscription purchases belong on the Abonnementer page; the
  // backend's transaction feed also carries one-off "extra contact" purchases.
  const items = (history.data ?? []).filter((item) => item.type === 'subscription');
  return (
    <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
      <View className="flex-row items-center gap-2">
        <Receipt size={16} color="#2E6641" />
        <Text className="text-sm font-semibold text-[#0B0B0B]">Kjøpshistorikk</Text>
      </View>

      {history.isLoading ? (
        <Text className="mt-3 text-sm text-[#63665F]">Laster kjøpshistorikk...</Text>
      ) : history.isError ? (
        <View className="mt-3">
          <Text className="text-sm text-[#63665F]">Kunne ikke hente kjøpshistorikken.</Text>
          <Pressable onPress={() => history.refetch()} className="mt-3 self-start rounded-full bg-[#2E6641] px-4 py-2">
            <Text className="text-[0.8125rem] font-semibold text-white">Prøv igjen</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text className="mt-3 text-sm leading-5 text-[#63665F]">Ingen kjøp ennå.</Text>
      ) : (
        <View className="mt-3">
          {items.map((item) => <HistoryRow key={item._id} item={item} />)}
        </View>
      )}
    </View>
  );
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const query = useCurrentSubscription();
  const history = useSubscriptionHistory();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([query.refetch(), history.refetch()]); } finally { setRefreshing(false); }
  };

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster abonnementet..." /></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste abonnementet" message="Abonnementet kunne ikke hentes akkurat nå." onAction={() => void query.refetch()} /></SafeAreaView>;

  const subscription = query.data;
  const cancelDate = date(subscription?.currentPeriodEnd || subscription?.renewalDate);
  const planStatus = subscription ? status(subscription) : null;
  const confirmCancel = () => Alert.alert('Si opp abonnementet?', cancelDate ? `Abonnementet forblir aktivt frem til ${cancelDate}.` : 'Abonnementet forblir aktivt frem til periodens slutt.', [{ text: 'Avbryt', style: 'cancel' }, { text: 'Si opp', style: 'destructive', onPress: () => cancel.mutate(undefined, { onError: (error) => Alert.alert('Kunne ikke si opp', mutationError(error, 'Kunne ikke si opp abonnementet.')) }) }]);
  const confirmResume = () => resume.mutate(undefined, { onError: (error) => Alert.alert('Kunne ikke gjenoppta', mutationError(error, 'Kunne ikke gjenoppta abonnementet.')) });

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" />}>
    <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2"><ArrowLeft size={18} color="#63665F" /><Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text></Pressable>
    <View className="mb-5 flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]"><CreditCard size={21} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-2xl font-bold text-[#0B0B0B]">Abonnement</Text><Text className="mt-1 text-sm text-[#63665F]">Administrer ditt nåværende abonnement</Text></View></View>
    {!subscription || !subscription.hasPlan ? <><EmptyState title="Ingen aktivt abonnement" message="Du har ingen nåværende abonnement å administrere." /><Pressable onPress={() => router.push('/profile/membership')} className="mt-4 flex-row items-center justify-center rounded-xl bg-[#2E6641] px-4 py-3.5"><Text className="text-sm font-semibold text-white">{subscription?.planType === 'business' ? 'Se bedriftsabonnementer' : 'Se abonnementer'}</Text></Pressable><ContactDetails subscription={subscription ?? { hasPlan: false, plan: null, planType: 'private', status: 'inactive', autoRenew: false, cancelAtPeriodEnd: false, contacts: { includedLimit: 0, includedUsed: 0, includedRemaining: 0, perContactPrice: null, contactUnlockMinutes: null, paidPurchased: 0, paidUsed: 0, paidAvailable: 0, totalPaidForExtraContacts: 0, currency: 'nok' } }} /></> : <><View className="rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">Gjeldende plan</Text><Text className="mt-2 text-2xl font-bold text-[#0B0B0B]">{subscription.plan}</Text><Text className="mt-1 text-sm text-[#63665F]">{subscription.planType === 'business' ? 'Bedrift' : 'Privatperson'}</Text><View className="mt-5 flex-row items-center"><CheckCircle2 size={17} color={planStatus?.color} /><Text className="ml-2 text-sm font-semibold" style={{ color: planStatus?.color }}>{planStatus?.label}</Text></View>{cancelDate ? <View className="mt-4 flex-row items-center"><CalendarDays size={16} color="#63665F" /><Text className="ml-2 text-sm text-[#63665F]">{subscription.cancelAtPeriodEnd ? 'Tilgang til' : 'Neste fornyelse'}: {cancelDate}</Text></View> : null}</View><ContactDetails subscription={subscription} />{subscription.cancelAtPeriodEnd ? <Pressable onPress={confirmResume} disabled={resume.isPending} className="mt-4 flex-row items-center justify-center rounded-xl bg-[#2E6641] px-4 py-3.5 disabled:opacity-50"><RefreshCcw size={17} color="#FFFFFF" /><Text className="ml-2 text-sm font-semibold text-white">{resume.isPending ? 'Gjenopptar...' : 'Gjenoppta abonnement'}</Text></Pressable> : subscription.stripeSubscriptionId && subscription.status === 'active' ? <Pressable onPress={confirmCancel} disabled={cancel.isPending} className="mt-4 flex-row items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 py-3.5 disabled:opacity-50"><XCircle size={17} color="#B4544A" /><Text className="ml-2 text-sm font-semibold text-[#B4544A]">{cancel.isPending ? 'Sier opp...' : 'Si opp abonnement'}</Text></Pressable> : null}</>}
    <HistorySection history={history} />
  </ScrollView></SafeAreaView>;
}
