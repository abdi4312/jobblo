import React, { useCallback, useEffect, useRef, useState } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppState, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Bookmark,
  Briefcase,
  CalendarClock,
  ChevronRight,
  LogOut,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useProfile } from '../../../src/hooks/useProfile';
import { usePublicProfile } from '../../../src/hooks/usePublicProfile';
import { useMyJobs } from '../../../src/hooks/useMyJobs';
import { useMyApplications } from '../../../src/hooks/useMyApplications';
import { useAuthStore } from '../../../src/store/authStore';
import { apiBaseUrl } from '../../../src/api/client';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { DropdownMenu } from '../../../src/components/ui/DropdownMenu';
import { ProfileSkeleton } from '../../../src/components/domain/ProfileSkeleton';
import { ProfileCover } from '../../../src/components/profile/ProfileCover';
import { TC, tc } from '../../../src/theme/colors';
import type { PublicUser, Review } from '../../../src/types/UserProfile';

/**
 * Own profile, rebuilt to match the website (frontend/src/components/profile/ProfilePage.tsx):
 * sprout cover, identity card with "Rediger profil" + "…" menu and stat chips, the
 * Jobbsøker/Oppdragsgiver switch, the BankID card, tabs, rating breakdown, Pålitelighet and
 * the SafePay card. Stats come from GET /users/:id (same as the web); /auth/profile has none.
 */

type ProfileType = 'seeker' | 'poster';
const TABS: Record<'seeker' | 'poster' | 'company', string[]> = {
  seeker: ['Om meg', 'Fullførte', 'Vurderinger'],
  poster: ['Aktive', 'Tidligere', 'Vurderinger'],
  company: ['Om oss', 'Aktive', 'Tidligere', 'Vurderinger'],
};
const WEB_BASE = apiBaseUrl.replace(/\/api\/?$/, '');

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
const placeOf = (user: { postSted?: string | { city?: string }; address?: string }) =>
  typeof user.postSted === 'string' ? user.postSted : user.postSted?.city || user.address || '';
const monthYear = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
};
const dayDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
};
/** Same as the web: under 1 t, {h} t, {d} d. */
const responseTime = (minutes: number) =>
  minutes < 60 ? 'under 1 t' : minutes < 1440 ? `${Math.round(minutes / 60)} t` : `${Math.round(minutes / 1440)} d`;

function StatChip({ icon: Icon, children, accent }: { icon?: LucideIcon; children: React.ReactNode; accent?: boolean }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${accent ? 'bg-tint' : 'bg-surface-2'}`}>
      {Icon ? <Icon size={14} color={accent ? TC.brandText : TC.ink2} /> : null}
      <Text className={`text-[0.875rem] ${accent ? 'font-semibold text-brand-text' : 'text-ink-2'}`}>{children}</Text>
    </View>
  );
}

/** White panel with an icon title and an inline "Rediger" on the right (web `Panel`). */
function Panel({ icon: Icon, title, onEdit, children }: { icon: LucideIcon; title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <View className="rounded-3xl border border-line bg-surface p-5">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon size={17} color={TC.brandText} />
        <Text className="flex-1 text-[1.0625rem] font-semibold text-ink">{title}</Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8} className="flex-row items-center gap-1" accessibilityLabel={`Rediger ${title.toLowerCase()}`}>
            <Pencil size={13} color={TC.brandText} />
            <Text className="text-[0.875rem] font-semibold text-brand-text">Rediger</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 active:bg-surface-2">
      <Plus size={15} color={TC.brandText} />
      <Text className="text-[0.875rem] font-semibold text-brand-text">{label}</Text>
    </Pressable>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const name = [review.reviewerId?.name, review.reviewerId?.lastName].filter(Boolean).join(' ') || 'Bruker';
  return (
    <View className="rounded-3xl border border-line bg-surface p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-tint">
          {review.reviewerId?.avatarUrl ? (
            <Image source={{ uri: review.reviewerId.avatarUrl }} className="h-full w-full" />
          ) : (
            <Text className="font-semibold text-brand-text">{initials(name)}</Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[0.9375rem] font-semibold text-ink" numberOfLines={1}>{name}</Text>
          <Text className="text-[0.8125rem] text-subtle">{dayDate(review.createdAt)}</Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-tint px-2.5 py-1">
          <Star size={12} color={TC.brandText} fill={TC.brandText} />
          <Text className="text-[0.8125rem] font-semibold text-brand-text">{Number(review.rating || 0).toFixed(1)}</Text>
        </View>
      </View>
      {review.comment ? <Text className="mt-3 text-[0.9375rem] leading-6 text-ink-2">{review.comment}</Text> : null}
      {review.serviceId?.title ? (
        <Text className="mt-3 border-t border-line-soft pt-3 text-[0.8125rem] text-muted" numberOfLines={1}>{review.serviceId.title}</Text>
      ) : null}
    </View>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <View className="items-center rounded-3xl border border-line bg-surface px-6 py-10">
      <Text className="text-center text-[1.0625rem] font-semibold text-ink">{title}</Text>
      <Text className="mt-1.5 text-center text-[0.9375rem] leading-6 text-muted">{text}</Text>
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}

function ListItem({ title, meta, right, onPress }: { title: string; meta: string; right?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
      <View className="min-w-0 flex-1">
        <Text className="text-[0.9375rem] font-semibold text-ink" numberOfLines={1}>{title}</Text>
        <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>{meta}</Text>
      </View>
      {right ? <Text className="text-[0.9375rem] font-semibold text-ink">{right}</Text> : null}
      <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
    </Pressable>
  );
}

/** "Jobbprofil" (from Min Jobblo): the website-style profile with cover, tabs and reviews. */
export default function JobProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const logout = useAuthStore((state) => state.logout);
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const ownId = profile?._id ?? null;
  const statsQuery = usePublicProfile(ownId);
  const isCompany = profile?.role === 'company';
  const [profileType, setProfileType] = useState<ProfileType>('seeker');
  const tabs = isCompany ? TABS.company : TABS[profileType];
  const [tab, setTab] = useState(params.tab && tabs.includes(params.tab) ? params.tab : tabs[0]);
  const jobsQuery = useMyJobs();
  const applicationsQuery = useMyApplications({ status: 'accepted', limit: 50, enabled: tab === 'Fullførte' });
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTop, setMenuTop] = useState<number | undefined>();
  const menuButton = useRef<View | null>(null);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openingBankId, setOpeningBankId] = useState(false);

  // The cover runs under the status bar: light icons on it while this screen is in front.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, [])
  );

  // Companies only have the poster view.
  useEffect(() => {
    if (isCompany) setProfileType('poster');
  }, [isCompany]);
  const firstRender = useRef(true);
  useEffect(() => {
    // Keep a tab asked for in the link on first load; reset only when the view switches.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileType, isCompany]);

  // Back from the BankID page in the browser: re-read the verified state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && openingBankId) {
        setOpeningBankId(false);
        void refetch();
        void statsQuery.refetch();
      }
    });
    return () => sub.remove();
  }, [openingBankId, refetch, statsQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), statsQuery.refetch(), jobsQuery.refetch()]);
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
        <ProfileSkeleton />
      </SafeAreaView>
    );
  if (isError || !profile)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ErrorState title="Kunne ikke laste profilen" message="Profilen kunne ikke hentes akkurat nå." onAction={() => void refetch()} />
      </SafeAreaView>
    );

  // Computed stats from /users/:id when they have arrived, the stored profile otherwise.
  const user = { ...profile, ...(statsQuery.data ?? {}) } as PublicUser & typeof profile & { totalEarned?: number };
  const fullName = isCompany
    ? user.companyName || user.name || 'Bedrift'
    : [user.name, user.lastName].filter(Boolean).join(' ') || 'Bruker';
  const place = placeOf(user);
  const since = monthYear(user.createdAt);
  const verified = user.identityVerified === true;
  const reviews = user.reviews ?? [];
  const reviewCount = reviews.length || user.reviewCount || 0;
  const rating = Number(user.averageRating || 0);
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(Number(review.rating)) === stars).length,
  }));
  const reliability = [
    user.hireRate ? ['Blir hyret', `${user.hireRate} %`] : null,
    user.completionRate ? ['Fullfører', `${user.completionRate} %`] : null,
    user.repeatCustomersCount ? ['Gjengangere', String(user.repeatCustomersCount)] : null,
    user.jobsThisMonth ? ['Denne måneden', String(user.jobsThisMonth)] : null,
  ].filter(Boolean) as [string, string][];
  const edit = () => router.push('/profile/edit');

  const chips: React.ReactNode[] = [];
  if (reviewCount > 0) chips.push(<StatChip key="r" icon={Star} accent>{`${rating.toFixed(1)} · ${reviewCount} ${reviewCount === 1 ? 'vurdering' : 'vurderinger'}`}</StatChip>);
  if (profileType === 'seeker' && user.completedJobs) chips.push(<StatChip key="c">{`${user.completedJobs} fullførte`}</StatChip>);
  if (profileType === 'poster' && user.postedJobsCount) chips.push(<StatChip key="p">{`${user.postedJobsCount} lagt ut`}</StatChip>);
  if (user.totalJobRequests && typeof user.responseRate === 'number') chips.push(<StatChip key="s">{`${user.responseRate} % svarer`}</StatChip>);
  if (user.averageResponseTimeMinutes && user.averageResponseTimeMinutes > 0) chips.push(<StatChip key="t">{`${responseTime(user.averageResponseTimeMinutes)} svartid`}</StatChip>);
  if (verified) chips.push(<StatChip key="v" icon={BadgeCheck} accent>Verifisert</StatChip>);
  if (!chips.length) chips.push(<StatChip key="n" icon={Sparkles}>{`Ny på Jobblo${since ? ` · siden ${since}` : ''}`}</StatChip>);

  const openMenu = () => {
    menuButton.current?.measureInWindow((_x, y, _w, h) => {
      setMenuTop(y + h + 6);
      setMenuOpen(true);
    });
  };

  const verifyWithBankId = async () => {
    // The BankID (Idura) flow returns to the website only, so it runs there.
    setOpeningBankId(true);
    await WebBrowser.openBrowserAsync(`${WEB_BASE}/profile`);
  };

  const activeJobs = (jobsQuery.data ?? []).filter((job) => ['open', 'pending', 'awaiting_payment', 'paid', 'in_progress', 'waiting_for_approval'].includes(job.status));
  const pastJobs = (jobsQuery.data ?? []).filter((job) => ['completed', 'closed', 'cancelled', 'expired'].includes(job.status));
  const finished = (applicationsQuery.data?.applications ?? []).filter((application) => application.order?.status === 'completed');

  const renderJobs = (jobs: typeof activeJobs, emptyTitle: string, emptyText: string) =>
    jobs.length ? (
      <View className="gap-2.5">
        {jobs.map((job) => (
          <ListItem
            key={job._id}
            title={job.title}
            meta={`${dayDate(job.createdAt)}${job.location?.city ? ` · ${job.location.city}` : ''}`}
            right={typeof job.price === 'number' ? `${job.price.toLocaleString('nb-NO')} kr` : undefined}
            onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } })}
          />
        ))}
      </View>
    ) : (
      <Empty
        title={emptyTitle}
        text={emptyText}
        action={
          <Pressable onPress={() => router.push('/(app)/create-job')} className="flex-row items-center gap-1.5 rounded-full bg-brand px-5 py-3">
            <Plus size={16} color="#FFFFFF" />
            <Text className="font-semibold text-white">Legg ut oppdrag</Text>
          </Pressable>
        }
      />
    );

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-page">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#FFFFFF" colors={[TC.brandText]} />}
      >
        <View>
          <ProfileCover seed={user._id} height={190} />
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Tilbake"
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-white/95 active:opacity-80"
            style={{ top: insets.top + 8 }}
          >
            <ArrowLeft size={19} color="#0B0B0B" />
          </Pressable>
        </View>

        <View className="px-4">
          {/* Identity card, overlapping the foot of the cover. */}
          <View className="-mt-16 items-center rounded-3xl border border-line bg-surface px-5 pb-5 pt-0">
            <View className="-mt-12 h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-tint">
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="h-full w-full" />
              ) : (
                <Text className="text-[2rem] font-semibold text-brand-text">{initials(fullName)}</Text>
              )}
            </View>
            {verified ? (
              <View className="-mt-7 ml-20 h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand">
                <ShieldCheck size={14} color="#FFFFFF" />
              </View>
            ) : null}

            <Text className="mt-3 text-center text-[1.5rem] font-bold tracking-[-0.02em] text-ink">{fullName}</Text>
            <View className="mt-1 flex-row flex-wrap items-center justify-center gap-x-2">
              {place ? (
                <View className="flex-row items-center gap-1">
                  <MapPin size={13} color={tc('#63665F', 'muted')} />
                  <Text className="text-[0.875rem] text-muted">{place}</Text>
                </View>
              ) : null}
              {since ? <Text className="text-[0.875rem] text-muted">{place ? '· ' : ''}Medlem siden {since}</Text> : null}
            </View>
            {isCompany && user.orgNumber ? <Text className="mt-0.5 text-[0.8125rem] text-subtle">Org.nr {user.orgNumber}</Text> : null}

            <View className="mt-4 w-full flex-row gap-2.5">
              <Pressable onPress={edit} className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-brand active:opacity-90">
                <Pencil size={15} color="#FFFFFF" />
                <Text className="text-[0.9375rem] font-semibold text-white">Rediger profil</Text>
              </Pressable>
              <View ref={menuButton} collapsable={false}>
                <Pressable onPress={openMenu} accessibilityLabel="Flere valg" className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface active:bg-surface-2">
                  <MoreHorizontal size={20} color={TC.ink} />
                </Pressable>
              </View>
            </View>

            <View className="mt-4 flex-row flex-wrap justify-center gap-2">{chips}</View>
          </View>

          {/* Jobbsøker / Oppdragsgiver (view only; companies are always Oppdragsgiver). */}
          {!isCompany ? (
            <View className="mt-4 flex-row rounded-full border border-line bg-surface p-1">
              {([['seeker', 'Jobbsøker'], ['poster', 'Oppdragsgiver']] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setProfileType(value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: profileType === value }}
                  className={`h-10 flex-1 items-center justify-center rounded-full ${profileType === value ? 'bg-brand' : ''}`}
                >
                  <Text className={`text-[0.9375rem] font-semibold ${profileType === value ? 'text-white' : 'text-muted'}`}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* BankID */}
          {verified ? (
            <View className="mt-4 flex-row items-center gap-3 rounded-3xl border border-[#C6E2CE] bg-tint p-4 dark:border-brand-text/30">
              <BadgeCheck size={24} color={TC.brandText} />
              <View className="flex-1">
                <Text className="text-[1rem] font-semibold text-ink">Identitet bekreftet</Text>
                <Text className="mt-0.5 text-[0.875rem] text-muted">
                  Bekreftet med BankID{user.identityVerifiedAt ? ` · ${dayDate(user.identityVerifiedAt)}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <View className="mt-4 rounded-3xl border border-line bg-surface p-5">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={18} color={TC.brandText} />
                <Text className="text-[1.0625rem] font-semibold text-ink">Identitetsbekreftelse</Text>
              </View>
              <Text className="mt-1.5 text-[0.9375rem] leading-6 text-muted">
                Bekreft identiteten din med BankID for å skape mer trygghet på Jobblo.
              </Text>
              <Pressable onPress={() => void verifyWithBankId()} className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full bg-brand active:opacity-90">
                <ShieldCheck size={17} color="#FFFFFF" />
                <Text className="text-[1rem] font-semibold text-white">{openingBankId ? 'Åpner BankID …' : 'Verifiser med BankID'}</Text>
              </Pressable>
            </View>
          )}

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mt-5" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {tabs.map((name) => (
              <Pressable
                key={name}
                onPress={() => setTab(name)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === name }}
                className={`h-10 justify-center rounded-full border px-4 ${tab === name ? 'border-ink bg-ink' : 'border-line bg-surface'}`}
              >
                <Text className={`text-[0.9375rem] font-semibold ${tab === name ? 'text-page' : 'text-ink-2'}`}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View className="mt-4 gap-4">
            {tab === 'Om meg' || tab === 'Om oss' ? (
              <>
                <Panel icon={Briefcase} title={tab} onEdit={edit}>
                  {user.bio ? (
                    <Text className="text-[0.9375rem] leading-6 text-ink-2">{user.bio}</Text>
                  ) : (
                    <>
                      <Text className="text-[0.9375rem] text-muted">Du har ikke skrevet noe om deg selv ennå.</Text>
                      <AddButton label="Skriv en bio" onPress={edit} />
                    </>
                  )}
                </Panel>

                <Panel icon={Award} title="Ferdigheter" onEdit={user.skills?.length ? edit : undefined}>
                  {user.skills?.length ? (
                    <View className="flex-row flex-wrap gap-2">
                      {user.skills.map((skill) => (
                        <View key={skill} className="rounded-full bg-tint px-3 py-1.5">
                          <Text className="text-[0.875rem] font-medium text-brand-text">{skill}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <>
                      <Text className="text-[0.9375rem] text-muted">Ingen ferdigheter lagt til.</Text>
                      <AddButton label="Legg til" onPress={edit} />
                    </>
                  )}
                </Panel>

                {user.locations?.length ? (
                  <Panel icon={MapPin} title="Områder">
                    <View className="flex-row flex-wrap gap-2">
                      {user.locations.map((area) => (
                        <View key={area} className="rounded-full bg-surface-2 px-3 py-1.5">
                          <Text className="text-[0.875rem] text-ink-2">{area}</Text>
                        </View>
                      ))}
                    </View>
                  </Panel>
                ) : null}

                <Panel icon={CalendarClock} title="Tilgjengelighet" onEdit={user.availabilityText ? edit : undefined}>
                  {user.availabilityText ? (
                    <Text className="text-[0.9375rem] leading-6 text-ink-2">{user.availabilityText}</Text>
                  ) : (
                    <>
                      <Text className="text-[0.9375rem] text-muted">Fortell når du kan ta oppdrag.</Text>
                      <AddButton label="Legg til" onPress={edit} />
                    </>
                  )}
                </Panel>

                {/* Vurdering: average + a bar per star level (counted from the reviews). */}
                <View className="rounded-3xl border border-line bg-surface p-5">
                  <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">Vurdering</Text>
                  {reviewCount ? (
                    <View className="mt-3 flex-row items-center gap-5">
                      <View className="items-center">
                        <Text className="text-[2.5rem] font-bold leading-none text-ink">{rating.toFixed(1)}</Text>
                        <Text className="mt-1 text-[0.8125rem] text-muted">{reviewCount} {reviewCount === 1 ? 'vurdering' : 'vurderinger'}</Text>
                      </View>
                      <View className="flex-1 gap-1.5">
                        {distribution.map(({ stars, count }) => (
                          <View key={stars} className="flex-row items-center gap-2">
                            <Text className="w-3 text-[0.8125rem] text-muted">{stars}</Text>
                            <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <View className="h-full rounded-full bg-brand" style={{ width: `${reviewCount ? (count / reviewCount) * 100 : 0}%` }} />
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Text className="mt-2 text-[0.9375rem] text-muted">Ingen vurderinger ennå.</Text>
                  )}
                </View>

                {reliability.length ? (
                  <View className="rounded-3xl border border-line bg-surface p-5">
                    <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">Pålitelighet</Text>
                    {reliability.map(([label, value], index) => (
                      <View key={label} className={`flex-row items-center justify-between py-2.5 ${index ? 'border-t border-line-soft' : ''}`}>
                        <Text className="text-[0.9375rem] text-ink-2">{label}</Text>
                        <Text className="text-[0.9375rem] font-semibold text-ink">{value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable onPress={() => router.push('/profile/settings/safepay')} className="rounded-3xl border border-line bg-surface p-5 active:bg-surface-2">
                  <View className="flex-row items-center gap-2">
                    <ShieldCheck size={17} color={TC.brandText} />
                    <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">SafePay</Text>
                  </View>
                  <Text className="mt-2 text-[1.75rem] font-bold tabular-nums text-ink">
                    {Number(user.totalEarned || 0).toLocaleString('nb-NO')} kr
                  </Text>
                  <Text className="mt-0.5 text-[0.9375rem] text-muted">
                    Utbetalt til deg. <Text className="font-semibold text-brand-text">Se historikken →</Text>
                  </Text>
                </Pressable>
              </>
            ) : null}

            {tab === 'Fullførte'
              ? finished.length ? (
                  <View className="gap-2.5">
                    {finished.map((application) => (
                      <ListItem
                        key={application._id}
                        title={application.service?.title || 'Oppdrag'}
                        meta={`Fullført${application.service?.location?.city ? ` · ${application.service.location.city}` : ''}`}
                        right={application.order?.agreedPrice ? `${application.order.agreedPrice.toLocaleString('nb-NO')} kr` : undefined}
                        onPress={() => application.order?._id && router.push({ pathname: '/(app)/provider/orders/[orderId]', params: { orderId: application.order._id } })}
                      />
                    ))}
                  </View>
                ) : (
                  <Empty title="Ingen fullførte oppdrag" text="Fullførte oppdrag vises her når de er godkjent." />
                )
              : null}

            {tab === 'Aktive' ? renderJobs(activeJobs, 'Ingen aktive oppdrag', 'Oppdrag du legger ut, vises her.') : null}
            {tab === 'Tidligere' ? renderJobs(pastJobs, 'Ingen tidligere oppdrag', 'Fullførte og avsluttede oppdrag vises her.') : null}

            {tab === 'Vurderinger'
              ? reviews.length ? (
                  <View className="gap-3">{reviews.map((review) => <ReviewCard key={review._id} review={review} />)}</View>
                ) : (
                  <Empty title="Ingen vurderinger ennå" text="Vurderinger fra fullførte oppdrag vises her." />
                )
              : null}
          </View>
        </View>
      </ScrollView>

      <DropdownMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        top={menuTop}
        items={[
          { label: 'Mine annonser', icon: Megaphone, onPress: () => router.push('/my-jobs') },
          { label: 'Mine søkere', icon: Users, onPress: () => router.push('/my-applications') },
          { label: 'Lagrede lister', icon: Bookmark, onPress: () => router.push('/(app)/favorites') },
          { label: 'SafePay', icon: ShieldCheck, onPress: () => router.push('/profile/settings/safepay') },
          { label: 'Innstillinger', icon: Settings, onPress: () => router.push('/(app)/profile/settings') },
          null,
          { label: 'Logg ut', icon: LogOut, destructive: true, onPress: () => setLogoutVisible(true) },
        ]}
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
