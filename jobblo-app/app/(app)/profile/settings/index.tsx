import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, AtSign, Bell, Briefcase, ChevronRight, CreditCard, Eye, Info, KeyRound, MapPin, Monitor, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type SettingsRowProps = { title: string; subtitle?: string; icon: React.ComponentType<{ size?: number; color?: string }>; onPress?: () => void; danger?: boolean };

function SettingsRow({ title, subtitle, icon: Icon, onPress, danger = false }: SettingsRowProps) {
  const disabled = !onPress;
  return <Pressable onPress={onPress} disabled={disabled} className={['flex-row items-center px-4 py-4', disabled ? 'opacity-50' : 'active:bg-[#F4F6F0]'].join(' ')}><View className={['h-10 w-10 items-center justify-center rounded-xl', danger ? 'bg-[#FBF4F2]' : 'bg-[#EAF1E9]'].join(' ')}><Icon size={18} color={danger ? '#B4544A' : '#2E6641'} /></View><View className="ml-3 min-w-0 flex-1"><Text className={['text-sm font-semibold', danger ? 'text-[#B4544A]' : 'text-[#0B0B0B]'].join(' ')}>{title}</Text>{subtitle ? <Text className="mt-1 text-xs leading-4 text-[#63665F]">{subtitle}</Text> : null}</View>{disabled ? <Text className="text-[0.6875rem] font-medium text-[#9B9E96]">Kommer</Text> : <ChevronRight size={18} color="#63665F" />}</Pressable>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white"><Text className="border-b border-[#E6E7E1] px-4 pb-3 pt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">{title}</Text>{children}</View>;
}

export default function SettingsOverviewScreen() {
  const router = useRouter();
  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
    <Pressable onPress={() => router.back()} className="mb-3 flex-row items-center self-start py-2"><ArrowLeft size={18} color="#63665F" /><Text className="ml-2 text-sm font-medium text-[#63665F]">Til profilen</Text></Pressable>
    <Text className="text-2xl font-bold text-[#0B0B0B]">Innstillinger</Text><Text className="mt-1 text-sm leading-5 text-[#63665F]">Konto, betaling og personvern.</Text>
    <Group title="Profil"><SettingsRow title="Rediger profil" subtitle="Navn, bilde, bio, ferdigheter og sted" icon={UserRound} onPress={() => router.push('/profile/edit')} /><SettingsRow title="Jobbsøkerinnstillinger" subtitle="Profil for hvordan du finner oppdrag" icon={Briefcase} /></Group>
    <Group title="Konto"><SettingsRow title="E-post og telefon" subtitle="Kontaktinformasjon" icon={AtSign} /><SettingsRow title="Endre passord" icon={KeyRound} onPress={() => router.push('/profile/settings/password')} /><SettingsRow title="Aktive økter" subtitle="Innloggede enheter" icon={Monitor} /></Group>
    <Group title="Betaling"><SettingsRow title="SafePay-historikk" icon={ShieldCheck} /><SettingsRow title="Utbetalinger" icon={CreditCard} /><SettingsRow title="Abonnementer" subtitle="Administrer aktivt abonnement" icon={CreditCard} /><SettingsRow title="Medlemskap" subtitle="Planvalg og kjøp" icon={Sparkles} /></Group>
    <Group title="Personvern"><SettingsRow title="Varsler" subtitle="Varslingsinnstillinger" icon={Bell} onPress={() => router.push('/profile/settings/notifications' as any)} /><SettingsRow title="Søkemotorsynlighet" icon={Eye} /><SettingsRow title="Blokkerte brukere" icon={ShieldCheck} /></Group>
    <Group title="Annet"><SettingsRow title="Lokasjon" icon={MapPin} /><SettingsRow title="Om Jobblo" icon={Info} /><SettingsRow title="Slett profilen min" subtitle="Denne handlingen kan ikke angres" icon={Trash2} danger /></Group>
  </ScrollView></SafeAreaView>;
}