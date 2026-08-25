import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, RefreshCcw, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCancelSubscription, useCurrentSubscription, useResumeSubscription } from '../../../../src/hooks/useSubscription';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { CurrentSubscription } from '../../../../src/services/subscription.service';

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function status(subscription: CurrentSubscription) {
  if (subscription.cancelAtPeriodEnd) return { label: 'Avsluttes ved periodens slutt', color: '#B7791F' };
  if (subscription.stripeStatus === 'past_due' || subscription.stripeStatus === 'unpaid') return { label: 'Betaling kreves', color: '#B4544A' };
  if (subscription.stripeStatus === 'incomplete') return { label: 'Ikke fullført', color: '#B7791F' };
  if (subscription.stripeStatus === 'canceled' || subscription.status === 'cancelled') return { label: 'Avsluttet', color: '#63665F' };
  if (subscription.stripeStatus === 'active' || subscription.stripeStatus === 'trialing' || subscription.status === 'active') return { label: 'Aktivt', color: '#2E6641' };
  if (subscription.status === 'inactive' || subscription.status === 'expired') return { label: 'Inaktivt', color: '#63665F' };
  return { label: 'Status ukjent', color: '#63665F' };
}

function mutationError(error: unknown, fallback: string) {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (response?.status === 403) return 'Du har ikke tilgang til dette abonnementet.';
  if (response?.status === 404) return 'Abonnementet ble ikke funnet.';
  return response?.data?.message || fallback;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const query = useCurrentSubscription();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster abonnementet..." /></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste abonnementet" message="Abonnementet kunne ikke hentes akkurat nå." onAction={() => void query.refetch()} /></SafeAreaView>;

  const subscription = query.data;
  const cancelDate = date(subscription?.currentPeriodEnd || subscription?.renewalDate);
  const planStatus = subscription ? status(subscription) : null;
  const confirmCancel = () => Alert.alert('Si opp abonnementet?', cancelDate ? `Abonnementet forblir aktivt frem til ${cancelDate}.` : 'Abonnementet forblir aktivt frem til periodens slutt.', [{ text: 'Avbryt', style: 'cancel' }, { text: 'Si opp', style: 'destructive', onPress: () => cancel.mutate(undefined, { onError: (error) => Alert.alert('Kunne ikke si opp', mutationError(error, 'Kunne ikke si opp abonnementet.')) }) }]);
  const confirmResume = () => resume.mutate(undefined, { onError: (error) => Alert.alert('Kunne ikke gjenoppta', mutationError(error, 'Kunne ikke gjenoppta abonnementet.')) });

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
    <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2"><ArrowLeft size={18} color="#63665F" /><Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text></Pressable>
    <View className="mb-5 flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]"><CreditCard size={21} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-2xl font-bold text-[#0B0B0B]">Abonnement</Text><Text className="mt-1 text-sm text-[#63665F]">Administrer ditt nåværende abonnement</Text></View></View>
    {!subscription ? <EmptyState title="Ingen aktivt abonnement" message="Du har ingen nåværende abonnement å administrere." /> : <><View className="rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">Gjeldende plan</Text><Text className="mt-2 text-2xl font-bold text-[#0B0B0B]">{subscription.plan}</Text><Text className="mt-1 text-sm text-[#63665F]">{subscription.planType === 'business' ? 'Bedrift' : 'Privatperson'}</Text><View className="mt-5 flex-row items-center"><CheckCircle2 size={17} color={planStatus?.color} /><Text className="ml-2 text-sm font-semibold" style={{ color: planStatus?.color }}>{planStatus?.label}</Text></View>{cancelDate ? <View className="mt-4 flex-row items-center"><CalendarDays size={16} color="#63665F" /><Text className="ml-2 text-sm text-[#63665F]">{subscription.cancelAtPeriodEnd ? 'Tilgang til' : 'Neste fornyelse'}: {cancelDate}</Text></View> : null}</View>{subscription.cancelAtPeriodEnd ? <Pressable onPress={confirmResume} disabled={resume.isPending} className="mt-4 flex-row items-center justify-center rounded-xl bg-[#2E6641] px-4 py-3.5 disabled:opacity-50"><RefreshCcw size={17} color="#FFFFFF" /><Text className="ml-2 text-sm font-semibold text-white">{resume.isPending ? 'Gjenopptar...' : 'Gjenoppta abonnement'}</Text></Pressable> : subscription.stripeSubscriptionId && subscription.status === 'active' ? <Pressable onPress={confirmCancel} disabled={cancel.isPending} className="mt-4 flex-row items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 py-3.5 disabled:opacity-50"><XCircle size={17} color="#B4544A" /><Text className="ml-2 text-sm font-semibold text-[#B4544A]">{cancel.isPending ? 'Sier opp...' : 'Si opp abonnement'}</Text></Pressable> : null}</>}
    <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-sm font-semibold text-[#0B0B0B]">Betaling og historikk</Text><Text className="mt-2 text-sm leading-5 text-[#63665F]">Betalingsmetode, fakturaer og kjøpshistorikk administreres ikke fra denne mobilskjermen ennå.</Text></View>
  </ScrollView></SafeAreaView>;
}
