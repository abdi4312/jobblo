import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Bookmark,
  Briefcase,
  ChevronRight,
  LogOut,
  MapPin,
  Megaphone,
  Settings,
  ShieldCheck,
  Star,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '../../../src/hooks/useProfile';
import { useAuthStore } from '../../../src/store/authStore';
import { Button } from '../../../src/components/ui/Button';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';

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

  if (isLoading)
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster profilen..." />
      </SafeAreaView>
    );
  if (isError || !profile)
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
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

  const confirmLogout = () =>
    Alert.alert('Logg ut?', 'Du må logge inn igjen for å bruke Jobblo.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Logg ut', style: 'destructive', onPress: () => void logout() },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="border-b border-[#E6E7E1] bg-[#EAF1E9] px-5 pb-8 pt-8">
          <View className="items-center">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#DCEBDD]">
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} className="h-full w-full" />
              ) : (
                <Text className="text-2xl font-semibold text-[#2E6641]">{initials(fullName)}</Text>
              )}
            </View>
            <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
              <Text className="text-2xl font-bold text-[#0B0B0B]">{fullName}</Text>
              {profile.verified || profile.identityVerified ? (
                <ShieldCheck size={19} color="#2E6641" />
              ) : null}
            </View>
            <Text className="mt-1 text-sm text-[#63665F]">
              {profile.role === 'company' ? 'Bedrift' : 'Jobbsøker'}
            </Text>
            {location ? (
              <View className="mt-3 flex-row items-center gap-1.5">
                <MapPin size={14} color="#63665F" />
                <Text className="text-sm text-[#63665F]">{location}</Text>
              </View>
            ) : null}
            {since ? (
              <Text className="mt-1 text-xs text-[#63665F]">Medlem siden {since}</Text>
            ) : null}
          </View>
          <View className="mt-6 flex-row justify-center gap-2">
            <Button
              label="Rediger profil"
              variant="secondary"
              onPress={() => router.push('/profile/edit')}
            />
          </View>
        </View>
        {stats.length ? (
          <View className="mx-4 -mt-5 flex-row flex-wrap justify-around rounded-3xl border border-[#E6E7E1] bg-white px-3 py-4">
            {stats.map((stat) => (
              <View key={stat.label} className="min-w-[68px] items-center px-2">
                <Text className="text-base font-bold text-[#0B0B0B]">{stat.value}</Text>
                <Text className="mt-1 text-[0.6875rem] text-[#63665F]">{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="px-4 pt-5">
          {profile.bio ? (
            <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
              <Text className="text-base font-semibold text-[#0B0B0B]">Om meg</Text>
              <Text className="mt-3 text-sm leading-6 text-[#63665F]">{profile.bio}</Text>
            </View>
          ) : null}
          {profile.skills?.length ? (
            <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
              <Text className="text-base font-semibold text-[#0B0B0B]">Ferdigheter</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <View key={skill} className="rounded-full bg-[#EAF1E9] px-3 py-2">
                    <Text className="text-xs font-medium text-[#2E6641]">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View className="mt-4 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
            <Pressable
              onPress={() => router.push('/my-applications')}
              className="flex-row items-center p-5"
            >
              <Briefcase size={18} color="#2E6641" />
              <Text className="ml-3 flex-1 text-sm font-semibold text-[#0B0B0B]">
                Mine oppdrag og søknader
              </Text>
              <ChevronRight size={18} color="#63665F" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/my-jobs')}
              className="flex-row items-center border-t border-[#E6E7E1] p-5"
            >
              <Megaphone size={18} color="#2E6641" />
              <Text className="ml-3 flex-1 text-sm font-semibold text-[#0B0B0B]">
                Mine annonser
              </Text>
              <ChevronRight size={18} color="#63665F" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/favorites')}
              className="flex-row items-center border-t border-[#E6E7E1] p-5"
            >
              <Bookmark size={18} color="#2E6641" />
              <Text className="ml-3 flex-1 text-sm font-semibold text-[#0B0B0B]">
                Lagrede lister
              </Text>
              <ChevronRight size={18} color="#63665F" />
            </Pressable>
            {rating ? (
              <View className="flex-row items-center border-t border-[#E6E7E1] p-5">
                <Star size={18} color="#2E6641" fill="#2E6641" />
                <Text className="ml-3 text-sm text-[#63665F]">
                  {rating} av 5 basert på {profile.reviewCount} anmeldelser
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => router.push('/(app)/profile/settings')}
              className="flex-row items-center border-t border-[#E6E7E1] p-5"
            >
              <Settings size={18} color="#2E6641" />
              <Text className="ml-3 flex-1 text-sm font-semibold text-[#0B0B0B]">
                Innstillinger
              </Text>
              <ChevronRight size={18} color="#63665F" />
            </Pressable>
          </View>
          <Pressable
            onPress={confirmLogout}
            className="mt-4 flex-row items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 py-3.5"
          >
            <LogOut size={17} color="#B4544A" />
            <Text className="ml-2 text-sm font-semibold text-[#B4544A]">Logg ut</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
