import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
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
  return (
    <Pressable onPress={onPress} className={['mb-3 flex-row items-center gap-3 rounded-2xl border bg-white p-4', unread ? 'border-[#2E6641]' : 'border-[#E6E7E1]'].join(' ')}>
      <View className="relative h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
        {person?.avatarUrl ? <Image source={{ uri: person.avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-[#2E6641]">{initials(name)}</Text>}
        {unread ? <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#2E6641]" /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className={['flex-1 text-[0.9375rem] text-[#0B0B0B]', unread ? 'font-bold' : 'font-semibold'].join(' ')} numberOfLines={1}>{name}</Text>
          <Text className="text-[0.6875rem] text-[#9B9E96]">{formatTime(latest?.createdAt ?? chat.updatedAt)}</Text>
        </View>
        <Text className={['mt-1 text-[0.8125rem]', unread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'].join(' ')} numberOfLines={1}>{conversationPreview(chat)}</Text>
        {chat.serviceId?.title ? <Text className="mt-2 self-start rounded-md bg-[#EAF1E9] px-2 py-1 text-[0.6875rem] font-semibold text-[#2E6641]" numberOfLines={1}>{chat.serviceId.title}</Text> : null}
      </View>
      {unread ? <MessageCircle size={16} color="#2E6641" /> : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userId = user && typeof user === 'object' && '_id' in user && typeof user._id === 'string' ? user._id : null;
  const query = useMessages();

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster meldinger..." /></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste meldinger" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void query.refetch()} /></SafeAreaView>;
  if (!query.data?.length) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="px-4 pt-6"><Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">Meldinger</Text><Text className="mt-2 text-[1.9rem] font-bold text-[#0B0B0B]">Meldinger</Text><View className="mt-8"><EmptyState title="Du har ingen meldinger ennå." message="Når du starter en samtale, vises den her." /></View></View></SafeAreaView>;

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}><View className="mb-6"><Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">Meldinger</Text><Text className="mt-2 text-[1.9rem] font-bold text-[#0B0B0B]">Meldinger</Text></View><View>{query.data.map((chat) => <ConversationRow key={chat._id} chat={chat} userId={userId} onPress={() => router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId: chat._id } })} />)}</View></ScrollView></SafeAreaView>;
}
