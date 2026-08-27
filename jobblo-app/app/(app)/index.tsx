import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Star } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { useJobs } from '../../src/hooks/useJobs';
import { useCategories } from '../../src/hooks/useCategories';
import { useAuthStore } from '../../src/store/authStore';
import { JobCard } from '../../src/components/JobCard';
import { CategoryChip } from '../../src/components/CategoryChip';
import { SaveToListSheet } from '../../src/components/domain/SaveToListSheet';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'price_low', label: 'Pris – lavest først' },
  { value: 'price_high', label: 'Pris – høyest først' },
  { value: 'relevant', label: 'Mest relevant' },
] as const;

const SEASONS = [
  {
    months: [10, 11, 0, 1],
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
    months: [8, 9],
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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortValue, setSortValue] = useState('newest');
  const [saveSheetServiceId, setSaveSheetServiceId] = useState<string | null>(null);

  const { data: filterOptions, isLoading: categoriesLoading } = useCategories();

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

  const recommendedWorkers = useQuery({
    queryKey: ['topUsers', 'home', user?.postNumber ?? '', user?.postSted ?? '', user?.address ?? ''],
    queryFn: async () => {
      const response = await apiClient.get('/users/top', {
        params: {
          page: 1,
          limit: 4,
          postNumber: user?.postNumber ?? '',
          postSted: user?.postSted ?? '',
          address: user?.address ?? '',
        },
      });
      return response.data?.data ?? [];
    },
    enabled: !!user,
  });

  const categories = filterOptions?.categories ?? [];
  const season = useMemo(() => {
    const month = new Date().getMonth();
    const seasonOptions: Array<{ months: number[]; label: string; line: string; category: string }> = SEASONS as any;
    return seasonOptions.find((option) => option.months.includes(month)) ?? seasonOptions[3];
  }, []);

  const userName = String(user?.name ?? 'der');
  const userLocation = String(user?.postSted ?? 'Norge');
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
    sponsored: boolean;
    avatarUrl?: string;
  }> = (recommendedWorkers.data ?? []).slice(0, 4).map((worker: any, index: number) => ({
    _id: worker._id,
    initials: `${String(worker.name ?? '').charAt(0)}${String(worker.lastName ?? '').charAt(0)}`.toUpperCase(),
    name: `${worker.name ?? ''} ${worker.lastName ?? ''}`.trim() || 'Oppdragstaker',
    role: Array.isArray(worker.skills) ? worker.skills.slice(0, 3).join(' · ') : 'Oppdragstaker',
    rating: Number(worker.averageRating ?? 0),
    count: Number(worker.reviewCount ?? 0),
    rate: worker.hourlyRate ? `${worker.hourlyRate} kr/t` : 'Tilgjengelig',
    location: worker.postSted || worker.locations?.[0] || 'Norge',
    sponsored: index === 0,
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

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 28 }}
      >
        <View className="relative overflow-hidden rounded-[28px] bg-[#2E6641]">
          <View className="absolute inset-y-0 right-0 w-2/3 opacity-25">
            <View className="h-full w-full rounded-l-[28px] bg-[#EAF1E9]" />
          </View>
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
                onPress={() => router.push('/(app)/explore')}
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

          <View className="mb-5 flex-row items-center justify-end">
            <Text className="mr-2 text-[0.8125rem] font-medium text-[#63665F]">Sorter</Text>
            <View className="flex-row items-center rounded-xl border border-[#E6E7E1] bg-white px-2 py-1.5">
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setSortValue(option.value)}
                  className={`rounded-lg px-2.5 py-1.5 ${sortValue === option.value ? 'bg-[#2E6641]' : ''}`}
                  activeOpacity={0.9}
                >
                  <Text className={`text-[0.75rem] font-medium ${sortValue === option.value ? 'text-white' : 'text-[#0B0B0B]'}`}>
                    {option.label.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
            <SectionHeader eyebrow="03 — I nærheten" title="Anbefalte oppdragstakere" actionLabel="Se alle" action={() => router.push('/(app)/explore')} />

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
                sponsored: boolean;
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
                  <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
                    {worker.avatarUrl ? (
                      <View className="h-full w-full rounded-full bg-[#EAF1E9]" />
                    ) : (
                      <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">{worker.initials}</Text>
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="truncate text-[0.9375rem] font-semibold text-[#0B0B0B]">{worker.name}</Text>
                      {worker.sponsored && (
                        <View className="rounded-full bg-[#F4F6F0] px-2 py-0.5">
                          <Text className="text-[0.6875rem] font-semibold text-[#63665F]">Sponset</Text>
                        </View>
                      )}
                    </View>

                    <Text className="mt-0.5 text-[0.8125rem] text-[#63665F]">{worker.role}</Text>

                    {worker.rating > 0 && (
                      <View className="mt-1.5 flex-row items-center gap-1.5">
                        <Star size={13} color="#2E6641" fill="#2E6641" />
                        <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">{worker.rating.toFixed(1)}</Text>
                        <Text className="text-[0.8125rem] text-[#63665F]">({worker.count} oppdrag)</Text>
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
      </ScrollView>

      <SaveToListSheet
        visible={!!saveSheetServiceId}
        onClose={() => setSaveSheetServiceId(null)}
        serviceId={saveSheetServiceId ?? ''}
      />
    </SafeAreaView>
  );
}
