import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList, Plus, Search, Users } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMyApplications, useWithdrawApplicationMutation } from '../../src/hooks/useMyApplications';
import { useMyApplicantsOverview } from '../../src/hooks/useMyApplicantsOverview';
import { ApplicationCard } from '../../src/components/domain/ApplicationCard';
import { ApplicantOverviewSkeleton } from '../../src/components/domain/ApplicantOverviewSkeleton';
import { ApplicantServiceCard } from '../../src/components/domain/ApplicantServiceCard';
import { OverviewTabs, type OverviewTabKey } from '../../src/components/domain/OverviewTabs';
import { Button } from '../../src/components/ui/Button';
import { Card, SectionLabel } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { providerOrderRoute } from '../../src/utils/orderRoute';
import type { MyApplication } from '../../src/types/Application';
import type { ApplicantOverviewService } from '../../src/types/Applicants';
import { TC } from '../../src/theme/colors';

const FILTERS = [
  { label: 'Alle', value: '' },
  { label: 'Venter', value: 'pending' },
  { label: 'Valgt', value: 'accepted' },
  { label: 'Avslått', value: 'declined' },
] as const;

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <Card className={['flex-1 rounded-xl px-3.5 py-3', highlight ? 'border-brand-text bg-tint' : ''].join(' ')}>
      <Text className={['text-[1.375rem] font-bold tabular-nums', highlight ? 'text-brand-text' : 'text-ink'].join(' ')}>{value}</Text>
      <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{label}</Text>
    </Card>
  );
}

function EmptyIcon({ icon: Icon }: { icon: typeof Users }) {
  return (
    <View className="h-12 w-12 items-center justify-center rounded-full bg-tint">
      <Icon size={22} color={TC.brandText} />
    </View>
  );
}

/** Only the two real tab keys are accepted; anything else means "no request". */
function requestedTabKey(value?: string): OverviewTabKey | null {
  return value === 'mine-sokere' || value === 'mine-soknader' ? value : null;
}

export default function MyApplicationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: OverviewTabKey = requestedTab === 'mine-soknader' ? 'mine-soknader' : 'mine-sokere';
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
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onOwnerTab) await refetchOwnerServices();
      else await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const withdrawMutation = useWithdrawApplicationMutation();

  // This is a hidden tab route, so a caller arriving with `?tab=` does not remount the screen:
  // the tab router reuses the existing route key and only replaces its params. `useState` above
  // therefore captures the tab requested on the very first mount and ignores every later
  // arrival, which is how a "Mine søkere" entry point could land on the "Mine søknader" list.
  //
  // Local state only. This deliberately does NOT clear the param afterwards: `router.setParams`
  // dispatches SET_PARAMS, which always yields a new navigation state (no bail-out), so calling
  // it from an effect whose dependency is that same param feeds the effect its own output and
  // re-enters BaseNavigationContainer's state from the passive-effect phase — that is the
  // "Maximum update depth exceeded" crash. The param staying in the route is harmless: the
  // equality guard below makes every later pass a no-op, so a manual tab switch is not undone.
  useEffect(() => {
    const wanted = requestedTabKey(requestedTab);
    if (!wanted) return;
    setActiveTab((current) => (current === wanted ? current : wanted));
  }, [requestedTab]);

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
  // "Venter på deg" first: services with applicants but no chosen worker are the owner's to-do.
  const isAwaiting = (service: ApplicantOverviewService) => service.applicantCount > 0 && !service.selectedWorker;
  const awaitingServices = filteredServices.filter(isAwaiting);
  const otherServices = filteredServices.filter((service) => !isAwaiting(service));
  const openService = (serviceId: string) =>
    router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId } });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} />}
      >
        <View className="mb-5">
          <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-muted">Oversikt</Text>
          <Text className="mt-2 text-[1.9rem] font-bold leading-tight tracking-[-0.04em] text-ink">Søkere og søknader</Text>
          <Text className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
            Oppdragene du har lagt ut, og oppdragene du selv har søkt på — samlet på ett sted.
          </Text>
        </View>

        <OverviewTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          applicantCount={ownerServices?.length}
          applicationCount={data?.pagination.total}
        />

        {onOwnerTab && !ownerLoading && !ownerError && (ownerServices?.length ?? 0) > 0 ? (
          <View className="mb-5 flex-row gap-2.5">
            <Stat value={ownerServices?.length ?? 0} label="Oppdrag" />
            <Stat value={totalApplicants} label="Søkere totalt" />
            <Stat value={needsAttention} label="Venter på deg" highlight={needsAttention > 0} />
          </View>
        ) : null}

        <View className="mb-4 flex-row">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder={onOwnerTab ? 'Søk i dine oppdrag' : 'Søk etter oppdrag eller oppdragsgiver'}
          />
        </View>

        {!onOwnerTab ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-4 mb-5"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {FILTERS.map((filter) => (
              <Chip
                key={filter.value}
                label={filter.label}
                selected={statusFilter === filter.value}
                onPress={() => setStatusFilter(filter.value)}
              />
            ))}
          </ScrollView>
        ) : null}

        {activeLoading ? (
          <View className="gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <ApplicantOverviewSkeleton key={index} />
            ))}
          </View>
        ) : activeError ? (
          <ErrorState
            title="Kunne ikke laste"
            message="Vi fikk ikke kontakt med serveren. Sjekk internettforbindelsen din og prøv igjen."
            actionLabel="Prøv igjen"
            onAction={() => (onOwnerTab ? refetchOwnerServices() : refetch())}
          />
        ) : onOwnerTab ? (
          filteredServices.length === 0 ? (
            <EmptyState
              icon={<EmptyIcon icon={searchText ? Search : Users} />}
              title={searchText ? 'Ingen treff' : 'Ingen søkere ennå'}
              message={searchText ? 'Prøv et annet søkeord.' : 'Når noen søker på et av oppdragene dine, dukker det opp her.'}
              action={searchText ? undefined : (
                <Button label="Legg ut et oppdrag" icon={<Plus size={16} color="#FFFFFF" />} onPress={() => router.push('/(app)/create-job')} />
              )}
            />
          ) : (
            <View className="gap-6">
              {awaitingServices.length ? (
                <View>
                  <SectionLabel>Venter på at du velger · {awaitingServices.length}</SectionLabel>
                  <View className="gap-3">
                    {awaitingServices.map((service) => (
                      <ApplicantServiceCard key={service._id} service={service} onPress={openService} />
                    ))}
                  </View>
                </View>
              ) : null}
              {otherServices.length ? (
                <View>
                  <SectionLabel>{awaitingServices.length ? 'Andre oppdrag' : 'Dine oppdrag'} · {otherServices.length}</SectionLabel>
                  <View className="gap-3">
                    {otherServices.map((service) => (
                      <ApplicantServiceCard key={service._id} service={service} onPress={openService} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )
        ) : filteredApplications.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon icon={searchText || statusFilter ? Search : ClipboardList} />}
            title={searchText || statusFilter ? 'Ingen treff' : 'Du har ikke søkt på noe ennå'}
            message={
              searchText || statusFilter
                ? 'Prøv et annet søkeord eller filter.'
                : 'Finn et oppdrag som passer deg, og send en søknad — det tar under ett minutt.'
            }
            action={searchText || statusFilter ? undefined : (
              <Button label="Finn oppdrag" icon={<Search size={16} color="#FFFFFF" />} onPress={() => router.push('/(app)/explore')} />
            )}
          />
        ) : (
          <View className="gap-3">
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
                  // The card only offers this when the application already has a chat.
                  if (chatId) router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId } });
                }}
                onOrder={(orderId) => {
                  // Applicants are the provider side, so orders and contracts open in their own
                  // order workspace rather than the customer-only checkout.
                  if (typeof orderId === 'string' && orderId.trim()) router.push(providerOrderRoute(orderId));
                }}
                onContract={(orderId) => {
                  if (typeof orderId === 'string' && orderId.trim()) router.push(providerOrderRoute(orderId));
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!withdrawRequestId}
        title="Vil du trekke tilbake søknaden?"
        message="Søknaden kan ikke gjenopprettes etter at den er trukket tilbake."
        confirmLabel="Trekk tilbake"
        pendingLabel="Trekker tilbake…"
        destructive
        isPending={withdrawMutation.isPending}
        onConfirm={handleWithdraw}
        onClose={() => setWithdrawRequestId(null)}
      />
    </SafeAreaView>
  );
}
