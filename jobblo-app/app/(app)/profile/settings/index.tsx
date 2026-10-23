import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import {
  AtSign,
  Bell,
  Briefcase,
  ChevronRight,
  CreditCard,
  Eye,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  MapPin,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Phone,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { ListRow } from '../../../../src/components/ui/ListRow';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { MEMBERSHIP_ENABLED } from '../../../../src/config/features';
import { useProfile } from '../../../../src/hooks/useProfile';
import { TC, tc } from '../../../../src/theme/colors';
import { loadThemePreference, setThemePreference, type ThemePreference } from '../../../../src/theme/themePreference';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Automatisk', icon: Smartphone },
  { value: 'light', label: 'Lys', icon: Sun },
  { value: 'dark', label: 'Mørk', icon: Moon },
];

type Row = { label: string; description?: string; icon: LucideIcon; href: Href; destructive?: boolean };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Profil',
    rows: [
      { label: 'Adresser', description: 'Gateadresse, postnummer og sted', icon: Home, href: '/profile/settings/addresses' },
      { label: 'Jobbsøker-profil', description: 'Tilgjengelighet, ferdigheter og erfaring', icon: Briefcase, href: '/profile/settings/seeker' },
    ],
  },
  {
    title: 'Konto og sikkerhet',
    rows: [
      { label: 'E-postadresse', description: 'Adressen du logger inn med', icon: AtSign, href: '/profile/settings/email' },
      { label: 'Telefonnummer', description: 'Kontaktinformasjon', icon: Phone, href: '/profile/settings/phone' },
      { label: 'Endre passord', description: 'Med kode på e-post', icon: KeyRound, href: '/profile/settings/password' },
      { label: 'Aktive økter', description: 'Enheter som er logget inn', icon: Monitor, href: '/profile/settings/sessions' },
    ],
  },
  {
    title: 'Betaling',
    rows: [
      { label: 'SafePay-historikk', description: 'Betalinger, utbetalinger og refusjoner', icon: ShieldCheck, href: '/profile/settings/safepay' },
      { label: 'Utbetalinger', description: 'Stripe Connect-oppsett', icon: Wallet, href: '/profile/settings/payout' },
      ...(MEMBERSHIP_ENABLED ? [
        { label: 'Abonnement', description: 'Administrer aktivt abonnement', icon: CreditCard, href: '/profile/settings/subscription' },
        { label: 'Medlemskap', description: 'Planvalg og kjøp', icon: Sparkles, href: '/profile/membership' },
      ] satisfies Row[] : []),
    ],
  },
  {
    title: 'Varsler og personvern',
    rows: [
      { label: 'Varsler', description: 'Push-varsler på denne enheten', icon: Bell, href: '/profile/settings/notifications' },
      { label: 'Personvern og informasjonskapsler', description: 'Personvernerklæring og cookie-policy', icon: ShieldCheck, href: '/profile/settings/privacy' },
      { label: 'Søkemotorsynlighet', description: 'Om profilen din vises i søk', icon: Eye, href: '/profile/settings/visibility' },
      { label: 'Blokkerte brukere', description: 'Personer du har blokkert', icon: ShieldBan, href: '/profile/settings/blocked-users' },
    ],
  },
  {
    title: 'Annet',
    rows: [
      { label: 'Kundesenter', description: 'FAQ, e-post og saksregistrering', icon: HelpCircle, href: '/profile/support' },
      { label: 'Lokasjon', description: 'Landet som vises på profilen din', icon: MapPin, href: '/profile/settings/location' },
      { label: 'Om Jobblo', icon: Info, href: '/profile/settings/about' },
    ],
  },
  {
    title: 'Faresone',
    rows: [
      { label: 'Slett profilen min', description: 'Kan ikke angres', icon: Trash2, href: '/profile/settings/delete-account', destructive: true },
    ],
  },
];

export default function SettingsOverviewScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const name =
    profile?.role === 'company'
      ? profile.companyName || profile.name || 'Bedrift'
      : `${profile?.name || ''} ${profile?.lastName || ''}`.trim() || 'Profil';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const version = Constants.expoConfig?.version;
  const [theme, setTheme] = useState<ThemePreference>('system');
  useEffect(() => {
    void loadThemePreference().then(setTheme);
  }, []);
  const chooseTheme = (value: ThemePreference) => {
    setTheme(value);
    void setThemePreference(value);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 20 }}>
        <ScreenHeader
          title="Innstillinger"
          subtitle="Konto, betaling og personvern"
          backLabel="Profil"
          className="mb-0"
        />

        {/* Who is signed in; tapping it edits the profile (iOS Settings pattern). */}
        <Card className="rounded-2xl overflow-hidden">
          <Pressable
            onPress={() => router.push('/profile/edit')}
            accessibilityRole="button"
            accessibilityLabel={`Rediger profil for ${name}`}
            className="flex-row items-center gap-3.5 p-4 active:bg-surface-2"
          >
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#DCEBDD] dark:bg-tint">
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} className="h-full w-full" />
              ) : profile ? (
                <Text className="text-lg font-semibold text-brand-text">{initials || '?'}</Text>
              ) : (
                <UserRound size={24} color={TC.brandText} />
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.0625rem] font-bold text-ink" numberOfLines={1}>{name}</Text>
              {profile?.email ? (
                <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{profile.email}</Text>
              ) : null}
              <Text className="mt-1 text-[0.8125rem] font-semibold text-brand-text">Rediger profil</Text>
            </View>
            <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
          </Pressable>
        </Card>

        <View>
          <SectionLabel>Utseende</SectionLabel>
          <Card className="rounded-2xl p-1.5">
            <View className="flex-row gap-1.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => chooseTheme(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Utseende: ${label}`}
                    className={`flex-1 items-center gap-1.5 rounded-xl py-3 ${active ? 'bg-tint' : 'active:bg-surface-2'}`}
                  >
                    <Icon size={20} color={active ? TC.brandText : tc('#9B9E96', 'subtle')} />
                    <Text className={`text-[0.875rem] ${active ? 'font-semibold text-brand-text' : 'text-muted'}`}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <Text className="mt-2 px-1 text-[0.8125rem] text-subtle">
            Automatisk følger innstillingen på telefonen.
          </Text>
        </View>

        {GROUPS.map((group) => (
          <View key={group.title}>
            <SectionLabel>{group.title}</SectionLabel>
            <Card className="rounded-2xl overflow-hidden">
              {group.rows.map((row, index) => (
                <ListRow
                  key={row.label}
                  icon={row.icon}
                  label={row.label}
                  description={row.description}
                  destructive={row.destructive}
                  divider={index > 0}
                  onPress={() => router.push(row.href)}
                />
              ))}
            </Card>
          </View>
        ))}

        <Text className="text-center text-[0.8125rem] text-subtle">
          Jobblo{version ? ` · versjon ${version}` : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
