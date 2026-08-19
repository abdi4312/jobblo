import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMyApplications, useWithdrawApplicationMutation } from '../../src/hooks/useMyApplications';
import { useMyApplicantsOverview } from '../../src/hooks/useMyApplicantsOverview';
import { ApplicationCard } from '../../src/components/domain/ApplicationCard';
import { ApplicantOverviewSkeleton } from '../../src/components/domain/ApplicantOverviewSkeleton';
import { ApplicantServiceCard } from '../../src/components/domain/ApplicantServiceCard';
import { OverviewTabs, type OverviewTabKey } from '../../src/components/domain/OverviewTabs';
import { Dialog } from '../../src/components/ui/Dialog';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../src/components/ui/LoadingIndicator';
import type { MyApplication } from '../../src/types/Application';
import type { ApplicantOverviewService } from '../../src/types/Applicants';

const FILTERS = [
  { label: 'Alle', value: '' },
  { label: 'Venter', value: 'pending' },
  { label: 'Valgt', value: 'accepted' },
  { label: 'Avslått', value: 'declined' },
] as const;

export default function MyApplicationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: OverviewTabKey = requestedTab === 'mine-sokere' ? 'mine-sokere' : 'mine-soknader';
  const [activeTab, setActiveTab] = useState<OverviewTabKey>(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [withdrawRequestId, setWithdrawRequestId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMyApplications({
    page: 1,
    limit: 20,
    status: statusFilter || undefined,
    enabled: activeTab === 'mine-soknader',
  });
  const {
    data: ownerServices,
    isLoading: ownerLoading,
    isError: ownerError,
    refetch: refetchOwnerServices,
  } = useMyApplicantsOverview(activeTab === 'mine-sokere');
  const withdrawMutation = useWithdrawApplicationMutation();

  const filteredServices = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const services = [...(ownerServices ?? [])];

    return services
      .filter((service: ApplicantOverviewService) => {
        if (!query) return true;
        return (
          service.title.toLowerCase().includes(query) ||
          service.selectedWorker?.name.toLowerCase().includes(query) ||
          service.categories?.some((category) => category.toLowerCase().includes(query))
        );
      })
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [ownerServices, searchText]);

  const filteredApplications = useMemo(() => {
    const apps: MyApplication[] = data?.applications ?? [];
    const query = searchText.trim().toLowerCase();

    if (!query) return apps;

    return apps.filter((application: MyApplication) => {
      const title = application.service?.title?.toLowerCase() ?? '';
      const ownerName = `${application.service?.customer?.name ?? ''} ${application.service?.customer?.lastName ?? ''}`.trim().toLowerCase();
      return title.includes(query) || ownerName.includes(query);
    });
  }, [data?.applications, searchText]);

  const handleWithdraw = () => {
    if (!withdrawRequestId) return;
    withdrawMutation.mutate(withdrawRequestId, {
      onSuccess: () => setWithdrawRequestId(null),
      onError: () => setWithdrawRequestId(null),
    });
  };

  const onOwnerTab = activeTab === 'mine-sokere';
  const activeLoading = onOwnerTab ? ownerLoading : isLoading;
  const activeError = onOwnerTab ? ownerError : isError;
  const totalApplicants = (ownerServices ?? []).reduce((total, service) => total + service.applicantCount, 0);
  const needsAttention = (ownerServices ?? []).filter(
    (service) => service.applicantCount > 0 && !service.selectedWorker,
  ).length;

  if (activeLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        {onOwnerTab ? (
          <View className="gap-3 px-4 pt-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <ApplicantOverviewSkeleton key={index} />
            ))}
          </View>
        ) : (
          <LoadingIndicator message="Laster søknader..." />
        )}
      </SafeAreaView>
    );
  }

  if (activeError) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste"
          message="Vi fikk ikke kontakt med serveren. Sjekk internettforbindelsen din og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => (onOwnerTab ? refetchOwnerServices() : refetch())}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}
      >
        <View className="mb-5">
          <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
            Oversikt
          </Text>
          <Text className="mt-2 text-[1.9rem] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            Søkere og søknader
          </Text>
          <Text className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">
            Oppdragene du har lagt ut, og oppdragene du selv har søkt på — samlet på ett sted.
          </Text>
          {!ownerLoading && !ownerError && (ownerServices?.length ?? 0) > 0 ? (
            <View className="mt-4 flex-row flex-wrap items-center gap-x-5 gap-y-2">
              <Text className="text-[0.875rem] text-[#63665F]">
                <Text className="font-semibold text-[#0B0B0B]">{totalApplicants}</Text> søkere totalt
              </Text>
              {needsAttention > 0 ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-[#2E6641]" />
                  <Text className="text-[0.875rem] font-semibold text-[#2E6641]">
                    {needsAttention} venter på at du velger utfører
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <OverviewTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          applicantCount={ownerServices?.length}
          applicationCount={data?.pagination.total}
        />

        <View className="mb-5 flex-row items-center rounded-full border border-[#E6E7E1] bg-white px-3 py-3">
          <Search size={16} color="#9B9E96" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={onOwnerTab ? 'Søk i dine oppdrag' : 'Søk etter oppdrag eller oppdragsgiver'}
            placeholderTextColor="#9B9E96"
            className="ml-2 flex-1 text-[0.9375rem] text-[#0B0B0B]"
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <X size={16} color="#63665F" />
            </Pressable>
          ) : null}
        </View>

        {!onOwnerTab ? (
          <View className="mb-5 flex-row flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const selected = statusFilter === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setStatusFilter(filter.value)}
                  className={[
                    'h-9 rounded-full border px-3.5',
                    selected ? 'border-[#2E6641] bg-[#2E6641]' : 'border-[#E6E7E1] bg-white',
                  ].join(' ')}
                >
                  <Text className={selected ? 'text-[0.8125rem] font-medium text-white' : 'text-[0.8125rem] font-medium text-[#63665F]'}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {onOwnerTab ? (
          filteredServices.length === 0 ? (
            <View className="mx-4 my-8 rounded-3xl border border-[#E6E7E1] bg-white p-8">
              <View className="mx-auto h-11 w-11 items-center justify-center rounded-full bg-[#EAF1E9]">
                <Users size={20} color="#2E6641" />
              </View>
              <Text className="mt-4 text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">
                {searchText ? 'Ingen treff' : 'Ingen søkere ennå'}
              </Text>
              <Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-[#63665F]">
                {searchText
                  ? 'Prøv et annet søkeord.'
                  : 'Når noen søker på et av oppdragene dine, dukker det opp her.'}
              </Text>
              {!searchText ? (
                <Pressable disabled className="mt-6 items-center rounded-full bg-[#2E6641] px-5 py-3 opacity-60">
                  <Text className="text-[0.875rem] font-semibold text-white">Legg ut et oppdrag</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View className="gap-4">
              {filteredServices.map((service) => (
                <ApplicantServiceCard
                  key={service._id}
                  service={service}
                  onPress={(serviceId) =>
                    router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId } })
                  }
                />
              ))}
            </View>
          )
        ) : (
          filteredApplications.length === 0 ? (
            <EmptyState
              title={searchText || statusFilter ? 'Ingen treff' : 'Du har ikke søkt på noe ennå'}
              message={
                searchText || statusFilter
                  ? 'Prøv et annet søkeord eller filter.'
                  : 'Finn et oppdrag som passer deg, og send en søknad — det tar under ett minutt.'
              }
            />
          ) : (
            <View className="gap-4">
              {filteredApplications.map((application: MyApplication) => (
                <ApplicationCard
                  key={application._id}
                  application={application}
                  isWithdrawing={withdrawMutation.isPending && withdrawRequestId === application._id}
                  onWithdraw={(requestId: string) => setWithdrawRequestId(requestId)}
                  onViewJob={(serviceId) => {
                    if (serviceId) router.push({ pathname: '/(app)/jobs/[id]', params: { id: serviceId } });
                  }}
                  onChat={(chatId) => {
                    if (chatId) {
                      // Chat flow intentionally not implemented in this task.
                    }
                  }}
                  onOrder={(orderId) => {
                    if (typeof orderId === 'string' && orderId.trim()) {
                      router.push(`/provider/orders/${orderId.trim()}` as Href);
                    }
                  }}
                  onContract={(orderId) => {
                    if (typeof orderId === 'string' && orderId.trim()) {
                      router.push(`/provider/orders/${orderId.trim()}` as Href);
                    }
                  }}
                />
              ))}
            </View>
          )
        )}
      </ScrollView>

      <Dialog visible={!!withdrawRequestId} onClose={() => setWithdrawRequestId(null)}>
        <View>
          <Text className="text-lg font-bold text-[#0B0B0B]">Vil du trekke tilbake søknaden?</Text>
          <Text className="mt-2 text-sm text-[#63665F]">
            Søknaden kan ikke gjenopprettes etter at den er trukket tilbake.
          </Text>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={() => setWithdrawRequestId(null)}
              className="flex-1 items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 py-3"
            >
              <Text className="text-sm font-medium text-[#0B0B0B]">Avbryt</Text>
            </Pressable>
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className={['flex-1 items-center justify-center rounded-xl bg-[#2F7E47] px-4 py-3', withdrawMutation.isPending ? 'opacity-60' : ''].join(' ')}
            >
              {withdrawMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">Bekreft</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Dialog>
    </SafeAreaView>
  );
}
