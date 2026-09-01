import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Check, ChevronRight, Image as ImageIcon, Plus } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import {
  useAddServiceToFavoriteList,
  useCreateFavoriteListAndSave,
  useFavoriteLists,
  useRemoveServiceFromFavoriteList,
} from '../../hooks/useFavoriteLists';
import {
  FAVORITE_LIST_NAME_MAX_LENGTH,
  favoriteListContainsService,
  favoriteListCount,
  favoriteListCoverImage,
  type FavoriteList,
} from '../../types/FavoriteList';
import { favoriteListErrorMessage, isAlreadyInListError } from '../../utils/favoriteListErrors';

interface SaveToListSheetProps {
  visible: boolean;
  onClose: () => void;
  serviceId: string;
  serviceTitle?: string;
}

/**
 * "Lagre i liste" — the single entry point for putting a job into a saved list.
 *
 * Tapping a list toggles membership: `POST /api/lists/add-service` when the job is not in
 * it, `DELETE /api/lists/remove-service/...` when it is. Nothing is auto-created — there
 * is no hidden default list in the product, so a user with no lists is asked to name one.
 *
 * The already-saved case is a plain message, not a crash and not a second write: the
 * backend answers 400 `service_already_in_list`, which only happens when this sheet's
 * cache is behind the server (another device, or a stale entry), so the row is refreshed
 * and the user is told it is already there.
 */
export function SaveToListSheet({
  visible,
  onClose,
  serviceId,
  serviceTitle,
}: SaveToListSheetProps) {
  const { data: lists = [], isLoading, isError, refetch } = useFavoriteLists();

  const addService = useAddServiceToFavoriteList();
  const removeService = useRemoveServiceFromFavoriteList();
  const createAndSave = useCreateFavoriteListAndSave();

  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [pendingListId, setPendingListId] = useState<string | null>(null);

  const trimmedName = newListName.trim();
  const isBusy = addService.isPending || removeService.isPending || createAndSave.isPending;

  // Fresh sheet each time it opens — a stale error or a half-typed name from the previous
  // job would otherwise be waiting there.
  useEffect(() => {
    if (visible) return;
    setIsCreating(false);
    setNewListName('');
    setMessage(null);
    setPendingListId(null);
  }, [visible]);

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => a.name.localeCompare(b.name, 'nb-NO')),
    [lists]
  );

  const handleToggle = useCallback(
    async (list: FavoriteList) => {
      if (isBusy) return;
      setMessage(null);
      setPendingListId(list._id);

      const alreadySaved = favoriteListContainsService(list, serviceId);

      try {
        if (alreadySaved) {
          await removeService.mutateAsync({ listId: list._id, serviceId });
          setMessage({ tone: 'info', text: `Fjernet fra «${list.name}».` });
        } else {
          await addService.mutateAsync({ listId: list._id, serviceId });
          setMessage({ tone: 'info', text: `Lagret i «${list.name}».` });
        }
      } catch (error) {
        if (isAlreadyInListError(error)) {
          setMessage({ tone: 'info', text: 'Allerede lagret i denne listen.' });
          void refetch();
        } else {
          setMessage({
            tone: 'error',
            text: favoriteListErrorMessage(
              error,
              alreadySaved ? 'Kunne ikke fjerne fra listen.' : 'Kunne ikke lagre i listen.'
            ),
          });
        }
      } finally {
        setPendingListId(null);
      }
    },
    [addService, isBusy, refetch, removeService, serviceId]
  );

  const handleCreateAndSave = useCallback(async () => {
    if (!trimmedName || isBusy) return;
    setMessage(null);

    try {
      const result = await createAndSave.mutateAsync({ name: trimmedName, serviceId });

      if (result.added) {
        setNewListName('');
        setIsCreating(false);
        setMessage({ tone: 'info', text: `Lagret i «${result.list.name}».` });
        return;
      }

      /**
       * The list exists — it is deliberately kept. Only the save failed, and the message
       * says exactly that instead of implying the whole action was undone.
       */
      setNewListName('');
      setIsCreating(false);
      setMessage({
        tone: 'error',
        text: isAlreadyInListError(result.addError)
          ? 'Allerede lagret i denne listen.'
          : `Listen «${result.list.name}» ble opprettet, men oppdraget ble ikke lagret. Prøv å lagre det på nytt.`,
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: favoriteListErrorMessage(error, 'Kunne ikke opprette listen.'),
      });
    }
  }, [createAndSave, isBusy, serviceId, trimmedName]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissable={!isBusy}
      title={isCreating ? 'Ny liste' : 'Lagre i liste'}
      headerLeft={
        isCreating ? (
          <Pressable
            onPress={() => {
              setIsCreating(false);
              setMessage(null);
            }}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text className="text-[0.875rem] font-semibold text-[#63665F]">Tilbake</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              setIsCreating(true);
              setMessage(null);
            }}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text className="text-[0.875rem] font-semibold text-[#2E6641]">Ny liste</Text>
          </Pressable>
        )
      }
    >
      {serviceTitle ? (
        <Text className="mb-4 text-[0.8125rem] text-[#63665F]" numberOfLines={2}>
          {serviceTitle}
        </Text>
      ) : null}

      {message ? (
        <View
          className={`mb-4 rounded-2xl border px-3.5 py-3 ${
            message.tone === 'error'
              ? 'border-[#E7CFCB] bg-[#FBF1F0]'
              : 'border-[#E6E7E1] bg-[#F4F6F0]'
          }`}
        >
          <Text
            className={`text-[0.8125rem] font-medium ${
              message.tone === 'error' ? 'text-[#B4544A]' : 'text-[#0B0B0B]'
            }`}
          >
            {message.text}
          </Text>
        </View>
      ) : null}

      {isCreating ? (
        <View>
          <Text className="mb-2 text-[0.8125rem] font-semibold text-[#0B0B0B]">Navn på liste</Text>
          <TextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="F.eks. Sommerjobber"
            placeholderTextColor="#9B9E96"
            autoFocus
            editable={!isBusy}
            maxLength={FAVORITE_LIST_NAME_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => void handleCreateAndSave()}
            className="rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
          />
          <Text className="mt-1.5 text-right text-[0.6875rem] text-[#9B9E96]">
            {trimmedName.length}/{FAVORITE_LIST_NAME_MAX_LENGTH}
          </Text>

          <Pressable
            onPress={() => void handleCreateAndSave()}
            disabled={!trimmedName || isBusy}
            className={`mt-3 flex-row items-center justify-center gap-2 rounded-full px-4 py-3.5 ${
              !trimmedName || isBusy ? 'bg-[#EAF1E9]' : 'bg-[#2E6641]'
            }`}
            accessibilityRole="button"
          >
            {createAndSave.isPending ? <ActivityIndicator size="small" color="#2E6641" /> : null}
            <Text
              className={`text-[0.9375rem] font-semibold ${
                !trimmedName || isBusy ? 'text-[#63665F]' : 'text-white'
              }`}
            >
              {createAndSave.isPending ? 'Oppretter...' : 'Opprett og lagre'}
            </Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color="#2E6641" />
          <Text className="mt-3 text-[0.8125rem] text-[#63665F]">Laster listene dine...</Text>
        </View>
      ) : isError ? (
        <View className="items-center py-8">
          <Text className="text-center text-[0.875rem] text-[#63665F]">
            Kunne ikke laste listene dine.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="mt-4 rounded-full bg-[#2E6641] px-4 py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-[0.875rem] font-semibold text-white">Prøv igjen</Text>
          </Pressable>
        </View>
      ) : sortedLists.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-[1rem] font-semibold text-[#0B0B0B]">Du har ingen lister ennå</Text>
          <Text className="mt-1.5 text-center text-[0.8125rem] text-[#63665F]">
            Lag en liste for å samle oppdragene du vil komme tilbake til.
          </Text>
          <Pressable
            onPress={() => setIsCreating(true)}
            className="mt-4 flex-row items-center gap-2 rounded-full bg-[#2E6641] px-4 py-3"
            accessibilityRole="button"
          >
            <Plus size={16} color="#FFFFFF" />
            <Text className="text-[0.875rem] font-semibold text-white">Opprett liste</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2">
          {sortedLists.map((list) => {
            const saved = favoriteListContainsService(list, serviceId);
            const cover = favoriteListCoverImage(list);
            const count = favoriteListCount(list);
            const rowBusy = pendingListId === list._id;

            return (
              <Pressable
                key={list._id}
                onPress={() => void handleToggle(list)}
                disabled={isBusy}
                className={`flex-row items-center gap-3.5 rounded-2xl border border-[#E6E7E1] p-3 ${
                  isBusy && !rowBusy ? 'opacity-60' : ''
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: saved }}
                accessibilityLabel={
                  saved ? `Fjern fra ${list.name}` : `Lagre i ${list.name}`
                }
              >
                <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#EAF1E9]">
                  {cover ? (
                    <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <ImageIcon size={18} color="#9B9E96" />
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text className="mt-0.5 text-[0.75rem] text-[#63665F]">
                    {count === 1 ? '1 oppdrag' : `${count} oppdrag`}
                  </Text>
                </View>

                {rowBusy ? (
                  <ActivityIndicator size="small" color="#2E6641" />
                ) : saved ? (
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-[#2E6641]">
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : (
                  <ChevronRight size={18} color="#C7C9C2" />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}
