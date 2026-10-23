import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  BellOff,
  Briefcase,
  Banknote,
  MessageSquare,
  Star,
  ClipboardCheck,
  CheckCheck,
  Settings2,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
} from '../../src/hooks/useNotifications';
import { useAuthStore } from '../../src/store/authStore';
import { resolveOrderRoute } from '../../src/utils/orderRoute';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../src/components/ui/LoadingIndicator';
import { cn } from '../../src/lib/utils';
import { useTabBarSpace } from '../../src/components/GlassTabBar';
import type { Notification } from '../../src/types/Notification';
import { TC, tc } from '../../src/theme/colors';

/* ── Notification type metadata ──────────────────────────────────────────── */

type Meta = { label: string; Icon: LucideIcon; tint: string; color: string };

const META: Record<string, Meta> = {
  order: { label: 'Bestilling', Icon: Banknote, tint: 'bg-tint', color: TC.brandText },
  payment: { label: 'Betaling', Icon: Banknote, tint: 'bg-tint', color: TC.brandText },
  application: { label: 'Søknad', Icon: Briefcase, tint: 'bg-[#EAF0FA]', color: '#2F5D9E' },
  message: { label: 'Melding', Icon: MessageSquare, tint: 'bg-[#F2EEF9]', color: '#6B4FA0' },
  review: { label: 'Anmeldelse', Icon: Star, tint: 'bg-[#FBF4E3]', color: '#96752A' },
  job_update: { label: 'Jobboppdatering', Icon: ClipboardCheck, tint: 'bg-surface-2', color: tc('#63665F', 'muted') },
};

const notificationMeta = (type: string): Meta =>
  META[type] || { label: 'Varsel', Icon: Bell, tint: 'bg-surface-2', color: tc('#63665F', 'muted') };

/* ── Time ────────────────────────────────────────────────────────────────── */

function formatNotificationTime(date: string): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Nå';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} t`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} d`;
  return new Date(date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

/** Groups by calendar day in the device's time zone: I dag, I går, Denne uken, Eldre. */
function sectionTitle(date: string): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - new Date(date).getTime()) / 86400000) + 1;
  if (days <= 0) return 'I dag';
  if (days === 1) return 'I går';
  if (days < 7) return 'Denne uken';
  return 'Eldre';
}

/* ── Category filter — value is the API `type` enum, label is display-only ─ */

const FILTER_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'application', label: 'Søknader' },
  { value: 'payment', label: 'Betalinger' },
  { value: 'message', label: 'Meldinger' },
  { value: 'review', label: 'Anmeldelser' },
  { value: 'job_update', label: 'Oppdrag' },
];

const keyExtractor = (item: Notification) => item._id;

/* ── One notification ────────────────────────────────────────────────────── */

function NotificationRow({
  item,
  onOpen,
  onDelete,
}: {
  item: Notification;
  onOpen: (item: Notification) => void;
  onDelete: (id: string) => void;
}) {
  const { label, Icon, tint, color } = notificationMeta(item.type);
  const isUnread = !item.read;
  const isSystem = !!item.isSystem || (!item.userId && item.readBy);
  const sender = item.senderId?.name
    ? [item.senderId.name, item.senderId.lastName].filter(Boolean).join(' ')
    : null;

  return (
    <Pressable
      onPress={() => onOpen(item)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${item.content}${isUnread ? ', ulest' : ''}`}
      className={cn(
        'mx-4 mb-2 flex-row items-start gap-3 rounded-2xl border p-3.5 active:opacity-80',
        isUnread ? 'border-brand-text/25 bg-surface' : 'border-line bg-white/70'
      )}
    >
      <View>
        {item.senderId?.avatarUrl ? (
          <Image source={{ uri: item.senderId.avatarUrl }} className="h-11 w-11 rounded-full bg-tint" />
        ) : (
          <View className={cn('h-11 w-11 items-center justify-center rounded-full', tint)}>
            <Icon size={18} color={color} />
          </View>
        )}
        {item.senderId?.avatarUrl ? (
          <View className={cn('absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white', tint)}>
            <Icon size={10} color={color} />
          </View>
        ) : null}
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-[0.8125rem] font-semibold text-muted" numberOfLines={1}>
            {sender ? `${label} · ${sender}` : label}
          </Text>
          <Text className="text-[0.8125rem] tabular-nums text-subtle">{formatNotificationTime(item.createdAt)}</Text>
          {isUnread ? <View className="h-2 w-2 rounded-full bg-brand" accessibilityLabel="Ulest" /> : null}
        </View>
        <Text
          className={cn('mt-1 text-[0.875rem] leading-5', isUnread ? 'font-semibold text-ink' : 'text-ink-2')}
          numberOfLines={3}
        >
          {item.content}
        </Text>
      </View>

      {!isSystem ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete(item._id);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Slett varsel"
          className="-mr-1 h-8 w-8 items-center justify-center rounded-full active:bg-surface-2"
        >
          <Trash2 size={15} color={tc('#9B9E96', 'subtle')} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

export default function AlertsScreen() {
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user && typeof s.user._id === 'string' ? (s.user._id as string) : null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [deleteAllVisible, setDeleteAllVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const typeFilter = activeCategory === 'all' ? undefined : activeCategory;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useNotifications(typeFilter);
  const { data: unreadCountData, refetch: refetchUnreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const deleteSingle = useDeleteNotification();
  const deleteAll = useDeleteAllNotifications();

  const unreadCount = unreadCountData?.count ?? 0;
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refetch(), refetchUnreadCount()]); } finally { setRefreshing(false); }
  };

  const allNotifications: Notification[] = useMemo(
    () => (data?.pages ? data.pages.flatMap((p) => p.data) : []),
    [data]
  );

  const sections = useMemo(() => {
    const visible = showUnreadOnly ? allNotifications.filter((n) => !n.read) : allNotifications;
    const groups: { title: string; data: Notification[] }[] = [];
    for (const n of visible) {
      const title = sectionTitle(n.createdAt);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(n);
      else groups.push({ title, data: [n] });
    }
    return groups;
  }, [allNotifications, showUnreadOnly]);

  const hasFilter = showUnreadOnly || activeCategory !== 'all';
  const resetFilters = () => {
    setShowUnreadOnly(false);
    setActiveCategory('all');
  };

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const handleMarkAll = useCallback(() => {
    markAll.mutate(undefined, {
      onError: () => Alert.alert('Feil', 'Kunne ikke merke varslene som lest.'),
    });
  }, [markAll]);

  const handleDeleteAll = useCallback(() => {
    deleteAll.mutate(undefined, {
      onSuccess: () => Alert.alert('Slettet', 'Alle personlige varsler er slettet.'),
      onError: () => Alert.alert('Feil', 'Kunne ikke slette varslene.'),
      onSettled: () => setDeleteAllVisible(false),
    });
  }, [deleteAll]);

  const handleDeleteSingle = useCallback(() => {
    if (!deleteTargetId) return;
    deleteSingle.mutate(deleteTargetId, {
      onError: () => Alert.alert('Feil', 'Kunne ikke slette varselet.'),
      onSettled: () => setDeleteTargetId(null),
    });
  }, [deleteTargetId, deleteSingle]);

  /* ── Navigation ────────────────────────────────────────────────────────── */

  const openNotification = useCallback(
    (n: Notification) => {
      if (!n.read) {
        markAsRead.mutateAsync(n._id).catch(() => {});
      }

      if (n.orderId) {
        const route = resolveOrderRoute(n.orderId, userId);
        if (route) {
          router.push(route);
          return;
        }
        Alert.alert('Feil', 'Denne ordren er ikke tilgjengelig lenger.');
        return;
      }

      if (n.requestId) {
        const request = n.requestId as { serviceId?: string | { _id?: string } };
        const serviceId = typeof request.serviceId === 'object' ? request.serviceId?._id : request.serviceId;
        if (serviceId) {
          router.push({ pathname: '/(app)/job-applicants/[serviceId]', params: { serviceId } });
        }
        return;
      }

      if (n.senderId?._id) {
        router.push({ pathname: '/(app)/profile/[userId]', params: { userId: n.senderId._id } });
      }
    },
    [markAsRead, userId, router]
  );

  /* ── Render ────────────────────────────────────────────────────────────── */

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationRow item={item} onOpen={openNotification} onDelete={setDeleteTargetId} />
    ),
    [openNotification]
  );

  const header = (
    <View className="px-4 pb-3 pt-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink">Varsler</Text>
          <Text className="mt-0.5 text-[0.875rem] text-muted">
            {unreadCount > 0 ? `Du har ${unreadCount} ${unreadCount === 1 ? 'ulest varsel' : 'uleste varsler'}` : 'Du er oppdatert'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/profile/settings/notifications')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Varslingsinnstillinger"
          className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface active:opacity-80"
        >
          <Settings2 size={18} color={TC.ink} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4 mt-4"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <Chip
          label="Uleste"
          selected={showUnreadOnly}
          count={unreadCount}
          onPress={() => setShowUnreadOnly((v) => !v)}
        />
        <View className="mx-1 w-px self-stretch bg-line" />
        {FILTER_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={activeCategory === option.value}
            onPress={() => setActiveCategory(option.value)}
          />
        ))}
      </ScrollView>

      {(unreadCount > 0 || allNotifications.length > 0) && (
        <View className="mt-3 flex-row items-center justify-between">
          {unreadCount > 0 ? (
            <Button
              label="Merk alle som lest"
              variant="secondary"
              small
              disabled={markAll.isPending}
              onPress={handleMarkAll}
              icon={<CheckCheck size={15} color={TC.ink} style={{ marginRight: 6 }} />}
            />
          ) : <View />}
          {allNotifications.length > 0 ? (
            <Button label="Slett alle" variant="ghost" small onPress={() => setDeleteAllVisible(true)} />
          ) : null}
        </View>
      )}
    </View>
  );

  const empty = isLoading ? (
    <LoadingIndicator message="Laster varsler..." />
  ) : (
    <EmptyState
      icon={
        <View className="h-14 w-14 items-center justify-center rounded-full bg-tint">
          {hasFilter ? <BellOff size={24} color={TC.brandText} /> : <Bell size={24} color={TC.brandText} />}
        </View>
      }
      title={hasFilter ? 'Ingen treff' : 'Ingen varsler ennå'}
      message={
        hasFilter
          ? 'Ingen varsler passer filteret ditt.'
          : 'Du får beskjed her når det skjer noe med oppdragene, søknadene eller betalingene dine.'
      }
      action={hasFilter ? <Button label="Nullstill filter" variant="secondary" small onPress={resetFilters} /> : undefined}
    />
  );

  const footer = isFetchingNextPage ? (
    <ActivityIndicator className="py-6" color={TC.brandText} />
  ) : hasNextPage ? (
    <View className="items-center py-4">
      <Button label="Vis flere" variant="secondary" small onPress={() => fetchNextPage()} />
    </View>
  ) : null;

  return (
    <SafeAreaView className="flex-1 bg-page" edges={['top']}>
      {isError && !isLoading ? (
        <>
          {header}
          <ErrorState
            title="Vi fikk ikke hentet varslene dine"
            message="Sjekk internettforbindelsen din og prøv igjen."
            onAction={() => refetch()}
          />
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text className="bg-page px-4 pb-2 pt-3 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              {section.title}
            </Text>
          )}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingBottom: 24 + tabBarSpace }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={TC.brandText}
              colors={[TC.brandText]}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
        />
      )}

      <ConfirmDialog
        visible={!!deleteTargetId}
        title="Slett varsel?"
        message="Er du sikker på at du vil slette dette varselet?"
        confirmLabel="Slett"
        destructive
        isPending={deleteSingle.isPending}
        onConfirm={handleDeleteSingle}
        onClose={() => setDeleteTargetId(null)}
      />

      <ConfirmDialog
        visible={deleteAllVisible}
        title="Slett alle varsler?"
        message="Slett alle personlige varsler? Denne handlingen kan ikke angres."
        confirmLabel="Slett alle"
        destructive
        isPending={deleteAll.isPending}
        onConfirm={handleDeleteAll}
        onClose={() => setDeleteAllVisible(false)}
      />
    </SafeAreaView>
  );
}
