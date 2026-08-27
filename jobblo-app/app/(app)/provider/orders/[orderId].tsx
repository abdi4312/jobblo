import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Archive, ArrowLeft, Camera, Check, CheckSquare, Clock, FileText, MessageCircle, Play, ShieldCheck, Star, Upload, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProviderOrder, useCreateProviderReviewMutation, useDeleteProviderEvidenceMutation, useMarkReadyForReviewMutation, useProviderChecklistMutation, useProviderEvidenceMutation, useProviderOrderReviews, useStartProviderJobMutation } from '../../../../src/hooks/useProviderOrder';
import { isDisputeEligibleOrderStatus } from '../../../../src/types/Dispute';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { Button } from '../../../../src/components/ui/Button';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { ProviderOrderHistoryItem } from '../../../../src/types/ProviderOrder';

const STATUS: Record<string, { label: string; tone: string; note: string }> = {
  awaiting_payment: { label: 'Venter på betaling', tone: 'bg-[#F4F6F0] text-[#63665F]', note: 'Oppdragsgiver har ikke betalt ennå. Du får beskjed så snart pengene er sikret.' },
  paid: { label: 'Betalt — klar til å starte', tone: 'bg-[#122A1C] text-white', note: 'Pengene er sikret hos Jobblo. Start jobben når du er klar.' },
  in_progress: { label: 'Jobb pågår', tone: 'bg-[#EAF1E9] text-[#2E6641]', note: 'Last opp bilder underveis, og meld fra når du er ferdig.' },
  ready_for_review: { label: 'Meldt ferdig', tone: 'bg-[#F4F6F0] text-[#63665F]', note: 'Oppdragsgiver går gjennom arbeidet. Utbetalingen skjer etter godkjenning.' },
  completed: { label: 'Fullført', tone: 'bg-[#EAF1E9] text-[#2E6641]', note: 'Jobben er godkjent. Utbetalingsstatusen håndteres separat.' },
  disputed: { label: 'Under tvist', tone: 'bg-[#122A1C] text-white', note: 'Utbetalingen står på vent til tvisten er avklart.' },
  refunded: { label: 'Refundert', tone: 'border border-[#E6E7E1] bg-white text-[#9B9E96]', note: 'Beløpet er tilbakeført til oppdragsgiver.' },
  cancelled: { label: 'Kansellert', tone: 'border border-[#E6E7E1] bg-white text-[#9B9E96]', note: 'Oppdraget er avlyst.' },
};

const HISTORY_LABELS: Record<string, string> = {
  contract_created: 'Kontrakt opprettet', payment_confirmed: 'Betaling bekreftet', job_started: 'Jobb startet', ready_for_review: 'Klar for gjennomgang', work_approved: 'Jobb godkjent', job_completed: 'Fullført', evidence_uploaded: 'Bevis lastet opp', evidence_removed: 'Bevis fjernet', dispute_opened: 'Tvist åpnet', payout_approved: 'Utbetaling godkjent',
};


type EvidenceType = 'before' | 'after';
interface UploadAsset { uri: string; name: string; type: string; size?: number }
const MAX_EVIDENCE_FILES = 10;
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error.response as { data?: { error?: string; message?: string } } | undefined)?.data;
    if (data?.error || data?.message) return data.error ?? data.message ?? fallback;
  }
  return fallback;
}

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name?: string) { return name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'; }

function Party({ label, name, avatarUrl }: { label: string; name: string; avatarUrl?: string }) {
  return <View className="flex-1 rounded-2xl bg-[#F4F6F0] p-3"><View className="mx-auto h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">{avatarUrl ? <Image source={{ uri: avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-[#2E6641]">{initials(name)}</Text>}</View><Text className="mt-2 text-center text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">{label}</Text><Text className="mt-1 text-center text-[0.8125rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>{name}</Text></View>;
}

function EvidenceGrid({ urls, type, canDelete, onDelete }: { urls: string[]; type: EvidenceType; canDelete: boolean; onDelete: (url: string, type: EvidenceType) => void }) {
  return <View className="flex-row flex-wrap gap-2">{urls.map((url, index) => <View key={`${url}-${index}`} className="relative h-24 w-[31%] overflow-hidden rounded-xl bg-[#F4F6F0]"><Image source={{ uri: url }} className="h-full w-full" resizeMode="cover" /><Text className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[0.5625rem] text-white">Bilde</Text>{canDelete ? <Pressable onPress={() => onDelete(url, type)} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"><X size={13} color="#FFFFFF" /></Pressable> : null}</View>)}</View>;
}

export default function ProviderOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('after');
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [completionNote, setCompletionNote] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const { data, isLoading, isError, error, refetch } = useProviderOrder(orderId ?? '');
  const startMutation = useStartProviderJobMutation(orderId ?? '');
  const checklistMutation = useProviderChecklistMutation(orderId ?? '');
  const evidenceMutation = useProviderEvidenceMutation(orderId ?? '');
  const deleteEvidenceMutation = useDeleteProviderEvidenceMutation(orderId ?? '');
  const readyMutation = useMarkReadyForReviewMutation(orderId ?? '');
  const { data: reviews = [] } = useProviderOrderReviews(orderId ?? '');
  const reviewMutation = useCreateProviderReviewMutation(orderId ?? '');

  const start = () => startMutation.mutate(undefined, { onError: (e) => Alert.alert('Kunne ikke starte jobben', errorMessage(e, 'Prøv igjen.')) });
  const toggleChecklist = (itemId: string, completed: boolean) => checklistMutation.mutate({ itemId, providerCompleted: !completed }, { onError: (e) => Alert.alert('Kunne ikke oppdatere sjekklisten', errorMessage(e, 'Prøv igjen.')) });
  const availableSlots = () => {
    const current = evidenceType === 'before' ? (data?.order.beforeImages ?? []).length : (data?.order.afterImages ?? []).length;
    return Math.max(0, MAX_EVIDENCE_FILES - current - assets.length);
  };
  const chooseAssets = async () => {
    const limit = availableSlots();
    if (!limit) {
      Alert.alert('Maks antall filer nådd', 'Du kan laste opp maksimalt 10 filer per type.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: 0.85 });
    if (!result.canceled) {
      const selected = result.assets.slice(0, limit).map((asset, index) => ({ uri: asset.uri, name: asset.fileName ?? `bevis-${Date.now()}-${index}.jpg`, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize }));
      setAssets((current) => [...current, ...selected]);
    }
  };
  const choosePdf = async () => {
    const limit = availableSlots();
    if (!limit) {
      Alert.alert('Maks antall filer nådd', 'Du kan laste opp maksimalt 10 filer per type.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], multiple: true, copyToCacheDirectory: true });
    if (!result.canceled) {
      const unsupported = result.assets.find((asset) => !ALLOWED_EVIDENCE_TYPES.includes(asset.mimeType ?? ''));
      if (unsupported) {
        Alert.alert('Filtype støttes ikke', 'Tillatte filer er JPEG, PNG, WebP og PDF.');
        return;
      }
      setAssets((current) => [...current, ...result.assets.slice(0, limit).map((asset) => ({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size }))]);
    }
  };
  const upload = () => {
    if (!assets.length && !completionNote.trim()) return;
    const oversized = assets.find((asset) => asset.size != null && asset.size > MAX_EVIDENCE_SIZE);
    if (oversized) {
      Alert.alert('Filen er for stor', 'Hver fil kan være maksimalt 10 MB.');
      return;
    }
    evidenceMutation.mutate({ evidenceType, files: assets, completionNote }, { onSuccess: () => { setAssets([]); setCompletionNote(''); }, onError: (e) => Alert.alert('Opplasting feilet', errorMessage(e, 'Prøv igjen.')) });
  };
  // Disputes live on their own screens (create + thread) so the enum values, limits and
  // eligibility rules stay in one place instead of being duplicated in this modal.
  const goToCreateDispute = () => router.push({ pathname: '/(app)/disputes/create', params: { orderId: orderId ?? '' } });
  const goToDisputeThread = () => router.push({ pathname: '/(app)/disputes/order/[orderId]', params: { orderId: orderId ?? '' } });

  if (isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster oppdrag..." /></SafeAreaView>;
  if (isError || !data?.order) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste oppdrag" message={errorMessage(error, 'Sjekk internettforbindelsen din og prøv igjen.')} actionLabel="Prøv igjen" onAction={() => void refetch()} /></SafeAreaView>;

  const { order, calculation, isProvider, activeDispute } = data;
  const status = order.status;
  const config = STATUS[status] ?? { label: status, tone: 'bg-[#F4F6F0] text-[#63665F]', note: '' };
  const canStart = isProvider && status === 'paid' && order.paymentStatus === 'paid' && !activeDispute;
  const canUpload = isProvider && (status === 'paid' || status === 'in_progress');
  const canReady = isProvider && status === 'in_progress' && !activeDispute;
  const canDispute = isProvider && !activeDispute && isDisputeEligibleOrderStatus(status);
  const before = order.beforeImages ?? [];
  const after = order.afterImages ?? [];
  const existingEvidenceCount = evidenceType === 'before' ? before.length : after.length;
  const providerName = `${order.providerId?.name ?? ''} ${order.providerId?.lastName ?? ''}`.trim();
  const customerName = `${order.customerId?.name ?? ''} ${order.customerId?.lastName ?? ''}`.trim();
  const reviewed = reviews.some((review) => review.revieweeRole === 'seeker');
  const history = [...(order.history ?? [])].sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    {/* No "Se kontrakt" link: /safepay/checkout is customer-only and its provider guard
        redirects straight back here, so the pair used to bounce the provider in a loop. */}
    <View className="mb-5 flex-row items-center"><Pressable onPress={() => router.back()} className="flex-row items-center gap-2"><ArrowLeft size={16} color="#63665F" /><Text className="text-[0.8125rem] text-[#63665F]">Tilbake</Text></Pressable></View>
    <View className="mb-4 rounded-2xl bg-[#122A1C] p-5"><View className="flex-row items-start justify-between gap-3"><View className="min-w-0 flex-1"><Text className="text-[1.125rem] font-bold text-white" numberOfLines={2}>{order.serviceId?.title ?? 'Oppdrag'}</Text><Text className="mt-1 text-[0.75rem] text-white/60">Kontrakt #JB-{order._id.substring(0, 8).toUpperCase()}</Text></View><View className="items-end"><Text className="text-[1.25rem] font-bold text-[#8FBF9A]">{order.agreedPrice?.toLocaleString('nb-NO')} kr</Text><Text className="text-[0.6875rem] text-white/60">Du mottar: {calculation.providerNet.toLocaleString('nb-NO')} kr</Text></View></View></View>
    <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><View className={['self-start rounded-full px-3 py-1.5', config.tone].join(' ')}><Text className="text-[0.75rem] font-semibold text-[#0B0B0B]">{config.label}</Text></View><Text className="mt-2.5 text-[0.875rem] leading-relaxed text-[#63665F]">{config.note}</Text>{activeDispute ? <Text className="mt-2 text-[0.8125rem] font-medium text-[#B4453A]">Tvist er åpnet — utbetalingen er fryst.</Text> : null}</View>
    <View className="mb-4 flex-row gap-3"><Party label="Oppdragsgiver" name={customerName} avatarUrl={order.customerId?.avatarUrl} /><Party label="Utfører" name={providerName} avatarUrl={order.providerId?.avatarUrl} /></View>
    <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-[#0B0B0B]">Oppdragsdetaljer</Text><Text className="border-b border-[#E6E7E1] py-2 text-[0.8125rem] text-[#63665F]">Sted: <Text className="font-medium text-[#0B0B0B]">{order.serviceId?.location?.city ?? 'Ikke angitt'}</Text></Text><Text className="border-b border-[#E6E7E1] py-2 text-[0.8125rem] text-[#63665F]">Avtalt pris: <Text className="font-medium text-[#0B0B0B]">{calculation.basePrice.toLocaleString('nb-NO')} kr</Text></Text><Text className="border-b border-[#E6E7E1] py-2 text-[0.8125rem] text-[#63665F]">Platform-gebyr 3%: <Text className="font-medium text-[#0B0B0B]">{calculation.fee.toLocaleString('nb-NO')} kr</Text></Text><Text className="py-2 text-[0.8125rem] text-[#63665F]">Betalingsstatus: <Text className="font-medium text-[#0B0B0B]">{order.paymentStatus === 'paid' ? 'Betalt' : 'Venter'}</Text></Text></View>
    {order.checklist?.length ? <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><View className="mb-3 flex-row items-center gap-2"><CheckSquare size={16} color="#2E6641" /><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Sjekkliste</Text></View>{order.checklist.map((item) => { const completed = item.providerCompleted ?? item.checked ?? false; const canToggle = isProvider && ['paid', 'in_progress', 'ready_for_review'].includes(status); return <Pressable key={item.id} disabled={!canToggle || checklistMutation.isPending} onPress={() => toggleChecklist(item.id, completed)} className={['mb-2 flex-row items-center gap-3 rounded-xl border p-3', completed ? 'border-[#C6F0D8] bg-[#EAF1E9]' : 'border-[#E6E7E1] bg-[#F4F6F0]'].join(' ')}><View className={['h-5 w-5 items-center justify-center rounded border', completed ? 'border-[#2E6641] bg-[#2E6641]' : 'border-[#9B9E96] bg-white'].join(' ')}>{completed ? <Check size={14} color="#FFFFFF" /> : null}</View><Text className="flex-1 text-[0.8125rem] text-[#0B0B0B]">{item.text}</Text>{item.customerConfirmed ? <Text className="text-[0.6875rem] text-[#2E6641]">Bekreftet</Text> : null}</Pressable>; })}</View> : null}
    {(canUpload || before.length || after.length) ? <View className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><View className="mb-3 flex-row items-center gap-2"><Camera size={16} color="#2E6641" /><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Arbeidsbevis</Text></View><View className="mb-3 flex-row gap-2"><Pressable onPress={() => { setEvidenceType('before'); setAssets([]); }} className={['flex-1 rounded-xl px-3 py-2.5', evidenceType === 'before' ? 'bg-[#2E6641]' : 'bg-[#F4F6F0]'].join(' ')}><Text className={evidenceType === 'before' ? 'text-center text-[0.8125rem] font-medium text-white' : 'text-center text-[0.8125rem] text-[#63665F]'}>Før arbeid ({before.length})</Text></Pressable><Pressable onPress={() => { setEvidenceType('after'); setAssets([]); }} className={['flex-1 rounded-xl px-3 py-2.5', evidenceType === 'after' ? 'bg-[#2E6641]' : 'bg-[#F4F6F0]'].join(' ')}><Text className={evidenceType === 'after' ? 'text-center text-[0.8125rem] font-medium text-white' : 'text-center text-[0.8125rem] text-[#63665F]'}>Etter arbeid ({after.length})</Text></Pressable></View><EvidenceGrid urls={evidenceType === 'before' ? before : after} type={evidenceType} canDelete={canUpload} onDelete={(url, type) => deleteEvidenceMutation.mutate({ url, evidenceType: type })} />{canUpload ? <><View className="mt-3 flex-row gap-2"><Button label="Velg bilder" onPress={() => void chooseAssets()} small icon={<Camera size={15} color="#FFFFFF" />} /><Button label="Velg PDF" onPress={() => void choosePdf()} small variant="secondary" icon={<FileText size={15} color="#0B0B0B" />} /></View>{assets.length ? <Text className="mt-2 text-[0.75rem] text-[#63665F]">{assets.length} fil(er) klare for opplasting</Text> : null}<TextInput value={completionNote} onChangeText={setCompletionNote} placeholder="Skriv et notat om arbeidet" placeholderTextColor="#9B9E96" multiline className="mt-3 min-h-[80px] rounded-xl border border-[#E6E7E1] bg-white p-3 text-[0.8125rem] text-[#0B0B0B]" /><Button label={evidenceMutation.isPending ? 'Laster opp...' : 'Last opp bevis'} onPress={upload} disabled={evidenceMutation.isPending || (!assets.length && !completionNote.trim())} fullWidth icon={<Upload size={15} color="#FFFFFF" />} /></> : <Text className="mt-3 rounded-xl bg-[#F4F6F0] p-3 text-[0.75rem] text-[#63665F]">Bilder er låst. Jobben er sendt til gjennomgang.</Text>}</View> : null}
    {canStart ? <Button label={startMutation.isPending ? 'Starter...' : 'Start jobben'} onPress={start} disabled={startMutation.isPending} fullWidth icon={<Play size={16} color="#FFFFFF" />} /> : null}{status === 'awaiting_payment' ? <View className="mb-4 rounded-2xl bg-[#F4F6F0] p-4"><Text className="text-[0.8125rem] text-[#63665F]">Oppdragsgiver har ikke betalt ennå. Du kan starte når betalingen er sikret.</Text></View> : null}{canReady ? <View className="mt-3"><Button label={readyMutation.isPending ? 'Meld­er ferdig...' : 'Meld jobben ferdig'} onPress={() => readyMutation.mutate(undefined, { onError: (e) => Alert.alert('Kunne ikke melde ferdig', errorMessage(e, 'Prøv igjen.')) })} disabled={readyMutation.isPending} fullWidth icon={<Check size={16} color="#FFFFFF" />} /></View> : null}{status === 'ready_for_review' ? <View className="mt-3 rounded-2xl bg-[#F4F6F0] p-4"><Text className="text-center text-[0.8125rem] text-[#63665F]">Oppdragsgiver går gjennom arbeidet. Utbetalingen skjer etter godkjenning.</Text></View> : null}
    <View className="mt-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-[#0B0B0B]">Historikk</Text>{history.length ? history.map((event: ProviderOrderHistoryItem, index) => <View key={`${event._id ?? event.action}-${index}`} className="mb-3 flex-row gap-3"><Clock size={14} color="#2E6641" /><View className="flex-1"><Text className="text-[0.8125rem] font-medium text-[#0B0B0B]">{HISTORY_LABELS[event.action ?? ''] ?? event.action}</Text><Text className="text-[0.6875rem] text-[#9B9E96]">{dateLabel(event.timestamp)}</Text></View></View>) : <Text className="text-[0.75rem] text-[#63665F]">Ingen historikk ennå.</Text>}</View>
    {canDispute ? <Pressable onPress={goToCreateDispute} className="mt-4 rounded-full border border-[#B4453A] px-4 py-3"><Text className="text-center text-[0.8125rem] font-semibold text-[#B4453A]">Noe gikk galt? Åpne tvist</Text></Pressable> : null}
    {activeDispute ? <View className="mt-4 rounded-2xl bg-[#FBF4F2] p-4"><Text className="text-center text-[0.8125rem] font-semibold text-[#B4453A]">Tvist pågår — Jobblo gjennomgår saken</Text><Text className="mt-1 text-center text-[0.75rem] text-[#63665F]">Start jobb og «meld ferdig» er låst til tvisten er avklart.</Text><Pressable onPress={goToDisputeThread} className="mt-2 rounded-full border border-[#B4453A] px-4 py-2.5"><Text className="text-center text-[0.8125rem] font-semibold text-[#B4453A]">Se tvist</Text></Pressable></View> : null}
    {status === 'completed' && !reviewed ? <View className="mt-4 rounded-2xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-[#0B0B0B]">Vurder oppdragsgiver</Text><View className="mb-3 flex-row gap-2">{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setReviewRating(value)}><Star size={28} color="#2E6641" fill={value <= reviewRating ? '#2E6641' : 'none'} /></Pressable>)}</View><TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Skriv en kommentar" placeholderTextColor="#9B9E96" multiline className="min-h-[70px] rounded-xl border border-[#E6E7E1] p-3 text-[0.8125rem]" /><Button label="Send vurdering" onPress={() => reviewMutation.mutate({ orderId: order._id, serviceId: order.serviceId?._id ?? '', revieweeId: order.customerId?._id ?? '', rating: reviewRating, comment: reviewComment })} disabled={!reviewRating || reviewMutation.isPending} fullWidth /></View> : null}
  </ScrollView></SafeAreaView>;
}
