import React, { useEffect, useMemo } from 'react';
import { Alert, AppState, Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { useSafePayCheckout, useCreateSafePaySessionMutation } from '../../../../src/hooks/useSafePayCheckout';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { SafePayCheckoutSkeleton, SafePayPartiesCard, DigitalContractCard, SafePayPaymentCard } from '../../../../src/components/domain/SafePayCheckoutSections';
import { SafePayProgressSteps } from '../../../../src/components/domain/SafePayProgressSteps';

const SETTLED_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed', 'disputed', 'refunded'];

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

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateRange(fromDate?: string, toDate?: string) {
  const from = formatDate(fromDate);
  const to = formatDate(toDate);
  if (!from) return null;
  if (!to || !fromDate || !toDate || new Date(fromDate).toDateString() === new Date(toDate).toDateString()) return from;
  return `${from} – ${to}`;
}

function formatDuration(duration?: { value?: number; unit?: string } | null) {
  if (!duration?.value || duration.value <= 0) return null;
  const labels: Record<string, string> = { minutes: 'minutter', minutter: 'minutter', hours: 'timer', timer: 'timer', days: 'dager', dager: 'dager' };
  return `${duration.value} ${labels[duration.unit ?? ''] ?? duration.unit ?? ''}`.trim();
}

export default function SafePayCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error, refetch } = useSafePayCheckout(orderId ?? '');
  const paymentMutation = useCreateSafePaySessionMutation(orderId ?? '');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const errorCopy = useMemo(() => {
    const status = getErrorStatus(error);
    if (status === 400) return { title: 'Ugyldig ordre', message: getErrorMessage(error) ?? 'Ordren kunne ikke åpnes.' };
    if (status === 403) return { title: 'Ikke tilgang', message: 'Du har ikke tilgang til denne kontrakten.' };
    if (status === 404) return { title: 'Kontrakten ble ikke funnet', message: 'Kontrakten finnes ikke lenger eller lenken er feil.' };
    if (status === 500) return { title: 'Serverfeil', message: getErrorMessage(error) ?? 'Serveren kunne ikke hente betalingsinformasjon.' };
    return { title: 'Kunne ikke laste betalingsinformasjon', message: 'Sjekk internettforbindelsen din og prøv igjen.' };
  }, [error]);

  if (isLoading) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView contentContainerStyle={{ paddingBottom: 100 }}><SafePayCheckoutSkeleton /></ScrollView></SafeAreaView>;
  }

  if (isError || !data?.order || !data.calculation) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title={errorCopy.title} message={errorCopy.message} actionLabel="Prøv igjen" onAction={() => refetch()} /></SafeAreaView>;
  }

  const { order, calculation } = data;
  const service = order.serviceId;
  const currentUserId = getId(user) ?? (typeof user === 'object' && user && 'id' in user && typeof user.id === 'string' ? user.id : null);
  const isCustomer = !!currentUserId && currentUserId === getId(order.customerId);
  const isProvider = !!currentUserId && currentUserId === getId(order.providerId);

  if (!service) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Oppdraget finnes ikke lenger" message="Oppdraget denne kontrakten gjelder er slettet, så betalingen kan ikke gjennomføres. Ta kontakt med support hvis dette ser feil ut." /></SafeAreaView>;
  }

  if (isProvider && !isCustomer) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="flex-1 justify-center px-4"><View className="rounded-3xl border border-[#E6E7E1] bg-white p-8"><View className="mx-auto h-11 w-11 items-center justify-center rounded-full bg-[#EAF1E9]"><ShieldCheck size={20} color="#2E6641" /></View><Text className="mt-4 text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">Betaling håndteres av oppdragsgiver</Text><Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-[#63665F]">Du kan følge oppdragets status og starte arbeidet fra din egen arbeidsside.</Text><Pressable onPress={() => router.push(`/provider/orders/${orderId}`)} className="mt-6 rounded-full bg-[#2E6641] px-6 py-3"><Text className="text-center text-[0.9375rem] font-semibold text-white">Gå til mitt oppdrag</Text></Pressable></View></View></SafeAreaView>;
  }

  if (!isCustomer && !isProvider) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="flex-1 justify-center px-4"><View className="rounded-3xl border border-[#E6E7E1] bg-white p-8"><Text className="text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">Ikke tilgang</Text><Text className="mt-2 text-center text-[0.875rem] text-[#63665F]">Denne kontrakten tilhører andre parter.</Text></View></View></SafeAreaView>;
  }

  const isPaid = order.paymentStatus === 'paid' || SETTLED_STATUSES.includes(order.status);
  const contractDate = formatDateRange(service.fromDate, service.toDate);
  const duration = formatDuration(service.duration);

  const handlePay = () => {
    paymentMutation.mutate(undefined, {
      onSuccess: async (response) => {
        if (typeof response.url !== 'string' || !response.url.trim()) {
          Alert.alert('Betaling kunne ikke starte', 'Fikk ingen betalingslenke fra Stripe. Prøv igjen.');
          return;
        }
        try {
          await Linking.openURL(response.url.trim());
        } catch {
          Alert.alert('Betaling kunne ikke starte', 'Kunne ikke åpne betalingslenken. Prøv igjen.');
        }
      },
      onError: (mutationError) => {
        if (getErrorStatus(mutationError) === 409) void refetch();
        Alert.alert('Kunne ikke starte betalingen', getErrorMessage(mutationError) ?? 'Prøv igjen.');
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}>
        <Pressable onPress={() => router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId: service._id } })} className="mb-5 flex-row items-center gap-2 self-start"><ArrowLeft size={17} color="#63665F" /><Text className="text-[0.8125rem] text-[#63665F]">Tilbake til søkere</Text></Pressable>
        <View className="mb-6"><Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#9B9E96]">SafePay</Text><Text className="mt-2 text-[1.9rem] font-bold leading-tight text-[#0B0B0B]">Kontrakt og betaling</Text><Text className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">Beløpet trekkes nå og holdes av Jobblo til du har godkjent arbeidet.</Text></View>
        <SafePayProgressSteps currentStep={2} />
        <SafePayPartiesCard order={order} />
        <DigitalContractCard service={service} order={order} calculation={calculation} contractDate={contractDate} duration={duration} />
        <SafePayPaymentCard calculation={calculation} isPaid={isPaid} providerName={order.providerId?.name} onPay={handlePay} isPending={paymentMutation.isPending} />
        {order.paymentStatus === 'failed' ? <Text className="mt-4 text-center text-[0.8125rem] font-medium text-[#B4453A]">Forrige betalingsforsøk mislyktes. Du kan prøve igjen over.</Text> : null}
        <Text className="mt-5 text-center text-[0.75rem] leading-relaxed text-[#9B9E96]">Ved å bekrefte godtar du Jobblos vilkår og SafePay-avtalen.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
