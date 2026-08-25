import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { FavoriteListCard } from '../../../src/components/domain/FavoriteListCard';
import { FavoriteListFormDialog } from '../../../src/components/domain/FavoriteListFormDialog';
import {
  useCreateFavoriteList,
  useFavoriteLists,
} from '../../../src/hooks/useFavoriteLists';
import { favoriteListErrorMessage } from '../../../src/utils/favoriteListErrors';

const GRID_GAP = 12;
const PAGE_PADDING = 16;

/** Two columns on every phone width; a third only where there is real room for it. */
function columnCount(width: number) {
  return width >= 700 ? 3 : 2;
}

function ListsSkeleton({ cardWidth, columns }: { cardWidth: number; columns: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
      {Array.from({ length: columns * 2 }).map((_, index) => (
        <View
          key={index}
          style={{ width: cardWidth }}
          className="overflow-hidden rounded-[24px] border border-[#E6E7E1] bg-white"
        >
          <View className="aspect-[4/5] bg-[#EAF1E9]" />
          <View className="px-3.5 py-3">
            <View className="h-3.5 w-4/5 rounded-full bg-[#EAF1E9]" />
            <View className="mt-2 h-2.5 w-1/2 rounded-full bg-[#F1F3EE]" />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Lagrede lister — the authenticated user's saved lists.
 *
 * Reads `GET /api/lists` with no `userId` parameter: the backend derives the owner from
 * the token, and the endpoint returns lists the user owns as well as lists they were
 * added to as a contributor. Contributor collaboration has no UI on mobile, but a list
 * shared with the user still belongs in their overview, so those are not filtered out.
 *
 * Favorites live only in the TanStack cache, which `authStore.clearAuthenticatedSession()`
 * wipes on logout and on an account switch. Nothing is written to AsyncStorage.
 */
export default function FavoritesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data: lists, isLoading, isError, refetch, isRefetching } = useFavoriteLists();
  const createList = useCreateFavoriteList();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const columns = columnCount(width);
  const cardWidth = (width - PAGE_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  const sortedLists = useMemo(() => {
    if (!lists) return [];
    // Most recently touched first, with the name as a stable tiebreaker so the grid does
    // not reshuffle between renders when timestamps match.
    return [...lists].sort((a, b) => {
      const left = a.updatedAt ?? a.createdAt ?? '';
      const right = b.updatedAt ?? b.createdAt ?? '';
      if (left !== right) return right.localeCompare(left);
      return a.name.localeCompare(b.name, 'nb-NO');
    });
  }, [lists]);

  const handleCreate = (values: { name: string }) => {
    setCreateError(null);
    createList.mutate(
      { name: values.name },
      {
        onSuccess: () => setIsCreateOpen(false),
        onError: (error) =>
          setCreateError(favoriteListErrorMessage(error, 'Kunne ikke opprette listen.')),
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
          Lagrede lister
        </Text>

        <Pressable
          onPress={() => {
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-[#2E6641]"
          accessibilityRole="button"
          accessibilityLabel="Opprett ny liste"
        >
          <Plus size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PADDING, paddingBottom: 32 }}
      >
        <Text className="mb-1 text-[1.75rem] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
          Lagrede lister
        </Text>
        <Text className="mb-5 text-[0.875rem] text-[#63665F]">
          Oppdragene du har lagret, samlet i dine egne lister.
        </Text>

        {isLoading ? (
          <ListsSkeleton cardWidth={cardWidth} columns={columns} />
        ) : isError ? (
          <ErrorState
            title="Kunne ikke laste listene dine"
            message="Sjekk internettforbindelsen din og prøv igjen."
            actionLabel="Prøv igjen"
            onAction={() => void refetch()}
          />
        ) : sortedLists.length === 0 ? (
          <View className="rounded-[24px] border border-[#E6E7E1] bg-white p-8">
            <Text className="text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">
              Du har ingen lister ennå
            </Text>
            <Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-[#63665F]">
              Lag en liste for å samle oppdragene du vil komme tilbake til.
            </Text>
            <Pressable
              onPress={() => {
                setCreateError(null);
                setIsCreateOpen(true);
              }}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-full bg-[#2E6641] px-4 py-3.5"
              accessibilityRole="button"
            >
              <Plus size={16} color="#FFFFFF" />
              <Text className="text-[0.9375rem] font-semibold text-white">Opprett liste</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
              {sortedLists.map((list) => (
                <View key={list._id} style={{ width: cardWidth }}>
                  <FavoriteListCard
                    list={list}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/favorites/[listId]',
                        params: { listId: list._id },
                      })
                    }
                  />
                </View>
              ))}
            </View>

            {isRefetching ? (
              <Text className="mt-5 text-center text-[0.75rem] text-[#63665F]">Oppdaterer...</Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <FavoriteListFormDialog
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        title="Ny liste"
        submitLabel="Opprett"
        pendingLabel="Oppretter..."
        isPending={createList.isPending}
        errorMessage={createError}
      />
    </SafeAreaView>
  );
}
