import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ShieldAlert } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFetchDisputeByOrder, useOpenDisputeMutation } from '../../../src/hooks/useDisputes';
import { useProviderOrder } from '../../../src/hooks/useProviderOrder';
import {
  DISPUTE_DESCRIPTION_MAX_LENGTH,
  DISPUTE_REASON_CATEGORIES,
  DISPUTE_REASON_LABELS,
  DISPUTE_TITLE_MAX_LENGTH,
  isDisputeEligibleOrderStatus,
  isDisputeReasonCategory,
  type DisputeReasonCategory,
} from '../../../src/types/Dispute';
import { disputeErrorMessage, httpStatus, isDuplicateDisputeError } from '../../../src/utils/disputeError';
import { Button } from '../../../src/components/ui/Button';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../src/components/ui/ErrorState';

function orderErrorMessage(error: unknown) {
  const status = httpStatus(error);
  if (status === 403) return 'Du har ikke tilgang til dette oppdraget.';
  if (status === 404) return 'Oppdraget ble ikke funnet.';
  if (status === undefined) return 'Ingen nettverksforbindelse. Sjekk tilkoblingen og prøv igjen.';
  return 'Kunne ikke laste oppdraget. Prøv igjen om litt.';
}

export default function CreateDisputeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const orderId = typeof rawOrderId === 'string' ? rawOrderId.trim() : '';

  const { data, isLoading, isError, error, refetch, isRefetching } = useProviderOrder(orderId);
  const openDisputeMutation = useOpenDisputeMutation(orderId);
  const fetchDisputeByOrder = useFetchDisputeByOrder();

  const [reasonCategory, setReasonCategory] = useState<DisputeReasonCategory | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const validCategory = isDisputeReasonCategory(reasonCategory);
  const formValid = validCategory && trimmedTitle.length > 0 && trimmedDescription.length > 0;

  const openThread = () => router.replace({ pathname: '/(app)/disputes/order/[orderId]', params: { orderId } });

  const submit = () => {
    // No orderId means no endpoint to call — bail before touching the API.
    if (!orderId) {
      Alert.alert('Mangler oppdrag', 'Vi fant ingen ordre-ID, så tvisten kan ikke opprettes.');
      return;
    }
    const category = isDisputeReasonCategory(reasonCategory) ? reasonCategory : null;
    if (!category) {
      Alert.alert('Velg en kategori', 'Du må velge hva tvisten handler om.');
      return;
    }
    if (!trimmedTitle) {
      Alert.alert('Tittel mangler', 'Skriv en kort tittel for tvisten.');
      return;
    }
    if (!trimmedDescription) {
      Alert.alert('Beskrivelse mangler', 'Beskriv hva som har skjedd.');
      return;
    }
    if (openDisputeMutation.isPending) return;

    openDisputeMutation.mutate(
      { reasonCategory: category, title: trimmedTitle, description: trimmedDescription },
      {
        onSuccess: openThread,
        onError: async (e) => {
          // The order already has an active dispute: open the real one instead of
          // inventing an id. If the refetch turns up nothing, just explain it.
          if (isDuplicateDisputeError(e)) {
            try {
              const existing = await fetchDisputeByOrder(orderId);
              if (existing?._id) {
                openThread();
                return;
              }
            } catch {
              // fall through to the message below
            }
            Alert.alert('Tvist finnes allerede', 'Det finnes allerede en aktiv tvist for dette oppdraget.');
            return;
          }
          Alert.alert('Kunne ikke opprette tvist', disputeErrorMessage(e, 'Prøv igjen om litt.'));
        },
      },
    );
  };

  if (!orderId) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Mangler oppdrag"
          message="Vi fant ingen ordre-ID i lenken. Åpne tvisten fra oppdraget ditt."
          actionLabel="Tilbake"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster oppdrag..." />
      </SafeAreaView>
    );
  }

  if (isError || !data?.order) {
    const forbidden = httpStatus(error) === 403;
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title={forbidden ? 'Ingen tilgang' : 'Kunne ikke laste oppdrag'}
          message={orderErrorMessage(error)}
          actionLabel={forbidden ? 'Tilbake' : isRefetching ? 'Prøver...' : 'Prøv igjen'}
          onAction={forbidden ? () => router.back() : () => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const { order, activeDispute } = data;
  const serviceTitle = order.serviceId?.title ?? 'Oppdrag';
  const amount = typeof order.agreedPrice === 'number' ? order.agreedPrice.toLocaleString('nb-NO') : '—';
  const eligible = isDisputeEligibleOrderStatus(order.status);

  // The server carries the authoritative flag; the client only avoids offering a
  // form the API is guaranteed to reject.
  if (activeDispute) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <View className="mx-4 my-8 rounded-3xl border border-[#E6E7E1] bg-white p-6">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Tvist finnes allerede</Text>
          <Text className="mt-1.5 text-[0.875rem] leading-relaxed text-[#63665F]">
            Det finnes allerede en aktiv tvist for dette oppdraget. Fortsett i den eksisterende tvisten.
          </Text>
          <View className="mt-4 gap-2">
            <Button label="Se tvist" onPress={openThread} fullWidth />
            <Button label="Tilbake" variant="secondary" onPress={() => router.back()} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!eligible) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Tvist kan ikke åpnes nå"
          message="Tvist kan bare åpnes etter at betalingen er sikret i SafePay, og før oppdraget er avsluttet."
          actionLabel="Tilbake"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center gap-2" hitSlop={8}>
            <ArrowLeft size={16} color="#63665F" />
            <Text className="text-[0.8125rem] text-[#63665F]">Tilbake</Text>
          </Pressable>

          <View className="mb-4 rounded-2xl bg-[#FBF4F2] p-5">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F2D5D0]">
                <ShieldAlert size={18} color="#B4453A" />
              </View>
              <View className="flex-1">
                <Text className="text-[0.9375rem] font-semibold text-[#B4453A]">Åpne tvist</Text>
                <Text className="text-[0.75rem] leading-relaxed text-[#63665F]">
                  Jobblo gjennomgår saken og kontakter begge parter. Betalingen holdes tilbake til tvisten er avgjort.
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5">
            <Text className="mb-1 text-[0.8125rem] font-medium text-[#0B0B0B]" numberOfLines={2}>{serviceTitle}</Text>
            <Text className="text-[0.75rem] text-[#63665F]">Avtalt beløp: {amount} kr</Text>
          </View>

          <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5">
            <Text className="mb-1 text-[0.9375rem] font-semibold text-[#0B0B0B]">Hva handler tvisten om?</Text>
            <Text className="mb-3 text-[0.75rem] text-[#63665F]">Velg kategorien som passer best.</Text>
            {DISPUTE_REASON_CATEGORIES.map((reason) => {
              const selected = reasonCategory === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setReasonCategory(reason)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={['mb-2 flex-row items-center justify-between rounded-xl border p-3', selected ? 'border-[#2E6641] bg-[#EAF1E9]' : 'border-[#E6E7E1]'].join(' ')}
                >
                  <Text className={['flex-1 text-[0.8125rem]', selected ? 'font-medium text-[#2E6641]' : 'text-[#0B0B0B]'].join(' ')}>
                    {DISPUTE_REASON_LABELS[reason]}
                  </Text>
                  {selected ? <Check size={16} color="#2E6641" /> : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5">
            <Text className="mb-3 text-[0.9375rem] font-semibold text-[#0B0B0B]">Detaljer</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Kort tittel"
              placeholderTextColor="#9B9E96"
              maxLength={DISPUTE_TITLE_MAX_LENGTH}
              editable={!openDisputeMutation.isPending}
              className="rounded-xl border border-[#E6E7E1] p-3 text-[0.8125rem] text-[#0B0B0B]"
            />
            <Text className="mb-3 mt-1 text-right text-[0.6875rem] text-[#9B9E96]">
              {title.length}/{DISPUTE_TITLE_MAX_LENGTH}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Beskriv hva som har skjedd"
              placeholderTextColor="#9B9E96"
              multiline
              maxLength={DISPUTE_DESCRIPTION_MAX_LENGTH}
              textAlignVertical="top"
              editable={!openDisputeMutation.isPending}
              className="min-h-[120px] rounded-xl border border-[#E6E7E1] p-3 text-[0.8125rem] text-[#0B0B0B]"
            />
            <Text className="mt-1 text-right text-[0.6875rem] text-[#9B9E96]">
              {description.length}/{DISPUTE_DESCRIPTION_MAX_LENGTH}
            </Text>
          </View>

          <Button
            label={openDisputeMutation.isPending ? 'Åpner tvist...' : 'Åpne tvist'}
            onPress={submit}
            disabled={openDisputeMutation.isPending || !formValid}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
