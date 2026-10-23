import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, Check, Loader2, Settings2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { deactivateRegisteredPushToken, getPushPermission, getRegisteredPushToken, registerPushNotifications } from '../../../../src/services/pushNotifications.service';
import { TC, tc } from '../../../../src/theme/colors';

function StatusRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <View className="flex-row items-center border-b border-line px-4 py-4 last:border-b-0"><View className="h-10 w-10 items-center justify-center rounded-xl bg-tint">{icon}</View><Text className="ml-3 flex-1 text-sm font-semibold text-ink">{label}</Text><Text className="text-[0.8125rem] font-medium text-muted">{value}</Text></View>;
}

export default function NotificationsSettingsScreen() {
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

  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
    <ScreenHeader title="Varslingsinnstillinger" subtitle="Varsler på denne enheten" icon={Bell} />
    <View className="overflow-hidden rounded-3xl border border-line bg-surface"><StatusRow label="Tillatelse" value={loading ? 'Sjekker...' : permissionLabel} icon={<Settings2 size={18} color={TC.brandText} />} /><StatusRow label="Enhetsregistrering" value={loading ? 'Sjekker...' : registrationLabel} icon={<Check size={18} color={registered ? TC.brandText : tc('#9B9E96', 'subtle')} />} /></View>
    <View className="mt-4 rounded-3xl border border-line bg-surface p-5"><Text className="text-sm font-semibold text-ink">Push-varsler</Text><Text className="mt-2 text-sm leading-5 text-muted">{expoGo ? 'Push-varsler krever en development build på Android. Expo Go kan ikke registrere push-varsler.' : permission === 'denied' ? 'Varsler er blokkert av systemet. Aktiver dem i systeminnstillingene.' : permission === 'granted' && registered ? 'Denne enheten er registrert for push-varsler.' : 'Tillat push-varsler for å registrere denne enheten.'}</Text>{error ? <Text className="mt-2 text-[0.8125rem] text-[#B4544A] dark:text-danger">{error}</Text> : null}{Platform.OS !== 'web' && !expoGo && permission === 'denied' ? <Pressable onPress={openSettings} className="mt-4 flex-row items-center justify-center rounded-xl border border-line px-4 py-3"><Settings2 size={16} color={TC.brandText} /><Text className="ml-2 text-sm font-semibold text-ink">Åpne innstillinger</Text></Pressable> : null}{!expoGo && permission !== 'denied' && (!registered || permission !== 'granted') ? <Pressable onPress={() => void enable()} disabled={loading} className="mt-4 flex-row items-center justify-center rounded-xl bg-brand px-4 py-3 disabled:opacity-50">{loading ? <Loader2 size={16} color="#FFFFFF" /> : null}<Text className="ml-2 text-sm font-semibold text-white">{loading ? 'Registrerer...' : 'Aktiver push-varsler'}</Text></Pressable> : null}{registered ? <Pressable onPress={() => void disable()} disabled={loading} className="mt-3 items-center py-2"><Text className="text-[0.8125rem] font-semibold text-[#B4544A] dark:text-danger">Deaktiver på denne enheten</Text></Pressable> : null}</View>
    <View className="mt-5 rounded-3xl border border-line bg-surface p-5"><Text className="text-sm font-semibold text-ink">Andre varslingsmetoder</Text><Text className="mt-2 text-sm leading-5 text-muted">E-postvarsler, SMS-varsler og varslingslyd har ingen mobilinnstilling eller backend-preferanse i denne versjonen.</Text></View>
  </ScrollView></SafeAreaView>;
}
