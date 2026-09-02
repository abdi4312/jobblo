import React, { useMemo, useState } from 'react';
import { Image, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Locate, ShieldCheck, Star } from 'lucide-react-native';
import { useJobs } from '../../src/hooks/useJobs';
import { useTopUsers } from '../../src/hooks/useTopUsers';
import { useCategories } from '../../src/hooks/useCategories';
import { useAuthStore } from '../../src/store/authStore';
import { JobCard } from '../../src/components/JobCard';
import { CategoryChip } from '../../src/components/CategoryChip';
import { SaveToListSheet } from '../../src/components/domain/SaveToListSheet';
import { Select } from '../../src/components/ui/Select';
import { useDashboardStats } from '../../src/hooks/useDashboardStats';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'price_low', label: 'Pris – lavest først' },
  { value: 'price_high', label: 'Pris – høyest først' },
  { value: 'relevant', label: 'Mest relevant' },
] as const;

const SEASONS = [
  {
    months: [11, 0, 1],
    label: 'Vinter',
    line: 'Frosne rør, snø på oppkjørselen eller storrengjøring før jul?',
    category: 'Rørlegger',
  },
  {
    months: [2, 3, 4],
    label: 'Vår',
    line: 'Hagen våkner, og vinduene har hatt en lang vinter.',
    category: 'Hagearbeid',
  },
  {
    months: [5, 6, 7],
    label: 'Sommer',
    line: 'Lyse kvelder — den korte sesongen for maling og arbeid ute.',
    category: 'Maling',
  },
  {
    months: [8, 9, 10],
    label: 'Høst',
    line: 'Mørkere kvelder. Tid for å ta tak innendørs.',
    category: 'Rengjøring',
  },
] as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'God morgen';
  if (hour >= 12 && hour < 18) return 'God ettermiddag';
  return 'God kveld';
}

function WorkerAvatar({ avatarUrl, initials }: { avatarUrl?: string; initials: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0 && !imageFailed;

  return (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
      {showImage ? (
        <Image
          source={{ uri: avatarUrl }}
          className="h-full w-full"
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">{initials}</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortValue, setSortValue] = useState('newest');
  const [saveSheetServiceId, setSaveSheetServiceId] = useState<string | null>(null);

  const { data: filterOptions, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
  const dashboardStats = useDashboardStats();

  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
    refetch: refetchJobs,
  } = useJobs({
    categories: selectedCategory ? [selectedCategory] : [],
    sort: sortValue,
    limit: 8,
  });

  const jobs = jobsData?.data || [];

  const recommendedWorkers = useTopUsers({
    page: 1,
    limit: 4,
    postNumber: typeof user?.postNumber === 'string' ? user.postNumber : '',
    postSted: typeof user?.postSted === 'string' ? user.postSted : '',
    address: typeof user?.address === 'string' ? user.address : '',
  });

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchJobs(), refetchCategories(), recommendedWorkers.refetch(), dashboardStats.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const categories = (filterOptions?.categories ?? []).filter((cat) => !['alle', 'all', 'alle kategorier', 'all categories', 'ingen'].includes(cat.name.trim().toLowerCase()));
  const season = useMemo(() => {
    const month = new Date().getMonth();
    const seasonOptions: Array<{ months: number[]; label: string; line: string; category: string }> = SEASONS as any;
    return seasonOptions.find((option) => option.months.includes(month)) ?? seasonOptions[3];
  }, []);

  const userName = String(user?.name ?? 'der');
  const userLocation = typeof user?.postSted === 'string' ? user.postSted : user?.postSted && typeof user.postSted === 'object' && 'city' in user.postSted ? String(user.postSted.city ?? 'Norge') : 'Norge';
  const greeting = getGreeting();
  const seasonalCategory = categories.find(
    (cat) => cat.name?.toLowerCase() === season.category.toLowerCase()
  )?.name;

  const workerCards: Array<{
    _id?: string;
    initials: string;
    name: string;
    role: string;
    rating: number;
    count: number;
    rate: string;
    location: string;
    avatarUrl?: string;
  }> = (recommendedWorkers.data?.data ?? []).slice(0, 4).map((worker) => ({
    _id: worker._id,
    initials: `${String(worker.name ?? '').charAt(0)}${String(worker.lastName ?? '').charAt(0)}`.toUpperCase(),
    name: `${worker.name ?? ''} ${worker.lastName ?? ''}`.trim() || 'Oppdragstaker',
    role: Array.isArray(worker.skills) ? worker.skills.slice(0, 3).join(' · ') : 'Oppdragstaker',
    rating: Number(worker.averageRating ?? 0),
    count: Number(worker.reviewCount ?? 0),
    rate: worker.hourlyRate ? `${worker.hourlyRate} kr/t` : 'Tilgjengelig',
    location: worker.postSted || worker.locations?.[0] || 'Norge',
    avatarUrl: worker.avatarUrl,
  }));

  const SectionHeader = ({ eyebrow, title, actionLabel, action }: { eyebrow: string; title: string; actionLabel?: string; action?: () => void }) => (
    <View className="mb-6">
      <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
        {eyebrow}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[1.25rem] font-bold text-[#0B0B0B]">{title}</Text>
        {actionLabel && (
          <TouchableOpacity onPress={action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-[0.875rem] font-medium text-[#2E6641]">{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  const seasonImage = season.category === 'Rørlegger' ? require('../../assets/category-showcase/rorlegger.webp') : season.category === 'Hagearbeid' ? require('../../assets/category-showcase/hagearbeid.webp') : season.category === 'Maling' ? require('../../assets/category-showcase/maling.webp') : require('../../assets/category-showcase/rengjoring.webp');
  const handleNearbyJobs = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        router.push({ pathname: '/(app)/explore', params: { lat: String(position.coords.latitude), lng: String(position.coords.longitude) } });
        return;
      }
    } catch {
      Alert.alert('Posisjon ikke tilgjengelig', 'Utforsk alle oppdrag i stedet.');
    }
    router.push('/(app)/explore');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" />}
      >
        <View className="relative overflow-hidden rounded-[28px] bg-[#2E6641]">
          <Image source={seasonImage} className="absolute inset-y-0 right-0 h-full w-2/3 opacity-25" resizeMode="cover" />
          <View className="absolute inset-y-0 right-0 w-2/3 bg-[#2E6641]/70" />
          <View className="relative px-6 py-8">
            <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#8FBF9A]">
              {season.label} · {userLocation}
            </Text>
            <Text className="mt-4 text-[1.625rem] font-bold leading-[1.1] text-white">
              {greeting}, {userName}.
            </Text>
            <Text className="mt-2 text-[1.1rem] font-semibold text-[#8FBF9A]">
              Hva trenger du hjelp med i dag?
            </Text>
            <Text className="mt-3 text-[0.9375rem] leading-relaxed text-white/70">{season.line}</Text>

            <View className="mt-7 flex-row flex-wrap gap-2.5">
              <TouchableOpacity
                onPress={() => void handleNearbyJobs()}
                className="rounded-full bg-white px-5 py-3.5"
                activeOpacity={0.9}
              >
                <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Oppdrag nær meg</Text>
              </TouchableOpacity>

              {seasonalCategory && (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(seasonalCategory)}
                  className="rounded-full border border-white/40 px-5 py-3.5"
                  activeOpacity={0.9}
                >
                  <Text className="text-[0.9375rem] font-semibold text-white">{seasonalCategory}</Text>
                </TouchableOpacity>
              )}
            </View>
            {dashboardStats.data ? <View className="mt-6 flex-row gap-5 border-t border-white/20 pt-4">{[[dashboardStats.data.activeJobs, 'Aktive oppdrag'], [dashboardStats.data.totalUsers, 'Brukere'], [dashboardStats.data.averageRating.toFixed(1), 'Snittrating']].map(([value, label]) => <View key={label}><Text className="text-base font-bold text-white">{value}</Text><Text className="mt-0.5 text-[0.6875rem] text-white/70">{label}</Text></View>)}</View> : null}
          </View>
        </View>

        <View className="mt-14">
          <SectionHeader eyebrow="01 — Kategorier" title="Hva trenger du hjelp til?" actionLabel="Se alle" action={() => router.push('/(app)/explore')} />

          {categoriesLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#2E6641" size="small" />
            </View>
          ) : (
            <View className="flex-row flex-wrap -mx-1.5">
              <View className="w-1/3 px-1.5 pb-3">
                <CategoryChip
                  category={{ name: 'Alle' }}
                  isSelected={selectedCategory === ''}
                  onPress={() => setSelectedCategory('')}
                />
              </View>

              {categories.map((cat) => (
                <View key={cat._id} className="w-1/3 px-1.5 pb-3">
                  <CategoryChip
                    category={cat}
                    isSelected={selectedCategory === cat.name}
                    onPress={() => setSelectedCategory((current) => (current === cat.name ? '' : cat.name))}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mt-14">
          <SectionHeader
            eyebrow="02 — Ute nå"
            title={`Oppdrag nær deg — ${userLocation}`}
            actionLabel="Se alle oppdrag"
            action={() => router.push('/(app)/explore')}
          />

            <View className="flex-row items-center justify-end"><Text className="mr-2 text-[0.8125rem] font-medium text-[#63665F]">Sorter</Text><Select value={sortValue} options={SORT_OPTIONS.map((option) => ({ ...option }))} onValueChange={setSortValue} />
          </View>

          {jobsLoading && (
            <View className="items-center justify-center py-12">
              <ActivityIndicator color="#2E6641" size="large" />
              <Text className="mt-4 text-[0.875rem] text-[#63665F]">Laster oppdrag...</Text>
            </View>
          )}

          {jobsError && !jobsLoading && (
            <View className="rounded-2xl border border-[#E6E7E1] bg-white p-6">
              <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Kunne ikke laste oppdrag</Text>
              <Text className="mt-1.5 text-[0.875rem] text-[#63665F]">
                Sjekk internettforbindelsen din og prøv igjen.
              </Text>
              <TouchableOpacity onPress={() => refetchJobs()} className="mt-4 rounded-lg bg-[#2E6641] px-4 py-2.5">
                <Text className="text-center text-[0.875rem] font-semibold text-white">Prøv igjen</Text>
              </TouchableOpacity>
            </View>
          )}

          {!jobsLoading && !jobsError && jobs.length === 0 && (
            <View className="rounded-2xl border border-[#E6E7E1] bg-white p-6">
              <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen oppdrag å vise akkurat nå</Text>
              <Text className="mt-1.5 text-[0.875rem] text-[#63665F]">
                Prøv en annen kategori, eller legg ut ditt eget oppdrag.
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/explore')} className="mt-4 rounded-lg bg-[#2E6641] px-4 py-2.5">
                <Text className="text-center text-[0.875rem] font-semibold text-white">Se alle oppdrag</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(app)/create-job')} className="mt-3 rounded-lg border border-[#2E6641] bg-white px-4 py-2.5">
                <Text className="text-center text-[0.875rem] font-semibold text-[#2E6641]">Legg ut et oppdrag</Text>
              </TouchableOpacity>
            </View>
          )}

          {!jobsLoading && !jobsError && jobs.length > 0 && (
            <View className="flex-row flex-wrap -mx-2">
              {jobs.slice(0, 8).map((job) => (
                <View key={job._id} className="w-1/2 px-2 pb-8">
                  <JobCard job={job} onSavePress={(id) => setSaveSheetServiceId(id)} />
                </View>
              ))}
            </View>
          )}
        </View>

        {workerCards.length > 0 && (
          <View className="mt-14">
            <SectionHeader eyebrow="03 — I nærheten" title="Anbefalte oppdragstakere" actionLabel="Se alle" action={() => router.push('/(app)/recommended-taskers')} />

            <View className="space-y-4">
              {workerCards.map((worker: {
                _id?: string;
                initials: string;
                name: string;
                role: string;
                rating: number;
                count: number;
                rate: string;
                location: string;
                avatarUrl?: string;
              }) => (
                <TouchableOpacity
                  key={worker._id ?? worker.name}
                  activeOpacity={0.9}
                  disabled={!worker._id}
                  className="flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-white p-4"
                  onPress={() => {
                    if (!worker._id) return;
                    router.push({ pathname: '/(app)/profile/[userId]', params: { userId: worker._id } });
                  }}
                >
                  <WorkerAvatar avatarUrl={worker.avatarUrl} initials={worker.initials} />

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="truncate text-[0.9375rem] font-semibold text-[#0B0B0B]">{worker.name}</Text>
                    </View>

                    <Text className="mt-0.5 text-[0.8125rem] text-[#63665F]">{worker.role}</Text>

                    {worker.rating > 0 && (
                      <View className="mt-1.5 flex-row items-center gap-1.5">
                        <Star size={13} color="#2E6641" fill="#2E6641" />
                        <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">{worker.rating.toFixed(1)}</Text>
                        <Text className="text-[0.8125rem] text-[#63665F]">({worker.count} {worker.count === 1 ? 'anmeldelse' : 'anmeldelser'})</Text>
                      </View>
                    )}

                    <Text className="mt-1.5 text-[0.8125rem] text-[#0B0B0B]">
                      {worker.rate} · {worker.location}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View className="mt-14"><SectionHeader eyebrow="" title="Tryggere sammen" actionLabel="" action={() => undefined} />{[
          [ShieldCheck, 'Trygg betaling med SafePay', 'Pengene holdes sikkert til jobben er godkjent. Du betaler aldri for noe du ikke er fornøyd med.'],
          [FileText, 'Automatisk kontrakt', 'Hver avtale genererer en digital kontrakt som beskytter både deg og oppdragstakeren.'],
          [Star, 'Verifiserte ratings', 'Alle anmeldelser er fra ekte fullførte oppdrag. Du ser alltid hvem du leier inn.'],
        ].map(([Icon, title, body]) => <View key={title as string} className="mb-3 flex-row items-start rounded-2xl border border-[#E6E7E1] bg-white p-4"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]"><Icon size={18} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-sm font-semibold text-[#0B0B0B]">{title as string}</Text><Text className="mt-1 text-xs leading-5 text-[#63665F]">{body as string}</Text></View></View>)}</View>
      </ScrollView>

      <SaveToListSheet
        visible={!!saveSheetServiceId}
        onClose={() => setSaveSheetServiceId(null)}
        serviceId={saveSheetServiceId ?? ''}
      />
    </SafeAreaView>
  );
}
