import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Briefcase, Send, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/authStore';
import { messageIdentity, upsertChatMessage, useChatDetail, useSendChatMessage } from '../../../src/hooks/useChatDetail';
import { getChatSocket } from '../../../src/services/chatSocket.service';
import type { ChatDetail, ChatMessage, MessageParticipant } from '../../../src/services/messages.service';
import { queryKeys } from '../../../src/queryKeys';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { orderRouteForRole } from '../../../src/utils/orderRoute';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Fullført', ready_for_review: 'Meldt ferdig', in_progress: 'Pågår',
  awaiting_payment: 'Venter på betaling', accepted: 'Godtatt', pending: 'Ventende',
  cancelled: 'Kansellert', declined: 'Avslått',
};

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value && typeof value._id === 'string') return value._id;
  return null;
}
function nameOf(value?: MessageParticipant | null) { return value?.name?.trim() || 'Bruker'; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'; }
function formatTime(value?: string) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }); }
function messageKey(message: ChatMessage) { return message._id || `${message.createdAt || ''}:${message.text || ''}:${idOf(message.senderId) || ''}`; }
function isSystem(message: ChatMessage) { return message.type?.startsWith('system_'); }

function JobContext({ chat, userId, onPress }: { chat: ChatDetail; userId: string | null; onPress: () => void }) {
  const service = chat.serviceId;
  const order = typeof chat.orderId === 'object' ? chat.orderId : null;
  const status = order?.status || chat.status;
  const isCustomer = service?.userId === userId;
  return (
    <Pressable onPress={onPress} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-white p-3">
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#EAF1E9]">
        {service?.images?.[0] ? <Image source={{ uri: service.images[0] }} className="h-full w-full" /> : <Briefcase size={20} color="#2E6641" />}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{service?.title || 'Oppdrag'}</Text>
        {service?.categories?.length ? <Text className="mt-0.5 text-[0.6875rem] text-[#63665F]" numberOfLines={1}>{service.categories.join(', ')}</Text> : null}
        {service?.price != null ? <Text className="mt-1 text-[0.75rem] font-semibold text-[#2E6641]">{service.price.toLocaleString('nb-NO')} kr</Text> : null}
      </View>
      {status ? <View className="rounded-full bg-[#F4F6F0] px-2.5 py-1"><Text className="text-[0.625rem] font-semibold text-[#63665F]">{STATUS_LABELS[status] || (order?.paymentStatus === 'paid' ? 'Betalt' : 'Forespørsel')}</Text></View> : null}
      <ShieldCheck size={16} color={isCustomer ? '#2E6641' : '#63665F'} />
    </Pressable>
  );
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ chatId: string | string[] }>();
  const chatId = (Array.isArray(params.chatId) ? params.chatId[0] : params.chatId) || '';
  const user = useAuthStore((state) => state.user);
  const userId = user && typeof user === 'object' && '_id' in user && typeof user._id === 'string' ? user._id : null;
  const queryClient = useQueryClient();
  const query = useChatDetail(chatId);
  const sendMutation = useSendChatMessage(chatId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!chatId) return;
    const socket = getChatSocket();
    const joinChat = () => socket.emit('join-chat', chatId);
    const handleMessage = (data: { chatId: string; message: ChatMessage }) => {
      if (data.chatId !== chatId) return;
      queryClient.setQueryData(queryKeys.chats.detail(chatId), (current: { pages: ChatDetail[]; pageParams: unknown[] } | undefined) => upsertChatMessage(current, data.message));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    };
    const handleChatError = (data: { chatId?: string; error?: string }) => {
      if (__DEV__ && data.chatId === chatId) console.warn('[chat] room access failed:', data.error || 'unknown error');
    };
    socket.on('connect', joinChat);
    socket.on('receive-message', handleMessage);
    socket.on('chat-error', handleChatError);
    if (socket.connected) joinChat();
    return () => { socket.emit('leave-chat', chatId); socket.off('connect', joinChat); socket.off('receive-message', handleMessage); socket.off('chat-error', handleChatError); };
  }, [chatId, queryClient]);

  const chat = query.data?.pages[0];
  const messages = useMemo(() => {
    const pages = query.data?.pages.slice().reverse().flatMap((page) => page.messages) || [];
    const seen = new Set<string>();
    return pages.filter((message) => { const key = messageIdentity(message); if (seen.has(key)) return false; seen.add(key); return true; });
  }, [query.data?.pages]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending || !chatId) return;
    sendMutation.mutate(trimmed, { onSuccess: () => { setText(''); setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50); } });
  };
  const openOrder = () => {
    if (!chat?.orderId) return;
    const orderId = idOf(chat.orderId);
    if (!orderId) return;
    const order = typeof chat.orderId === 'object' ? chat.orderId : undefined;
    router.push(orderRouteForRole(orderId, chat.serviceId?.userId === userId, order?.status || chat.status, order?.paymentStatus));
  };

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6641" /><Text className="mt-3 text-[#63665F]">Laster samtale...</Text></View></SafeAreaView>;
  if (query.isError || !chat) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Samtale ikke funnet" message="Kunne ikke laste denne samtalen." actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;

  const other = chat.clientId?._id === userId ? chat.providerId : chat.clientId;
  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center gap-3 border-b border-[#E6E7E1] bg-white px-4 py-3"><Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center"><ArrowLeft size={19} color="#0B0B0B" /></Pressable><View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">{other?.avatarUrl ? <Image source={{ uri: other.avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-[#2E6641]">{initials(nameOf(other))}</Text>}</View><Text className="flex-1 text-[1rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{nameOf(other)}</Text></View>
        <FlatList ref={listRef} data={messages} keyExtractor={messageKey} contentContainerStyle={{ padding: 16, paddingBottom: 18, flexGrow: messages.length ? 0 : 1 }} onContentSizeChange={() => { if (!query.isFetchingNextPage) listRef.current?.scrollToEnd({ animated: false }); }} onScroll={(event) => { if (event.nativeEvent.contentOffset.y < 80 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} scrollEventThrottle={200} maintainVisibleContentPosition={{ minIndexForVisible: 1 }} ListHeaderComponent={<JobContext chat={chat} userId={userId} onPress={openOrder} />} ListEmptyComponent={<View className="flex-1 items-center justify-center"><Text className="text-[0.875rem] text-[#63665F]">Ingen meldinger i denne samtalen.</Text></View>} renderItem={({ item }) => { const own = idOf(item.senderId) === userId; if (isSystem(item)) return <View className="my-2 rounded-full bg-[#F4F6F0] px-4 py-2"><Text className="text-center text-[0.75rem] text-[#63665F]">{item.text || 'Status oppdatert'}</Text></View>; return <View className={['mb-2 max-w-[82%] rounded-2xl px-4 py-3', own ? 'self-end rounded-br-md bg-[#2E6641]' : 'self-start rounded-bl-md bg-white'].join(' ')}><Text className={own ? 'text-[0.9375rem] leading-relaxed text-white' : 'text-[0.9375rem] leading-relaxed text-[#0B0B0B]'}>{item.text || ''}</Text><Text className={['mt-1 text-[0.625rem]', own ? 'text-white/70' : 'text-[#9B9E96]'].join(' ')}>{formatTime(item.createdAt)}</Text></View>; }} />
        <View className="flex-row items-end gap-2 border-t border-[#E6E7E1] bg-white px-4 py-3"><TextInput value={text} onChangeText={setText} placeholder="Skriv en melding..." placeholderTextColor="#9B9E96" multiline className="max-h-28 min-h-[44px] flex-1 rounded-2xl border border-[#E6E7E1] bg-[#F4F6F0] px-4 py-3 text-[0.9375rem] text-[#0B0B0B]" /><Pressable onPress={send} disabled={!text.trim() || sendMutation.isPending} className="h-11 w-11 items-center justify-center rounded-full bg-[#2E6641] disabled:opacity-50"><Send size={17} color="#FFF" /></Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
