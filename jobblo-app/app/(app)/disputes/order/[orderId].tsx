import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Send } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { useAddDisputeMessageMutation, useDisputeByOrder } from '../../../../src/hooks/useDisputes';
import {
  DISPUTE_MESSAGE_MAX_LENGTH,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_REASON_LABELS,
  DISPUTE_ROLE_LABELS,
  DISPUTE_STATUS_LABELS,
  isDisputeActive,
  type DisputeOutcome,
  type DisputeRole,
  type DisputeStatus,
} from '../../../../src/types/Dispute';
import { disputeErrorMessage, httpStatus } from '../../../../src/utils/disputeError';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { Button } from '../../../../src/components/ui/Button';

const STATUS_TONE: Record<DisputeStatus, string> = {
  open: 'bg-[#FBF4F2] text-[#B4453A]',
  under_review: 'bg-[#FFF8E1] text-[#8B6914]',
  waiting_for_customer: 'bg-[#FFF8E1] text-[#8B6914]',
  waiting_for_provider: 'bg-[#FFF8E1] text-[#8B6914]',
  evidence_submitted: 'bg-[#EAF1E9] text-[#2E6641]',
  resolved: 'bg-[#EAF1E9] text-[#2E6641]',
  closed: 'bg-[#F4F6F0] text-[#63665F]',
  cancelled: 'bg-[#F4F6F0] text-[#63665F]',
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function roleLabel(role?: DisputeRole | string) {
  return DISPUTE_ROLE_LABELS[(role ?? 'system') as DisputeRole] ?? 'System';
}

function outcomeLabel(outcome?: string) {
  if (!outcome) return 'Avgjørelse registrert';
  return DISPUTE_OUTCOME_LABELS[outcome as DisputeOutcome] ?? outcome;
}

export default function DisputeThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const orderId = typeof rawOrderId === 'string' ? rawOrderId.trim() : '';
  const viewerId = useAuthStore((s) => (s.user && typeof s.user._id === 'string' ? (s.user._id as string) : null));

  const { data: dispute, isLoading, isError, error, refetch, isRefetching } = useDisputeByOrder(orderId);
  const messageMutation = useAddDisputeMessageMutation(orderId);
  const [draft, setDraft] = useState('');

  // Second line of defence: the API already filters internal admin notes, but a
  // malformed payload must never put one on screen.
  const messages = useMemo(
    () => (dispute?.messages ?? []).filter((m) => m && m.isInternal !== true),
    [dispute?.messages],
  );

  const trimmedDraft = draft.trim();
  const canSend = !!dispute?._id && trimmedDraft.length > 0 && !messageMutation.isPending;

  const sendMessage = () => {
    if (!canSend || !dispute?._id) return;
    messageMutation.mutate(
      { disputeId: dispute._id, message: trimmedDraft },
      {
        onSuccess: () => setDraft(''),
        onError: (e) => Alert.alert('Kunne ikke sende melding', disputeErrorMessage(e, 'Prøv igjen.')),
      },
    );
  };

  if (!orderId) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Mangler oppdrag"
          message="Vi fant ingen ordre-ID i lenken, så tvisten kan ikke åpnes."
          actionLabel="Tilbake"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster tvist..." />
      </SafeAreaView>
    );
  }

  if (isError) {
    const status = httpStatus(error);
    const forbidden = status === 403;
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title={forbidden ? 'Ingen tilgang' : 'Kunne ikke laste tvisten'}
          message={disputeErrorMessage(error, 'Prøv igjen om litt.')}
          actionLabel={forbidden ? 'Tilbake' : isRefetching ? 'Prøver...' : 'Prøv igjen'}
          onAction={forbidden ? () => router.back() : () => void refetch()}
        />
      </SafeAreaView>
    );
  }

  // 404 from the API means "no dispute on this order yet", not a failure.
  if (!dispute) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <View className="mx-4 my-8 rounded-3xl border border-[#E6E7E1] bg-white p-6">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen tvist på dette oppdraget</Text>
          <Text className="mt-1.5 text-[0.875rem] leading-relaxed text-[#63665F]">
            Det er ikke åpnet noen tvist her ennå. Du kan åpne en tvist hvis noe har gått galt med oppdraget.
          </Text>
          <View className="mt-4 gap-2">
            <Button
              label="Åpne tvist"
              onPress={() => router.push({ pathname: '/(app)/disputes/create', params: { orderId } })}
              fullWidth
            />
            <Button label="Tilbake" variant="secondary" onPress={() => router.back()} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel = DISPUTE_STATUS_LABELS[dispute.status] ?? dispute.status;
  const statusTone = STATUS_TONE[dispute.status] ?? 'bg-[#F4F6F0] text-[#63665F]';
  const reasonLabel = DISPUTE_REASON_LABELS[dispute.reasonCategory] ?? dispute.reasonCategory;
  const active = isDisputeActive(dispute.status);
  const openedLabel = dateLabel(dispute.openedAt ?? dispute.createdAt);

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <View className="flex-row items-center gap-3 border-b border-[#E6E7E1] bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tilbake">
          <ArrowLeft size={18} color="#63665F" />
        </Pressable>
        <Text className="flex-1 text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>Tvist</Text>
        <View className={['rounded-full px-3 py-1', statusTone].join(' ')}>
          <Text className="text-[0.6875rem] font-semibold">{statusLabel}</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5">
            <Text className="mb-1 text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={3}>{dispute.title}</Text>
            <Text className="mb-3 text-[0.75rem] text-[#63665F]">Kategori: {reasonLabel}</Text>
            <Text className="text-[0.8125rem] leading-relaxed text-[#0B0B0B]">{dispute.description}</Text>
            <View className="mt-3 flex-row flex-wrap items-center gap-x-2">
              {openedLabel ? <Text className="text-[0.6875rem] text-[#9B9E96]">Opprettet {openedLabel}</Text> : null}
              {dispute.openedByRole ? (
                <Text className="text-[0.6875rem] text-[#9B9E96]">· Åpnet av {roleLabel(dispute.openedByRole)}</Text>
              ) : null}
            </View>
          </View>

          {dispute.resolution ? (
            <View className="mb-4 rounded-2xl border border-[#C6E2CE] bg-[#EAF1E9] p-5">
              <Text className="mb-1 text-[0.875rem] font-semibold text-[#2E6641]">Avgjørelse</Text>
              <Text className="text-[0.8125rem] font-medium text-[#0B0B0B]">{outcomeLabel(dispute.resolution.outcome)}</Text>
              {dispute.resolution.reason ? (
                <Text className="mt-2 text-[0.8125rem] leading-relaxed text-[#63665F]">{dispute.resolution.reason}</Text>
              ) : null}
              {dispute.resolution.resolvedAt ? (
                <Text className="mt-2 text-[0.6875rem] text-[#63665F]">Avgjort {dateLabel(dispute.resolution.resolvedAt)}</Text>
              ) : null}
            </View>
          ) : null}

          <Text className="mb-2 px-1 text-[0.75rem] font-semibold uppercase tracking-wide text-[#63665F]">
            Meldinger ({messages.length})
          </Text>

          {messages.length === 0 ? (
            <View className="rounded-2xl border border-[#E6E7E1] bg-white p-5">
              <Text className="text-[0.8125rem] leading-relaxed text-[#63665F]">
                {active
                  ? 'Ingen meldinger ennå. Skriv den første meldingen nedenfor.'
                  : 'Det ble ikke sendt noen meldinger i denne tvisten.'}
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const senderId = typeof msg.senderId === 'string' ? msg.senderId : undefined;
              const isSystem = msg.senderRole === 'system';
              const isAdmin = msg.senderRole === 'admin';
              const isOwn = !isSystem && !isAdmin && !!viewerId && senderId === viewerId;

              if (isSystem) {
                return (
                  <View key={msg._id} className="mb-3 items-center">
                    <View className="rounded-full bg-[#E6E7E1] px-3 py-1.5">
                      <Text className="text-center text-[0.6875rem] text-[#63665F]">{msg.message}</Text>
                    </View>
                    <Text className="mt-1 text-[0.625rem] text-[#9B9E96]">{dateLabel(msg.createdAt)}</Text>
                  </View>
                );
              }

              return (
                <View key={msg._id} className={['mb-3', isOwn ? 'items-end' : 'items-start'].join(' ')}>
                  <View
                    className={[
                      'max-w-[88%] rounded-2xl border p-3',
                      isAdmin
                        ? 'border-[#D8C9A3] bg-[#FFF8E1]'
                        : isOwn
                          ? 'border-[#C6E2CE] bg-[#EAF1E9]'
                          : 'border-[#E6E7E1] bg-white',
                    ].join(' ')}
                  >
                    <Text
                      className={[
                        'mb-1 text-[0.6875rem] font-semibold',
                        isAdmin ? 'text-[#8B6914]' : isOwn ? 'text-[#2E6641]' : 'text-[#63665F]',
                      ].join(' ')}
                    >
                      {isOwn ? 'Deg' : roleLabel(msg.senderRole)}
                    </Text>
                    <Text className="text-[0.8125rem] leading-relaxed text-[#0B0B0B]">{msg.message}</Text>
                    <Text className="mt-1 text-[0.625rem] text-[#9B9E96]">{dateLabel(msg.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {active ? (
          <View className="border-t border-[#E6E7E1] bg-white px-4 pb-2 pt-3">
            <View className="flex-row items-end gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Skriv en melding..."
                placeholderTextColor="#9B9E96"
                multiline
                maxLength={DISPUTE_MESSAGE_MAX_LENGTH}
                textAlignVertical="top"
                editable={!messageMutation.isPending}
                className="max-h-[120px] min-h-[44px] flex-1 rounded-xl border border-[#E6E7E1] bg-[#F4F6F0] px-3 py-2.5 text-[0.8125rem] text-[#0B0B0B]"
              />
              <Pressable
                onPress={sendMessage}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send melding"
                className={['h-11 w-11 items-center justify-center rounded-full', canSend ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'].join(' ')}
              >
                <Send size={16} color={canSend ? '#FFFFFF' : '#9B9E96'} />
              </Pressable>
            </View>
            <Text className="mt-1 text-right text-[0.625rem] text-[#9B9E96]">
              {messageMutation.isPending ? 'Sender...' : `${draft.length}/${DISPUTE_MESSAGE_MAX_LENGTH}`}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 border-t border-[#E6E7E1] bg-white px-4 py-4">
            <Lock size={14} color="#63665F" />
            <Text className="flex-1 text-[0.8125rem] text-[#63665F]">Tvisten er avsluttet.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
