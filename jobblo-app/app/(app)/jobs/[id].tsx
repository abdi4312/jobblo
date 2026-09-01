import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  Zap,
} from 'lucide-react-native';
import { useJobDetails } from '../../../src/hooks/useJobDetails';
import { useApplyMutation } from '../../../src/hooks/useApplyMutation';
import { useIsServiceSaved } from '../../../src/hooks/useFavoriteLists';
import { useAuthStore } from '../../../src/store/authStore';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ApplyModal } from '../../../src/components/domain/ApplyModal';
import { JobMetaRow } from '../../../src/components/domain/JobMetaRow';
import { SaveToListSheet } from '../../../src/components/domain/SaveToListSheet';
import { getCategoryIcon } from '../../../src/utils/categoryIcons';
import type { Job } from '../../../src/types/Jobs';

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

export default function JobDetailsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { data: job, isLoading, isError, refetch } = useJobDetails(id ?? '');
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [saveSheetVisible, setSaveSheetVisible] = React.useState(false);
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
        errorMessage = 'Du har nådd din månedlige grense for kontakter. Oppgrader planen din for å søke videre.';
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
  const imageList = Array.isArray(job?.images) && job.images.length > 0 ? job.images : [];

  const primaryCtaLabel = !isAuthenticated
    ? 'Logg inn for å søke'
    : isOwner
      ? 'Dette er ditt oppdrag'
      : isClosed
        ? 'Oppdraget er lukket'
        : 'Søk på oppdraget';

  const handlePrimaryAction = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    if (isOwner || isClosed) {
      return;
    }

    setApplyError(null);
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = (payload: any) => {
    applyToJob({
      serviceId: id ?? '',
      message: payload.message,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster oppdrag..." />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
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
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <EmptyState
          title="Oppdraget finnes ikke"
          message="Annonsen er kanskje fjernet, eller lenken er feil."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white"
          >
            <ArrowLeft size={18} color="#0B0B0B" />
          </TouchableOpacity>
          <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
            Oppdrag
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View className="overflow-hidden rounded-[28px] border border-[#E6E7E1] bg-white">
          <View className="relative aspect-[4/3] bg-[#EAF1E9]">
            {imageList.length > 0 ? (
              <Image source={{ uri: imageList[0] }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-[#EAF1E9]">
                <Text className="text-[0.875rem] text-[#63665F]">Ingen bilde</Text>
              </View>
            )}

            <View className="absolute left-3 top-3 flex-row flex-wrap gap-2">
              {job.promoted && (
                <View className="flex-row items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5">
                  <Zap size={12} color="#2E6641" fill="#2E6641" />
                  <Text className="text-[0.6875rem] font-semibold text-[#63665F]">Sponset</Text>
                </View>
              )}
              {job.urgent && (
                <View className="flex-row items-center gap-1 rounded-full bg-[#122A1C] px-2.5 py-1.5">
                  <Zap size={12} color="#FFFFFF" fill="#FFFFFF" />
                  <Text className="text-[0.6875rem] font-semibold text-white">Haster</Text>
                </View>
              )}
            </View>

            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  if (!isAuthenticated) {
                    router.push('/(auth)/login');
                    return;
                  }
                  setSaveSheetVisible(true);
                }}
                className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white/95"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={isSaved ? 'Fjern fra lagrede lister' : 'Lagre i liste'}
              >
                {savedLoading ? (
                  <View className="h-4 w-4" />
                ) : (
                  <Bookmark size={16} color="#0B0B0B" fill={isSaved ? '#0B0B0B' : 'none'} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {imageList.length > 1 && (
            <View className="flex-row gap-2 overflow-x-auto px-3 py-3">
              {imageList.map((imageUrl, index) => (
                <Image
                  key={`${imageUrl}-${index}`}
                  source={{ uri: imageUrl }}
                  className="h-16 w-16 rounded-xl"
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </View>

        <View className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5">
          <Text className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            {job.title || 'Uten tittel'}
          </Text>

          <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <View className="flex-row items-center gap-1">
              <MapPin size={14} color="#9B9E96" strokeWidth={2} />
              <Text className="text-[0.875rem] text-[#63665F]">
                {job.location?.city || job.location?.address || 'Norge'}
              </Text>
            </View>
            <Text className="text-[#9B9E96]">·</Text>
            <View className="flex-row items-center gap-1">
              <CalendarDays size={14} color="#9B9E96" strokeWidth={2} />
              <Text className="text-[0.875rem] text-[#63665F]">{formatDate(job.createdAt)}</Text>
            </View>
          </View>

          <View className="mt-6 border-t border-[#E6E7E1] pt-5">
            <Text className="text-[2.1rem] font-bold leading-none tracking-[-0.04em] text-[#0B0B0B]">
              {job.price ? `${job.price.toLocaleString('nb-NO')} kr` : 'Pris ikke satt'}
            </Text>
            <Text className="mt-1.5 text-[0.8125rem] text-[#63665F]">
              {job.hourlyRate
                ? `${job.hourlyRate.toLocaleString('nb-NO')} kr/t`
                : job.paymentType === 'Anbud'
                  ? 'Antatt budsjett — gi ditt tilbud'
                  : 'Fastpris for hele oppdraget'}
            </Text>
          </View>
        </View>

        <View className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Om oppdraget</Text>
          <Text className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[#63665F]">
            {job.description || 'Ingen beskrivelse tilgjengelig.'}
          </Text>
        </View>

        {job.categories?.length > 0 && (
          <View className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5">
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Kategorier</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {job.categories.map((category) => {
                const Icon = getCategoryIcon({ name: category });
                return (
                  <View
                    key={category}
                    className="flex-row items-center gap-1.5 rounded-full border border-[#E6E7E1] bg-[#F4F6F0] px-3 py-2"
                  >
                    <Icon size={15} color="#2E6641" strokeWidth={2} />
                    <Text className="text-[0.75rem] font-medium text-[#0B0B0B]">{category}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5">
          <Text className="mb-2 text-[0.9375rem] font-semibold text-[#0B0B0B]">Detaljer</Text>
          <JobMetaRow label="Sted" value={job.location?.city || job.location?.address || 'Norge'} />
          <JobMetaRow label="Varighet" value={formatDuration(job.duration) || 'Ikke angitt'} />
          <JobMetaRow label="Utstyr" value={job.equipment || null} />
          <JobMetaRow label="Lagt ut" value={formatDate(job.createdAt)} />
          <JobMetaRow label="Status" value={job.status || null} />
        </View>

        {poster && (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(app)/profile/[userId]', params: { userId: String(poster._id) } })
            }
            className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5"
          >
            <Text className="mb-3 text-[0.9375rem] font-semibold text-[#0B0B0B]">Oppdragsgiver</Text>
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
                {poster.avatarUrl ? (
                  <Image source={{ uri: poster.avatarUrl }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">
                    {(poster.name || poster.companyName || 'O').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                    {poster.companyName || poster.name || 'Oppdragsgiver'}
                  </Text>
                  {poster.verified && (
                    <View className="flex-row items-center gap-1 rounded-full bg-[#EAF1E9] px-2 py-0.5">
                      <ShieldCheck size={10} color="#2E6641" />
                      <Text className="text-[0.625rem] font-bold uppercase text-[#2E6641]">Verifisert</Text>
                    </View>
                  )}
                </View>

                {typeof poster.averageRating === 'number' && poster.averageRating > 0 && (
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <Star size={12} color="#2E6641" fill="#2E6641" />
                    <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">
                      {poster.averageRating.toFixed(1)}
                    </Text>
                  </View>
                )}

                {poster.role && (
                  <Text className="mt-1 text-[0.8125rem] text-[#63665F]">{poster.role}</Text>
                )}
              </View>
            </View>
          </Pressable>
        )}

        {job.tags?.length > 0 && (
          <View className="mt-5 rounded-[28px] border border-[#E6E7E1] bg-white p-5">
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Merker</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {job.tags.map((tag) => (
                <View key={tag} className="rounded-full bg-[#F4F6F0] px-3 py-1.5">
                  <Text className="text-[0.75rem] font-medium text-[#63665F]">#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 border-t border-[#E6E7E1] bg-white px-4 pb-5 pt-3">
        <TouchableOpacity
          onPress={handlePrimaryAction}
          disabled={!isAuthenticated || isOwner || isClosed}
          className={`rounded-full px-4 py-3.5 ${
            !isAuthenticated || isOwner || isClosed ? 'bg-[#EAF1E9]' : 'bg-[#2E6641]'
          }`}
          activeOpacity={0.9}
        >
          <Text
            className={`text-center text-[0.9375rem] font-semibold ${
              !isAuthenticated || isOwner || isClosed ? 'text-[#63665F]' : 'text-white'
            }`}
          >
            {primaryCtaLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <ApplyModal
        visible={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSubmit={handleApplySubmit}
        jobTitle={job?.title}
        isLoading={isApplyLoading}
        error={applyError}
      />

      <SaveToListSheet
        visible={saveSheetVisible}
        onClose={() => setSaveSheetVisible(false)}
        serviceId={id ?? ''}
        serviceTitle={job?.title}
      />
    </SafeAreaView>
  );
}
