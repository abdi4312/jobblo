import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, Clock, MapPin, Users } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApplicantCard } from '../../../src/components/domain/ApplicantCard';
import { ApplicantCompareSection } from '../../../src/components/domain/ApplicantCompareSection';
import { ApplicantOverviewSkeleton } from '../../../src/components/domain/ApplicantOverviewSkeleton';
import { ApplicantNextSteps, ApplicantSelectionGuide, SafePayInfoCard, SafePayProgressSteps, getApplicantProgressStep } from '../../../src/components/domain/SafePayProgressSteps';
import { Select } from '../../../src/components/ui/Select';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { useApplicants, useCreateSafePayContractMutation, useDeclineApplicantMutation, useToggleApplicantArchiveMutation, useToggleApplicantFavoriteMutation } from '../../../src/hooks/useApplicants';
import { useCreateOrGetChatMutation } from '../../../src/hooks/useCreateOrGetChat';
import { customerOrderRoute, type OrderRoute } from '../../../src/utils/orderRoute';

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Nyeste først' },
  { value: 'rating', label: 'Høyest rating' },
  { value: 'completedJobs', label: 'Flest oppdrag' },
  { value: 'favorites', label: 'Favoritter først' },
];

const FILTER_OPTIONS = [
  { value: 'notArchived', label: 'Ikke arkivert' },
  { value: 'favorites', label: 'Favoritter' },
  { value: 'archived', label: 'Arkivert' },
];

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
  if (!value) return 'Dato ikke angitt';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Dato ikke angitt'
    : date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatPrice(value?: number) {
  return typeof value === 'number' ? `${value.toLocaleString('nb-NO')} kr` : '—';
}

function formatDuration(value?: { value?: number; unit?: string } | null) {
  if (!value?.value || value.value <= 0) return null;
  const labels: Record<string, string> = { minutes: 'minutter', minutter: 'minutter', hours: 'timer', timer: 'timer', days: 'dager', dager: 'dager' };
  return `${value.value} ${labels[value.unit ?? ''] ?? value.unit ?? ''}`.trim();
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Label derived from the destination rather than re-deciding the status thresholds here —
 * same pattern as `orderActionLabel` in app/(app)/my-jobs.tsx, so this can never disagree
 * with `customerOrderRoute` about where the button goes.
 */
function activeOrderActionLabel(route: OrderRoute, status?: string) {
  if (route.pathname === '/(app)/safepay/approval/[orderId]') {
    return status === 'completed' ? 'Se godkjenningen' : 'Godkjenn jobb og utbetal';
  }
  if (route.pathname === '/(app)/safepay/success') return 'Se SafePay-ordren';
  return 'Gå til betaling';
}

export default function JobApplicantsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId: string | string[] }>();
  const serviceId = Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId;
  const [sort, setSort] = useState('createdAt');
  const [filter, setFilter] = useState('notArchived');
  const [comparedApplicants, setComparedApplicants] = useState<string[]>([]);
  const { data, isLoading, isError, error, refetch } = useApplicants(serviceId ?? '', sort, filter);
  const favoriteMutation = useToggleApplicantFavoriteMutation();
  const archiveMutation = useToggleApplicantArchiveMutation();
  const declineMutation = useDeclineApplicantMutation();
  const contractMutation = useCreateSafePayContractMutation();
  const chatMutation = useCreateOrGetChatMutation();

  const errorStatus = getErrorStatus(error);
  const errorCopy = useMemo(() => {
    if (errorStatus === 403) {
      return {
        title: 'Ikke autorisert',
        message: 'Du har ikke tilgang til søkerne for dette oppdraget.',
      };
    }
    if (errorStatus === 404) {
      return {
        title: 'Oppdraget ble ikke funnet',
        message: 'Oppdraget kan være slettet eller lenken er feil.',
      };
    }
    if (errorStatus === 500) {
      return {
        title: 'Serverfeil',
        message: 'Serveren kunne ikke hente søkerne akkurat nå. Prøv igjen.',
      };
    }
    return {
      title: 'Kunne ikke laste søkere',
      message: 'Sjekk internettforbindelsen din og prøv igjen.',
    };
  }, [errorStatus]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View className="h-5 w-24 rounded bg-[#E6E7E1]" />
          <View className="h-32 rounded-2xl bg-[#E6E7E1]" />
          {Array.from({ length: 3 }).map((_, index) => (
            <ApplicantOverviewSkeleton key={index} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isError || !data?.service) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState title={errorCopy.title} message={errorCopy.message} onAction={() => refetch()} />
      </SafeAreaView>
    );
  }

  const { service, applicants, activeOrder } = data;
  const duration = formatDuration(service.duration);
  const compared = applicants.filter((application) => comparedApplicants.includes(application.applicant._id));
  // The backend 403s anyone but the job owner on this route, so the viewer is always the
  // customer side of the order. `null` when the id is unusable — never a Home fallback.
  const activeOrderRoute: OrderRoute | null =
    activeOrder && validId(activeOrder._id) ? customerOrderRoute(activeOrder._id.trim(), activeOrder.status) : null;

  const handleMutationError = (action: string, mutationError: unknown) => {
    if (getErrorStatus(mutationError) === 409) {
      Alert.alert('Aktiv kontrakt', 'Dette oppdraget har allerede en aktiv kontrakt.');
      return;
    }
    Alert.alert(
      'Kunne ikke oppdatere',
      getErrorMessage(mutationError) ?? `Kunne ikke ${action}. Prøv igjen.`,
    );
  };

  const handleSelect = (application: (typeof applicants)[number]) => {
    if (!validId(serviceId)) {
      Alert.alert('Kunne ikke velge søker', 'Oppdraget mangler en gyldig ID.');
      return;
    }
    if (activeOrder) {
      if (!validId(activeOrder._id)) {
        Alert.alert('Kunne ikke åpne kontrakten', 'Ordren mangler en gyldig ID.');
        return;
      }
      // The viewer owns this job, so they are always the customer side of the order.
      router.push(customerOrderRoute(activeOrder._id, activeOrder.status));
      return;
    }
    if (!validId(application.applicant._id) || !validId(application._id)) {
      Alert.alert('Kunne ikke velge søker', 'Søkeren mangler en gyldig ID.');
      return;
    }
    contractMutation.mutate(
      { serviceId: serviceId.trim(), applicantId: application.applicant._id.trim(), requestId: application._id.trim() },
      {
        onSuccess: ({ orderId }) => {
          if (!validId(orderId)) {
            handleMutationError('velge søker', new Error('Mangler orderId fra serveren.'));
            return;
          }
          // A freshly created contract is always `awaiting_payment`, so this resolves to checkout.
          router.push(customerOrderRoute(orderId));
        },
        onError: (mutationError) => handleMutationError('velge søker', mutationError),
      },
    );
  };

  const handleChat = (applicantId: string) => {
    if (!serviceId || chatMutation.isPending) return;
    chatMutation.mutate(
      { providerId: applicantId, serviceId },
      {
        onSuccess: ({ _id: chatId }) => router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId } }),
        onError: (mutationError) => handleMutationError('starte chat', mutationError),
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120 }}
      >
        <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center gap-2 self-start">
          <ArrowLeft size={17} color="#63665F" />
          <Text className="text-[0.8125rem] text-[#63665F]">Tilbake til oversikt</Text>
        </Pressable>

        <SafePayProgressSteps currentStep={getApplicantProgressStep(activeOrder?.status)} />

        <View className="mb-5 rounded-2xl bg-[#122A1C] p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[1.125rem] font-semibold text-white" numberOfLines={2}>
                {service.title}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
                <View className="flex-row items-center gap-1">
                  <MapPin size={12} color="#8FBF9A" />
                  <Text className="text-[0.75rem] text-white/70">{service.location?.city || 'Ikke angitt'}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <CalendarDays size={12} color="#8FBF9A" />
                  <Text className="text-[0.75rem] text-white/70">{formatDate(service.date)}</Text>
                </View>
                {duration ? (
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color="#8FBF9A" />
                    <Text className="text-[0.75rem] text-white/70">{duration}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View className="items-end">
              <Text className="text-[1.25rem] font-semibold text-[#8FBF9A]">{formatPrice(service.price)}</Text>
              <Text className="mt-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-white/50">Oppdragsbeløp</Text>
            </View>
          </View>
          {activeOrder ? (
            <View className="mt-4 gap-2.5 rounded-xl bg-white/10 p-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-[0.8125rem] font-semibold text-white">Utfører valgt</Text>
                <Text className="text-[0.75rem] text-white/70">Aktiv kontrakt: {activeOrder.status}</Text>
              </View>
              {/* The only other way into the contract was the per-applicant "Se godkjenning"
                  button, which disappears when the list is empty, archived or filtered — so the
                  customer could have a `ready_for_review` order and no reachable approval CTA. */}
              {activeOrderRoute ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(activeOrderRoute)}
                  className="rounded-full bg-white px-4 py-2.5"
                >
                  <Text className="text-center text-[0.8125rem] font-semibold text-[#122A1C]">
                    {activeOrderActionLabel(activeOrderRoute, activeOrder.status)}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <ApplicantCompareSection
          applicants={compared}
          onClear={() => setComparedApplicants([])}
        />

        <View className="mb-4 flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Users size={16} color="#2E6641" />
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{applicants.length} {applicants.length === 1 ? 'søker' : 'søkere'}</Text>
          </View>
          <View className="flex-row gap-2">
            <Select value={filter} options={FILTER_OPTIONS} onValueChange={setFilter} placeholder="Filter" />
            <Select value={sort} options={SORT_OPTIONS} onValueChange={setSort} placeholder="Sorter" />
          </View>
        </View>

        {applicants.length > 0 ? (
          <View className="gap-4">
            {applicants.map((application, index) => (
              <ApplicantCard
                key={application._id}
                application={application}
                activeOrder={activeOrder}
                isTop={index === 0}
                isCompared={comparedApplicants.includes(application.applicant._id)}
                isSelecting={contractMutation.isPending}
                isStartingChat={chatMutation.isPending}
                onFavorite={(requestId) => {
                  favoriteMutation.mutate(requestId, {
                    onError: (mutationError) => handleMutationError('endre favoritt', mutationError),
                  });
                }}
                onArchive={(requestId) => {
                  archiveMutation.mutate(requestId, {
                    onError: (mutationError) => handleMutationError('endre arkivstatus', mutationError),
                  });
                }}
                onDecline={(requestId) => {
                  declineMutation.mutate(
                    { requestId, archive: true },
                    {
                      onError: (mutationError) => handleMutationError('avslå søker', mutationError),
                    },
                  );
                }}
                onCompare={(applicantId) => setComparedApplicants((current) => current.includes(applicantId) ? current.filter((id) => id !== applicantId) : current.length < 3 ? [...current, applicantId] : current)}
                onSelect={handleSelect}
                onChat={handleChat}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="Ingen søkere enda" message="Vent på at søkere skal søke om jobben din." />
        )}

        <View className="mt-5 gap-3">
          <ApplicantNextSteps activeOrderStatus={activeOrder?.status} jobDate={formatDate(service.date)} payout={String((service.price ?? 0) - Math.round((service.price ?? 0) * 0.03))} />
          <SafePayInfoCard price={service.price ?? 0} />
          <ApplicantSelectionGuide />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}