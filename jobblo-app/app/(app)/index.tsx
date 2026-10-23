import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Briefcase, ChevronRight, FileText, Locate, MapPin, Plus, Search, ShieldCheck, Star } from 'lucide-react-native';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useJobs } from '../../src/hooks/useJobs';
import { useTopUsers } from '../../src/hooks/useTopUsers';
import { useCategories } from '../../src/hooks/useCategories';
import { useAuthStore } from '../../src/store/authStore';
import { JobCard } from '../../src/components/JobCard';
import { CategoryGrid } from '../../src/components/CategoryGrid';
import { HomeHero } from '../../src/components/HomeHero';
import { SaveToListSheet } from '../../src/components/domain/SaveToListSheet';
import { Select } from '../../src/components/ui/Select';
import { useTabBarSpace } from '../../src/components/GlassTabBar';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { TC, tc } from '../../src/theme/colors';

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
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-tint">
      {showImage ? (
        <Image
          source={{ uri: avatarUrl }}
          className="h-full w-full"
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text className="text-[0.9375rem] font-semibold text-brand-text">{initials}</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  // FINN-style: once the feed reaches the top, a blurred header with search + category chips
  // fades in. `jobsTop` is where the feed starts; the flag only flips when the line is crossed.
  const jobsTop = useRef(0);
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const headerFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerFade, { toValue: compact ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [compact, headerFade]);
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortValue, setSortValue] = useState('newest');
  const [saveSheetServiceId, setSaveSheetServiceId] = useState<string | null>(null);

  const { data: filterOptions, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();

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
      await Promise.all([refetchJobs(), refetchCategories(), recommendedWorkers.refetch()]);
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
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = jobsTop.current > 0 && event.nativeEvent.contentOffset.y > jobsTop.current - insets.top - 110;
          if (next !== compactRef.current) {
            compactRef.current = next;
            setCompact(next);
          }
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 28 + tabBarSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} colors={[TC.brandText]} />}
      >
        {/* Greeting + avatar */}
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1">
            <Text className="text-[0.8125rem] text-muted">{greeting},</Text>
            <Text className="text-[1.375rem] font-bold tracking-[-0.02em] text-ink" numberOfLines={1}>{userName}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profil"
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-line bg-tint"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44 }} />
            ) : (
              <Text className="text-[0.9375rem] font-semibold text-brand-text">{initials}</Text>
            )}
          </Pressable>
        </View>

        {/* Search entry */}
        <Pressable
          onPress={() => router.push('/(app)/explore')}
          accessibilityRole="search"
          accessibilityLabel="Søk etter oppdrag"
          className="mt-4 h-12 flex-row items-center gap-2.5 rounded-full border border-line bg-surface px-4"
        >
          <Search size={18} color={tc('#63665F', 'muted')} />
          <Text className="flex-1 text-[0.9375rem] text-subtle">Søk etter oppdrag eller tjenester</Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color={TC.brandText} />
            <Text className="text-[0.8125rem] font-medium text-brand-text" numberOfLines={1}>{userLocation}</Text>
          </View>
        </Pressable>

        {/* Website-style hero */}
        <HomeHero
          eyebrow={`${season.label} · ${userLocation}`}
          categories={categories.map((cat) => cat.name)}
          onPost={() => router.push('/(app)/create-job')}
          onNearby={() => void handleNearbyJobs()}
        />

        {/* Categories */}
        <SectionHeader title="Kategorier" actionLabel="Se alle" action={() => router.push('/(app)/explore')} />
        {categoriesLoading ? (
          <View className="gap-4 py-2" accessibilityLabel="Laster kategorier">
            {[0, 1].map((row) => (
              <View key={row} className="flex-row justify-between px-2">
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} className="items-center gap-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <CategoryGrid
            // The seasonal category leads, as before.
            categories={[
              ...(seasonalCategory ? [categories.find((cat) => cat.name === seasonalCategory) ?? { name: seasonalCategory }] : []),
              ...categories.filter((cat) => cat.name !== seasonalCategory),
            ]}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {/* Jobs */}
        <View onLayout={(event) => { jobsTop.current = event.nativeEvent.layout.y; }} />
        <SectionHeader
          title={selectedCategory ? `Oppdrag · ${selectedCategory}` : 'Oppdrag nær deg'}
          actionLabel="Se alle"
          action={() => router.push('/(app)/explore')}
        />
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-[0.8125rem] text-muted">{jobsLoading ? 'Laster…' : `${jobs.length} oppdrag`}</Text>
          <Select value={sortValue} options={SORT_OPTIONS.map((option) => ({ ...option }))} onValueChange={setSortValue} placeholder="Sorter" />
        </View>

        {jobsLoading ? (
          <View className="flex-row flex-wrap justify-between gap-y-5" accessible accessibilityRole="progressbar" accessibilityLabel="Laster oppdrag">
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ width: '48%' }} className="gap-2">
                <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: 4 / 5 }} />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </View>
            ))}
          </View>
        ) : jobsError ? (
          <Card className="rounded-2xl p-5">
            <Text className="text-[0.9375rem] font-semibold text-ink">Kunne ikke laste oppdrag</Text>
            <Text className="mt-1 text-[0.875rem] text-muted">Sjekk internettforbindelsen din og prøv igjen.</Text>
            <View className="mt-4">
              <Button label="Prøv igjen" onPress={() => void refetchJobs()} small />
            </View>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="items-center rounded-2xl p-6">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-tint">
              <Briefcase size={22} color={TC.brandText} />
            </View>
            <Text className="mt-3 text-center text-[0.9375rem] font-semibold text-ink">Ingen oppdrag å vise akkurat nå</Text>
            <Text className="mt-1 text-center text-[0.875rem] text-muted">Prøv en annen kategori, eller legg ut ditt eget oppdrag.</Text>
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
                  className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-2 ${index > 0 ? 'border-t border-line-soft' : ''}`}
                >
                  <WorkerAvatar avatarUrl={worker.avatarUrl} initials={worker.initials} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[0.9375rem] font-semibold text-ink" numberOfLines={1}>{worker.name}</Text>
                    <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{worker.role}</Text>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      {worker.rating > 0 ? (
                        <>
                          <Star size={12} color="#B7791F" fill="#B7791F" />
                          <Text className="text-[0.8125rem] font-semibold text-ink">{worker.rating.toFixed(1)}</Text>
                          <Text className="text-[0.8125rem] text-subtle">({worker.count}) ·</Text>
                        </>
                      ) : null}
                      <Text className="shrink text-[0.8125rem] text-muted" numberOfLines={1}>{worker.rate} · {worker.location}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
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
            <View key={title} className={`flex-row items-start gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-tint">
                <Icon size={17} color={TC.brandText} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[0.875rem] font-semibold text-ink">{title}</Text>
                <Text className="mt-0.5 text-[0.8125rem] leading-5 text-muted">{body}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Behind the status bar, so scrolled content never runs under the clock. */}
      {/* zIndex + elevation: Android draws elevated cards above later siblings otherwise. */}
      <View pointerEvents="none" className="absolute left-0 right-0 top-0 bg-page" style={{ height: insets.top, zIndex: 30, elevation: 30, shadowColor: 'transparent' }} />

      {/* Sticky FINN-style header: blurred, search + category chips. */}
      <Animated.View
        pointerEvents={compact ? 'box-none' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          opacity: headerFade,
          zIndex: 40,
          elevation: compact ? 40 : 0,
          // Keep Android's layering, drop its elevation shadow (it drew a dark band).
          shadowColor: 'transparent',
          transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        }}
      >
        <View
          className={Platform.OS === 'ios' ? 'overflow-hidden border-b border-line/70' : 'border-b border-line bg-page'}
          style={{ paddingTop: insets.top + 6 }}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterial" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          ) : null}
          <Pressable
            onPress={() => router.push('/(app)/explore')}
            accessibilityRole="search"
            accessibilityLabel="Søk etter oppdrag"
            className="mx-4 h-11 flex-row items-center gap-2.5 rounded-full border border-line bg-surface/90 px-4"
          >
            <Search size={17} color={tc('#63665F', 'muted')} />
            <Text className="flex-1 text-[0.9375rem] text-subtle">Søk etter oppdrag eller tjenester</Text>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          >
            {['', ...categories.map((cat) => cat.name)].map((name) => {
              const active = selectedCategory === name;
              return (
                <Pressable
                  key={name || 'alle'}
                  onPress={() => setSelectedCategory(active && name ? '' : name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`h-9 justify-center rounded-full border px-3.5 ${active ? 'border-brand bg-brand' : 'border-line bg-surface/90'}`}
                >
                  <Text className={`text-[0.875rem] font-medium ${active ? 'text-white' : 'text-ink'}`}>{name || 'Alle'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

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
      <Text className="text-[1.125rem] font-bold tracking-[-0.01em] text-ink">{title}</Text>
      {actionLabel && action ? (
        <Pressable onPress={action} hitSlop={8} className="flex-row items-center gap-0.5">
          <Text className="text-[0.8125rem] font-semibold text-brand-text">{actionLabel}</Text>
          <ChevronRight size={15} color={TC.brandText} />
        </Pressable>
      ) : null}
    </View>
  );
}
