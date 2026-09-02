import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { MessagesSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { useMessages } from '../../../src/hooks/useMessages';
import type { MessageConversation, MessageParticipant } from '../../../src/services/messages.service';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../src/components/ui/ErrorState';

function participantName(participant?: MessageParticipant | null) {
  return participant?.name?.trim() || 'Bruker';
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function otherParticipant(chat: MessageConversation, userId?: string | null) {
  return chat.clientId?._id === userId ? chat.providerId : chat.clientId;
}

function hasUnread(chat: MessageConversation, userId?: string | null) {
  const latest = chat.messages?.[0];
  return Boolean(userId && latest?.senderId && String(typeof latest.senderId === 'string' ? latest.senderId : latest.senderId._id) !== userId && !latest.seenBy?.includes(userId));
}

function conversationPreview(chat: MessageConversation) {
  return chat.lastMessage?.trim() || chat.messages?.[0]?.text?.trim() || 'Ingen meldinger ennå';
}

function ConversationRow({ chat, userId, onPress }: { chat: MessageConversation; userId?: string | null; onPress: () => void }) {
  const person = otherParticipant(chat, userId);
  const name = participantName(person);
  const unread = hasUnread(chat, userId);
  const latest = chat.messages?.[0];
  const photo = chat.serviceId?.images?.[0] || chat.serviceId?.image || undefined;
  return (
    <Pressable onPress={onPress} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-white p-4">
      <View className="relative shrink-0">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#EAF1E9]">
          {photo ? (
            <Image source={{ uri: photo }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <MessagesSquare size={17} strokeWidth={2} color="#2E6641" />
          )}
        </View>
        <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EAF1E9]">
          {person?.avatarUrl ? (
            <Image source={{ uri: person.avatarUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-[0.625rem] font-semibold text-[#2E6641]">{(person?.name?.charAt(0) || 'U').toUpperCase()}</Text>
          )}
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className={['flex-1 text-[0.9375rem] text-[#0B0B0B]', unread ? 'font-bold' : 'font-semibold'].join(' ')} numberOfLines={1}>{name}</Text>
          <Text className="text-[0.6875rem] text-[#9B9E96]">{formatTime(latest?.createdAt ?? chat.updatedAt)}</Text>
        </View>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className={['flex-1 text-[0.8125rem]', unread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'].join(' ')} numberOfLines={1}>{conversationPreview(chat)}</Text>
          {unread ? <View className="h-2 w-2 shrink-0 rounded-full bg-[#2E6641]" /> : null}
        </View>
        {chat.serviceId?.title ? <Text className="mt-2 self-start rounded-md bg-[#EAF1E9] px-2 py-1 text-[0.6875rem] font-semibold text-[#2E6641]" numberOfLines={1}>{chat.serviceId.title}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userId = user && typeof user === 'object' && '_id' in user && typeof user._id === 'string' ? user._id : null;
  const query = useMessages();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await query.refetch(); } finally { setRefreshing(false); }
  };

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster meldinger..." /></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste meldinger" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void query.refetch()} /></SafeAreaView>;
  if (!query.data?.length) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="px-4 pt-6"><Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">Meldinger</Text><Text className="mt-2 text-[1.9rem] font-bold text-[#0B0B0B]">Meldinger</Text><View className="mt-8"><EmptyState title="Du har ingen meldinger ennå." message="Når du starter en samtale, vises den her." /></View></View></SafeAreaView>;

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" />}><View className="mb-6"><Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">Meldinger</Text><Text className="mt-2 text-[1.9rem] font-bold text-[#0B0B0B]">Meldinger</Text></View><View>{query.data.map((chat) => <ConversationRow key={chat._id} chat={chat} userId={userId} onPress={() => router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId: chat._id } })} />)}</View></ScrollView></SafeAreaView>;
}
