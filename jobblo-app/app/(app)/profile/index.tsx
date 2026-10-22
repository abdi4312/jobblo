import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import {
  Bookmark,
  Briefcase,
  LogOut,
  MapPin,
  Megaphone,
  PencilLine,
  Settings,
  ShieldCheck,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '../../../src/hooks/useProfile';
import { useAuthStore } from '../../../src/store/authStore';
import { Button } from '../../../src/components/ui/Button';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { Card, SectionLabel } from '../../../src/components/ui/Card';
import { ListRow } from '../../../src/components/ui/ListRow';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function placeOf(profile: { postSted?: string | { city?: string }; address?: string }) {
  if (typeof profile.postSted === 'string') return profile.postSted;
  if (profile.postSted?.city) return profile.postSted.city;
  return profile.address || '';
}

function memberSince(createdAt?: string) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
}

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster profilen..." />
      </SafeAreaView>
    );
  if (isError || !profile)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste profilen"
          message="Profilen kunne ikke hentes akkurat nå."
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );

  const fullName =
    profile.role === 'company'
      ? profile.companyName || profile.name || 'Bedrift'
      : `${profile.name || ''} ${profile.lastName || ''}`.trim() || 'Bruker';
  const location = placeOf(profile);
  const since = memberSince(profile.createdAt);
  const rating =
    typeof profile.averageRating === 'number' && profile.reviewCount
      ? profile.averageRating.toFixed(1)
      : null;
  const stats = [
    typeof profile.completedJobs === 'number'
      ? { label: 'Fullførte', value: profile.completedJobs.toString() }
      : null,
    typeof profile.postedJobsCount === 'number'
      ? { label: 'Lagt ut', value: profile.postedJobsCount.toString() }
      : null,
    rating ? { label: 'Rating', value: `${rating}★` } : null,
    typeof profile.reviewCount === 'number'
      ? { label: 'Anmeldelser', value: profile.reviewCount.toString() }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const verified = Boolean(profile.verified || profile.identityVerified);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" colors={['#2E6641']} />}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-[1.75rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">Profil</Text>
          <Pressable
            onPress={() => router.push('/(app)/profile/settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Innstillinger"
            className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white active:opacity-80"
          >
            <Settings size={18} color="#0B0B0B" />
          </Pressable>
        </View>

        {/* Identity */}
        <Card className="p-5">
          <View className="flex-row items-center gap-4">
            <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#EAF1E9] bg-[#DCEBDD]">
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} className="h-full w-full" />
              ) : (
                <Text className="text-2xl font-semibold text-[#2E6641]">{initials(fullName)}</Text>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="shrink text-[1.25rem] font-bold text-[#0B0B0B]" numberOfLines={1}>
                  {fullName}
                </Text>
                {verified ? <ShieldCheck size={18} color="#2E6641" accessibilityLabel="Verifisert" /> : null}
              </View>
              <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                <View className="rounded-full bg-[#EAF1E9] px-2.5 py-1">
                  <Text className="text-[0.6875rem] font-semibold text-[#2E6641]">
                    {profile.role === 'company' ? 'Bedrift' : 'Privat'}
                  </Text>
                </View>
                {verified ? (
                  <View className="rounded-full bg-[#F4F6F0] px-2.5 py-1">
                    <Text className="text-[0.6875rem] font-semibold text-[#3C3F38]">Verifisert</Text>
                  </View>
                ) : null}
              </View>
              {location || since ? (
                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  {location ? (
                    <View className="flex-row items-center gap-1">
                      <MapPin size={13} color="#63665F" />
                      <Text className="text-[0.8125rem] text-[#63665F]">{location}</Text>
                    </View>
                  ) : null}
                  {since ? <Text className="text-[0.8125rem] text-[#9B9E96]">Medlem siden {since}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>

          {stats.length ? (
            <View className="mt-5 flex-row rounded-2xl bg-[#F4F6F0] py-3">
              {stats.map((stat, index) => (
                <View
                  key={stat.label}
                  className={`flex-1 items-center ${index > 0 ? 'border-l border-[#E6E7E1]' : ''}`}
                >
                  <Text className="text-[1.0625rem] font-bold tabular-nums text-[#0B0B0B]">{stat.value}</Text>
                  <Text className="mt-0.5 text-[0.6875rem] text-[#63665F]">{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="mt-4">
            <Button
              label="Rediger profil"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/profile/edit')}
              icon={<PencilLine size={15} color="#0B0B0B" style={{ marginRight: 6 }} />}
            />
          </View>
        </Card>

        {profile.bio ? (
          <Card className="p-5">
            <SectionLabel className="px-0">Om meg</SectionLabel>
            <Text className="text-[0.875rem] leading-6 text-[#3C3F38]">{profile.bio}</Text>
          </Card>
        ) : null}

        {profile.skills?.length ? (
          <Card className="p-5">
            <SectionLabel className="px-0">Ferdigheter</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <View key={skill} className="rounded-full bg-[#EAF1E9] px-3 py-1.5">
                  <Text className="text-[0.75rem] font-medium text-[#2E6641]">{skill}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <View>
          <SectionLabel>Aktivitet</SectionLabel>
          <Card className="overflow-hidden">
            <ListRow
              icon={Briefcase}
              label="Mine oppdrag og søknader"
              description="Søknader du har sendt og oppdrag du utfører"
              onPress={() => router.push('/my-applications')}
            />
            <ListRow
              icon={Megaphone}
              label="Mine annonser"
              description="Oppdrag du har lagt ut"
              onPress={() => router.push('/my-jobs')}
              divider
            />
            <ListRow
              icon={Bookmark}
              label="Lagrede lister"
              description="Favoritter og lister"
              onPress={() => router.push('/(app)/favorites')}
              divider
            />
          </Card>
        </View>

        <View>
          <SectionLabel>Konto</SectionLabel>
          <Card className="overflow-hidden">
            <ListRow
              icon={Settings}
              label="Innstillinger"
              description="Konto, varsler, betaling og personvern"
              onPress={() => router.push('/(app)/profile/settings')}
            />
            <ListRow icon={LogOut} label="Logg ut" destructive divider onPress={() => setLogoutVisible(true)} />
          </Card>
        </View>
      </ScrollView>

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
