import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Star,
} from 'lucide-react-native';
import { usePublicProfile } from '../../../src/hooks/usePublicProfile';
import { useJobs } from '../../../src/hooks/useJobs';
import { useProfile } from '../../../src/hooks/useProfile';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { JobCard } from '../../../src/components/JobCard';
import { ProfileSkeleton } from '../../../src/components/domain/ProfileSkeleton';
import type { PublicUser, Review, ExperienceItem } from '../../../src/types/UserProfile';
import { TC, tc } from '../../../src/theme/colors';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function asExperience(field: unknown): ExperienceItem[] {
  if (!field) return [];
  if (Array.isArray(field)) return field as ExperienceItem[];
  if (typeof field === 'object') return [field as ExperienceItem];
  return [];
}

function formatExperienceDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' });
}

function formatDateRange(item: ExperienceItem) {
  if (typeof item.startDate !== 'string' && typeof item.endDate !== 'string') return '';
  const start = formatExperienceDate(item.startDate);
  const end = formatExperienceDate(item.endDate);
  return [start || 'Ukjent start', end || 'Nå'].join(' – ');
}

function ExperienceCard({ item }: { item: ExperienceItem }) {
  const title = typeof item.title === 'string' ? item.title : '';
  const company = typeof item.company === 'string' ? item.company : '';
  const description = typeof item.description === 'string' ? item.description : '';
  if (!title && !company && !description) return null;
  return (
    <View className="rounded-2xl bg-surface-2 p-3">
      {title ? <Text className="text-sm font-semibold text-ink">{title}</Text> : null}
      {company ? <Text className="mt-0.5 text-[0.8125rem] font-medium text-brand-text">{company}</Text> : null}
      {formatDateRange(item) ? (
        <Text className="mt-0.5 text-[0.8125rem] text-subtle">{formatDateRange(item)}</Text>
      ) : null}
      {description ? (
        <Text className="mt-2 text-[0.8125rem] leading-5 text-muted">{description}</Text>
      ) : null}
    </View>
  );
}

function placeOf(u: PublicUser) {
  if (typeof u.postSted === 'string') return u.postSted;
  if (u.postSted && typeof u.postSted === 'object' && u.postSted.city) return u.postSted.city;
  return u.address || '';
}

function memberSince(createdAt?: string) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
}

function formatResponseTime(minutes: number) {
  if (minutes < 60) return 'under 1 t';
  if (minutes < 1440) return `${Math.round(minutes / 60)} t`;
  return `${Math.round(minutes / 1440)} d`;
}

const TABS = ['Om meg', 'Aktive', 'Vurderinger'] as const;
type Tab = (typeof TABS)[number];

function ReviewCard({ review }: { review: Review }) {
  const reviewer = review.reviewerId;
  const reviewerName = [reviewer?.name, reviewer?.lastName].filter(Boolean).join(' ') || 'Bruker';
  return (
    <View className="rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-tint">
          {reviewer?.avatarUrl ? (
            <Image source={{ uri: reviewer.avatarUrl }} className="h-full w-full" />
          ) : (
            <Text className="text-[0.8125rem] font-semibold text-brand-text">{initials(reviewerName)}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{reviewerName}</Text>
          {review.serviceId?.title ? (
            <Text className="text-[0.8125rem] text-muted">{review.serviceId.title}</Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-0.5">
          <Star size={13} color={TC.brandText} fill={TC.brandText} />
          <Text className="text-sm font-semibold text-ink">{review.rating}</Text>
        </View>
      </View>
      {review.comment ? (
        <Text className="mt-3 text-sm leading-5 text-muted">{review.comment}</Text>
      ) : null}
    </View>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${accent ? 'bg-tint' : 'bg-surface-2'}`}>
      {accent ? (
        <Star size={12} color={TC.brandText} fill={TC.brandText} />
      ) : null}
      <Text className="text-sm font-semibold text-ink">{value}</Text>
      {label ? <Text className="text-[0.8125rem] text-muted">{label}</Text> : null}
    </View>
  );
}

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('Om meg');

  const { data: self, isLoading: selfLoading } = useProfile();
  const isSelf = !!self?._id && !!userId && self._id === userId;

  useEffect(() => {
    if (isSelf) router.replace('/(app)/profile');
  }, [isSelf]);

  const { data: user, isLoading, isError, refetch } = usePublicProfile(isSelf ? null : userId ?? null);
  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
    refetch: refetchJobs,
  } = useJobs({ userId: userId ?? '', limit: 20, enabled: !isSelf && !!userId });
  const activeJobs = jobsData?.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refetch(), refetchJobs()]); } finally { setRefreshing(false); }
  };

  if (selfLoading && !isSelf) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }
  if (isSelf) return null;

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ErrorState
          title="Fant ikke brukeren"
          message="Profilen finnes ikke lenger, eller lenken er feil."
          onAction={() => router.replace('/(app)')}
        />
      </SafeAreaView>
    );
  }

  const fullName =
    user.role === 'company'
      ? user.companyName || user.name || 'Bedrift'
      : `${user.name || ''} ${user.lastName || ''}`.trim() || 'Bruker';
  const location = placeOf(user);
  const since = memberSince(user.createdAt);
  const isVerified = user.identityVerified === true;

  const stats: { label: string; value: string; accent?: boolean }[] = [];
  if (user.reviewCount) {
    stats.push({
      label: `${user.reviewCount} vurdering${user.reviewCount === 1 ? '' : 'er'}`,
      value: Number(user.averageRating ?? 0).toFixed(1),
      accent: true,
    });
  }
  if (typeof user.completedJobs === 'number' && user.completedJobs > 0) {
    stats.push({ label: 'fullførte', value: String(user.completedJobs) });
  }
  if (typeof user.responseRate === 'number' && user.totalJobRequests && user.totalJobRequests > 0) {
    stats.push({ label: 'svarer', value: `${user.responseRate} %` });
  }
  if (typeof user.averageResponseTimeMinutes === 'number' && user.averageResponseTimeMinutes > 0) {
    stats.push({ label: 'svartid', value: formatResponseTime(user.averageResponseTimeMinutes) });
  }
  if (isVerified) {
    stats.push({ label: '', value: 'Verifisert', accent: true });
  }

  const reviews = user.reviews ?? [];
  const experience = asExperience(user.experience ?? null);
  const hasExperience = experience.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-page" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} />}>
        {/* This screen is pushed from Home, alerts and chat with headerShown: false, so the
            back control has to live in the content. */}
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Tilbake"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center gap-2 px-4 py-3"
        >
          <ArrowLeft size={20} color={TC.ink} />
          <Text className="text-[0.875rem] font-medium text-ink">Tilbake</Text>
        </Pressable>
        {/* Header */}
        <View className="border-b border-line bg-tint px-5 pb-8 pt-6">
          <View className="items-center">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-tint">
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="h-full w-full" />
              ) : (
                <Text className="text-2xl font-semibold text-brand-text">{initials(fullName)}</Text>
              )}
            </View>
            <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
              <Text className="text-2xl font-bold text-ink">{fullName}</Text>
              {isVerified ? <BadgeCheck size={19} color={TC.brandText} /> : null}
            </View>
            <Text className="mt-1 text-sm text-muted">
              {user.role === 'company' ? 'Bedrift' : 'Jobbsøker'}
            </Text>
            {location ? (
              <View className="mt-3 flex-row items-center gap-1.5">
                <MapPin size={14} color={tc('#63665F', 'muted')} />
                <Text className="text-sm text-muted">{location}</Text>
              </View>
            ) : null}
            {since ? (
              <Text className="mt-1 text-[0.8125rem] text-muted">Medlem siden {since}</Text>
            ) : null}
          </View>
          {stats.length > 0 ? (
            <View className="mt-6 flex-row flex-wrap justify-center gap-2">
              {stats.map((s) => (
                <StatChip key={s.label + s.value} {...s} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Tabs */}
        <View className="flex-row border-b border-line bg-surface px-5">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`mr-6 border-b-2 py-3 ${active ? 'border-brand-text' : 'border-transparent'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-brand-text' : 'text-muted'}`}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab content */}
        <View className="px-4 pt-5">
          {activeTab === 'Om meg' && (
            <View className="gap-4">
              {user.bio ? (
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-base font-semibold text-ink">Om meg</Text>
                  <Text className="mt-3 text-sm leading-6 text-muted">{user.bio}</Text>
                </View>
              ) : null}

              {user.skills?.length ? (
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-base font-semibold text-ink">Ferdigheter</Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {user.skills.map((skill) => (
                      <View key={skill} className="rounded-full bg-tint px-3 py-2">
                        <Text className="text-[0.8125rem] font-medium text-brand-text">{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {hasExperience ? (
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-base font-semibold text-ink">Erfaring</Text>
                  <View className="mt-3 gap-3">
                    {experience.map((item, index) => (
                      <ExperienceCard key={item._id ?? item.id ?? index} item={item} />
                    ))}
                  </View>
                </View>
              ) : null}

              {user.portfolio?.length ? (
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-base font-semibold text-ink">Portfolio</Text>
                  <View className="mt-3 gap-3">
                    {user.portfolio.map((item) => (
                      <View key={item._id} className="rounded-2xl bg-surface-2 p-3">
                        <Text className="text-sm font-semibold text-ink">{item.title}</Text>
                        {item.description ? (
                          <Text className="mt-1 text-[0.8125rem] leading-5 text-muted">{item.description}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {user.previousProjects?.length ? (
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-base font-semibold text-ink">Tidligere prosjekter</Text>
                  <View className="mt-3 gap-3">
                    {user.previousProjects.map((item) => (
                      <View key={item._id} className="rounded-2xl bg-surface-2 p-3">
                        <Text className="text-sm font-semibold text-ink">{item.title}</Text>
                        {item.description ? (
                          <Text className="mt-1 text-[0.8125rem] leading-5 text-muted">{item.description}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {!user.bio && !user.skills?.length && !hasExperience && !user.portfolio?.length && !user.previousProjects?.length ? (
                <EmptyState title="Ingenting her ennå" message="Denne brukeren har ikke fylt ut profilen sin." />
              ) : null}
            </View>
          )}

          {activeTab === 'Aktive' && (
            <View>
              {jobsLoading ? (
                <LoadingIndicator message="Laster aktive oppdrag..." />
              ) : jobsError ? (
                <ErrorState
                  title="Kunne ikke laste oppdrag"
                  message="Prøv igjen."
                  actionLabel="Prøv igjen"
                  onAction={() => void refetchJobs()}
                />
              ) : activeJobs.length === 0 ? (
                <EmptyState title="Ingen aktive oppdrag" message="Denne brukeren har ingen aktive oppdrag ute akkurat nå." />
              ) : (
                <View className="flex-row flex-wrap gap-3">
                  {activeJobs.map((job) => (
                    <View key={job._id} className="w-[47%]">
                      <JobCard job={job} compact />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'Vurderinger' && (
            <View>
              {reviews.length === 0 ? (
                <EmptyState title="Ingen vurderinger" message="Denne brukeren har ikke fått noen vurderinger ennå." />
              ) : (
                <View className="gap-3">
                  {reviews.map((r) => (
                    <ReviewCard key={r._id} review={r} />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
