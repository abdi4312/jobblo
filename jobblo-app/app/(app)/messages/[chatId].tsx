import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Briefcase, Flag, MoreHorizontal, Send, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/authStore';
import { messageIdentity, upsertChatMessage, useChatDetail, useSendChatMessage } from '../../../src/hooks/useChatDetail';
import { getChatSocket } from '../../../src/services/chatSocket.service';
import { createChatContract, deleteChatForMe, submitChatReport, type ChatDetail, type ChatMessage, type MessageParticipant } from '../../../src/services/messages.service';
import { queryKeys } from '../../../src/queryKeys';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { Button } from '../../../src/components/ui/Button';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { DropdownMenu } from '../../../src/components/ui/DropdownMenu';
import { orderRouteForRole } from '../../../src/utils/orderRoute';
import { groupSystemMessages, isStatusGroup, type ChatItem } from '../../../src/utils/chatGrouping';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { TC, tc } from '../../../src/theme/colors';

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
function serverError(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; error?: string } } } | null)?.response?.data;
  return data?.message ?? data?.error;
}

/** One card for a run of system messages: the latest line, expandable to the whole run. */
function StatusCard({ items, onOpen }: { items: ChatMessage[]; onOpen: (orderId?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const latest = items[items.length - 1];
  const target = [...items].reverse().find((item) => item.systemData?.orderId)?.systemData?.orderId;
  return (
    <View className="my-2 rounded-2xl border border-line bg-surface px-4 py-3">
      <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">Oppdragsstatus</Text>
      {(expanded ? items : [latest]).map((item) => (
        <View key={messageKey(item)} className="mt-1.5 flex-row items-start gap-2">
          <Text className="flex-1 text-[0.875rem] leading-5 text-ink">{item.text || 'Status oppdatert'}</Text>
          <Text className="text-[0.8125rem] text-subtle">{formatTime(item.createdAt)}</Text>
        </View>
      ))}
      {items.length > 1 || target ? (
        <View className="mt-2.5 flex-row items-center justify-between">
          {items.length > 1 ? (
            <Pressable onPress={() => setExpanded((value) => !value)} hitSlop={8}>
              <Text className="text-[0.8125rem] font-semibold text-brand-text">{expanded ? 'Vis mindre' : `Vis alle (${items.length})`}</Text>
            </Pressable>
          ) : <View />}
          {target ? (
            <Pressable onPress={() => onOpen(target)} hitSlop={8}>
              <Text className="text-[0.8125rem] font-semibold text-brand-text">Se oppdrag ›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function JobContext({ chat, userId, onPress }: { chat: ChatDetail; userId: string | null; onPress: () => void }) {
  const service = chat.serviceId;
  const order = typeof chat.orderId === 'object' ? chat.orderId : null;
  const status = order?.status || chat.status;
  const isCustomer = service?.userId === userId;
  return (
    <Pressable onPress={onPress} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-tint">
        {service?.images?.[0] ? <Image source={{ uri: service.images[0] }} className="h-full w-full" /> : <Briefcase size={20} color={TC.brandText} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[0.875rem] font-semibold text-ink" numberOfLines={1}>{service?.title || 'Oppdrag'}</Text>
        {service?.categories?.length ? <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{service.categories.join(', ')}</Text> : null}
        {chat.agreedPrice != null ? <Text className="mt-1 text-[0.8125rem] font-semibold text-brand-text">Avtalt pris: {chat.agreedPrice.toLocaleString('nb-NO')} kr</Text> : service?.price != null ? <Text className="mt-1 text-[0.8125rem] font-semibold text-brand-text">{service.price.toLocaleString('nb-NO')} kr</Text> : null}
      </View>
      {status ? <View className="rounded-full bg-surface-2 px-2.5 py-1"><Text className="text-[0.6875rem] font-semibold text-muted">{STATUS_LABELS[status] || (order?.paymentStatus === 'paid' ? 'Betalt' : 'Forespørsel')}</Text></View> : null}
      <ShieldCheck size={16} color={isCustomer ? TC.brandText : tc('#63665F', 'muted')} />
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
  const listRef = useRef<FlatList<ChatItem<ChatMessage>>>(null);
  const [text, setText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    const socket = getChatSocket();
    let joined = false;
    const joinChat = () => {
      // On every REconnect, fetch what arrived while the socket was down.
      if (joined) void queryClient.invalidateQueries({ queryKey: queryKeys.chats.detail(chatId) });
      joined = true;
      socket.emit('join-chat', chatId);
    };
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
  const items = useMemo(() => groupSystemMessages(messages), [messages]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending || !chatId) return;
    sendMutation.mutate(trimmed, { onSuccess: () => { setText(''); setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50); } });
  };
  /** Opens the chat's order, or the one a system message points at. Customers land on checkout/status/approval, providers on their work page. */
  const openOrder = (targetId?: string) => {
    const orderId = targetId || idOf(chat?.orderId);
    if (!chat || !orderId) return;
    const order = typeof chat.orderId === 'object' && chat.orderId?._id === orderId ? chat.orderId : undefined;
    router.push(orderRouteForRole(orderId, chat.serviceId?.userId === userId, order ? order.status || chat.status : undefined, order?.paymentStatus));
  };

  const createContract = async () => {
    if (!chatId || creatingContract) return;
    try {
      setCreatingContract(true);
      await createChatContract(chatId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.chats.detail(chatId) });
    } catch (error) {
      Alert.alert('Kunne ikke opprette kontrakt', serverError(error) || 'Prøv igjen.');
    } finally {
      setCreatingContract(false);
    }
  };

  // "…" menu and its dialogs (shadcn-style DropdownMenu + ConfirmDialog, no native popups).
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'report' | 'delete' | 'reported' | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const openDialog = (kind: 'report' | 'delete') => {
    setDialogError(null);
    setDialog(kind);
  };
  const closeDialog = () => {
    if (dialogPending) return;
    setDialog(null);
    setDialogError(null);
  };

  const confirmDelete = async () => {
    try {
      setDialogPending(true);
      await deleteChatForMe(chatId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
      setDialog(null);
      router.back();
    } catch (error) {
      setDialogError(serverError(error) || 'Kunne ikke slette samtalen. Prøv igjen.');
    } finally {
      setDialogPending(false);
    }
  };

  const confirmReport = async () => {
    if (!chatId) return;
    try {
      setDialogPending(true);
      setReporting(true);
      const result = await submitChatReport(chatId, {
        scope: 'chat',
        reportType: 'other',
        title: 'Rapportering av samtale',
        description: 'Jeg rapporterer denne samtalen fordi den inkluderer uønsket eller upassende innhold som trenger vurdering av Jobblo.',
      });
      setReportMessage(result.message || 'Jobblo har mottatt rapporten og vil vurdere den.');
      setDialog('reported');
    } catch (error) {
      setDialogError(serverError(error) || 'Kunne ikke sende rapporten. Prøv igjen senere.');
    } finally {
      setDialogPending(false);
      setReporting(false);
    }
  };

  if (query.isLoading) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><LoadingIndicator variant="chat" message="Laster samtale..." /></SafeAreaView>;
  if (query.isError || !chat) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Samtale ikke funnet" message="Kunne ikke laste denne samtalen." actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;

  const other = chat.clientId?._id === userId ? chat.providerId : chat.clientId;
  // Same action bar as the web chat: only the job owner (customer) creates the contract and pays.
  const chatOrder = typeof chat.orderId === 'object' ? chat.orderId : null;
  const isCustomer = !!userId && chat.serviceId?.userId === userId;
  const chatReady = chat.status === 'agreed' || chat.agreedPrice != null || !!chat.orderId;
  const action = !isCustomer || !chat.serviceId || !chatReady ? null
    : !chat.orderId ? { label: creatingContract ? 'Oppretter kontrakt…' : 'Opprett kontrakt', onPress: () => void createContract() }
    : chatOrder?.paymentStatus !== 'paid' ? { label: 'Start fiks ferdig-betaling', onPress: () => openOrder() }
    : null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center gap-3 border-b border-line bg-surface px-4 py-3"><Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center"><ArrowLeft size={19} color={TC.ink} /></Pressable><View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-tint">{other?.avatarUrl ? <Image source={{ uri: other.avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-brand-text">{initials(nameOf(other))}</Text>}</View><Text className="flex-1 text-[1rem] font-semibold text-ink" numberOfLines={1}>{nameOf(other)}</Text>{reporting ? <ActivityIndicator size="small" color={TC.brandText} /> : null}<Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Flere valg" className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-2"><MoreHorizontal size={22} color={TC.ink} /></Pressable></View>
        {/* The job stays pinned under the header instead of scrolling away with the messages. */}
        <View className="border-b border-line bg-page px-4 pt-3"><JobContext chat={chat} userId={userId} onPress={() => openOrder()} /></View>
        {action ? <View className="border-b border-line bg-surface px-4 py-3"><Button label={action.label} onPress={action.onPress} disabled={creatingContract} fullWidth /></View> : null}
        <FlatList ref={listRef} data={items} keyExtractor={(item) => (isStatusGroup(item) ? item.key : messageKey(item))} contentContainerStyle={{ padding: 16, paddingBottom: 18, flexGrow: messages.length ? 0 : 1 }} onContentSizeChange={() => { if (!query.isFetchingNextPage) listRef.current?.scrollToEnd({ animated: false }); }} onScroll={(event) => { if (event.nativeEvent.contentOffset.y < 80 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} scrollEventThrottle={200} maintainVisibleContentPosition={{ minIndexForVisible: 1 }} ListEmptyComponent={<View className="flex-1 items-center justify-center"><Text className="text-[0.875rem] text-muted">Ingen meldinger i denne samtalen.</Text></View>} renderItem={({ item }) => { if (isStatusGroup(item)) return <StatusCard items={item.items} onOpen={openOrder} />; const own = idOf(item.senderId) === userId; return <View className={['mb-2 max-w-[82%] rounded-2xl px-4 py-3', own ? 'self-end rounded-br-md bg-brand' : 'self-start rounded-bl-md bg-surface'].join(' ')}><Text className={own ? 'text-[0.9375rem] leading-relaxed text-white' : 'text-[0.9375rem] leading-relaxed text-ink'}>{item.text || ''}</Text><Text className={['mt-1 text-[0.6875rem]', own ? 'text-white/70' : 'text-subtle'].join(' ')}>{formatTime(item.createdAt)}</Text></View>; }} />
        <View className="flex-row items-end gap-2 border-t border-line bg-surface px-4 py-3"><TextInput value={text} onChangeText={setText} placeholder="Skriv en melding..." placeholderTextColor={TC.placeholder} multiline className="max-h-28 min-h-[44px] flex-1 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[0.9375rem] text-ink" /><Pressable onPress={send} disabled={!text.trim() || sendMutation.isPending} className="h-11 w-11 items-center justify-center rounded-full bg-brand disabled:opacity-50"><Send size={17} color="#FFF" /></Pressable></View>
      </KeyboardAvoidingView>

      <DropdownMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        label={nameOf(other)}
        items={[
          { label: 'Rapporter samtale', icon: Flag, onPress: () => openDialog('report') },
          null,
          { label: 'Slett samtale', icon: Trash2, destructive: true, onPress: () => openDialog('delete') },
        ]}
      />
      {/* One dialog for "report?" and "sent": swapping two Modals at once fails on iOS. */}
      <ConfirmDialog
        visible={dialog === 'report' || dialog === 'reported'}
        title={dialog === 'reported' ? 'Rapport sendt' : 'Rapporter samtalen?'}
        message={dialog === 'reported' ? reportMessage : 'Rapporten sendes til Jobblo for vurdering. Bare den andre personen i samtalen blir markert som rapportert.'}
        confirmLabel={dialog === 'reported' ? 'OK' : 'Send rapport'}
        pendingLabel="Sender…"
        destructive={dialog === 'report'}
        hideCancel={dialog === 'reported'}
        isPending={dialogPending}
        errorMessage={dialogError}
        onConfirm={() => (dialog === 'reported' ? setDialog(null) : void confirmReport())}
        onClose={closeDialog}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Slette samtalen?"
        message="Samtalen fjernes fra listen din. Den andre personen beholder sin kopi."
        confirmLabel="Slett"
        pendingLabel="Sletter…"
        destructive
        isPending={dialogPending}
        errorMessage={dialogError}
        onConfirm={() => void confirmDelete()}
        onClose={closeDialog}
      />
    </SafeAreaView>
  );
}
