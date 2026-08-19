import React, { useEffect, useMemo } from 'react';
import { Alert, AppState, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { useSafePayCheckout, useSafePaySessionStatus } from '../../../src/hooks/useSafePayCheckout';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { SafePayProgressSteps } from '../../../src/components/domain/SafePayProgressSteps';

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

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} className={['rounded-full px-5 py-3', secondary ? 'border border-[#E6E7E1] bg-white' : 'bg-[#2E6641]'].join(' ')}>
      <Text className={['text-center text-[0.9375rem] font-semibold', secondary ? 'text-[#0B0B0B]' : 'text-white'].join(' ')}>{label}</Text>
    </Pressable>
  );
}

export default function SafePaySuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string | string[]; orderId?: string | string[] }>();
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const paramOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const user = useAuthStore((state) => state.user);
  const statusQuery = useSafePaySessionStatus(sessionId ?? '');
  const resolvedOrderId = paramOrderId ?? statusQuery.data?.orderId ?? '';
  const orderQuery = useSafePayCheckout(resolvedOrderId);
  const order = orderQuery.data?.order;

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

  const currentUserId = getId(user) ?? (typeof user === 'object' && user && 'id' in user && typeof user.id === 'string' ? user.id : null);
  const isCustomer = !!currentUserId && currentUserId === getId(order?.customerId);
  const isProvider = !!currentUserId && currentUserId === getId(order?.providerId);
  const serviceId = order?.serviceId?._id;

  const goOverview = () => {
    const tab = isProvider ? 'mine-soknader' : 'mine-sokere';
    router.push(`/my-applications?tab=${tab}` as Href);
  };
  const goHome = () => router.push('/' as Href);

  const errorCopy = useMemo(() => {
    const status = getErrorStatus(statusQuery.error) ?? getErrorStatus(orderQuery.error);
    if (status === 403) return { title: 'Ikke tilgang', message: 'Denne kontrakten tilhører andre parter.' };
    if (status === 404) return { title: 'Kontrakten ble ikke funnet', message: 'Kontrakten finnes ikke lenger eller lenken er feil.' };
    return { title: 'Vi fikk ikke bekreftet betalingen', message: getErrorMessage(statusQuery.error) ?? getErrorMessage(orderQuery.error) ?? 'Vi klarte ikke å hente betalingsstatusen. Sjekk på nytt, eller gå til betalingssiden for oppdraget.' };
  }, [statusQuery.error, orderQuery.error]);

  if (statusQuery.isLoading || orderQuery.isLoading) {
    return <SafeAreaView className="flex-1 items-center justify-center bg-[#EFF0EA]"><Text className="text-[0.9375rem] text-[#63665F]">Bekrefter betalingen…</Text></SafeAreaView>;
  }

  if (paymentState !== 'paid') {
    const retry = () => void statusQuery.refetch();
    const checkout = () => {
      if (!resolvedOrderId.trim()) return;
      router.push(`/safepay/checkout/${resolvedOrderId}` as Href);
    };
    const pending = paymentState === 'pending';
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-8">
            <View className="mx-auto h-12 w-12 items-center justify-center rounded-full bg-[#F4F6F0]"><AlertCircle size={22} color="#63665F" /></View>
            <Text className="mt-5 text-center text-[1.25rem] font-bold text-[#0B0B0B]">{pending ? 'Betalingen er ikke fullført' : errorCopy.title}</Text>
            <Text className="mt-2.5 text-center text-[0.875rem] leading-relaxed text-[#63665F]">{pending ? 'Vi har ikke mottatt bekreftelse på betalingen ennå. Har du nettopp betalt, kan det ta noen sekunder — prøv å sjekke på nytt.' : errorCopy.message}</Text>
            <View className="mt-7 gap-2.5">
              {sessionId ? <ActionButton label={statusQuery.isRefetching ? 'Sjekker…' : 'Sjekk på nytt'} onPress={retry} /> : null}
              {resolvedOrderId ? <ActionButton label="Gå til betaling" onPress={checkout} secondary /> : null}
              <ActionButton label="Tilbake til forsiden" onPress={goHome} secondary />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!order) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Vi fikk ikke bekreftet betalingen" message="Betalingen er bekreftet, men ordredetaljene kunne ikke lastes ennå." actionLabel="Sjekk på nytt" onAction={() => void orderQuery.refetch()} /></SafeAreaView>;
  }

  const readyForApproval = isCustomer && order.status === 'ready_for_review';
  const completed = isCustomer && order.status === 'completed';
  const goApproval = () => router.push(`/safepay/approval/${order._id}` as Href);
  const goProvider = () => router.push(`/provider/orders/${order._id}` as Href);
  const goApplicants = () => serviceId ? router.push(`/job-applicants/${serviceId}` as Href) : goOverview();

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120 }}>
        <SafePayProgressSteps currentStep={3} />
        <View className="rounded-3xl border border-[#E6E7E1] bg-white p-8">
          <View className="mx-auto h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E9]"><CheckCircle2 size={22} color="#2E6641" /></View>
          <Text className="mt-5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#9B9E96]">SafePay</Text>
          <Text className="mt-2 text-center text-[1.5rem] font-bold text-[#0B0B0B]">Betalingen er bekreftet</Text>
          <Text className="mt-2.5 text-center text-[0.875rem] leading-relaxed text-[#63665F]">{isProvider ? 'Oppdraget er betalt via SafePay. Du kan starte arbeidet når du er klar.' : 'Beløpet holdes av Jobblo og utbetales til utføreren når arbeidet er gjort og du har godkjent det.'}</Text>
          <View className="mt-7 flex-row items-center gap-3 rounded-2xl bg-[#F4F6F0] p-4"><ShieldCheck size={20} color="#2E6641" /><View className="flex-1"><Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">SafePay-beskyttelse</Text><Text className="mt-0.5 text-[0.75rem] leading-relaxed text-[#63665F]">Jobblo holder beløpet frem til du godkjenner.</Text></View></View>
          <View className="mt-7 gap-2.5">
            {isProvider ? <ActionButton label="Gå til aktiv jobb" onPress={goProvider} /> : null}
            {isCustomer && !readyForApproval && !completed ? <Text className="rounded-2xl bg-[#F4F6F0] px-4 py-3 text-center text-[0.8125rem] leading-relaxed text-[#63665F]">Neste steg er utførerens. Du kan godkjenne og utbetale så snart arbeidet er meldt ferdig — vi varsler deg.</Text> : null}
            {isCustomer && (readyForApproval || completed) ? <ActionButton label={completed ? 'Se oppsummeringen' : 'Godkjenn jobb og utbetal'} onPress={goApproval} /> : null}
            {isCustomer || isProvider ? <ActionButton label={isProvider ? 'Mine søknader' : 'Mine søkere'} onPress={goOverview} secondary={!isCustomer || readyForApproval || completed} /> : null}
            <ActionButton label="Tilbake til forsiden" onPress={goHome} secondary />
          </View>
        </View>
        {isCustomer && serviceId ? <Pressable onPress={goApplicants} className="mt-4 flex-row items-center justify-center gap-2"><ArrowLeft size={15} color="#63665F" /><Text className="text-[0.8125rem] text-[#63665F]">Tilbake til søkerne</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
