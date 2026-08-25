import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  Briefcase,
  Banknote,
  MessageSquare,
  Star,
  ClipboardCheck,
  Check,
  Trash2,
  ChevronLeft,
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
import type { Notification } from '../../src/types/Notification';

/* ── Notification type metadata ──────────────────────────────────────────── */

const META: Record<string, { label: string; Icon: LucideIcon }> = {
  order: { label: 'Bestilling', Icon: Banknote },
  payment: { label: 'Betaling', Icon: Banknote },
  application: { label: 'Søknad', Icon: Briefcase },
  message: { label: 'Melding', Icon: MessageSquare },
  review: { label: 'Anmeldelse', Icon: Star },
  job_update: { label: 'Jobboppdatering', Icon: ClipboardCheck },
};

function notificationMeta(type: string): { label: string; Icon: LucideIcon } {
  return META[type] || { label: 'Varsel', Icon: ClipboardCheck };
}

/* ── Relative time ───────────────────────────────────────────────────────── */

function formatNotificationTime(date: string): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Nå';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} t`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} d`;
  return new Date(date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

/* ── Category filters ────────────────────────────────────────────────────── */

const CATEGORIES = [
  { key: 'all', label: 'Alle', Icon: Bell },
  { key: 'application', label: 'Søknader', Icon: Briefcase },
  { key: 'payment', label: 'Betalinger', Icon: Banknote },
  { key: 'message', label: 'Meldinger', Icon: MessageSquare },
  { key: 'review', label: 'Anmeldelser', Icon: Star },
  { key: 'job_update', label: 'Jobber', Icon: ClipboardCheck },
];

/* ── Safe id extractor ───────────────────────────────────────────────────── */

const keyExtractor = (item: Notification) => item._id;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function AlertsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user && typeof s.user._id === 'string' ? (s.user._id as string) : null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [deleteAllVisible, setDeleteAllVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const typeFilter = activeCategory === 'all' ? undefined : activeCategory;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useNotifications(typeFilter);

  const { data: unreadCountData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const deleteSingle = useDeleteNotification();
  const deleteAll = useDeleteAllNotifications();

  const unreadCount = unreadCountData?.count ?? 0;

  const allNotifications: Notification[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.data);
  }, [data]);

  const filtered = useMemo(
    () => (showUnreadOnly ? allNotifications.filter((n) => !n.read) : allNotifications),
    [allNotifications, showUnreadOnly]
  );

  const hasFilter = showUnreadOnly || activeCategory !== 'all';

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
      onSuccess: () => Alert.alert('Slettet', 'Varselet er slettet.'),
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
          router.push(route as any);
          return;
        }
        Alert.alert('Feil', 'Denne ordren er ikke tilgjengelig lenger.');
        return;
      }

      if (n.requestId) {
        const request = n.requestId as { serviceId?: string | { _id?: string } };
        const serviceId =
          typeof request.serviceId === 'object' ? request.serviceId?._id : request.serviceId;
        if (serviceId) {
          router.push(`/(app)/job-applicants/${serviceId}`);
        }
        return;
      }

      if (n.senderId?._id) {
        router.push(`/(app)/profile`);
        return;
      }
    },
    [markAsRead, userId, router]
  );

  /* ── Render helpers ────────────────────────────────────────────────────── */

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => {
      const { label, Icon } = notificationMeta(item.type);
      const isUnread = !item.read;
      const isSystem = !!item.isSystem || (!item.userId && item.readBy);

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openNotification(item)}
          className={`mx-4 mb-2 flex-row items-start gap-3 rounded-3xl border p-4 ${
            isUnread ? 'border-[#2E6641]/30 bg-white' : 'border-[#E6E7E1] bg-white'
          }`}
          accessibilityLabel={`${label}: ${item.content}${isUnread ? ', ulest' : ''}`}
          accessibilityRole="button"
        >
          <View className="shrink-0">
            {item.senderId?.avatarUrl ? (
              <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
                <Image
                  source={{ uri: item.senderId.avatarUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View
                className={`h-10 w-10 items-center justify-center rounded-xl ${
                  isUnread ? 'bg-[#EAF1E9] text-[#2E6641]' : 'bg-[#F4F6F0]'
                }`}
              >
                <Icon size={16} color={isUnread ? '#2E6641' : '#9B9E96'} />
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                {label}
              </Text>
              <Text className="shrink-0 text-[0.6875rem] tabular-nums text-[#9B9E96]">
                {formatNotificationTime(item.createdAt)}
              </Text>
            </View>
            <Text
              className={`mt-1 text-[0.875rem] leading-relaxed ${
                isUnread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'
              }`}
              numberOfLines={3}
            >
              {item.content}
            </Text>
          </View>

          <View className="shrink-0 flex-row items-center gap-1">
            {isUnread && (
              <View className="mr-1 h-2 w-2 rounded-full bg-[#2E6641]" accessibilityLabel="Ulest" />
            )}
            {!isSystem && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  setDeleteTargetId(item._id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="h-8 w-8 items-center justify-center rounded-full"
                accessibilityLabel="Slett varsel"
              >
                <Trash2 size={14} color="#9B9E96" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [openNotification]
  );

  /* ── Empty state ───────────────────────────────────────────────────────── */

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View className="mx-4 mt-4 items-center rounded-3xl border border-[#E6E7E1] bg-white p-12">
        <View className="mb-4 h-11 w-11 items-center justify-center rounded-full bg-[#EAF1E9]">
          <Bell size={20} color="#2E6641" />
        </View>
        <Text className="text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">
          {hasFilter ? 'Ingen treff' : 'Ingen varsler ennå'}
        </Text>
        <Text className="mt-2 max-w-sm text-center text-[0.875rem] leading-relaxed text-[#63665F]">
          {hasFilter
            ? 'Prøv en annen kategori, eller nullstill filtrene.'
            : 'Du får beskjed her når det skjer noe med oppdragene, søknadene eller betalingene dine.'}
        </Text>
      </View>
    );
  }, [isLoading, hasFilter]);

  /* ── Footer ────────────────────────────────────────────────────────────── */

  const renderFooter = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return null;
    return (
      <View className="items-center py-6">
        <TouchableOpacity
          onPress={() => fetchNextPage()}
          activeOpacity={0.8}
          className="h-11 flex-row items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-6"
        >
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Se flere</Text>
        </TouchableOpacity>
      </View>
    );
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ── Main render ───────────────────────────────────────────────────────── */

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={22} color="#0B0B0B" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
            Varsler
          </Text>
          <Text className="mt-1 text-[1.25rem] font-bold text-[#0B0B0B]">
            {unreadCount > 0 ? `${unreadCount} uleste varsler` : 'Alt er lest'}
          </Text>
          <Text className="mt-0.5 text-[0.875rem] text-[#63665F]">
            Alt som skjer med oppdragene dine, samlet her.
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAll}
            disabled={markAll.isPending}
            activeOpacity={0.8}
            className="h-10 flex-row items-center gap-1.5 rounded-full border border-[#E6E7E1] bg-white px-4"
            accessibilityLabel="Merk alle som lest"
          >
            <Check size={15} color="#0B0B0B" />
            <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">Merk alle som lest</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips — horizontal scroll */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
        renderItem={({ item: cat }) => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.8}
              className={`mr-2 flex-row h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 ${
                isActive
                  ? 'border-[#2E6641] bg-[#2E6641]'
                  : 'border-[#E6E7E1] bg-white'
              }`}
              accessibilityLabel={cat.label}
              accessibilityState={{ selected: isActive }}
            >
              <cat.Icon size={14} color={isActive ? 'white' : '#63665F'} />
              <Text
                className={`text-[0.8125rem] font-medium ${
                  isActive ? 'text-white' : 'text-[#63665F]'
                }`}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Unread toggle + reset + delete all */}
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <TouchableOpacity
          onPress={() => setShowUnreadOnly((v) => !v)}
          activeOpacity={0.8}
          className={`flex-row h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 ${
            showUnreadOnly ? 'border-[#2E6641] bg-[#2E6641]' : 'border-[#E6E7E1] bg-white'
          }`}
          accessibilityLabel="Kun uleste"
          accessibilityState={{ selected: showUnreadOnly }}
        >
          <Text
            className={`text-[0.8125rem] font-medium ${
              showUnreadOnly ? 'text-white' : 'text-[#63665F]'
            }`}
          >
            Kun uleste
          </Text>
        </TouchableOpacity>

        {hasFilter && (
          <TouchableOpacity
            onPress={() => {
              setShowUnreadOnly(false);
              setActiveCategory('all');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-[0.8125rem] font-semibold text-[#63665F] underline">
              Nullstill
            </Text>
          </TouchableOpacity>
        )}

        {allNotifications.length > 0 && (
          <TouchableOpacity
            onPress={() => setDeleteAllVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="ml-auto"
            accessibilityLabel="Slett alle varsler"
          >
            <Text className="text-[0.8125rem] font-medium text-[#9B9E96]">Slett alle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification list */}
      {isError && !isLoading ? (
        <View className="mx-4 mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-6">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
            Vi fikk ikke hentet varslene dine.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 rounded-full bg-[#2E6641] px-4 py-2.5"
          >
            <Text className="text-center text-[0.875rem] font-semibold text-white">Prøv igjen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderNotification}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor="#2E6641"
              colors={['#2E6641']}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#2E6641" />
                <Text className="mt-4 text-[0.875rem] text-[#63665F]">Laster varsler...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Settings link */}
      <View className="border-t border-[#E6E7E1] bg-white px-4 py-3">
        <TouchableOpacity
          onPress={() => router.push('/(app)/profile/settings/notifications')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-center text-[0.8125rem] font-medium text-[#63665F]">
            Varslingsinnstillinger
          </Text>
        </TouchableOpacity>
      </View>

      {/* Delete single confirm */}
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

      {/* Delete all confirm */}
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
