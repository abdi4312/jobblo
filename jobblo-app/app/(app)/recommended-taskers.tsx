import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTopUsers } from '../../src/hooks/useTopUsers';
import { useProfile } from '../../src/hooks/useProfile';
import { ErrorState } from '../../src/components/ui/ErrorState';

const PAGE_SIZE = 12;

function initials(name?: string, lastName?: string) {
  return `${name?.trim()?.[0] || ''}${lastName?.trim()?.[0] || ''}`.toUpperCase() || 'U';
}

export default function RecommendedTaskersScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const query = useTopUsers({
    page: 1,
    limit,
    postNumber: typeof profile?.postNumber === 'string' ? profile.postNumber : '',
    postSted: typeof profile?.postSted === 'string' ? profile.postSted : '',
    address: typeof profile?.address === 'string' ? profile.address : '',
  });
  const users = query.data?.data || [];
  const total = query.data?.pagination?.total || users.length;

  const refresh = async () => {
    setRefreshing(true);
    try { await query.refetch(); } finally { setRefreshing(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Tilbake" className="h-10 w-10 items-center justify-center"><ArrowLeft size={20} color="#0B0B0B" /></Pressable>
        <View className="ml-2 flex-1"><Text className="text-lg font-semibold text-[#0B0B0B]">Anbefalte oppdragstakere</Text><Text className="mt-0.5 flex-row text-xs text-[#63665F]">{profile?.postSted ? `Oppdragstakere nær ${profile.postSted}` : 'Oppdragstakere nær deg'}</Text></View>
        {query.data?.pagination ? <Text className="text-xs text-[#63665F]">{users.length} av {total}</Text> : null}
      </View>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState title="Kunne ikke laste oppdragstakere" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void query.refetch()} /> : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#2E6641" />} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {users.length === 0 ? <View className="rounded-2xl border border-[#E6E7E1] bg-white p-8"><Text className="text-center text-sm text-[#63665F]">Ingen oppdragstakere funnet.</Text></View> : users.map((worker) => {
            const name = `${worker.name || ''} ${worker.lastName || ''}`.trim() || 'Oppdragstaker';
            return <Pressable key={worker._id} onPress={() => router.push({ pathname: '/(app)/profile/[userId]', params: { userId: worker._id } })} className="mb-3 flex-row items-center rounded-2xl border border-[#E6E7E1] bg-white p-4"><View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">{worker.avatarUrl ? <Image source={{ uri: worker.avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-[#2E6641]">{initials(worker.name, worker.lastName)}</Text>}</View><View className="ml-3 flex-1"><Text className="text-sm font-semibold text-[#0B0B0B]" numberOfLines={1}>{name}</Text><Text className="mt-0.5 text-xs text-[#63665F]" numberOfLines={1}>{worker.skills?.slice(0, 3).join(' · ') || 'Oppdragstaker'}</Text><View className="mt-1 flex-row items-center"><Star size={12} color="#2E6641" fill="#2E6641" /><Text className="ml-1 text-xs font-semibold text-[#0B0B0B]">{Number(worker.averageRating || 0).toFixed(1)}</Text><Text className="ml-1 text-xs text-[#63665F]">({worker.reviewCount || 0} anmeldelser)</Text></View><View className="mt-1 flex-row items-center"><Text className="text-xs text-[#0B0B0B]">{worker.hourlyRate ? `${worker.hourlyRate} kr/t` : 'Tilgjengelig'}</Text><Text className="mx-1 text-xs text-[#9B9E96]">·</Text><MapPin size={11} color="#63665F" /><Text className="ml-1 flex-1 text-xs text-[#63665F]" numberOfLines={1}>{worker.postSted || worker.locations?.[0] || 'Norge'}</Text></View></View></Pressable>;
          })}
          {users.length < total ? <Pressable onPress={() => setLimit((current) => current + PAGE_SIZE)} className="self-center rounded-full bg-[#2E6641] px-6 py-3"><Text className="text-sm font-semibold text-white">Last flere</Text></Pressable> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Loading() {
  return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#2E6641" /><Text className="mt-3 text-sm text-[#63665F]">Laster oppdragstakere...</Text></View>;
}
