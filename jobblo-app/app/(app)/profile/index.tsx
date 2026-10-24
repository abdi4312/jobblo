import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import {
  BadgeCheck,
  Check,
  Moon,
  Smartphone,
  Sun,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Heart,
  HelpCircle,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../src/hooks/useProfile';
import { Popover, type PopoverAnchor } from '../../../src/components/ui/Popover';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { loadThemePreference, setThemePreference, type ThemePreference } from '../../../src/theme/themePreference';
import { useAuthStore } from '../../../src/store/authStore';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { TC, tc } from '../../../src/theme/colors';
import { MinJobbloSkeleton } from '../../../src/components/skeletons/ScreenSkeletons';

/**
 * "Min Jobblo", in the FINN app's "Min FINN" layout: a centred title, one card with the
 * person (avatar, name, BankID, e-mail), then plain rows with icon, label and chevron.
 * The full website-style profile (cover, tabs, reviews) is behind "Jobbprofil".
 */

type Row = { label: string; icon: LucideIcon; href: Href; destructive?: boolean };

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Automatisk', icon: Smartphone },
  { value: 'light', label: 'Lys', icon: Sun },
  { value: 'dark', label: 'Mørk', icon: Moon },
];

const MAIN: Row[] = [
  { label: 'Mine annonser', icon: Megaphone, href: '/my-jobs' },
  { label: 'Søkere og søknader', icon: ClipboardList, href: '/my-applications' },
  { label: 'Favoritter', icon: Heart, href: '/(app)/favorites' },
  { label: 'SafePay', icon: ShieldCheck, href: '/profile/settings/safepay' },
  { label: 'Vurderinger', icon: Star, href: { pathname: '/profile/me', params: { tab: 'Vurderinger' } } },
  { label: 'Jobbprofil', icon: Briefcase, href: '/profile/me' },
  { label: 'Utbetalinger', icon: Wallet, href: '/profile/settings/payout' },
];

const ACCOUNT: Row[] = [
  { label: 'Innstillinger', icon: Settings, href: '/(app)/profile/settings' },
  { label: 'Personvern', icon: ShieldCheck, href: '/profile/settings/privacy' },
  { label: 'Kundesenter', icon: HelpCircle, href: '/profile/support' },
];

/** FINN-style row: line icon, label, chevron; a hairline divider starts after the icon. */
function MenuRow({ icon: Icon, label, onPress, divider, destructive, value }: { icon: LucideIcon; label: string; onPress: () => void; divider?: boolean; destructive?: boolean; value?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center pl-4 active:bg-surface-2">
      {/* Fixed icon box + explicit gap (inline style, so no cached class can shrink it). */}
      <View style={{ width: 28, alignItems: 'center' }}>
        <Icon size={22} color={destructive ? TC.danger : TC.ink2} strokeWidth={1.75} />
      </View>
      <View
        style={{ marginLeft: 20 }}
        className={`flex-1 flex-row items-center py-4 pr-4 ${divider ? 'border-t border-line' : ''}`}
      >
        <Text className={`flex-1 text-[1.0625rem] ${destructive ? 'text-danger' : 'text-ink'}`}>{label}</Text>
        {value ? <Text className="mr-1.5 text-[0.9375rem] text-muted">{value}</Text> : null}
        {destructive ? null : <ChevronRight size={20} color={tc('#9B9E96', 'subtle')} />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const version = Constants.expoConfig?.version;
  const updateProfile = useUpdateProfile();
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Utseende: same setting as Innstillinger → Utseende (saved on the device).
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [themeSheet, setThemeSheet] = useState(false);
  useEffect(() => {
    void loadThemePreference().then(setTheme);
  }, []);
  const chooseTheme = (value: ThemePreference) => {
    setTheme(value);
    setThemeSheet(false);
    void setThemePreference(value);
  };
  const currentTheme = THEMES.find((option) => option.value === theme) ?? THEMES[0];

  const openCardMenu = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  };

  /** "Ta nytt bilde" / "Velg bilde …": square crop, then upload as the avatar (PUT /users/:id). */
  const changePhoto = async (source: 'camera' | 'library') => {
    if (!profile?._id) return;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Gi Jobblo tilgang til kameraet i Innstillinger for å ta et nytt bilde.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('avatar', { uri: asset.uri, name: asset.fileName ?? `profil-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
    updateProfile.mutate(
      { userId: profile._id, data: form },
      { onError: () => setPhotoError('Kunne ikke lagre bildet. Prøv igjen.') }
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setLogoutVisible(false);
      router.replace('/(auth)/login');
    }
  };

  if (isLoading)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <MinJobbloSkeleton />
      </SafeAreaView>
    );
  if (isError || !profile)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ErrorState title="Kunne ikke laste profilen" message="Profilen kunne ikke hentes akkurat nå." onAction={() => void refetch()} />
      </SafeAreaView>
    );

  const name =
    profile.role === 'company'
      ? profile.companyName || profile.name || 'Bedrift'
      : [profile.name, profile.lastName].filter(Boolean).join(' ') || 'Bruker';
  const verified = profile.identityVerified === true;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} colors={[TC.brandText]} />}
      >
        <Text className="py-3 text-center text-[1.0625rem] font-semibold text-ink">Min Jobblo</Text>

        {/* The person: tapping opens the full job profile. */}
        <View ref={cardRef} collapsable={false} className="mx-4 mt-2">
        <Pressable
          onPress={openCardMenu}
          accessibilityRole="button"
          accessibilityLabel={`Profil: ${name}`}
          className="flex-row items-center gap-4 rounded-2xl bg-surface p-4 active:opacity-90"
        >
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2">
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} className="h-full w-full" />
            ) : (
              <UserRound size={40} color={tc('#9B9E96', 'subtle')} strokeWidth={1.5} />
            )}
            {updateProfile.isPending ? (
              <View className="absolute inset-0 items-center justify-center bg-black/35">
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[1.5rem] font-bold text-ink" numberOfLines={1}>{name}</Text>
            {verified ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                <BadgeCheck size={17} color={TC.surface} fill={TC.brandText} />
                <Text className="text-[0.9375rem] text-ink-2">Verifisert med BankID</Text>
              </View>
            ) : (
              <Text className="mt-1 text-[0.9375rem] font-medium text-brand-text">Verifiser med BankID</Text>
            )}
            {profile.email ? <Text className="mt-0.5 text-[0.9375rem] text-muted" numberOfLines={1}>{profile.email}</Text> : null}
          </View>
        </Pressable>
        </View>

        <View className="mt-6">
          {MAIN.map((row, index) => (
            <MenuRow key={row.label} icon={row.icon} label={row.label} divider={index > 0} onPress={() => router.push(row.href)} />
          ))}
        </View>

        <View className="mt-8">
          <MenuRow icon={currentTheme.icon} label="Utseende" value={currentTheme.label} onPress={() => setThemeSheet(true)} />
          {ACCOUNT.map((row) => (
            <MenuRow key={row.label} icon={row.icon} label={row.label} divider onPress={() => router.push(row.href)} />
          ))}
          <MenuRow icon={LogOut} label="Logg ut" divider destructive onPress={() => setLogoutVisible(true)} />
        </View>

        <Text className="mt-8 text-center text-[0.8125rem] text-subtle">Jobblo{version ? ` · versjon ${version}` : ''}</Text>
      </ScrollView>

      <BottomSheet visible={themeSheet} onClose={() => setThemeSheet(false)} title="Utseende" hideClose>
        <View className="-mx-2 -my-2">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <Pressable
                key={value}
                onPress={() => chooseTheme(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-3 rounded-xl px-3 py-3.5 ${active ? 'bg-tint' : 'active:bg-surface-2'}`}
              >
                <Icon size={20} color={active ? TC.brandText : TC.ink2} />
                <Text className={`flex-1 text-[1rem] ${active ? 'font-semibold text-brand-text' : 'text-ink'}`}>{label}</Text>
                {active ? <Check size={18} color={TC.brandText} /> : null}
              </Pressable>
            );
          })}
          <Text className="px-3 pt-2 text-[0.875rem] text-subtle">Automatisk følger innstillingen på telefonen.</Text>
        </View>
      </BottomSheet>
      <Popover
        visible={!!anchor}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        title="Profil"
        actions={[
          { label: 'Se profilen min', onPress: () => router.push('/profile/me') },
          { label: 'Profilinnstillinger', onPress: () => router.push('/profile/edit') },
          { label: 'Ta nytt bilde', onPress: () => void changePhoto('camera') },
          { label: 'Velg bilde …', onPress: () => void changePhoto('library') },
        ]}
      />
      <ConfirmDialog
        visible={!!photoError}
        title="Profilbilde"
        message={photoError ?? undefined}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setPhotoError(null)}
        onClose={() => setPhotoError(null)}
      />
      <ConfirmDialog
        visible={logoutVisible}
        title="Logg ut?"
        message="Vil du logge ut av Jobblo?"
        confirmLabel="Ja, logg ut"
        pendingLabel="Logger ut..."
        cancelLabel="Avbryt"
        destructive
        isPending={isLoggingOut}
        onConfirm={() => void handleLogout()}
        onClose={() => !isLoggingOut && setLogoutVisible(false)}
      />
    </SafeAreaView>
  );
}
