import React, { useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, Check, CheckCircle2, FileText, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { useSafePayCheckout } from '../../../../src/hooks/useSafePayCheckout';
import { useApproveSafePayJobMutation, useCustomerChecklistMutation, useReviewPhotoUploadMutation } from '../../../../src/hooks/useApproval';
import { useProviderDispute } from '../../../../src/hooks/useProviderOrder';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { Button } from '../../../../src/components/ui/Button';
import { SafePayProgressSteps } from '../../../../src/components/domain/SafePayProgressSteps';

const STATUS: Record<string, { title: string; step: number; canApprove: boolean }> = {
  awaiting_payment: { title: 'Venter på betaling', step: 2, canApprove: false },
  paid: { title: 'har ikke startet jobben ennå', step: 3, canApprove: false },
  in_progress: { title: 'jobber med oppdraget nå', step: 3, canApprove: false },
  ready_for_review: { title: 'melder jobben som ferdig', step: 4, canApprove: true },
  completed: { title: 'Jobben er godkjent', step: 4, canApprove: false },
  disputed: { title: 'Oppdraget er under tvist', step: 4, canApprove: false },
  cancelled: { title: 'Oppdraget er kansellert', step: 2, canApprove: false },
};

const OPTIONAL_RATINGS = [
  { key: 'punctuality', label: 'Punktlighet' },
  { key: 'quality', label: 'Kvalitet' },
  { key: 'communication', label: 'Kommunikasjon' },
  { key: 'tidiness', label: 'Ryddighet' },
] as const;

type ReviewRatingKey = 'overall' | 'punctuality' | 'quality' | 'communication' | 'tidiness';
type ReviewRatings = Record<ReviewRatingKey, number>;
type Photo = { uri: string; name: string; type: string; size?: number };
type ApprovalResult = { title: string; message: string; warning?: boolean; providerNet?: number; };
const REVIEW_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_REVIEW_PHOTO_SIZE = 8 * 1024 * 1024;

function emptyRatings(): ReviewRatings { return { overall: 0, punctuality: 0, quality: 0, communication: 0, tidiness: 0 }; }
function idOf(value: unknown) { return typeof value === 'object' && value && '_id' in value && typeof value._id === 'string' ? value._id : null; }
function errorText(error: unknown) { if (typeof error === 'object' && error && 'response' in error) { const data = (error.response as { data?: { error?: string; message?: string } }).data; return data?.error ?? data?.message; } return undefined; }
function toPayloadRatings(ratings: ReviewRatings): { overall: number; punctuality?: number; quality?: number; communication?: number; tidiness?: number } {
  const payload: { overall: number; punctuality?: number; quality?: number; communication?: number; tidiness?: number } = { overall: ratings.overall };
  if (ratings.punctuality > 0) payload.punctuality = ratings.punctuality;
  if (ratings.quality > 0) payload.quality = ratings.quality;
  if (ratings.communication > 0) payload.communication = ratings.communication;
  if (ratings.tidiness > 0) payload.tidiness = ratings.tidiness;
  return payload;
}
function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label?: string }) {
  return (
    <View>
      {label ? <Text className="mb-2 text-[0.75rem] font-medium text-[#63665F]">{label}</Text> : null}
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)}>
            <Star size={26} color="#2E6641" fill={star <= value ? '#2E6641' : 'none'} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} className={['rounded-full bg-[#2E6641] px-5 py-3', disabled ? 'opacity-50' : ''].join(' ')}><Text className="text-center font-semibold text-white">{label}</Text></Pressable>; }

export default function SafePayApprovalScreen() {
  const router = useRouter();
  const rawId = useLocalSearchParams<{ orderId: string | string[] }>().orderId;
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = useAuthStore((state) => state.user);
  const query = useSafePayCheckout(orderId ?? '');
  const checklistMutation = useCustomerChecklistMutation(orderId ?? '');
  const approveMutation = useApproveSafePayJobMutation(orderId ?? '');
  const photoMutation = useReviewPhotoUploadMutation(orderId ?? '');
  const { data: dispute } = useProviderDispute(orderId ?? '');
  const activeDispute = !!dispute;
  const [ratings, setRatings] = useState<ReviewRatings>(emptyRatings());
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [recommendWorker, setRecommendWorker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null);

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster oppdrag..." /></SafeAreaView>;
  if (query.isError || !query.data?.order) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste oppdraget" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void query.refetch()} /></SafeAreaView>;

  const { order, calculation } = query.data;
  const currentUserId = idOf(user);
  const isCustomer = !!currentUserId && currentUserId === idOf(order.customerId);
  const status = STATUS[order.status] ?? { title: 'Status kan ikke godkjennes ennå', step: 2, canApprove: false };
  const completed = order.status === 'completed';
  const canEditChecklist = !activeDispute && ['paid', 'in_progress', 'ready_for_review'].includes(order.status);
  const canApprove = isCustomer && order.status === 'ready_for_review' && order.paymentStatus === 'paid' && !activeDispute;
  const beforeImages = order.beforeImages ?? [];
  const afterImages = order.afterImages ?? [];
  const hasAnyEvidence = Boolean(order.completionNote?.trim()) || beforeImages.length > 0 || afterImages.length > 0;

  if (!isCustomer) {
    return <SafeAreaView className="flex-1 justify-center bg-[#EFF0EA] px-4"><View className="rounded-3xl bg-white p-8"><Text className="text-center text-lg font-semibold">Ikke tilgang</Text><Text className="mt-2 text-center text-sm text-[#63665F]">Kun oppdragsgiver kan godkjenne en jobb og frigi betalingen.</Text></View></SafeAreaView>;
  }

  const choosePhotos = async () => {
    const remaining = 6 - photoUrls.length - photos.length;
    if (remaining <= 0) {
      Alert.alert('Maks antall bilder nådd', 'Du kan laste opp maksimalt 6 bilder.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.85 });
    if (!result.canceled) {
      const unsupported = result.assets.find((asset) => !REVIEW_PHOTO_TYPES.includes(asset.mimeType ?? 'image/jpeg'));
      if (unsupported) {
        Alert.alert('Bildetype støttes ikke', 'Tillatte bilder er JPEG, PNG og WebP.');
        return;
      }
      setPhotos((current) => [...current, ...result.assets.slice(0, remaining).map((asset, index) => ({ uri: asset.uri, name: asset.fileName ?? `review-${Date.now()}-${index}.jpg`, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize }))]);
    }
  };
  const uploadPhotos = () => {
    const oversized = photos.some((photo) => photo.size != null && photo.size > MAX_REVIEW_PHOTO_SIZE);
    if (oversized) {
      Alert.alert('Bildet er for stort', 'Hvert bilde kan være maksimalt 8 MB.');
      return;
    }
    photoMutation.mutate(photos, { onSuccess: (result) => { setPhotoUrls((current) => [...current, ...result.urls].slice(0, 6)); setPhotos([]); }, onError: (error) => Alert.alert('Bildeopplasting feilet', errorText(error) ?? 'Prøv igjen.') });
  };
  const openDocument = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
    Alert.alert('Kunne ikke åpne dokumentet', 'Denne filen kan ikke åpnes på denne enheten.');
  };
  const submit = () => {
    const payloadRatings = toPayloadRatings(ratings);
    approveMutation.mutate({ orderId: orderId ?? '', ratings: payloadRatings, comment: comment.slice(0, 1000), photos: photoUrls, recommendWorker }, {
      onSuccess: async (result) => {
        await query.refetch();
        setApprovalResult(result.payoutWarning ? { title: 'Godkjent — men utbetalingen stoppet', message: result.payoutWarning, warning: true } : { title: 'Jobben er godkjent', message: `Oppdraget er fullført og ${calculation.providerNet.toLocaleString('nb-NO')} kr er tilgjengelig for utfører.`, providerNet: calculation.providerNet });
      },
      onError: async (error) => {
        const refetched = await query.refetch();
        const nextStatus = refetched.data?.order?.status;
        if (nextStatus === 'completed') {
          setApprovalResult({ title: 'Jobben er godkjent', message: 'Oppdraget ble fullført av serveren. Du kan se oppsummeringen nedenfor.' });
          return;
        }
        Alert.alert('Godkjenning feilet', errorText(error) ?? 'Sjekk ordrestatus før du prøver igjen.');
      },
    });
  };
  const approve = () => {
    if (!canApprove || completed) return;
    if (!ratings.overall) return Alert.alert('Vurdering mangler', 'Vennligst gi en helhetlig vurdering (1-5 stjerner)');
    if ((order.checklist ?? []).length > 0 && !(order.checklist ?? []).every((item) => item.checked)) {
      return Alert.alert('Sjekkliste', 'Merk av alle sjekklist punktene, eller bekreft at du vil hoppe over sjekklisten.', [{ text: 'Avbryt' }, { text: 'Hopp over', onPress: submit }]);
    }
    submit();
  };

  if (approvalResult) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center gap-2"><ArrowLeft size={16} color="#63665F" /><Text className="text-sm text-[#63665F]">Tilbake</Text></Pressable>
          <View className="rounded-3xl bg-white p-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E9]">
              <CheckCircle2 size={22} color="#2E6641" />
            </View>
            <Text className="text-center text-[1.5rem] font-bold text-[#0B0B0B]">{approvalResult.title}</Text>
            <Text className="mt-3 text-center text-[0.875rem] leading-relaxed text-[#63665F]">{approvalResult.message}</Text>
            {approvalResult.warning ? (
              <View className="mt-4 rounded-2xl bg-[#F4F6F0] p-4">
                <Text className="text-center text-[0.8125rem] font-semibold text-[#122A1C]">Ikke utbetalt ennå</Text>
                <Text className="mt-2 text-center text-[0.75rem] text-[#63665F]">Utbetalingen stoppet, men oppdraget er godkjent og vi holder beløpet trygt.</Text>
              </View>
            ) : null}
            <View className="mt-6 gap-3">
              <Action label="Mine oppdrag" onPress={() => router.push({ pathname: '/(app)/my-applications', params: { tab: 'mine-sokere' } })} />
              <Action label="Tilbake til forsiden" onPress={() => router.push('/(app)')} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center gap-2"><ArrowLeft size={16} color="#63665F" /><Text className="text-sm text-[#63665F]">Tilbake</Text></Pressable>
        <SafePayProgressSteps currentStep={status.step} orderId={orderId} serviceId={order.serviceId?._id} />
        <View className="mb-4 rounded-2xl bg-white p-5"><Text className="font-semibold">Jobbstatus</Text><View className="mt-3 rounded-xl bg-[#EAF1E9] p-4"><Text className="font-bold text-[#2E6641]">{status.title}</Text><Text className="mt-1 text-xs text-[#63665F]">{order.serviceId?.title ?? 'Oppdrag'}</Text></View></View>
        <View className="mb-4 rounded-2xl bg-white p-5"><View className="flex-row items-center gap-3"><View className="h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E9]"><Text className="font-bold text-[#2E6641]">{order.providerId?.name?.[0] ?? '?'}</Text></View><View><Text className="text-xs uppercase text-[#9B9E96]">Oppdragstaker</Text><Text className="font-bold">{order.providerId?.name} {order.providerId?.lastName}</Text><Text className="text-xs text-[#63665F]">{order.providerId?.averageRating ? `${order.providerId.averageRating.toFixed(1)} av 5 stjerner` : 'Ingen vurderinger enda'}</Text></View></View></View>

        <View className="mb-4 rounded-2xl bg-white p-5">
          <View className="flex-row items-center gap-2"><Camera size={17} color="#2E6641" /><Text className="font-semibold">Arbeidsbevis / Proof of work</Text></View>
          {hasAnyEvidence ? (
            <View className="mt-4 gap-4">
              {order.completionNote?.trim() ? (
                <View className="rounded-xl bg-[#F4F6F0] p-4">
                  <Text className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">Ferdigstillingsnotat fra utfører</Text>
                  <Text className="text-sm leading-relaxed text-[#63665F]">{order.completionNote}</Text>
                </View>
              ) : null}

              {beforeImages.length > 0 ? (
                <View>
                  <Text className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">Før arbeid</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {beforeImages.map((asset, index) => (
                      <Pressable key={`before-${index}`} onPress={() => asset.toLowerCase().endsWith('.pdf') ? void openDocument(asset) : setSelectedImage(asset)} className="h-24 w-[31%] overflow-hidden rounded-xl bg-[#F4F6F0]">
                        {asset.toLowerCase().endsWith('.pdf') ? (
                          <View className="h-full w-full items-center justify-center bg-[#EAF1E9]">
                            <FileText size={24} color="#2E6641" />
                            <Text className="mt-1 text-[0.5625rem] text-[#2E6641]">PDF #{index + 1}</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: asset }} className="h-full w-full" resizeMode="cover" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {afterImages.length > 0 ? (
                <View>
                  <Text className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">Etter arbeid</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {afterImages.map((asset, index) => (
                      <Pressable key={`after-${index}`} onPress={() => asset.toLowerCase().endsWith('.pdf') ? void openDocument(asset) : setSelectedImage(asset)} className="h-24 w-[31%] overflow-hidden rounded-xl bg-[#F4F6F0]">
                        {asset.toLowerCase().endsWith('.pdf') ? (
                          <View className="h-full w-full items-center justify-center bg-[#EAF1E9]">
                            <FileText size={24} color="#2E6641" />
                            <Text className="mt-1 text-[0.5625rem] text-[#2E6641]">PDF #{index + 1}</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: asset }} className="h-full w-full" resizeMode="cover" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="mt-4 rounded-xl border border-dashed border-[#D6D9D2] bg-[#F4F6F0] p-6">
              <Text className="text-center text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen arbeidsbevis lastet opp</Text>
              <Text className="mt-2 text-center text-[0.75rem] leading-relaxed text-[#63665F]">
                {order.status === 'ready_for_review'
                  ? 'Utfører har ikke lastet opp bilder eller dokumentasjon. Du kan fortsatt godkjenne jobben hvis alt er i orden, eller åpne en tvist hvis du forventet bevis.'
                  : 'Utfører har ikke lastet opp bilder eller dokumentasjon ennå.'}
              </Text>
            </View>
          )}
        </View>

        {order.checklist?.length ? (
          <View className="mb-4 rounded-2xl bg-white p-5">
            <Text className="mb-3 font-semibold">Sjekkliste</Text>
            {order.checklist.map((item) => (
              <Pressable
                key={item.id}
                disabled={!canEditChecklist || checklistMutation.isPending}
                onPress={() => checklistMutation.mutate({ itemId: item.id, checked: !item.checked }, {
                  onError: async (error) => {
                    await query.refetch();
                    const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
                    Alert.alert(
                      'Sjekklisten kan ikke endres',
                      code === 'checklist_locked_by_dispute'
                        ? 'Sjekklisten er låst mens tvisten behandles.'
                        : 'Sjekklisten kan ikke endres for dette oppdraget nå.',
                    );
                  },
                })}
                className={['mb-2 flex-row items-center gap-3 rounded-xl p-3', canEditChecklist ? 'bg-[#F4F6F0]' : 'bg-[#F2F4EE] opacity-80'].join(' ')}
              >
                <View className={['h-5 w-5 rounded border', item.checked ? 'border-[#2E6641] bg-[#2E6641]' : 'border-[#9B9E96] bg-white'].join(' ')}>{item.checked ? <Check size={14} color="#FFFFFF" /> : null}</View>
                <Text className="flex-1 text-sm text-[#0B0B0B]">{item.text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!completed ? (
          <View className="mb-4 rounded-2xl bg-white p-5">
            <Text className="mb-2 font-semibold">Vurdering</Text>
            <Stars value={ratings.overall} onChange={(value) => setRatings((current) => ({ ...current, overall: value }))} label="Helhetlig opplevelse" />

            <View className="mt-4 space-y-4">
              {OPTIONAL_RATINGS.map((story) => (
                <View key={story.key} className="rounded-xl bg-[#F4F6F0] p-3">
                  <Stars value={ratings[story.key]} onChange={(value) => setRatings((current) => ({ ...current, [story.key]: value }))} label={story.label} />
                </View>
              ))}
            </View>

            <TextInput value={comment} onChangeText={(value) => setComment(value.slice(0, 1000))} placeholder="Kommentar" multiline className="mt-4 min-h-[80px] rounded-xl border border-[#E6E7E1] p-3" />
            <Text className="mt-1 text-right text-[0.6875rem] text-[#9B9E96]">{comment.length}/1000</Text>
            <Button label="Velg egne bilder" onPress={() => void choosePhotos()} small />
            {photos.length ? <Button label="Last opp bilder" onPress={uploadPhotos} disabled={photoMutation.isPending} small variant="secondary" /> : null}
            <View className="mt-4 flex-row items-center justify-between rounded-xl bg-[#F4F6F0] p-3">
              <Text className="text-sm font-medium text-[#0B0B0B]">Anbefal denne arbeidstaker</Text>
              <Switch value={recommendWorker} onValueChange={setRecommendWorker} />
            </View>
          </View>
        ) : null}

        {status.canApprove && order.paymentStatus === 'paid' && !activeDispute && !completed ? <Action label={approveMutation.isPending ? 'Godkjenner...' : `Godkjenn jobb og utbetal ${calculation.providerNet.toLocaleString('nb-NO')} kr`} onPress={approve} disabled={approveMutation.isPending} /> : null}
        {completed ? <View className="rounded-2xl bg-[#122A1C] p-5"><Text className="text-center font-bold text-white">Jobb allerede godkjent!</Text></View> : null}
        {activeDispute ? <Text className="mt-4 rounded-xl bg-[#FBF4F2] p-4 text-center text-sm font-semibold text-[#B4453A]">Tvist pågår — godkjenning og utbetaling er låst.</Text> : null}
      </ScrollView>

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/80 p-4" onPress={() => setSelectedImage(null)}>
          <Pressable className="w-full items-center justify-center" onPress={() => undefined}>
            {selectedImage ? <Image source={{ uri: selectedImage }} className="h-[70%] w-full rounded-2xl" resizeMode="contain" /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
