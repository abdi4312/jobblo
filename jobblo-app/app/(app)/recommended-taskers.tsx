import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, MapPin, Search, Star, Users, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTopUsers } from '../../src/hooks/useTopUsers';
import { useProfile } from '../../src/hooks/useProfile';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../src/components/ui/LoadingIndicator';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';

const PAGE_SIZE = 12;

function initials(name?: string, lastName?: string) {
  return `${name?.trim()?.[0] || ''}${lastName?.trim()?.[0] || ''}`.toUpperCase() || 'U';
}

function Avatar({ uri, label }: { uri?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
      {uri && !failed ? (
        <Image source={{ uri }} style={{ width: 56, height: 56 }} onError={() => setFailed(true)} />
      ) : (
        <Text className="text-[1rem] font-semibold text-[#2E6641]">{label}</Text>
      )}
    </View>
  );
}

export default function RecommendedTaskersScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const place = typeof profile?.postSted === 'string' ? profile.postSted : '';
  const query = useTopUsers({
    page: 1,
    limit,
    postNumber: typeof profile?.postNumber === 'string' ? profile.postNumber : '',
    postSted: place,
    address: typeof profile?.address === 'string' ? profile.address : '',
  });
  const users = query.data?.data || [];
  const total = query.data?.pagination?.total || users.length;
  const loadingMore = query.isFetching && !query.isLoading && !refreshing;

  // Filters what is already loaded; the server list is the "near you" ranking.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((worker) =>
      [worker.name, worker.lastName, ...(worker.skills ?? [])].some((part) => String(part ?? '').toLowerCase().includes(term))
    );
  }, [users, search]);

  const refresh = async () => {
    setRefreshing(true);
    try { await query.refetch(); } finally { setRefreshing(false); }
  };

  if (query.isLoading)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster oppdragstakere..." />
      </SafeAreaView>
    );
  if (query.isError)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste oppdragstakere"
          message="Sjekk internettforbindelsen din og prøv igjen."
          actionLabel="Prøv igjen"
          onAction={() => void query.refetch()}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#2E6641" colors={['#2E6641']} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <ScreenHeader
          title="Anbefalte oppdragstakere"
          subtitle={place ? `Dyktige folk nær ${place}` : 'Dyktige folk nær deg'}
          icon={Users}
          backLabel="Tilbake"
        />

        {users.length ? (
          <View className="mb-3 h-12 flex-row items-center gap-2.5 rounded-full border border-[#E6E7E1] bg-white px-4">
            <Search size={17} color="#63665F" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Søk på navn eller ferdighet"
              placeholderTextColor="#9B9E96"
              accessibilityLabel="Søk blant oppdragstakere"
              returnKeyType="search"
              style={{ paddingVertical: 0 }}
              className="flex-1 text-[0.9375rem] text-[#0B0B0B]"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Tøm søket">
                <X size={16} color="#9B9E96" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {users.length ? (
          <Text className="mb-3 px-1 text-[0.8125rem] text-[#63665F]">
            {search ? `${visible.length} treff` : `Viser ${users.length} av ${total}`}
          </Text>
        ) : null}

        {users.length === 0 ? (
          <EmptyState
            icon={
              <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EAF1E9]">
                <Users size={24} color="#2E6641" />
              </View>
            }
            title="Ingen oppdragstakere funnet"
            message="Vi fant ingen oppdragstakere i nærheten akkurat nå. Prøv igjen senere."
          />
        ) : visible.length === 0 ? (
          <Text className="my-8 text-center text-[0.875rem] text-[#63665F]">Ingen treff på «{search.trim()}».</Text>
        ) : (
          <View className="gap-3">
            {visible.map((worker) => {
              const name = `${worker.name || ''} ${worker.lastName || ''}`.trim() || 'Oppdragstaker';
              const rating = Number(worker.averageRating || 0);
              const reviews = Number(worker.reviewCount || 0);
              const skills = (worker.skills ?? []).slice(0, 3);
              return (
                <Pressable
                  key={worker._id}
                  onPress={() => router.push({ pathname: '/(app)/profile/[userId]', params: { userId: worker._id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}, se profil`}
                  className="rounded-2xl border border-[#E6E7E1] bg-white p-4 active:bg-[#FAFAF7]"
                >
                  <View className="flex-row items-center gap-3">
                    <Avatar uri={worker.avatarUrl} label={initials(worker.name, worker.lastName)} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[1rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{name}</Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        {reviews > 0 ? (
                          <>
                            <Star size={13} color="#B7791F" fill="#B7791F" />
                            <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">{rating.toFixed(1)}</Text>
                            <Text className="text-[0.8125rem] text-[#9B9E96]">
                              ({reviews} {reviews === 1 ? 'anmeldelse' : 'anmeldelser'})
                            </Text>
                          </>
                        ) : (
                          <View className="rounded-full bg-[#EAF1E9] px-2 py-0.5">
                            <Text className="text-[0.6875rem] font-semibold text-[#2E6641]">Ny på Jobblo</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-[0.9375rem] font-bold tabular-nums text-[#0B0B0B]">
                        {worker.hourlyRate ? `${worker.hourlyRate} kr` : '—'}
                      </Text>
                      <Text className="text-[0.6875rem] text-[#9B9E96]">{worker.hourlyRate ? 'per time' : 'pris avtales'}</Text>
                    </View>
                  </View>

                  {skills.length ? (
                    <View className="mt-3 flex-row flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <View key={skill} className="rounded-full bg-[#F4F6F0] px-2.5 py-1">
                          <Text className="text-[0.75rem] font-medium text-[#3C3F38]">{skill}</Text>
                        </View>
                      ))}
                      {(worker.skills?.length ?? 0) > 3 ? (
                        <View className="rounded-full bg-[#F4F6F0] px-2.5 py-1">
                          <Text className="text-[0.75rem] font-medium text-[#9B9E96]">+{(worker.skills?.length ?? 0) - 3}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View className="mt-3 flex-row items-center justify-between border-t border-[#EFF0EA] pt-3">
                    <View className="min-w-0 flex-1 flex-row items-center gap-1">
                      <MapPin size={13} color="#63665F" />
                      <Text className="shrink text-[0.8125rem] text-[#63665F]" numberOfLines={1}>
                        {worker.postSted || worker.locations?.[0] || 'Norge'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-0.5">
                      <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">Se profil</Text>
                      <ChevronRight size={15} color="#2E6641" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {users.length < total && !search ? (
          <Pressable
            onPress={() => setLimit((current) => current + PAGE_SIZE)}
            disabled={loadingMore}
            className={`mt-5 h-11 flex-row items-center justify-center gap-2 self-center rounded-full bg-[#2E6641] px-6 ${loadingMore ? 'opacity-70' : ''}`}
          >
            {loadingMore ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text className="text-[0.875rem] font-semibold text-white">{loadingMore ? 'Laster…' : 'Last flere'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
