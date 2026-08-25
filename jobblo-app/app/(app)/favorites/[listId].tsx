import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Globe, Lock, Pencil, Trash2 } from 'lucide-react-native';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { SavedJobCard } from '../../../src/components/domain/SavedJobCard';
import { ListVisibilityPill } from '../../../src/components/domain/FavoriteListCard';
import { FavoriteListFormDialog } from '../../../src/components/domain/FavoriteListFormDialog';
import {
  useDeleteFavoriteList,
  useFavoriteList,
  useRemoveServiceFromFavoriteList,
  useUpdateFavoriteList,
} from '../../../src/hooks/useFavoriteLists';
import {
  favoriteListCount,
  favoriteListServices,
  isFavoriteListContributor,
  isFavoriteListOwner,
} from '../../../src/types/FavoriteList';
import { favoriteListErrorMessage } from '../../../src/utils/favoriteListErrors';
import { useAuthStore } from '../../../src/store/authStore';

function DetailSkeleton() {
  return (
    <View className="px-4">
      <View className="h-7 w-2/3 rounded-full bg-[#E4E7DF]" />
      <View className="mt-3 h-3.5 w-1/3 rounded-full bg-[#EAF1E9]" />
      <View className="mt-6 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={index}
            className="flex-row items-center gap-3.5 rounded-[24px] border border-[#E6E7E1] bg-white p-3"
          >
            <View className="h-[76px] w-[76px] rounded-2xl bg-[#EAF1E9]" />
            <View className="flex-1">
              <View className="h-3.5 w-5/6 rounded-full bg-[#EAF1E9]" />
              <View className="mt-2.5 h-2.5 w-1/2 rounded-full bg-[#F1F3EE]" />
              <View className="mt-2.5 h-2.5 w-1/3 rounded-full bg-[#F1F3EE]" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One saved list — `GET /api/lists/:listId`.
 *
 * Permissions follow the backend exactly, so nothing is offered that the server would
 * refuse. Rename, description, visibility and delete are owner-only (`PUT`/`DELETE
 * /api/lists/:listId` both match on `{ _id, user: req.userId }`); removing a saved job is
 * allowed for an owner or a contributor.
 *
 * Contributor collaboration is deferred for mobile: a list shared with the user is
 * readable and its jobs can be removed, but there is no UI to add, list or remove
 * contributors, and no public-list discovery or sharing surface. The visibility toggle
 * only flips the stored `public` flag.
 */
export default function FavoriteListDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listId?: string | string[] }>();
  const listId = Array.isArray(params.listId) ? params.listId[0] : params.listId;

  const currentUserId = useAuthStore((state) =>
    state.user && typeof state.user._id === 'string' ? state.user._id : null
  );

  const { data: list, isLoading, isError, refetch, isRefetching } = useFavoriteList(listId);
  const updateList = useUpdateFavoriteList();
  const deleteList = useDeleteFavoriteList();
  const removeService = useRemoveServiceFromFavoriteList();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; title: string } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const isOwner = isFavoriteListOwner(list, currentUserId);
  const isContributor = isFavoriteListContributor(list, currentUserId);
  const canRemoveServices = isOwner || isContributor;

  const services = useMemo(() => favoriteListServices(list), [list]);
  const count = favoriteListCount(list);
  // Saved references that could not be populated — a job deleted after it was saved. The
  // count above stays truthful, and this line says why the numbers differ.
  const unresolved = count - services.length;

  const handleEdit = (values: { name: string; description?: string }) => {
    if (!listId) return;
    setEditError(null);
    updateList.mutate(
      { listId, data: { name: values.name, description: values.description ?? '' } },
      {
        onSuccess: () => setIsEditOpen(false),
        onError: (error) =>
          setEditError(favoriteListErrorMessage(error, 'Kunne ikke lagre endringene.')),
      }
    );
  };

  const handleToggleVisibility = () => {
    if (!listId || !list) return;
    setBanner(null);
    updateList.mutate(
      { listId, data: { public: !list.public } },
      {
        onError: (error) =>
          setBanner(favoriteListErrorMessage(error, 'Kunne ikke endre synligheten.')),
      }
    );
  };

  const handleDelete = () => {
    if (!listId) return;
    setDeleteError(null);
    deleteList.mutate(listId, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        router.back();
      },
      onError: (error) =>
        setDeleteError(favoriteListErrorMessage(error, 'Kunne ikke slette listen.')),
    });
  };

  const handleRemoveService = () => {
    if (!listId || !pendingRemoval) return;
    setRemoveError(null);
    removeService.mutate(
      { listId, serviceId: pendingRemoval.id },
      {
        onSuccess: () => setPendingRemoval(null),
        onError: (error) =>
          setRemoveError(favoriteListErrorMessage(error, 'Kunne ikke fjerne oppdraget.')),
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <View className="flex-row items-center justify-between px-4 pb-3 pt-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white"
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ArrowLeft size={18} color="#0B0B0B" />
        </Pressable>

        <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
          Liste
        </Text>

        {isOwner ? (
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setEditError(null);
                setIsEditOpen(true);
              }}
              className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white"
              accessibilityRole="button"
              accessibilityLabel="Rediger liste"
            >
              <Pencil size={16} color="#0B0B0B" />
            </Pressable>
            <Pressable
              onPress={() => {
                setDeleteError(null);
                setIsDeleteOpen(true);
              }}
              className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white"
              accessibilityRole="button"
              accessibilityLabel="Slett liste"
            >
              <Trash2 size={16} color="#B4544A" />
            </Pressable>
          </View>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      {isLoading ? (
        <DetailSkeleton />
      ) : isError || !list ? (
        <ErrorState
          title="Kunne ikke laste listen"
          message="Listen finnes kanskje ikke lenger, eller nettforbindelsen sviktet."
          actionLabel="Prøv igjen"
          onAction={() => void refetch()}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
          <Text className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            {list.name}
          </Text>

          {list.description ? (
            <Text className="mt-2 text-[0.875rem] leading-relaxed text-[#63665F]">
              {list.description}
            </Text>
          ) : null}

          <View className="mt-3 flex-row items-center gap-2">
            <Text className="text-[0.8125rem] text-[#63665F]">
              {count === 1 ? '1 oppdrag' : `${count} oppdrag`}
            </Text>
            <ListVisibilityPill isPublic={list.public} />
            {isContributor && !isOwner ? (
              <View className="rounded-full border border-[#E6E7E1] bg-white px-2.5 py-1.5">
                <Text className="text-[0.6875rem] font-semibold text-[#63665F]">Delt med deg</Text>
              </View>
            ) : null}
          </View>

          {banner ? (
            <View className="mt-4 rounded-2xl border border-[#E7CFCB] bg-[#FBF1F0] px-3.5 py-3">
              <Text className="text-[0.8125rem] font-medium text-[#B4544A]">{banner}</Text>
            </View>
          ) : null}

          {isOwner ? (
            <Pressable
              onPress={handleToggleVisibility}
              disabled={updateList.isPending}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 py-3 ${
                updateList.isPending ? 'opacity-60' : ''
              }`}
              accessibilityRole="button"
              accessibilityLabel={list.public ? 'Gjør listen privat' : 'Gjør listen offentlig'}
            >
              {updateList.isPending ? (
                <ActivityIndicator size="small" color="#2E6641" />
              ) : list.public ? (
                <Lock size={15} color="#0B0B0B" />
              ) : (
                <Globe size={15} color="#0B0B0B" />
              )}
              <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                {list.public ? 'Gjør privat' : 'Gjør offentlig'}
              </Text>
            </Pressable>
          ) : null}

          {unresolved > 0 ? (
            <Text className="mt-4 text-[0.75rem] text-[#63665F]">
              {unresolved === 1
                ? '1 lagret oppdrag er ikke tilgjengelig lenger.'
                : `${unresolved} lagrede oppdrag er ikke tilgjengelige lenger.`}
            </Text>
          ) : null}

          {services.length === 0 ? (
            <View className="mt-5 rounded-[24px] border border-[#E6E7E1] bg-white p-8">
              <Text className="text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">
                Ingen oppdrag i listen ennå
              </Text>
              <Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-[#63665F]">
                Åpne et oppdrag og trykk på bokmerket for å lagre det her.
              </Text>
            </View>
          ) : (
            <View className="mt-5 gap-3">
              {services.map((job) => (
                <SavedJobCard
                  key={job._id}
                  job={job}
                  onRemove={
                    canRemoveServices
                      ? () => {
                          setRemoveError(null);
                          setPendingRemoval({ id: job._id, title: job.title || 'oppdraget' });
                        }
                      : undefined
                  }
                  isRemoving={removeService.isPending && pendingRemoval?.id === job._id}
                />
              ))}
            </View>
          )}

          {isRefetching ? (
            <Text className="mt-5 text-center text-[0.75rem] text-[#63665F]">Oppdaterer...</Text>
          ) : null}
        </ScrollView>
      )}

      <FavoriteListFormDialog
        visible={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEdit}
        title="Rediger liste"
        submitLabel="Lagre"
        pendingLabel="Lagrer..."
        initialName={list?.name ?? ''}
        initialDescription={list?.description ?? ''}
        showDescription
        isPending={updateList.isPending}
        errorMessage={editError}
      />

      <ConfirmDialog
        visible={isDeleteOpen}
        title="Slette listen?"
        message={`«${list?.name ?? 'Listen'}» og alle lagrede oppdrag i den blir borte. Oppdragene selv slettes ikke.`}
        confirmLabel="Slett liste"
        pendingLabel="Sletter..."
        destructive
        isPending={deleteList.isPending}
        errorMessage={deleteError}
        onConfirm={handleDelete}
        onClose={() => setIsDeleteOpen(false)}
      />

      <ConfirmDialog
        visible={!!pendingRemoval}
        title="Fjerne fra listen?"
        message={pendingRemoval ? `«${pendingRemoval.title}» fjernes fra «${list?.name ?? 'listen'}».` : undefined}
        confirmLabel="Fjern"
        pendingLabel="Fjerner..."
        destructive
        isPending={removeService.isPending}
        errorMessage={removeError}
        onConfirm={handleRemoveService}
        onClose={() => setPendingRemoval(null)}
      />
    </SafeAreaView>
  );
}
