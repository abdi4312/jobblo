import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AlertCircle, ArrowLeft, Check, Clock, MapPin, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { useSafePayCheckout, useSafePaySessionStatus } from '../../../src/hooks/useSafePayCheckout';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { useTabBarSpace } from '../../../src/components/GlassTabBar';
import { providerOrderRoute } from '../../../src/utils/orderRoute';
import { isValidOrderId, isValidSessionId } from '../../../src/utils/safepayCheckoutSession';
import { reconcileSafePayPayment } from '../../../src/services/safepay.service';
import type { SafePayParty } from '../../../src/types/SafePay';
import { TC, tc } from '../../../src/theme/colors';

const PAID_ORDER_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed'];
type PaymentState = 'verifying' | 'paid' | 'pending' | 'unverified';

function getId(value: unknown) {
  if (typeof value !== 'object' || value === null) return null;
  if ('_id' in value && typeof value._id === 'string') return value._id;
  return null;
}

function getErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}

function getErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return null;
  const data = response.data;
  if (typeof data !== 'object' || data === null) return null;
  if ('error' in data && typeof data.error === 'string') return data.error;
  if ('message' in data && typeof data.message === 'string') return data.message;
  return null;
}

const kr = (n?: number) => `${(n ?? 0).toLocaleString('nb-NO')} kr`;
const fullName = (p?: SafePayParty | null) => [p?.name, p?.lastName].filter(Boolean).join(' ') || 'Ukjent';

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={['min-h-[50px] justify-center rounded-full px-5', secondary ? 'border border-line bg-surface active:bg-surface-2' : 'bg-brand active:bg-brand-hover'].join(' ')}>
      <Text className={['text-center text-[0.9375rem] font-semibold', secondary ? 'text-ink' : 'text-white'].join(' ')}>{label}</Text>
    </Pressable>
  );
}

/** Success badge: rings ease in, the check pops with a spring (static when Reduce Motion is on). */
function SuccessBadge() {
  const scale = useRef(new Animated.Value(0.4)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        scale.setValue(1);
        ring.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [ring, scale]);

  return (
    <View className="h-32 w-32 items-center justify-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ position: 'absolute', opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <View className="h-32 w-32 rounded-full bg-tint" />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
        <View className="h-24 w-24 rounded-full border-2 border-brand/25" />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand">
          <Check size={32} color="#FFFFFF" strokeWidth={3} />
        </View>
      </Animated.View>
    </View>
  );
}

function ReceiptRow({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <View className={['flex-row items-baseline justify-between gap-3 py-3', last ? '' : 'border-b border-line-soft'].join(' ')}>
      <Text className={strong ? 'text-[0.9375rem] font-semibold text-ink' : 'text-[0.875rem] text-muted'}>{label}</Text>
      <Text className={strong ? 'text-[1.0625rem] font-bold text-ink' : 'text-[0.875rem] font-medium text-ink'}>{value}</Text>
    </View>
  );
}

function PartyAvatar({ party }: { party?: SafePayParty | null }) {
  const initials = fullName(party).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-2">
      <Text className="text-[0.875rem] font-bold text-ink">{initials}</Text>
    </View>
  );
}

/** "Hva skjer nå": paid → work → approval. `current` is the step in progress (1-based). */
function NextSteps({ steps, current }: { steps: Array<{ title: string; text: string }>; current: number }) {
  return (
    <View className="rounded-3xl border border-line bg-surface p-5">
      <Text className="mb-4 text-[1rem] font-bold text-ink">Hva skjer nå</Text>
      {steps.map((step, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <View key={step.title} className="flex-row gap-3.5">
            <View className="items-center">
              <View className={['h-7 w-7 items-center justify-center rounded-full', done ? 'bg-brand' : active ? 'border-2 border-brand bg-surface' : 'border border-line bg-surface'].join(' ')}>
                {done ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : <Text className={active ? 'text-[0.8125rem] font-bold text-brand-text' : 'text-[0.8125rem] text-subtle'}>{n}</Text>}
              </View>
              {n < steps.length ? <View className={['my-1 w-0.5 flex-1 rounded-full', done ? 'bg-brand' : 'bg-line'].join(' ')} style={{ minHeight: 22 }} /> : null}
            </View>
            <View className={['flex-1', n < steps.length ? 'pb-4' : ''].join(' ')}>
              <Text className={['text-[0.9375rem]', done || active ? 'font-semibold text-ink' : 'font-medium text-muted'].join(' ')}>{step.title}</Text>
              <Text className="mt-0.5 text-[0.8125rem] leading-5 text-muted">{step.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SuccessSkeleton() {
  return (
    <View className="items-center px-4 pt-10" accessible accessibilityRole="progressbar" accessibilityLabel="Bekrefter betalingen">
      <Skeleton className="h-32 w-32 rounded-full" />
      <Skeleton className="mt-6 h-7 w-56" />
      <Skeleton className="mt-3 h-10 w-36" />
      <Skeleton className="mt-3 h-4 w-64" />
      <View className="mt-8 w-full rounded-3xl border border-line bg-surface p-5">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <View style={{ flex: 1 }} className="gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </View>
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} className="mt-4 flex-row justify-between">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </View>
        ))}
      </View>
      <Skeleton className="mt-4 h-48 w-full rounded-3xl" />
    </View>
  );
}

export default function SafePaySuccessScreen() {
  const router = useRouter();
  const bottomSpace = useTabBarSpace();
  const params = useLocalSearchParams<{ session_id?: string | string[]; orderId?: string | string[] }>();
  // This screen is a deep-link target, so both ids arrive from a URL we do not control.
  // Validated rather than merely truthy-checked: a malformed link carrying "undefined" or
  // "[object Object]" would otherwise pass `enabled: !!id` and fire a request for it.
  const rawSessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const sessionId = isValidSessionId(rawSessionId) ? rawSessionId.trim() : undefined;
  const paramOrderId = isValidOrderId(rawOrderId) ? rawOrderId.trim() : undefined;
  const user = useAuthStore((state) => state.user);
  const statusQuery = useSafePaySessionStatus(sessionId ?? '');
  const statusOrderId = statusQuery.data?.orderId;
  const resolvedOrderId = paramOrderId ?? (isValidOrderId(statusOrderId) ? statusOrderId : '');
  const orderQuery = useSafePayCheckout(resolvedOrderId);
  const order = orderQuery.data?.order;
  const calculation = orderQuery.data?.calculation;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void statusQuery.refetch();
        void orderQuery.refetch();
      }
    });
    return () => subscription.remove();
  }, [orderQuery.refetch, statusQuery.refetch]);

  const paymentState: PaymentState = useMemo(() => {
    if (statusQuery.isLoading || orderQuery.isLoading) return 'verifying';
    const paidBySession = statusQuery.data?.payment_status === 'paid';
    const paidByOrder = order?.paymentStatus === 'paid' || PAID_ORDER_STATUSES.includes(order?.status ?? '');
    if (paidBySession || paidByOrder) return 'paid';
    if (statusQuery.data?.payment_status || order) return 'pending';
    return 'unverified';
  }, [statusQuery.isLoading, orderQuery.isLoading, statusQuery.data, order]);

  // One success haptic when the payment is confirmed, not on every re-render or refetch.
  const celebrated = useRef(false);
  useEffect(() => {
    if (paymentState !== 'paid' || !order || celebrated.current) return;
    celebrated.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [paymentState, order]);

  const currentUserId = getId(user) ?? (typeof user === 'object' && user && 'id' in user && typeof user.id === 'string' ? user.id : null);
  const isCustomer = !!currentUserId && currentUserId === getId(order?.customerId);
  const isProvider = !!currentUserId && currentUserId === getId(order?.providerId);
  const serviceId = order?.serviceId?._id;

  const goOverview = () => {
    const tab = isProvider ? 'mine-soknader' : 'mine-sokere';
    router.push({ pathname: '/(app)/my-applications', params: { tab } });
  };
  // `/` is only a redirect gate, so dismissing goes straight to the tab group.
  const goHome = () => router.push('/(app)');

  const errorCopy = useMemo(() => {
    const status = getErrorStatus(statusQuery.error) ?? getErrorStatus(orderQuery.error);
    if (status === 403) return { title: 'Ikke tilgang', message: 'Denne kontrakten tilhører andre parter.' };
    if (status === 404) return { title: 'Kontrakten ble ikke funnet', message: 'Kontrakten finnes ikke lenger eller lenken er feil.' };
    return { title: 'Vi fikk ikke bekreftet betalingen', message: getErrorMessage(statusQuery.error) ?? getErrorMessage(orderQuery.error) ?? 'Vi klarte ikke å hente betalingsstatusen. Sjekk på nytt, eller gå til betalingssiden for oppdraget.' };
  }, [statusQuery.error, orderQuery.error]);

  if (statusQuery.isLoading || orderQuery.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <SuccessSkeleton />
      </SafeAreaView>
    );
  }

  if (paymentState !== 'paid') {
    const retry = async () => {
      if (resolvedOrderId && isCustomer) {
        try {
          await reconcileSafePayPayment(resolvedOrderId);
        } catch {
          // Reconciliation is best effort; only the subsequent DB read reports payment.
        }
      }
      await statusQuery.refetch();
      await orderQuery.refetch();
    };
    const checkout = () => {
      if (!resolvedOrderId.trim()) return;
      router.push({ pathname: '/(app)/safepay/checkout/[orderId]', params: { orderId: resolvedOrderId } });
    };
    const pending = paymentState === 'pending';
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingBottom: bottomSpace }}>
          <View className="items-center">
            <View className={['h-24 w-24 items-center justify-center rounded-full', pending ? 'bg-warn-tint' : 'bg-surface-2'].join(' ')}>
              {pending ? <Clock size={36} color={TC.warn} /> : <AlertCircle size={36} color={tc('#63665F', 'muted')} />}
            </View>
            <Text accessibilityRole="header" className="mt-6 text-center text-[1.5rem] font-bold text-ink">{pending ? 'Venter på bekreftelse' : errorCopy.title}</Text>
            <Text className="mt-2.5 px-2 text-center text-[0.9375rem] leading-6 text-muted">{pending ? 'Vi har ikke fått bekreftet betalingen ennå. Har du nettopp betalt, tar det som regel bare noen sekunder.' : errorCopy.message}</Text>
          </View>
          {pending ? (
            <View className="mt-6 flex-row gap-3 rounded-2xl border border-warn-line bg-warn-tint p-4">
              <ShieldCheck size={18} color={TC.warn} />
              <Text className="flex-1 text-[0.8125rem] leading-5 text-ink">Du blir ikke belastet to ganger. Betal ikke på nytt før du har sjekket statusen.</Text>
            </View>
          ) : null}
          <View className="mt-7 gap-2.5">
            {sessionId ? <ActionButton label={statusQuery.isRefetching ? 'Sjekker…' : 'Sjekk på nytt'} onPress={retry} /> : null}
            {resolvedOrderId ? <ActionButton label="Gå til betaling" onPress={checkout} secondary /> : null}
            <ActionButton label="Tilbake til forsiden" onPress={goHome} secondary />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!order) {
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Vi fikk ikke bekreftet betalingen" message="Betalingen er bekreftet, men ordredetaljene kunne ikke lastes ennå." actionLabel="Sjekk på nytt" onAction={() => void orderQuery.refetch()} /></SafeAreaView>;
  }

  const readyForApproval = isCustomer && order.status === 'ready_for_review';
  const completed = isCustomer && order.status === 'completed';
  const goApproval = () => router.push({ pathname: '/(app)/safepay/approval/[orderId]', params: { orderId: order._id } });
  const goProvider = () => router.push(providerOrderRoute(order._id));
  const goApplicants = () => serviceId ? router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId } }) : goOverview();

  const otherParty = isProvider ? order.customerId : order.providerId;
  const total = calculation?.total ?? order.agreedPrice;
  const headlineAmount = isProvider ? calculation?.providerNet ?? order.agreedPrice : total;
  const otherName = fullName(otherParty);
  const step = order.status === 'completed' ? 4 : order.status === 'ready_for_review' ? 3 : 2;
  const steps = isProvider
    ? [
        { title: 'Betalt via SafePay', text: `${fullName(order.customerId)} har betalt. Beløpet holdes trygt av Jobblo.` },
        { title: 'Gjør jobben', text: 'Start når du er klar, og meld jobben ferdig i appen når den er gjort.' },
        { title: 'Kunden godkjenner', text: `Du får utbetalt ${kr(calculation?.providerNet)} så snart jobben er godkjent.` },
      ]
    : [
        { title: 'Betalt via SafePay', text: 'Beløpet holdes trygt av Jobblo, ikke av utføreren.' },
        { title: `${otherName} gjør jobben`, text: 'Du får varsel når jobben er meldt ferdig.' },
        { title: 'Du godkjenner', text: 'Først da utbetales pengene. Er noe galt, kan du åpne en tvist.' },
      ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: bottomSpace + 16 }}>
        <View className="items-center">
          <SuccessBadge />
          <Text accessibilityRole="header" className="mt-4 text-center text-[1.625rem] font-bold text-ink">Betalingen er bekreftet</Text>
          <Text className="mt-2 text-center text-[2.25rem] font-extrabold tracking-tight text-ink" accessibilityLabel={`${isProvider ? 'Du får' : 'Betalt'} ${kr(headlineAmount)}`}>{kr(headlineAmount)}</Text>
          <View className="mt-2 flex-row items-center gap-1.5 rounded-full bg-tint px-3 py-1.5">
            <ShieldCheck size={14} color={TC.brand} />
            <Text className="text-[0.8125rem] font-semibold text-brand-text">{isProvider ? 'Utbetales når jobben er godkjent' : 'Trygt holdt av SafePay'}</Text>
          </View>
        </View>

        <View className="mt-7 rounded-3xl border border-line bg-surface p-5">
          <View className="flex-row items-center gap-3 border-b border-line-soft pb-4">
            <PartyAvatar party={otherParty} />
            <View className="min-w-0 flex-1">
              <Text className="text-[0.8125rem] text-muted">{isProvider ? 'Oppdragsgiver' : 'Oppdragstaker'}</Text>
              <Text className="text-[1rem] font-semibold text-ink" numberOfLines={1}>{otherName}</Text>
            </View>
          </View>
          <View className="pt-4">
            <Text className="text-[1.0625rem] font-bold text-ink" numberOfLines={2}>{order.serviceId?.title ?? 'Oppdrag'}</Text>
            {order.serviceId?.location?.city ? (
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <MapPin size={14} color={tc('#63665F', 'muted')} />
                <Text className="text-[0.8125rem] text-muted">{order.serviceId.location.city}</Text>
              </View>
            ) : null}
          </View>
          <View className="mt-3">
            <ReceiptRow label="Oppdragsbeløp" value={kr(calculation?.basePrice ?? order.agreedPrice)} />
            {calculation ? <ReceiptRow label={isProvider ? 'SafePay-gebyr (3 %)' : 'SafePay-gebyr'} value={isProvider ? `−${kr(calculation.fee)}` : kr(calculation.fee)} /> : null}
            <ReceiptRow label={isProvider ? 'Du får utbetalt' : 'Totalt betalt'} value={kr(headlineAmount)} strong />
            <ReceiptRow label="Kontrakt" value={`#JB-${order._id.substring(0, 8).toUpperCase()}`} last />
          </View>
        </View>

        <View className="mt-4">
          <NextSteps steps={steps} current={step} />
        </View>

        <View className="mt-7 gap-2.5">
          {isProvider ? <ActionButton label="Gå til aktiv jobb" onPress={goProvider} /> : null}
          {isCustomer && (readyForApproval || completed) ? <ActionButton label={completed ? 'Se oppsummeringen' : 'Godkjenn jobb og utbetal'} onPress={goApproval} /> : null}
          {isCustomer || isProvider ? <ActionButton label={isProvider ? 'Mine søknader' : 'Mine søkere'} onPress={goOverview} secondary={isProvider || readyForApproval || completed} /> : null}
          <ActionButton label="Tilbake til forsiden" onPress={goHome} secondary />
        </View>
        {isCustomer && serviceId ? (
          <Pressable accessibilityRole="link" onPress={goApplicants} className="mt-4 flex-row items-center justify-center gap-2 py-2">
            <ArrowLeft size={15} color={tc('#63665F', 'muted')} />
            <Text className="text-[0.8125rem] text-muted">Tilbake til søkerne</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
