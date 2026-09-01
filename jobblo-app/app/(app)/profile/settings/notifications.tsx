import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Bell, Check, Loader2, Settings2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { deactivateRegisteredPushToken, getPushPermission, getRegisteredPushToken, registerPushNotifications } from '../../../../src/services/pushNotifications.service';

function StatusRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <View className="flex-row items-center border-b border-[#E6E7E1] px-4 py-4 last:border-b-0"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]">{icon}</View><Text className="ml-3 flex-1 text-sm font-semibold text-[#0B0B0B]">{label}</Text><Text className="text-xs font-medium text-[#63665F]">{value}</Text></View>;
}

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('undetermined');
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const expoGo = permission === 'unavailable';

  const refresh = async () => {
    setLoading(true);
    try {
      setPermission(await getPushPermission());
      setRegistered(Boolean(await getRegisteredPushToken()));
    } catch {
      setPermission('unavailable');
      setRegistered(false);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);
  const openSettings = () => void Linking.openSettings().catch(() => undefined);
  const enable = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await registerPushNotifications();
      setPermission(result.status);
      setRegistered(result.registered);
      if (!result.registered && result.status === 'denied') setError('Varsler er ikke tillatt. Åpne systeminnstillingene for å aktivere dem.');
    } catch {
      setError('Kunne ikke registrere denne enheten. Prøv igjen i en development build.');
    } finally {
      setLoading(false);
    }
  };
  const disable = async () => {
    setLoading(true);
    setError('');
    try {
      await deactivateRegisteredPushToken();
      setRegistered(false);
    } catch {
      setError('Kunne ikke deaktivere push-varsler. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };
  const permissionLabel = permission === 'granted' ? 'Tillatt' : permission === 'denied' ? 'Ikke tillatt' : permission === 'unavailable' ? 'Ikke tilgjengelig' : 'Ikke avklart';
  const registrationLabel = registered ? 'Registrert' : 'Ikke registrert';

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
    <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2"><ArrowLeft size={18} color="#63665F" /><Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text></Pressable>
    <View className="mb-5 flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]"><Bell size={21} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-2xl font-bold text-[#0B0B0B]">Varslingsinnstillinger</Text><Text className="mt-1 text-sm text-[#63665F]">Varsler på denne enheten</Text></View></View>
    <View className="overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white"><StatusRow label="Tillatelse" value={loading ? 'Sjekker...' : permissionLabel} icon={<Settings2 size={18} color="#2E6641" />} /><StatusRow label="Enhetsregistrering" value={loading ? 'Sjekker...' : registrationLabel} icon={<Check size={18} color={registered ? '#2E6641' : '#9B9E96'} />} /></View>
    <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-sm font-semibold text-[#0B0B0B]">Push-varsler</Text><Text className="mt-2 text-sm leading-5 text-[#63665F]">{expoGo ? 'Push-varsler krever en development build på Android. Expo Go kan ikke registrere push-varsler.' : permission === 'denied' ? 'Varsler er blokkert av systemet. Aktiver dem i systeminnstillingene.' : permission === 'granted' && registered ? 'Denne enheten er registrert for push-varsler.' : 'Tillat push-varsler for å registrere denne enheten.'}</Text>{error ? <Text className="mt-2 text-xs text-[#B4544A]">{error}</Text> : null}{Platform.OS !== 'web' && !expoGo && permission === 'denied' ? <Pressable onPress={openSettings} className="mt-4 flex-row items-center justify-center rounded-xl border border-[#E6E7E1] px-4 py-3"><Settings2 size={16} color="#2E6641" /><Text className="ml-2 text-sm font-semibold text-[#0B0B0B]">Åpne innstillinger</Text></Pressable> : null}{!expoGo && permission !== 'denied' && (!registered || permission !== 'granted') ? <Pressable onPress={() => void enable()} disabled={loading} className="mt-4 flex-row items-center justify-center rounded-xl bg-[#2E6641] px-4 py-3 disabled:opacity-50">{loading ? <Loader2 size={16} color="#FFFFFF" /> : null}<Text className="ml-2 text-sm font-semibold text-white">{loading ? 'Registrerer...' : 'Aktiver push-varsler'}</Text></Pressable> : null}{registered ? <Pressable onPress={() => void disable()} disabled={loading} className="mt-3 items-center py-2"><Text className="text-xs font-semibold text-[#B4544A]">Deaktiver på denne enheten</Text></Pressable> : null}</View>
    <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-sm font-semibold text-[#0B0B0B]">Andre varslingsmetoder</Text><Text className="mt-2 text-sm leading-5 text-[#63665F]">E-postvarsler, SMS-varsler og varslingslyd har ingen mobilinnstilling eller backend-preferanse i denne versjonen.</Text></View>
  </ScrollView></SafeAreaView>;
}