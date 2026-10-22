import React, { useMemo, useState } from 'react';
import { Image, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Briefcase, ChevronRight, FileText, Locate, MapPin, Plus, Search, ShieldCheck, Star } from 'lucide-react-native';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
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

  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  const avatarUrl = typeof user?.avatarUrl === 'string' ? user.avatarUrl : undefined;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" colors={['#2E6641']} />}
      >
        {/* Greeting + avatar */}
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1">
            <Text className="text-[0.8125rem] text-[#63665F]">{greeting},</Text>
            <Text className="text-[1.375rem] font-bold tracking-[-0.02em] text-[#0B0B0B]" numberOfLines={1}>{userName}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profil"
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#E6E7E1] bg-[#EAF1E9]"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44 }} />
            ) : (
              <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">{initials}</Text>
            )}
          </Pressable>
        </View>

        {/* Search entry */}
        <Pressable
          onPress={() => router.push('/(app)/explore')}
          accessibilityRole="search"
          accessibilityLabel="Søk etter oppdrag"
          className="mt-4 h-12 flex-row items-center gap-2.5 rounded-full border border-[#E6E7E1] bg-white px-4"
        >
          <Search size={18} color="#63665F" />
          <Text className="flex-1 text-[0.9375rem] text-[#9B9E96]">Søk etter oppdrag eller tjenester</Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#2E6641" />
            <Text className="text-[0.75rem] font-medium text-[#2E6641]" numberOfLines={1}>{userLocation}</Text>
          </View>
        </Pressable>

        {/* Seasonal hero */}
        <View className="mt-4 overflow-hidden rounded-[28px] bg-[#2E6641]">
          <Image source={seasonImage} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%', opacity: 0.3 }} resizeMode="cover" />
          <View className="absolute bottom-0 right-0 top-0 w-[55%] bg-[#2E6641]/60" />
          <View className="p-5">
            <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#B9D9C0]">
              {season.label} · {userLocation}
            </Text>
            <Text className="mt-2 text-[1.25rem] font-bold leading-tight text-white">Hva trenger du hjelp med i dag?</Text>
            <Text className="mt-1.5 text-[0.875rem] leading-5 text-white/75">{season.line}</Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => router.push('/(app)/create-job')}
                className="h-10 flex-row items-center gap-1.5 rounded-full bg-white px-4 active:opacity-90"
              >
                <Plus size={16} color="#2E6641" />
                <Text className="text-[0.875rem] font-semibold text-[#2E6641]">Legg ut oppdrag</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleNearbyJobs()}
                className="h-10 flex-row items-center gap-1.5 rounded-full border border-white/40 px-4 active:opacity-90"
              >
                <Locate size={15} color="#FFFFFF" />
                <Text className="text-[0.875rem] font-semibold text-white">Nær meg</Text>
              </Pressable>
            </View>
            {dashboardStats.data ? (
              <View className="mt-5 flex-row border-t border-white/20 pt-3">
                {[
                  [dashboardStats.data.activeJobs, 'Aktive oppdrag'],
                  [dashboardStats.data.totalUsers, 'Brukere'],
                  [dashboardStats.data.averageRating.toFixed(1), 'Snittrating'],
                ].map(([value, label]) => (
                  <View key={String(label)} className="flex-1">
                    <Text className="text-[1rem] font-bold tabular-nums text-white">{value}</Text>
                    <Text className="mt-0.5 text-[0.6875rem] text-white/70">{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Categories */}
        <SectionHeader title="Kategorier" actionLabel="Se alle" action={() => router.push('/(app)/explore')} />
        {categoriesLoading ? (
          <ActivityIndicator color="#2E6641" size="small" className="py-4" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <CategoryChip category={{ name: 'Alle' }} isSelected={selectedCategory === ''} onPress={() => setSelectedCategory('')} />
            {seasonalCategory ? (
              <CategoryChip
                category={categories.find((cat) => cat.name === seasonalCategory) ?? { name: seasonalCategory }}
                isSelected={selectedCategory === seasonalCategory}
                onPress={() => setSelectedCategory((current) => (current === seasonalCategory ? '' : seasonalCategory))}
              />
            ) : null}
            {categories
              .filter((cat) => cat.name !== seasonalCategory)
              .map((cat) => (
                <CategoryChip
                  key={cat._id}
                  category={cat}
                  isSelected={selectedCategory === cat.name}
                  onPress={() => setSelectedCategory((current) => (current === cat.name ? '' : cat.name))}
                />
              ))}
          </ScrollView>
        )}

        {/* Jobs */}
        <SectionHeader
          title={selectedCategory ? `Oppdrag · ${selectedCategory}` : 'Oppdrag nær deg'}
          actionLabel="Se alle"
          action={() => router.push('/(app)/explore')}
        />
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-[0.8125rem] text-[#63665F]">{jobsLoading ? 'Laster…' : `${jobs.length} oppdrag`}</Text>
          <Select value={sortValue} options={SORT_OPTIONS.map((option) => ({ ...option }))} onValueChange={setSortValue} placeholder="Sorter" />
        </View>

        {jobsLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#2E6641" size="large" />
            <Text className="mt-3 text-[0.875rem] text-[#63665F]">Laster oppdrag...</Text>
          </View>
        ) : jobsError ? (
          <Card className="rounded-2xl p-5">
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Kunne ikke laste oppdrag</Text>
            <Text className="mt-1 text-[0.875rem] text-[#63665F]">Sjekk internettforbindelsen din og prøv igjen.</Text>
            <View className="mt-4">
              <Button label="Prøv igjen" onPress={() => void refetchJobs()} small />
            </View>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="items-center rounded-2xl p-6">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E9]">
              <Briefcase size={22} color="#2E6641" />
            </View>
            <Text className="mt-3 text-center text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen oppdrag å vise akkurat nå</Text>
            <Text className="mt-1 text-center text-[0.875rem] text-[#63665F]">Prøv en annen kategori, eller legg ut ditt eget oppdrag.</Text>
            <View className="mt-4 flex-row gap-2">
              <Button label="Se alle oppdrag" variant="secondary" small onPress={() => router.push('/(app)/explore')} />
              <Button label="Legg ut oppdrag" small onPress={() => router.push('/(app)/create-job')} />
            </View>
          </Card>
        ) : (
          <View className="-mx-1.5 flex-row flex-wrap">
            {jobs.slice(0, 8).map((job) => (
              <View key={job._id} className="w-1/2 px-1.5 pb-5">
                <JobCard job={job} compact onSavePress={(id) => setSaveSheetServiceId(id)} />
              </View>
            ))}
          </View>
        )}

        {/* Recommended taskers */}
        {workerCards.length > 0 ? (
          <>
            <SectionHeader title="Anbefalte oppdragstakere" actionLabel="Se alle" action={() => router.push('/(app)/recommended-taskers')} />
            <Card className="overflow-hidden rounded-2xl">
              {workerCards.map((worker, index) => (
                <Pressable
                  key={worker._id ?? worker.name}
                  disabled={!worker._id}
                  onPress={() => {
                    if (worker._id) router.push({ pathname: '/(app)/profile/[userId]', params: { userId: worker._id } });
                  }}
                  className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-[#F4F6F0] ${index > 0 ? 'border-t border-[#EFF0EA]' : ''}`}
                >
                  <WorkerAvatar avatarUrl={worker.avatarUrl} initials={worker.initials} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{worker.name}</Text>
                    <Text className="mt-0.5 text-[0.8125rem] text-[#63665F]" numberOfLines={1}>{worker.role}</Text>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      {worker.rating > 0 ? (
                        <>
                          <Star size={12} color="#B7791F" fill="#B7791F" />
                          <Text className="text-[0.75rem] font-semibold text-[#0B0B0B]">{worker.rating.toFixed(1)}</Text>
                          <Text className="text-[0.75rem] text-[#9B9E96]">({worker.count}) ·</Text>
                        </>
                      ) : null}
                      <Text className="shrink text-[0.75rem] text-[#63665F]" numberOfLines={1}>{worker.rate} · {worker.location}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#9B9E96" />
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

        {/* Trust */}
        <SectionHeader title="Tryggere sammen" />
        <Card className="overflow-hidden rounded-2xl">
          {([
            [ShieldCheck, 'Trygg betaling med SafePay', 'Pengene holdes sikkert til jobben er godkjent.'],
            [FileText, 'Automatisk kontrakt', 'Hver avtale får en digital kontrakt som beskytter begge parter.'],
            [Star, 'Verifiserte ratings', 'Alle anmeldelser er fra ekte, fullførte oppdrag.'],
          ] as const).map(([Icon, title, body], index) => (
            <View key={title} className={`flex-row items-start gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-[#EFF0EA]' : ''}`}>
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1E9]">
                <Icon size={17} color="#2E6641" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">{title}</Text>
                <Text className="mt-0.5 text-[0.8125rem] leading-5 text-[#63665F]">{body}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      <SaveToListSheet
        visible={!!saveSheetServiceId}
        onClose={() => setSaveSheetServiceId(null)}
        serviceId={saveSheetServiceId ?? ''}
      />
    </SafeAreaView>
  );
}

function SectionHeader({ title, actionLabel, action }: { title: string; actionLabel?: string; action?: () => void }) {
  return (
    <View className="mb-3 mt-8 flex-row items-center justify-between">
      <Text className="text-[1.125rem] font-bold tracking-[-0.01em] text-[#0B0B0B]">{title}</Text>
      {actionLabel && action ? (
        <Pressable onPress={action} hitSlop={8} className="flex-row items-center gap-0.5">
          <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">{actionLabel}</Text>
          <ChevronRight size={15} color="#2E6641" />
        </Pressable>
      ) : null}
    </View>
  );
}
