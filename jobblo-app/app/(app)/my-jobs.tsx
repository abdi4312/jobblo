import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Eye, MapPin, Megaphone, Pencil, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDeleteMyJobMutation, useMyJobs } from '../../src/hooks/useMyJobs';
import { useMyApplicantsOverview } from '../../src/hooks/useMyApplicantsOverview';
import { ServiceStatusBadge } from '../../src/components/domain/ServiceStatusBadge';
import { ApplicantOverviewSkeleton } from '../../src/components/domain/ApplicantOverviewSkeleton';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Select } from '../../src/components/ui/Select';
import { customerOrderRoute, type OrderRoute } from '../../src/utils/orderRoute';
import type { ApplicantOverviewOrder } from '../../src/types/Applicants';
import type { JobStatus, MyJob } from '../../src/types/Jobs';
import { TC, tc } from '../../src/theme/colors';

/** Buckets over the 11 Service.status values. Counts are derived from the response. */
const FILTERS: { label: string; value: string; statuses: JobStatus[] }[] = [
  { label: 'Alle', value: 'alle', statuses: [] },
  { label: 'Aktive', value: 'aktive', statuses: ['open'] },
  {
    label: 'Pågår',
    value: 'pagar',
    statuses: ['pending', 'awaiting_payment', 'paid', 'in_progress', 'waiting_for_approval'],
  },
  { label: 'Fullført', value: 'fullfort', statuses: ['completed'] },
  { label: 'Utkast', value: 'utkast', statuses: ['draft'] },
  { label: 'Avsluttet', value: 'avsluttet', statuses: ['closed', 'cancelled', 'expired'] },
];

const SORTS = [
  { label: 'Nyeste først', value: 'newest' },
  { label: 'Eldste først', value: 'oldest' },
  { label: 'Høyest pris', value: 'price_desc' },
  { label: 'Lavest pris', value: 'price_asc' },
];

function getErrorMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { error?: string; message?: string } } }).response
      ?.data;
    return data?.error ?? data?.message ?? null;
  }
  return null;
}

/** Every owner-side order lands on the same route as the SafePay helper resolves. */
function orderRouteFor(order: ApplicantOverviewOrder): OrderRoute {
  return customerOrderRoute(order._id, order.status, order.paymentStatus);
}

/**
 * The CTA label is derived from the resolved destination rather than from a second copy
 * of the status buckets, so the button can never promise one screen and open another.
 */
function orderActionLabel(order: ApplicantOverviewOrder) {
  const { pathname } = orderRouteFor(order);
  if (pathname === '/(app)/safepay/approval/[orderId]') return 'Godkjenn arbeid';
  if (pathname === '/(app)/safepay/success') return 'Se SafePay-ordre';
  return 'Betal med SafePay';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(job: MyJob) {
  if (job.paymentType === 'Timepris' && typeof job.hourlyRate === 'number') {
    return `${job.hourlyRate.toLocaleString('nb-NO')} kr/t`;
  }
  return typeof job.price === 'number' ? `${job.price.toLocaleString('nb-NO')} kr` : null;
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <Card className={['flex-1 rounded-xl px-3.5 py-3', highlight ? 'border-brand-text bg-tint' : ''].join(' ')}>
      <Text className={['text-[1.375rem] font-bold tabular-nums', highlight ? 'text-brand-text' : 'text-ink'].join(' ')}>{value}</Text>
      <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{label}</Text>
    </Card>
  );
}

function MyJobCard({
  job,
  applicantCount,
  order,
  deleting,
  onOpen,
  onApplicants,
  onEdit,
  onOrder,
  onDelete,
}: {
  job: MyJob;
  applicantCount?: number;
  order?: ApplicantOverviewOrder | null;
  deleting: boolean;
  onOpen: () => void;
  onApplicants: () => void;
  onEdit: () => void;
  onOrder: () => void;
  onDelete: () => void;
}) {
  const price = formatPrice(job);
  const canDelete = job.capabilities?.canDelete !== false;
  const canEdit = job.capabilities?.canEdit !== false;
  const blockedReason = job.capabilities?.blockedReason ?? null;

  return (
    <Pressable
      onPress={onOpen}
      className="overflow-hidden rounded-xl border border-line bg-surface active:opacity-90"
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
            <ServiceStatusBadge status={job.status} />
            {job.urgent ? (
              <View className="self-start rounded-full bg-brand-deep px-2.5 py-1">
                <Text className="text-[0.8125rem] font-semibold text-white">Hastar</Text>
              </View>
            ) : null}
            {job.promoted ? (
              <View className="self-start rounded-full bg-tint px-2.5 py-1">
                <Text className="text-[0.8125rem] font-semibold text-brand-text">Fremhevet</Text>
              </View>
            ) : null}
          </View>
          {price ? <Text className="text-[1rem] font-bold text-ink">{price}</Text> : null}
        </View>

        <View className="mt-2.5 flex-row items-center gap-2">
          <Text className="flex-1 text-[1rem] font-semibold tracking-[-0.02em] text-ink" numberOfLines={2}>
            {job.title}
          </Text>
          <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
        </View>

        <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          <Text className="text-[0.8125rem] text-muted">{formatDate(job.createdAt)}</Text>
          {job.location?.city ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-subtle">·</Text>
              <MapPin size={12} color={tc('#9B9E96', 'subtle')} />
              <Text className="text-[0.8125rem] text-muted">{job.location.city}</Text>
            </View>
          ) : null}
        </View>

        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {typeof job.views === 'number' ? (
            <View className="flex-row items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5">
              <Eye size={13} color={tc('#63665F', 'muted')} />
              <Text className="text-[0.8125rem] text-muted">{job.views} visninger</Text>
            </View>
          ) : null}
          {typeof applicantCount === 'number' ? (
            <View className="flex-row items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5">
              <Users size={13} color={tc('#63665F', 'muted')} />
              <Text className="text-[0.8125rem] text-muted">
                {applicantCount} {applicantCount === 1 ? 'søker' : 'søkere'}
              </Text>
            </View>
          ) : null}
          {job.categories?.length ? (
            <Text className="min-w-0 flex-shrink text-[0.8125rem] text-subtle" numberOfLines={1}>
              {job.categories.join(', ')}
            </Text>
          ) : null}
        </View>

        {job.status === 'draft' ? (
          <Text className="mt-3 text-[0.8125rem] leading-5 text-muted">
            Utkastet er lagret på serveren og er ikke synlig for andre.
          </Text>
        ) : null}

        {order ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-lg bg-tint p-3">
            <ShieldCheck size={16} color={TC.brandText} />
            <Text className="flex-1 text-[0.8125rem] font-medium text-brand-text">SafePay-ordre er opprettet</Text>
            <Pressable onPress={onOrder} className="rounded-lg bg-brand px-3 py-2">
              <Text className="text-[0.8125rem] font-semibold text-white">{orderActionLabel(order)}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center gap-2 border-t border-line bg-surface-2 px-4 py-3">
        <Pressable
          onPress={onApplicants}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2.5"
        >
          <Users size={15} color="#FFFFFF" />
          <Text className="text-[0.8125rem] font-semibold text-white">
            Se søkere{applicantCount ? ` (${applicantCount})` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          disabled={!canEdit}
          className={[
            'flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5',
            canEdit ? 'bg-surface' : 'bg-surface-2 opacity-60',
          ].join(' ')}
        >
          <Pencil size={15} color={canEdit ? TC.ink : tc('#9B9E96', 'subtle')} />
          <Text className={['text-[0.8125rem] font-semibold', canEdit ? 'text-ink' : 'text-subtle'].join(' ')}>Rediger</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={!canDelete || deleting}
          accessibilityLabel="Slett annonse"
          className={[
            'h-10 w-10 items-center justify-center rounded-lg border',
            canDelete ? 'border-[#E7CFCB] dark:border-danger-line bg-surface' : 'border-line bg-surface-2 opacity-60',
          ].join(' ')}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={tc('#B4544A', 'danger')} />
          ) : (
            <Trash2 size={16} color={canDelete ? tc('#B4544A', 'danger') : tc('#9B9E96', 'subtle')} />
          )}
        </Pressable>
      </View>

      {(!canDelete || !canEdit) && blockedReason ? (
        <Text className="px-4 pb-3 text-[0.8125rem] leading-5 text-muted">{blockedReason}</Text>
      ) : null}
    </Pressable>
  );
}

export default function MyJobsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('alle');
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState('newest');
  const [pendingDelete, setPendingDelete] = useState<MyJob | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMyJobs();
  // Applicant counts and the real order id live on the applicants overview —
  // /services/my-posted returns neither, so SafePay routing reuses this source
  // instead of guessing an orderId.
  const { data: overview, refetch: refetchOverview } = useMyApplicantsOverview();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refetch(), refetchOverview()]); } finally { setRefreshing(false); }
  };
  const deleteMutation = useDeleteMyJobMutation();

  const jobs = data ?? [];

  const overviewById = useMemo(() => {
    const map = new Map<string, { applicantCount: number; order: ApplicantOverviewOrder | null }>();
    for (const service of overview ?? []) {
      map.set(service._id, { applicantCount: service.applicantCount, order: service.order });
    }
    return map;
  }, [overview]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { alle: jobs.length };
    for (const bucket of FILTERS) {
      if (bucket.value === 'alle') continue;
      result[bucket.value] = jobs.filter((job) => bucket.statuses.includes(job.status)).length;
    }
    return result;
  }, [jobs]);

  const totalApplicants = (overview ?? []).reduce((total, service) => total + service.applicantCount, 0);

  const visibleJobs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const bucket = FILTERS.find((entry) => entry.value === filter);

    return [...jobs]
      .filter((job) => {
        if (bucket && bucket.statuses.length && !bucket.statuses.includes(job.status)) return false;
        if (!query) return true;
        return (
          job.title.toLowerCase().includes(query) ||
          job._id.toLowerCase().includes(query) ||
          (job.categories ?? []).some((category) => category.toLowerCase().includes(query))
        );
      })
      .sort((first, second) => {
        if (sort === 'oldest') {
          return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
        }
        if (sort === 'price_desc') return (second.price ?? 0) - (first.price ?? 0);
        if (sort === 'price_asc') return (first.price ?? 0) - (second.price ?? 0);
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      });
  }, [jobs, filter, searchText, sort]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    deleteMutation.mutate(pendingDelete._id, {
      onSuccess: () => setPendingDelete(null),
      // 409 carries a finished Norwegian sentence from the server — show it verbatim.
      onError: (error) =>
        setDeleteError(getErrorMessage(error) ?? 'Kunne ikke slette annonsen. Prøv igjen.'),
    });
  };

  const closeDelete = () => {
    setPendingDelete(null);
    setDeleteError(null);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} />
        }
      >
        <ScreenHeader
          title="Mine annonser"
          subtitle={
            isLoading || isError
              ? 'Oppdragene du har lagt ut'
              : `${jobs.length} ${jobs.length === 1 ? 'annonse' : 'annonser'} lagt ut av deg`
          }
          icon={Megaphone}
          backLabel="Profil"
        />

        {isLoading ? (
          <View className="gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <ApplicantOverviewSkeleton key={index} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title="Kunne ikke laste annonsene dine"
            message="Vi fikk ikke kontakt med serveren. Sjekk internettforbindelsen din og prøv igjen."
            onAction={() => void refetch()}
          />
        ) : (
          <>
            {jobs.length ? (
              <View className="mb-5 flex-row gap-2.5">
                <Stat value={counts.aktive ?? 0} label="Aktive" />
                <Stat value={counts.pagar ?? 0} label="Pågår" highlight={(counts.pagar ?? 0) > 0} />
                <Stat value={totalApplicants} label="Søkere totalt" />
              </View>
            ) : null}

            <View className="flex-row gap-2">
              <SearchInput value={searchText} onChange={setSearchText} placeholder="Søk i tittel, kategori eller ID" />
              <Pressable
                onPress={() => router.push('/(app)/create-job')}
                accessibilityLabel="Legg ut ny annonse"
                className="h-12 w-12 items-center justify-center rounded-full bg-brand"
              >
                <Plus size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-4 mt-4"
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {FILTERS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  count={counts[entry.value]}
                  selected={filter === entry.value}
                  onPress={() => setFilter(entry.value)}
                />
              ))}
            </ScrollView>

            <View className="mb-4 mt-4 flex-row items-center justify-between">
              <Text className="text-[0.8125rem] text-muted">
                Viser {visibleJobs.length} av {jobs.length}
              </Text>
              <Select value={sort} options={SORTS} onValueChange={setSort} placeholder="Sorter" />
            </View>

            {visibleJobs.length === 0 ? (
              <EmptyState
                icon={
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-tint">
                    {searchText.trim() ? <Search size={22} color={TC.brandText} /> : <Megaphone size={22} color={TC.brandText} />}
                  </View>
                }
                title={
                  searchText.trim()
                    ? 'Ingen treff'
                    : jobs.length === 0
                      ? 'Du har ingen annonser ennå'
                      : 'Ingen oppdrag i denne kategorien'
                }
                message={
                  searchText.trim()
                    ? 'Prøv et annet søkeord.'
                    : jobs.length === 0
                      ? 'Legg ut et oppdrag, så finner du det igjen her.'
                      : 'Velg et annet filter for å se de andre annonsene dine.'
                }
                action={
                  jobs.length === 0 && !searchText.trim() ? (
                    <Button label="Legg ut et oppdrag" icon={<Plus size={16} color="#FFFFFF" />} onPress={() => router.push('/(app)/create-job')} />
                  ) : undefined
                }
              />
            ) : (
              <View className="gap-3">
                {visibleJobs.map((job) => {
                  const extra = overviewById.get(job._id);
                  return (
                    <MyJobCard
                      key={job._id}
                      job={job}
                      applicantCount={overview ? (extra?.applicantCount ?? 0) : undefined}
                      order={extra?.order ?? null}
                      deleting={deleteMutation.isPending && pendingDelete?._id === job._id}
                      onOpen={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } })}
                      onApplicants={() =>
                        router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId: job._id } })
                      }
                      onEdit={() => router.push({ pathname: '/(app)/create-job', params: { editId: job._id } })}
                      onOrder={() => {
                        if (extra?.order) router.push(orderRouteFor(extra.order));
                      }}
                      onDelete={() => {
                        setDeleteError(null);
                        setPendingDelete(job);
                      }}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Slette annonsen?"
        message={pendingDelete ? `«${pendingDelete.title}» slettes. Denne handlingen kan ikke angres.` : undefined}
        confirmLabel="Slett annonse"
        pendingLabel="Sletter…"
        destructive
        isPending={deleteMutation.isPending}
        errorMessage={deleteError}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </SafeAreaView>
  );
}
