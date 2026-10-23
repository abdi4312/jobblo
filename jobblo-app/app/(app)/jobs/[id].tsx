import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Home,
  Heart,
  BadgeCheck,
  ChevronRight,
  Lock,
  RotateCcw,
  CalendarDays,
  Clock3,
  MapPin,
  ShieldCheck,
  Share2,
  Star,
  Zap,
} from 'lucide-react-native';
import { useJobDetails } from '../../../src/hooks/useJobDetails';
import { useApplyMutation } from '../../../src/hooks/useApplyMutation';
import { useConnectStatus } from '../../../src/hooks/usePayout';
import { useMyJobRequests } from '../../../src/hooks/useMyApplications';
import { useIsServiceSaved } from '../../../src/hooks/useFavoriteLists';
import { useAuthStore } from '../../../src/store/authStore';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ApplyModal } from '../../../src/components/domain/ApplyModal';
import { JobMetaRow } from '../../../src/components/domain/JobMetaRow';
import { SaveToListSheet } from '../../../src/components/domain/SaveToListSheet';
import { getCategoryIcon } from '../../../src/utils/categoryIcons';
import { ImageViewer } from '../../../src/components/ui/ImageViewer';
import { categoryImage } from '../../../src/utils/categoryImage';
import { serviceStatusLabel } from '../../../src/components/domain/ServiceStatusBadge';
import { MEMBERSHIP_ENABLED } from '../../../src/config/features';
import { EQUIPMENT_LABELS, type Job } from '../../../src/types/Jobs';
import { TC, tc } from '../../../src/theme/colors';

function formatDate(value?: string) {
  if (!value) return 'Ikke angitt';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke angitt';

  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(duration?: Job['duration']) {
  if (!duration?.value) return null;
  const unit = duration.unit === 'minutes' ? 'minutter' : duration.unit === 'days' ? 'dager' : 'timer';
  return `${duration.value} ${unit}`;
}

/** Round white button floating over the listing photo (FINN style). */
function FloatingButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-full bg-white/95 active:opacity-80"
      style={{ shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}
    >
      {children}
    </Pressable>
  );
}

export default function JobDetailsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { data: job, isLoading, isError, refetch } = useJobDetails(id ?? '');
  const requestsQuery = useMyJobRequests(isAuthenticated && !!id);
  const connectStatusQuery = useConnectStatus(isAuthenticated);
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) void connectStatusQuery.refetch();
    }, [connectStatusQuery.refetch, isAuthenticated])
  );
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [saveSheetVisible, setSaveSheetVisible] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState(0);
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const { isSaved, isLoading: savedLoading } = useIsServiceSaved(id ?? '');

  const { mutate: applyToJob, isPending: isApplyLoading } = useApplyMutation({
    onSuccess: () => {
      setIsApplyModalOpen(false);
      setApplyError(null);
      // Modal closes, success toast is shown by parent if needed
    },
    onError: (error: any) => {
      const errorData = error.response?.data;
      let errorMessage = 'Kunne ikke sende forespørsel. Prøv igjen senere.';

      if (error.response?.status === 403 && errorData?.isDelayed) {
        const minutesLeft = Math.ceil((new Date(errorData.unlockAt).getTime() - Date.now()) / 60000);
        errorMessage = `Du må vente ${minutesLeft} minutter før du kan søke på nytt.`;
      } else if (error.response?.status === 402) {
        errorMessage = MEMBERSHIP_ENABLED
          ? 'Du har nådd din månedlige grense for kontakter. Oppgrader planen din for å søke videre.'
          : 'Du har nådd din månedlige grense for kontakter.';
      } else if (errorData?.code === 'STRIPE_CONNECT_REQUIRED') {
        void connectStatusQuery.refetch();
        errorMessage = 'Du må fullføre og verifisere Stripe Connect-kontoen din før du kan sende forespørsler eller starte oppdrag.';
      } else if (errorData?.error) {
        errorMessage = String(errorData.error);
      } else if (errorData?.message) {
        errorMessage = String(errorData.message);
      } else if (error.message) {
        errorMessage = String(error.message);
      }

      setApplyError(errorMessage);
    },
  });

  const poster = typeof job?.userId === 'object' && job.userId ? job.userId : null;
  const isOwner = !!poster && !!user && String((user as any)._id ?? (user as any).id) === String(poster._id ?? '');
  const isClosed = job?.status === 'closed' || job?.status === 'completed' || job?.status === 'cancelled' || job?.status === 'expired';
  const currentUserId = user ? String((user as any)._id ?? (user as any).id ?? '') : '';
  const hasPendingRequest = (requestsQuery.data ?? []).some((request) => {
    const serviceId = typeof request.serviceId === 'object' ? request.serviceId?._id : request.serviceId;
    const customerId = typeof request.customerId === 'object' ? request.customerId?._id : request.customerId;
    if (!serviceId || !customerId) return false;
    return String(serviceId) === String(id) && String(customerId) === currentUserId && request.status === 'pending';
  });
  const imageList = Array.isArray(job?.images) && job.images.length > 0 ? job.images : [];

  const primaryCtaLabel = !isAuthenticated
    ? 'Logg inn for å søke'
    : isOwner
      ? 'Dette er ditt oppdrag'
      : isClosed
        ? 'Oppdraget er lukket'
        : hasPendingRequest
          ? 'Forespørsel sendt'
          : 'Søk på oppdraget';

  const handleShare = async () => {
    if (!job) return;
    const url = `https://jobblo.no/jobs/${id}`;
    const message = `${job.title}\n\n${url}`;
    await Share.share({ message, url });
  };

  const handlePrimaryAction = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    if (isOwner || isClosed || hasPendingRequest) {
      return;
    }

    setApplyError(null);
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = (payload: any) => {
    if (connectStatusQuery.data?.payoutReady !== true) return;
    applyToJob({
      serviceId: id ?? '',
      message: payload.message,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        {/* Skeleton in the page's own shape instead of a full-screen spinner. */}
        <View className="gap-5 px-4 pt-4" accessibilityLabel="Laster oppdrag">
          <View className="flex-row justify-between">
            <View className="h-10 w-10 rounded-full bg-line" />
            <View className="h-10 w-10 rounded-full bg-line" />
          </View>
          <View className="aspect-[4/3] rounded-[28px] bg-line" />
          <View className="gap-3 rounded-[28px] bg-surface p-5">
            <View className="h-7 w-4/5 rounded bg-line" />
            <View className="h-4 w-1/2 rounded bg-page" />
            <View className="mt-3 h-9 w-2/5 rounded bg-line" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ErrorState
          title="Kunne ikke laste oppdraget"
          message="Sjekk internettforbindelsen din og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <EmptyState
          title="Oppdraget finnes ikke"
          message="Annonsen er kanskje fjernet, eller lenken er feil."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* FINN-style: the photo runs edge to edge, under the status bar. */}
        <View className="bg-surface">
          <View className="relative aspect-[4/3] bg-tint">
            {imageList.length > 0 ? (
              <Pressable
                onPress={() => setViewerIndex(Math.min(activeImage, imageList.length - 1))}
                accessibilityRole="imagebutton"
                accessibilityLabel="Vis bildet i full størrelse"
                className="h-full w-full"
              >
                <Image source={{ uri: imageList[Math.min(activeImage, imageList.length - 1)] }} className="h-full w-full" resizeMode="cover" />
              </Pressable>
            ) : (
              <Image source={categoryImage(job.categories)} className="h-full w-full" resizeMode="cover" />
            )}

            <View className="absolute bottom-3 left-3 flex-row flex-wrap gap-2">
              {job.promoted && (
                <View className="flex-row items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5">
                  <Zap size={12} color="#2E6641" fill="#2E6641" />
                  <Text className="text-[0.8125rem] font-semibold text-[#55584F]">Sponset</Text>
                </View>
              )}
              {job.urgent && (
                <View className="flex-row items-center gap-1 rounded-full bg-brand-deep px-2.5 py-1.5">
                  <Zap size={12} color="#FFFFFF" fill="#FFFFFF" />
                  <Text className="text-[0.8125rem] font-semibold text-white">Haster</Text>
                </View>
              )}
            </View>
            {imageList.length > 1 ? (
              <View className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1">
                <Text className="text-[0.8125rem] font-semibold text-white">
                  {Math.min(activeImage, imageList.length - 1) + 1}/{imageList.length}
                </Text>
              </View>
            ) : null}

            {/* Round floating buttons over the photo (always light: they sit on a picture). */}
            <View
              pointerEvents="box-none"
              className="absolute left-0 right-0 flex-row items-center justify-between px-4"
              style={{ top: insets.top + 8 }}
            >
              <FloatingButton label="Tilbake" onPress={() => router.back()}>
                <ArrowLeft size={19} color="#0B0B0B" />
              </FloatingButton>
              <View className="flex-row gap-2.5">
                <FloatingButton label="Del oppdrag" onPress={() => void handleShare()}>
                  <Share2 size={18} color="#0B0B0B" />
                </FloatingButton>
                {!isOwner ? (
                  <FloatingButton
                    label={isSaved ? 'Fjern fra lagrede lister' : 'Lagre i liste'}
                    onPress={() => {
                      if (!isAuthenticated) {
                        router.push('/(auth)/login');
                        return;
                      }
                      setSaveSheetVisible(true);
                    }}
                  >
                    {savedLoading ? <View className="h-4 w-4" /> : <Heart size={18} color={isSaved ? '#B4453A' : '#0B0B0B'} fill={isSaved ? '#B4453A' : 'none'} />}
                  </FloatingButton>
                ) : null}
              </View>
            </View>
          </View>

          {imageList.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12 }}>
              {imageList.map((imageUrl, index) => (
                <Pressable
                  key={`${imageUrl}-${index}`}
                  onPress={() => setActiveImage(index)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Bilde ${index + 1} av ${imageList.length}`}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 bg-tint ${index === activeImage ? 'border-brand-text' : 'border-transparent'}`}
                >
                  <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View className="px-4">
        {/* One sheet with divided sections instead of six stacked cards. */}
        <View className="mt-4 overflow-hidden rounded-[28px] bg-surface">
        <View className="px-5 pb-6 pt-5">
          {job.customerType ? (
            <View className="mb-2.5 flex-row items-center gap-1.5 self-start rounded-full bg-tint px-2.5 py-1">
              {job.customerType === 'business' ? <Building2 size={13} color={TC.brandText} /> : <Home size={13} color={TC.brandText} />}
              <Text className="text-[0.8125rem] font-semibold text-brand-text">
                {job.customerType === 'business' ? 'Bedriftsoppdrag' : 'Privat oppdrag'}
              </Text>
            </View>
          ) : null}
          <Text className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em] text-ink">
            {job.title || 'Uten tittel'}
          </Text>

          <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <View className="flex-row items-center gap-1">
              <MapPin size={14} color={tc('#9B9E96', 'subtle')} strokeWidth={2} />
              <Text className="text-[0.875rem] text-muted">
                {job.location?.city || job.location?.address || 'Norge'}
              </Text>
            </View>
            <Text className="text-subtle">·</Text>
            <View className="flex-row items-center gap-1">
              <CalendarDays size={14} color={tc('#9B9E96', 'subtle')} strokeWidth={2} />
              <Text className="text-[0.875rem] text-muted">{formatDate(job.createdAt)}</Text>
            </View>
          </View>

          <View className="mt-6 border-t border-line pt-5">
            <Text className="text-[2.1rem] font-bold leading-none tracking-[-0.04em] text-ink">
              {job.paymentType === 'Timepris' && job.hourlyRate
                ? `${job.hourlyRate.toLocaleString('nb-NO')} kr/t`
                : job.price
                  ? `${job.price.toLocaleString('nb-NO')} kr`
                  : 'Pris ikke satt'}
            </Text>
            <View className="mt-2 self-start rounded-full bg-tint px-3 py-1">
              <Text className="text-[0.8125rem] font-semibold text-brand-text">
                {job.paymentType === 'Timepris' ? 'Timepris' : job.paymentType === 'Anbud' ? 'Anbud · antatt budsjett' : 'Fastpris'}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-5 pb-6">
          <View className="rounded-2xl border border-[#C6E2CE] bg-tint p-4 dark:border-brand-text/30">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={18} color={TC.brandText} />
              <Text className="text-[1rem] font-semibold text-ink">Trygg handel med SafePay</Text>
            </View>
            {[
              { icon: Lock, text: 'Pengene holdes trygt hos Jobblo til du har godkjent jobben.' },
              { icon: RotateCcw, text: 'Starter ikke utføreren innen fristen, får kunden hele beløpet tilbake.' },
              { icon: BadgeCheck, text: 'Uenig om resultatet? Åpne en tvist, så hjelper Jobblo dere.' },
            ].map(({ icon: Icon, text }) => (
              <View key={text} className="mt-2.5 flex-row gap-2.5">
                <Icon size={15} color={TC.brandText} style={{ marginTop: 3 }} />
                <Text className="flex-1 text-[0.875rem] leading-5 text-ink-2">{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="border-t border-line-soft px-5 py-6">
          <Text className="text-[1.0625rem] font-semibold text-ink">Om oppdraget</Text>
          <Text className="mt-3 whitespace-pre-wrap text-[1rem] leading-relaxed text-ink-2">
            {job.description || 'Ingen beskrivelse tilgjengelig.'}
          </Text>
        </View>

        {job.categories?.length > 0 && (
          <View className="border-t border-line-soft px-5 py-6">
            <Text className="text-[1.0625rem] font-semibold text-ink">Kategorier</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {job.categories.map((category) => {
                const Icon = getCategoryIcon({ name: category });
                return (
                  <View
                    key={category}
                    className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-2"
                  >
                    <Icon size={15} color={TC.brandText} strokeWidth={2} />
                    <Text className="text-[0.8125rem] font-medium text-ink">{category}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="border-t border-line-soft px-5 py-6">
          <Text className="mb-2 text-[1.0625rem] font-semibold text-ink">Detaljer</Text>
          <JobMetaRow label="Sted" value={job.location?.city || job.location?.address || 'Norge'} />
          <JobMetaRow label="Varighet" value={formatDuration(job.duration) || 'Ikke angitt'} />
          <JobMetaRow label="Utstyr" value={job.equipment ? EQUIPMENT_LABELS[job.equipment] ?? null : null} />
          <JobMetaRow label="Lagt ut" value={formatDate(job.createdAt)} />
          <JobMetaRow label="Status" value={job.status ? serviceStatusLabel(job.status) : null} />
        </View>

        {poster && (
          <View className="border-t border-line-soft px-5 py-6">
            <Text className="mb-3 text-[1.0625rem] font-semibold text-ink">Oppdragsgiver</Text>
            {/* Seller card, FINN style: who, verified, rating, member since. */}
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/profile/[userId]', params: { userId: String(poster._id) } })}
              accessibilityRole="button"
              accessibilityLabel={`Se profilen til ${poster.companyName || poster.name || 'oppdragsgiver'}`}
              className="rounded-2xl border border-line p-4 active:bg-surface-2"
            >
              <View className="flex-row items-center gap-3.5">
                <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-tint">
                  {poster.avatarUrl ? (
                    <Image source={{ uri: poster.avatarUrl }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <Text className="text-[1.0625rem] font-semibold text-brand-text">
                      {(poster.companyName || poster.name || 'O').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[1rem] font-semibold text-ink" numberOfLines={1}>
                    {poster.companyName || [poster.name, poster.lastName].filter(Boolean).join(' ') || 'Oppdragsgiver'}
                  </Text>
                  <Text className="mt-0.5 text-[0.8125rem] text-muted">
                    {poster.role === 'company' || poster.companyName ? 'Bedrift' : 'Privat'}
                    {poster.createdAt ? ` · Medlem siden ${new Date(poster.createdAt).getFullYear()}` : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
              </View>

              <View className="mt-3.5 gap-2 border-t border-line-soft pt-3.5">
                {poster.verified ? (
                  <View className="flex-row items-center gap-2">
                    <BadgeCheck size={16} color={TC.brandText} />
                    <Text className="text-[0.875rem] font-medium text-brand-text">Verifisert med BankID</Text>
                  </View>
                ) : null}
                <View className="flex-row items-center gap-2">
                  <Star size={15} color={TC.brandText} fill={poster.averageRating ? TC.brandText : 'none'} />
                  <Text className="text-[0.875rem] text-ink-2">
                    {poster.averageRating
                      ? `${poster.averageRating.toFixed(1)} · ${poster.reviewCount ?? 0} ${poster.reviewCount === 1 ? 'vurdering' : 'vurderinger'}`
                      : 'Ingen vurderinger ennå'}
                  </Text>
                </View>
                {poster.completedJobs ? (
                  <View className="flex-row items-center gap-2">
                    <ShieldCheck size={15} color={TC.brandText} />
                    <Text className="text-[0.875rem] text-ink-2">{poster.completedJobs} fullførte oppdrag med SafePay</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>
        )}

        {job.tags?.length > 0 && (
          <View className="border-t border-line-soft px-5 py-6">
            <Text className="text-[1.0625rem] font-semibold text-ink">Merker</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {job.tags.map((tag) => (
                <View key={tag} className="rounded-full bg-surface-2 px-3 py-1.5">
                  <Text className="text-[0.8125rem] font-medium text-muted">#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        </View>
        </View>
      </ScrollView>

      <ImageViewer images={imageList} index={viewerIndex} onClose={() => setViewerIndex(null)} />

      <View className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-4 pb-5 pt-3">
        {isOwner ? (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId: id ?? '' } })}
              className="flex-1 rounded-full bg-brand px-4 py-3.5"
              activeOpacity={0.9}
            >
              <Text className="text-center text-[0.9375rem] font-semibold text-white">Se søkere</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/create-job', params: { editId: id ?? '' } })}
              className="flex-1 rounded-full border border-line bg-surface px-4 py-3.5"
              activeOpacity={0.9}
            >
              <Text className="text-center text-[0.9375rem] font-semibold text-ink">Rediger</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <TouchableOpacity
          onPress={handlePrimaryAction}
          disabled={isAuthenticated && (isClosed || hasPendingRequest)}
          className={`rounded-full px-4 py-3.5 ${isAuthenticated && (isClosed || hasPendingRequest) ? 'bg-tint' : 'bg-brand'
            }`}
          activeOpacity={0.9}
        >
          <Text
            className={`text-center text-[0.9375rem] font-semibold ${isAuthenticated && (isClosed || hasPendingRequest) ? 'text-muted' : 'text-white'
              }`}
          >
            {primaryCtaLabel}
          </Text>
        </TouchableOpacity>
        )}
      </View>

      {isApplyModalOpen ? <ApplyModal
        visible
        onClose={() => setIsApplyModalOpen(false)}
        onSubmit={handleApplySubmit}
        jobTitle={job?.title}
        isLoading={isApplyLoading}
        error={applyError}
        connectStatus={
          connectStatusQuery.isLoading
            ? 'loading'
            : connectStatusQuery.isError
              ? 'unavailable'
              : connectStatusQuery.data?.payoutReady === true
                ? 'ready'
                : 'required'
        }
        onGoToPayout={() => router.push('/profile/settings/payout')}
      /> : null}

      <SaveToListSheet
        visible={saveSheetVisible}
        onClose={() => setSaveSheetVisible(false)}
        serviceId={id ?? ''}
        serviceTitle={job?.title}
      />
    </SafeAreaView>
  );
}
