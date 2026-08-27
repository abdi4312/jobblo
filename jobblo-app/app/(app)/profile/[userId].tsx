import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  ShieldCheck,
  Star,
  Briefcase,
  ChevronRight,
} from 'lucide-react-native';
import { usePublicProfile, usePublicUserServices } from '../../../src/hooks/usePublicProfile';
import { useProfile } from '../../../src/hooks/useProfile';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import type { PublicUser, Review, ExperienceItem } from '../../../src/types/UserProfile';

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
    <View className="rounded-2xl bg-[#F4F6F0] p-3">
      {title ? <Text className="text-sm font-semibold text-[#0B0B0B]">{title}</Text> : null}
      {company ? <Text className="mt-0.5 text-xs font-medium text-[#2E6641]">{company}</Text> : null}
      {formatDateRange(item) ? (
        <Text className="mt-0.5 text-[0.6875rem] text-[#9B9E96]">{formatDateRange(item)}</Text>
      ) : null}
      {description ? (
        <Text className="mt-2 text-xs leading-5 text-[#63665F]">{description}</Text>
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
    <View className="rounded-3xl border border-[#E6E7E1] bg-white p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#DCEBDD]">
          {reviewer?.avatarUrl ? (
            <Image source={{ uri: reviewer.avatarUrl }} className="h-full w-full" />
          ) : (
            <Text className="text-xs font-semibold text-[#2E6641]">{initials(reviewerName)}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-[#0B0B0B]">{reviewerName}</Text>
          {review.serviceId?.title ? (
            <Text className="text-xs text-[#63665F]">{review.serviceId.title}</Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-0.5">
          <Star size={13} color="#2E6641" fill="#2E6641" />
          <Text className="text-sm font-semibold text-[#0B0B0B]">{review.rating}</Text>
        </View>
      </View>
      {review.comment ? (
        <Text className="mt-3 text-sm leading-5 text-[#63665F]">{review.comment}</Text>
      ) : null}
    </View>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${accent ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]'}`}>
      {accent ? (
        <Star size={12} color="#2E6641" fill="#2E6641" />
      ) : null}
      <Text className="text-sm font-semibold text-[#0B0B0B]">{value}</Text>
      {label ? <Text className="text-xs text-[#63665F]">{label}</Text> : null}
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
  const { data: services = [], isLoading: servicesLoading } = usePublicUserServices(isSelf ? null : userId ?? null);

  if (selfLoading && !isSelf) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster profil..." />
      </SafeAreaView>
    );
  }
  if (isSelf) return null;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster profil..." />
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
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
    <SafeAreaView className="flex-1 bg-[#EFF0EA]" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* This screen is pushed from Home, alerts and chat with headerShown: false, so the
            back control has to live in the content. */}
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Tilbake"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center gap-2 px-4 py-3"
        >
          <ArrowLeft size={20} color="#0B0B0B" />
          <Text className="text-[0.875rem] font-medium text-[#0B0B0B]">Tilbake</Text>
        </Pressable>
        {/* Header */}
        <View className="border-b border-[#E6E7E1] bg-[#EAF1E9] px-5 pb-8 pt-6">
          <View className="items-center">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#DCEBDD]">
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="h-full w-full" />
              ) : (
                <Text className="text-2xl font-semibold text-[#2E6641]">{initials(fullName)}</Text>
              )}
            </View>
            <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
              <Text className="text-2xl font-bold text-[#0B0B0B]">{fullName}</Text>
              {isVerified ? <BadgeCheck size={19} color="#2E6641" /> : null}
            </View>
            <Text className="mt-1 text-sm text-[#63665F]">
              {user.role === 'company' ? 'Bedrift' : 'Jobbsøker'}
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
          {stats.length > 0 ? (
            <View className="mt-6 flex-row flex-wrap justify-center gap-2">
              {stats.map((s) => (
                <StatChip key={s.label + s.value} {...s} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Tabs */}
        <View className="flex-row border-b border-[#E6E7E1] bg-white px-5">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`mr-6 border-b-2 py-3 ${active ? 'border-[#2E6641]' : 'border-transparent'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-[#2E6641]' : 'text-[#63665F]'}`}>
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
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                  <Text className="text-base font-semibold text-[#0B0B0B]">Om meg</Text>
                  <Text className="mt-3 text-sm leading-6 text-[#63665F]">{user.bio}</Text>
                </View>
              ) : null}

              {user.skills?.length ? (
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                  <Text className="text-base font-semibold text-[#0B0B0B]">Ferdigheter</Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {user.skills.map((skill) => (
                      <View key={skill} className="rounded-full bg-[#EAF1E9] px-3 py-2">
                        <Text className="text-xs font-medium text-[#2E6641]">{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {hasExperience ? (
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                  <Text className="text-base font-semibold text-[#0B0B0B]">Erfaring</Text>
                  <View className="mt-3 gap-3">
                    {experience.map((item, index) => (
                      <ExperienceCard key={item._id ?? item.id ?? index} item={item} />
                    ))}
                  </View>
                </View>
              ) : null}

              {user.portfolio?.length ? (
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                  <Text className="text-base font-semibold text-[#0B0B0B]">Portfolio</Text>
                  <View className="mt-3 gap-3">
                    {user.portfolio.map((item) => (
                      <View key={item._id} className="rounded-2xl bg-[#F4F6F0] p-3">
                        <Text className="text-sm font-semibold text-[#0B0B0B]">{item.title}</Text>
                        {item.description ? (
                          <Text className="mt-1 text-xs leading-5 text-[#63665F]">{item.description}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {user.previousProjects?.length ? (
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                  <Text className="text-base font-semibold text-[#0B0B0B]">Tidligere prosjekter</Text>
                  <View className="mt-3 gap-3">
                    {user.previousProjects.map((item) => (
                      <View key={item._id} className="rounded-2xl bg-[#F4F6F0] p-3">
                        <Text className="text-sm font-semibold text-[#0B0B0B]">{item.title}</Text>
                        {item.description ? (
                          <Text className="mt-1 text-xs leading-5 text-[#63665F]">{item.description}</Text>
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
              {servicesLoading ? (
                <LoadingIndicator message="Laster tjenester..." />
              ) : services.length === 0 ? (
                <EmptyState title="Ingen aktive tjenester" message="Denne brukeren har ingen tjenester ute akkurat nå." />
              ) : (
                <View className="gap-3">
                  {services.map((svc) => (
                    <Pressable
                      key={svc._id}
                      onPress={() =>
                        router.push({ pathname: '/(app)/jobs/[id]', params: { id: svc._id } })
                      }
                      className="flex-row items-center rounded-3xl border border-[#E6E7E1] bg-white p-4"
                    >
                      {svc.imageUrl ? (
                        <Image source={{ uri: svc.imageUrl }} className="h-12 w-12 rounded-xl" />
                      ) : (
                        <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#EAF1E9]">
                          <Briefcase size={18} color="#2E6641" />
                        </View>
                      )}
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-semibold text-[#0B0B0B]" numberOfLines={1}>
                          {svc.title}
                        </Text>
                        {svc.category ? (
                          <Text className="mt-0.5 text-xs text-[#63665F]">{svc.category}</Text>
                        ) : null}
                        {typeof svc.price === 'number' ? (
                          <Text className="mt-1 text-xs font-semibold text-[#2E6641]">
                            kr {svc.price}{svc.unit ? `/${svc.unit}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color="#63665F" />
                    </Pressable>
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
