import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Dialog } from '../ui/Dialog';
import { FAVORITE_LIST_NAME_MAX_LENGTH } from '../../types/FavoriteList';
import { TC, tc } from '../../theme/colors';

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
          <Text className="text-[1.0625rem] font-bold text-ink">{title}</Text>
          <Pressable
            onPress={onClose}
            disabled={isPending}
            className="h-8 w-8 items-center justify-center rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          >
            <X size={19} color={tc('#63665F', 'muted')} />
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-[#E7CFCB] dark:border-danger-line bg-[#FBF1F0] dark:bg-danger-tint px-3.5 py-3">
            <Text className="text-[0.8125rem] font-medium text-[#B4544A] dark:text-danger">{errorMessage}</Text>
          </View>
        ) : null}

        <Text className="mb-2 text-[0.8125rem] font-semibold text-ink">Navn på liste</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="F.eks. Sommerjobber"
          placeholderTextColor={TC.placeholder}
          autoFocus
          editable={!isPending}
          maxLength={FAVORITE_LIST_NAME_MAX_LENGTH}
          returnKeyType={showDescription ? 'next' : 'done'}
          onSubmitEditing={showDescription ? undefined : handleSubmit}
          className="rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink"
        />
        <Text className="mt-1.5 text-right text-[0.8125rem] text-subtle">
          {trimmedName.length}/{FAVORITE_LIST_NAME_MAX_LENGTH}
        </Text>

        {showDescription ? (
          <View className="mt-4">
            <Text className="mb-2 text-[0.8125rem] font-semibold text-ink">
              Beskrivelse <Text className="font-normal text-muted">(valgfritt)</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Hva samler du i denne listen?"
              placeholderTextColor={TC.placeholder}
              multiline
              numberOfLines={4}
              editable={!isPending}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="min-h-[96px] rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={onClose}
            disabled={isPending}
            className={`flex-1 items-center justify-center rounded-full border border-line bg-surface px-4 py-3.5 ${
              isPending ? 'opacity-60' : ''
            }`}
            accessibilityRole="button"
          >
            <Text className="text-[0.9375rem] font-semibold text-ink">Avbryt</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3.5 ${
              canSubmit ? 'bg-brand' : 'bg-tint'
            }`}
            accessibilityRole="button"
          >
            {isPending ? <ActivityIndicator size="small" color={TC.brandText} /> : null}
            <Text
              className={`text-[0.9375rem] font-semibold ${canSubmit ? 'text-white' : 'text-muted'}`}
            >
              {isPending ? pendingLabel : submitLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Dialog>
  );
}
