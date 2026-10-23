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
import { orderStatusLabel } from '../../../../src/constants/orderStatus';
import type { ProviderOrderHistoryItem } from '../../../../src/types/ProviderOrder';
import { TC, tc } from '../../../../src/theme/colors';

const STATUS: Record<string, { label: string; tone: string; note: string }> = {
  awaiting_payment: { label: 'Venter på betaling', tone: 'bg-surface-2 text-muted', note: 'Oppdragsgiver har ikke betalt ennå. Du får beskjed så snart pengene er sikret.' },
  paid: { label: 'Betalt — klar til å starte', tone: 'bg-brand-deep text-white', note: 'Pengene er sikret hos Jobblo. Start jobben når du er klar.' },
  in_progress: { label: 'Jobb pågår', tone: 'bg-tint text-brand-text', note: 'Last opp bilder underveis, og meld fra når du er ferdig.' },
  ready_for_review: { label: 'Meldt ferdig', tone: 'bg-surface-2 text-muted', note: 'Oppdragsgiver går gjennom arbeidet. Utbetalingen skjer etter godkjenning.' },
  completed: { label: 'Fullført', tone: 'bg-tint text-brand-text', note: 'Jobben er godkjent. Utbetalingsstatusen håndteres separat.' },
  disputed: { label: 'Under tvist', tone: 'bg-brand-deep text-white', note: 'Utbetalingen står på vent til tvisten er avklart.' },
  refunded: { label: 'Refundert', tone: 'border border-line bg-surface text-subtle', note: 'Beløpet er tilbakeført til oppdragsgiver.' },
  cancelled: { label: 'Kansellert', tone: 'border border-line bg-surface text-subtle', note: 'Oppdraget er avlyst.' },
};

const HISTORY_LABELS: Record<string, string> = {
  contract_created: 'Kontrakt opprettet', payment_confirmed: 'Betaling bekreftet', job_started: 'Jobb startet', ready_for_review: 'Klar for gjennomgang', work_approved: 'Jobb godkjent', job_completed: 'Fullført', evidence_uploaded: 'Bevis lastet opp', evidence_removed: 'Bevis fjernet', dispute_opened: 'Tvist åpnet', payout_approved: 'Utbetaling godkjent', provider_connect_timeout_refund_started: 'Kansellert — ikke startet innen fristen', provider_connect_timeout_refunded: 'Kunden fikk full refusjon',
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
  return <View className="flex-1 rounded-2xl bg-surface-2 p-3"><View className="mx-auto h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-tint">{avatarUrl ? <Image source={{ uri: avatarUrl }} className="h-full w-full" /> : <Text className="font-semibold text-brand-text">{initials(name)}</Text>}</View><Text className="mt-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-subtle">{label}</Text><Text className="mt-1 text-center text-[0.8125rem] font-semibold text-ink" numberOfLines={2}>{name}</Text></View>;
}

function EvidenceGrid({ urls, type, canDelete, onDelete }: { urls: string[]; type: EvidenceType; canDelete: boolean; onDelete: (url: string, type: EvidenceType) => void }) {
  return <View className="flex-row flex-wrap gap-2">{urls.map((url, index) => <View key={`${url}-${index}`} className="relative h-24 w-[31%] overflow-hidden rounded-xl bg-surface-2"><Image source={{ uri: url }} className="h-full w-full" resizeMode="cover" /><Text className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[0.6875rem] text-white">Bilde</Text>{canDelete ? <Pressable onPress={() => onDelete(url, type)} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"><X size={13} color={TC.surface} /></Pressable> : null}</View>)}</View>;
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
  const [connectRequired, setConnectRequired] = useState(false);
  const { data, isLoading, isError, error, refetch } = useProviderOrder(orderId ?? '');
  const startMutation = useStartProviderJobMutation(orderId ?? '');
  const checklistMutation = useProviderChecklistMutation(orderId ?? '');
  const evidenceMutation = useProviderEvidenceMutation(orderId ?? '');
  const deleteEvidenceMutation = useDeleteProviderEvidenceMutation(orderId ?? '');
  const readyMutation = useMarkReadyForReviewMutation(orderId ?? '');
  const { data: reviews = [] } = useProviderOrderReviews(orderId ?? '');
  const reviewMutation = useCreateProviderReviewMutation(orderId ?? '');

  const start = () => startMutation.mutate(undefined, {
    onSuccess: () => setConnectRequired(false),
    onError: (e) => {
      const code = typeof e === 'object' && e !== null && 'response' in e
        ? (e.response as { data?: { code?: string } } | undefined)?.data?.code
        : undefined;
      if (code === 'STRIPE_CONNECT_REQUIRED') {
        setConnectRequired(true);
        return;
      }
      Alert.alert('Kunne ikke starte jobben', errorMessage(e, 'Prøv igjen.'));
    },
  });
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

  if (isLoading) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><LoadingIndicator variant="detail" message="Laster oppdrag..." /></SafeAreaView>;
  if (isError || !data?.order) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Kunne ikke laste oppdrag" message={errorMessage(error, 'Sjekk internettforbindelsen din og prøv igjen.')} actionLabel="Prøv igjen" onAction={() => void refetch()} /></SafeAreaView>;

  const { order, calculation, isProvider, activeDispute } = data;
  const status = order.status;
  const config = STATUS[status] ?? { label: orderStatusLabel(status), tone: 'bg-surface-2 text-muted', note: '' };
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

  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    {/* No "Se kontrakt" link: /safepay/checkout is customer-only and its provider guard
        redirects straight back here, so the pair used to bounce the provider in a loop. */}
    {connectRequired ? <View className="mb-4 rounded-2xl border border-line bg-surface-2 p-4"><Text className="text-sm font-medium text-ink">Du må fullføre og verifisere Stripe Connect-kontoen din før du kan sende forespørsler eller starte oppdrag.</Text><Pressable onPress={() => router.push('/profile/settings/payout')} className="mt-3 rounded-full bg-brand px-4 py-3"><Text className="text-center text-sm font-semibold text-white">Fullfør Stripe Connect</Text></Pressable></View> : null}
    <View className="mb-5 flex-row items-center"><Pressable onPress={() => router.back()} className="flex-row items-center gap-2"><ArrowLeft size={16} color={tc('#63665F', 'muted')} /><Text className="text-[0.8125rem] text-muted">Tilbake</Text></Pressable></View>
    <View className="mb-4 rounded-2xl bg-brand-deep p-5"><View className="flex-row items-start justify-between gap-3"><View className="min-w-0 flex-1"><Text className="text-[1.125rem] font-bold text-white" numberOfLines={2}>{order.serviceId?.title ?? 'Oppdrag'}</Text><Text className="mt-1 text-[0.8125rem] text-white/60">Kontrakt #JB-{order._id.substring(0, 8).toUpperCase()}</Text></View><View className="items-end"><Text className="text-[1.25rem] font-bold text-[#8FBF9A]">{order.agreedPrice?.toLocaleString('nb-NO')} kr</Text><Text className="text-[0.8125rem] text-white/60">Du mottar: {calculation.providerNet.toLocaleString('nb-NO')} kr</Text></View></View></View>
    <View className="mb-4 rounded-2xl border border-line bg-surface p-5"><View className={['self-start rounded-full px-3 py-1.5', config.tone].join(' ')}><Text className="text-[0.8125rem] font-semibold text-ink">{config.label}</Text></View><Text className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">{status === 'cancelled' && order.cancellationReason === 'provider_stripe_connect_timeout' ? 'Du startet ikke oppdraget innen fristen, så det ble kansellert automatisk og kunden får full refusjon.' : config.note}</Text>{activeDispute ? <Text className="mt-2 text-[0.8125rem] font-medium text-danger">Tvist er åpnet — utbetalingen er fryst.</Text> : null}</View>
    {isProvider && status === 'paid' && order.providerConnectDeadlineAt ? <View className="mb-4 rounded-2xl border border-[#F1D9D5] bg-danger-tint p-4"><Text className="text-[0.8125rem] font-semibold text-danger">Start oppdraget innen {new Date(order.providerConnectDeadlineAt).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })}</Text><Text className="mt-1 text-[0.8125rem] leading-relaxed text-muted">Ellers kanselleres oppdraget automatisk og kunden får full refusjon.</Text></View> : null}
    {order.chatId ? <Pressable onPress={() => router.push({ pathname: '/(app)/messages/[chatId]', params: { chatId: order.chatId! } })} className="mb-4 flex-row items-center justify-between rounded-2xl border border-line bg-surface p-4"><View className="flex-row items-center gap-2"><MessageCircle size={17} color={TC.brandText} /><Text className="text-[0.875rem] font-medium text-ink">Åpne chat</Text></View><Text className="text-subtle">›</Text></Pressable> : null}
    <View className="mb-4 flex-row gap-3"><Party label="Oppdragsgiver" name={customerName} avatarUrl={order.customerId?.avatarUrl} /><Party label="Utfører" name={providerName} avatarUrl={order.providerId?.avatarUrl} /></View>
    <View className="mb-4 rounded-2xl border border-line bg-surface p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-ink">Oppdragsdetaljer</Text><Text className="border-b border-line py-2 text-[0.8125rem] text-muted">Sted: <Text className="font-medium text-ink">{order.serviceId?.location?.city ?? 'Ikke angitt'}</Text></Text><Text className="border-b border-line py-2 text-[0.8125rem] text-muted">Avtalt pris: <Text className="font-medium text-ink">{calculation.basePrice.toLocaleString('nb-NO')} kr</Text></Text><Text className="border-b border-line py-2 text-[0.8125rem] text-muted">Platform-gebyr 3%: <Text className="font-medium text-ink">{calculation.fee.toLocaleString('nb-NO')} kr</Text></Text><Text className="py-2 text-[0.8125rem] text-muted">Betalingsstatus: <Text className="font-medium text-ink">{order.paymentStatus === 'paid' ? 'Betalt' : 'Venter'}</Text></Text></View>
    {order.checklist?.length ? <View className="mb-4 rounded-2xl border border-line bg-surface p-5"><View className="mb-3 flex-row items-center gap-2"><CheckSquare size={16} color={TC.brandText} /><Text className="text-[0.9375rem] font-semibold text-ink">Sjekkliste</Text></View>{order.checklist.map((item) => { const completed = item.providerCompleted ?? item.checked ?? false; const canToggle = isProvider && ['paid', 'in_progress', 'ready_for_review'].includes(status); return <Pressable key={item.id} disabled={!canToggle || checklistMutation.isPending} onPress={() => toggleChecklist(item.id, completed)} className={['mb-2 flex-row items-center gap-3 rounded-xl border p-3', completed ? 'border-[#C6F0D8] bg-tint' : 'border-line bg-surface-2'].join(' ')}><View className={['h-5 w-5 items-center justify-center rounded border', completed ? 'border-brand-text bg-brand' : 'border-[#9B9E96] bg-surface'].join(' ')}>{completed ? <Check size={14} color={TC.surface} /> : null}</View><Text className="flex-1 text-[0.8125rem] text-ink">{item.text}</Text>{item.customerConfirmed ? <Text className="text-[0.8125rem] text-brand-text">Bekreftet</Text> : null}</Pressable>; })}</View> : null}
    {(canUpload || before.length || after.length) ? <View className="mb-4 rounded-2xl border border-line bg-surface p-5"><View className="mb-3 flex-row items-center gap-2"><Camera size={16} color={TC.brandText} /><Text className="text-[0.9375rem] font-semibold text-ink">Arbeidsbevis</Text></View><View className="mb-3 flex-row gap-2"><Pressable onPress={() => { setEvidenceType('before'); setAssets([]); }} className={['flex-1 rounded-xl px-3 py-2.5', evidenceType === 'before' ? 'bg-brand' : 'bg-surface-2'].join(' ')}><Text className={evidenceType === 'before' ? 'text-center text-[0.8125rem] font-medium text-white' : 'text-center text-[0.8125rem] text-muted'}>Før arbeid ({before.length})</Text></Pressable><Pressable onPress={() => { setEvidenceType('after'); setAssets([]); }} className={['flex-1 rounded-xl px-3 py-2.5', evidenceType === 'after' ? 'bg-brand' : 'bg-surface-2'].join(' ')}><Text className={evidenceType === 'after' ? 'text-center text-[0.8125rem] font-medium text-white' : 'text-center text-[0.8125rem] text-muted'}>Etter arbeid ({after.length})</Text></Pressable></View><EvidenceGrid urls={evidenceType === 'before' ? before : after} type={evidenceType} canDelete={canUpload} onDelete={(url, type) => deleteEvidenceMutation.mutate({ url, evidenceType: type })} />{canUpload ? <><View className="mt-3 flex-row gap-2"><Button label="Velg bilder" onPress={() => void chooseAssets()} small icon={<Camera size={15} color="#FFFFFF" />} /><Button label="Velg PDF" onPress={() => void choosePdf()} small variant="secondary" icon={<FileText size={15} color={TC.ink} />} /></View>{assets.length ? <Text className="mt-2 text-[0.8125rem] text-muted">{assets.length} fil(er) klare for opplasting</Text> : null}<TextInput value={completionNote} onChangeText={setCompletionNote} placeholder="Skriv et notat om arbeidet" placeholderTextColor={TC.placeholder} multiline className="mt-3 min-h-[80px] rounded-xl border border-line bg-surface p-3 text-[0.8125rem] text-ink" /><Button label={evidenceMutation.isPending ? 'Laster opp...' : 'Last opp bevis'} onPress={upload} disabled={evidenceMutation.isPending || (!assets.length && !completionNote.trim())} fullWidth icon={<Upload size={15} color="#FFFFFF" />} /></> : <Text className="mt-3 rounded-xl bg-surface-2 p-3 text-[0.8125rem] text-muted">Bilder er låst. Jobben er sendt til gjennomgang.</Text>}</View> : null}
    {canStart ? <Button label={startMutation.isPending ? 'Starter...' : 'Start jobben'} onPress={start} disabled={startMutation.isPending} fullWidth icon={<Play size={16} color="#FFFFFF" />} /> : null}{status === 'awaiting_payment' ? <View className="mb-4 rounded-2xl bg-surface-2 p-4"><Text className="text-[0.8125rem] text-muted">Oppdragsgiver har ikke betalt ennå. Du kan starte når betalingen er sikret.</Text></View> : null}{canReady ? <View className="mt-3"><Button label={readyMutation.isPending ? 'Meld­er ferdig...' : 'Meld jobben ferdig'} onPress={() => readyMutation.mutate(undefined, { onError: (e) => Alert.alert('Kunne ikke melde ferdig', errorMessage(e, 'Prøv igjen.')) })} disabled={readyMutation.isPending} fullWidth icon={<Check size={16} color="#FFFFFF" />} /></View> : null}{status === 'ready_for_review' ? <View className="mt-3 rounded-2xl bg-surface-2 p-4"><Text className="text-center text-[0.8125rem] text-muted">Oppdragsgiver går gjennom arbeidet. Utbetalingen skjer etter godkjenning.</Text></View> : null}
    <View className="mt-4 rounded-2xl border border-line bg-surface p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-ink">Historikk</Text>{history.length ? history.map((event: ProviderOrderHistoryItem, index) => <View key={`${event._id ?? event.action}-${index}`} className="mb-3 flex-row gap-3"><Clock size={14} color={TC.brandText} /><View className="flex-1"><Text className="text-[0.8125rem] font-medium text-ink">{HISTORY_LABELS[event.action ?? ''] ?? event.action}</Text><Text className="text-[0.8125rem] text-subtle">{dateLabel(event.timestamp)}</Text></View></View>) : <Text className="text-[0.8125rem] text-muted">Ingen historikk ennå.</Text>}</View>
    {canDispute ? <Pressable onPress={goToCreateDispute} className="mt-4 rounded-full border border-danger px-4 py-3"><Text className="text-center text-[0.8125rem] font-semibold text-danger">Noe gikk galt? Åpne tvist</Text></Pressable> : null}
    {activeDispute ? <View className="mt-4 rounded-2xl bg-danger-tint p-4"><Text className="text-center text-[0.8125rem] font-semibold text-danger">Tvist pågår — Jobblo gjennomgår saken</Text><Text className="mt-1 text-center text-[0.8125rem] text-muted">Start jobb og «meld ferdig» er låst til tvisten er avklart.</Text><Pressable onPress={goToDisputeThread} className="mt-2 rounded-full border border-danger px-4 py-2.5"><Text className="text-center text-[0.8125rem] font-semibold text-danger">Se tvist</Text></Pressable></View> : null}
    {status === 'completed' && !reviewed ? <View className="mt-4 rounded-2xl border border-line bg-surface p-5"><Text className="mb-3 text-[0.9375rem] font-semibold text-ink">Vurder oppdragsgiver</Text><View className="mb-3 flex-row gap-2">{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setReviewRating(value)}><Star size={28} color={TC.brandText} fill={value <= reviewRating ? TC.brandText : 'none'} /></Pressable>)}</View><TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Skriv en kommentar" placeholderTextColor={TC.placeholder} multiline className="min-h-[70px] rounded-xl border border-line p-3 text-[0.8125rem]" /><Button label="Send vurdering" onPress={() => reviewMutation.mutate({ orderId: order._id, serviceId: order.serviceId?._id ?? '', revieweeId: order.customerId?._id ?? '', rating: reviewRating, comment: reviewComment })} disabled={!reviewRating || reviewMutation.isPending} fullWidth /></View> : null}
  </ScrollView></SafeAreaView>;
}
