import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Dialog } from '../ui/Dialog';
import { FAVORITE_LIST_NAME_MAX_LENGTH } from '../../types/FavoriteList';

interface FavoriteListFormDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string }) => void;
  title: string;
  submitLabel: string;
  pendingLabel: string;
  initialName?: string;
  initialDescription?: string;
  /**
   * Description is only offered where the backend actually accepts it. `POST /api/lists`
   * takes `name` alone, so the create dialog leaves it off rather than sending a field
   * the server would drop.
   */
  showDescription?: boolean;
  isPending?: boolean;
  errorMessage?: string | null;
}

const DESCRIPTION_MAX_LENGTH = 300;

/**
 * Name (and optionally description) form for a saved list — used both for "Ny liste" on
 * the overview and for "Rediger liste" on the detail screen.
 *
 * Empty and whitespace-only names are refused here as well as on the server, so the
 * common mistake never costs a round trip. The trim is what gets submitted.
 */
export function FavoriteListFormDialog({
  visible,
  onClose,
  onSubmit,
  title,
  submitLabel,
  pendingLabel,
  initialName = '',
  initialDescription = '',
  showDescription = false,
  isPending = false,
  errorMessage = null,
}: FavoriteListFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // Re-seed on open so a reopened dialog shows the list's current values, not whatever
  // was left behind by the previous edit.
  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setDescription(initialDescription);
  }, [visible, initialName, initialDescription]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(
      showDescription
        ? { name: trimmedName, description: description.trim() }
        : { name: trimmedName }
    );
  };

  return (
    <Dialog visible={visible} onClose={isPending ? () => undefined : onClose}>
      <View className="w-full">
        <View className="mb-5 flex-row items-center justify-between">
          <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">{title}</Text>
          <Pressable
            onPress={onClose}
            disabled={isPending}
            className="h-8 w-8 items-center justify-center rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          >
            <X size={19} color="#63665F" />
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-[#E7CFCB] bg-[#FBF1F0] px-3.5 py-3">
            <Text className="text-[0.8125rem] font-medium text-[#B4544A]">{errorMessage}</Text>
          </View>
        ) : null}

        <Text className="mb-2 text-[0.8125rem] font-semibold text-[#0B0B0B]">Navn på liste</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="F.eks. Sommerjobber"
          placeholderTextColor="#9B9E96"
          autoFocus
          editable={!isPending}
          maxLength={FAVORITE_LIST_NAME_MAX_LENGTH}
          returnKeyType={showDescription ? 'next' : 'done'}
          onSubmitEditing={showDescription ? undefined : handleSubmit}
          className="rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
        />
        <Text className="mt-1.5 text-right text-[0.6875rem] text-[#9B9E96]">
          {trimmedName.length}/{FAVORITE_LIST_NAME_MAX_LENGTH}
        </Text>

        {showDescription ? (
          <View className="mt-4">
            <Text className="mb-2 text-[0.8125rem] font-semibold text-[#0B0B0B]">
              Beskrivelse <Text className="font-normal text-[#63665F]">(valgfritt)</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Hva samler du i denne listen?"
              placeholderTextColor="#9B9E96"
              multiline
              numberOfLines={4}
              editable={!isPending}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="min-h-[96px] rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={onClose}
            disabled={isPending}
            className={`flex-1 items-center justify-center rounded-full border border-[#E6E7E1] bg-white px-4 py-3.5 ${
              isPending ? 'opacity-60' : ''
            }`}
            accessibilityRole="button"
          >
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Avbryt</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3.5 ${
              canSubmit ? 'bg-[#2E6641]' : 'bg-[#EAF1E9]'
            }`}
            accessibilityRole="button"
          >
            {isPending ? <ActivityIndicator size="small" color="#2E6641" /> : null}
            <Text
              className={`text-[0.9375rem] font-semibold ${canSubmit ? 'text-white' : 'text-[#63665F]'}`}
            >
              {isPending ? pendingLabel : submitLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Dialog>
  );
}
