import React, { useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useBlockedUsers, useUnblockUser } from '../../../../src/hooks/useBlockedUsers';
import type { BlockedUser } from '../../../../src/services/users.service';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';

const PAGE_SIZE = 10;

function initials(user: BlockedUser) {
  return `${user.name?.trim()?.[0] || ''}${user.lastName?.trim()?.[0] || ''}`.toUpperCase() || 'U';
}

function displayName(user: BlockedUser) {
  return [user.name?.trim(), user.lastName?.trim()].filter(Boolean).join(' ') || 'Ukjent bruker';
}

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error || 'Kunne ikke oppheve blokkeringen. Prøv igjen.';
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const query = useBlockedUsers(page, PAGE_SIZE);
  const unblock = useUnblockUser();
  const users = query.data?.data || [];
  const totalPages = query.data?.pagination.totalPages || 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Opphev blokkering?',
      `${displayName(user)} vil kunne se deg og kontakte deg på Jobblo igjen. Brukeren blir ikke varslet.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Opphev blokkering',
          style: 'destructive',
          onPress: () => unblock.mutate(user._id, {
            onSuccess: (result) => {
              if (!result.isBlocked) Alert.alert('Blokkering opphevet');
            },
            onError: (error) => Alert.alert('Kunne ikke oppheve blokkeringen', errorMessage(error)),
          }),
        },
      ]
    );
  };

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster blokkerte brukere..." /></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste blokkerte brukere" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void query.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityLabel="Tilbake" className="h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color="#0B0B0B" />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Blokkerte brukere</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#2E6641" />}
      >
        <Text className="mb-5 text-[0.9375rem] leading-6 text-[#63665F]">
          Når du blokkerer noen, kan de ikke sende deg meldinger, følge deg eller like annonsene dine. Du vil heller ikke se varsler fra dem.
        </Text>
        {users.length ? users.map((user) => (
          <View key={user._id} className="mb-3 flex-row items-center rounded-2xl border border-[#E6E7E1] bg-white p-3">
            <Pressable onPress={() => router.push(`/profile/${user._id}`)} className="flex-1 flex-row items-center gap-3">
              <View className="relative h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[#E6E7E1] bg-[#EAF1E9]">
                {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-[#2E6641]">{initials(user)}</Text>}
                <View className="absolute bottom-0 right-0 h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#0B0B0B]"><Check size={9} color="#FFF" strokeWidth={4} /></View>
              </View>
              <Text className="flex-1 text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>{displayName(user)}</Text>
            </Pressable>
            <Pressable onPress={() => confirmUnblock(user)} disabled={unblock.isPending} className="ml-2 px-1 py-2 disabled:opacity-50">
              <Text className="text-[0.75rem] font-semibold text-[#B4544A]">{unblock.isPending ? '...' : 'Opphev'}</Text>
            </Pressable>
          </View>
        )) : <View className="flex-1 justify-center"><EmptyState title="Du har ikke blokkert noen brukere ennå" message="Blokkerte brukere vises her." /></View>}
        {totalPages > 1 ? <View className="mt-4 flex-row items-center justify-center border-t border-[#E6E7E1] pt-4"><Pressable onPress={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="p-2 disabled:opacity-30"><ChevronLeft size={20} color="#0B0B0B" /></Pressable><Text className="px-4 text-[0.8125rem] font-semibold text-[#63665F]">Side {page} av {totalPages}</Text><Pressable onPress={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="p-2 disabled:opacity-30"><ChevronRight size={20} color="#0B0B0B" /></Pressable></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
