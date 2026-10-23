import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Dialog } from './Dialog';
import { TC } from '../../theme/colors';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for actions that destroy something. */
  destructive?: boolean;
  isPending?: boolean;
  errorMessage?: string | null;
  /** Only the confirm button, e.g. for a "done" message. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Lightweight confirmation over `Dialog`, used before a saved job is taken out of a list
 * and before a list is deleted.
 *
 * `Alert.alert` was not used: it cannot show the in-flight state, and a failed delete has
 * to report why without a second popup.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Avbryt',
  destructive = false,
  isPending = false,
  errorMessage = null,
  hideCancel = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog visible={visible} onClose={isPending ? () => undefined : onClose}>
      <View className="w-full">
        <Text className="text-[1.0625rem] font-bold text-ink">{title}</Text>

        {message ? (
          <Text className="mt-2 text-[0.875rem] leading-relaxed text-muted">{message}</Text>
        ) : null}

        {errorMessage ? (
          <View className="mt-4 rounded-2xl border border-[#E7CFCB] dark:border-danger-line bg-[#FBF1F0] dark:bg-danger-tint px-3.5 py-3">
            <Text className="text-[0.8125rem] font-medium text-[#B4544A] dark:text-danger">{errorMessage}</Text>
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-3">
          {hideCancel ? null : (
          <Pressable
            onPress={onClose}
            disabled={isPending}
            className={`flex-1 items-center justify-center rounded-full border border-line bg-surface px-4 py-3.5 ${
              isPending ? 'opacity-60' : ''
            }`}
            accessibilityRole="button"
          >
            <Text className="text-[0.9375rem] font-semibold text-ink">{cancelLabel}</Text>
          </Pressable>
          )}

          <Pressable
            onPress={onConfirm}
            disabled={isPending}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3.5 ${
              isPending ? 'bg-tint' : destructive ? 'bg-danger-solid' : 'bg-brand'
            }`}
            accessibilityRole="button"
          >
            {isPending ? <ActivityIndicator size="small" color={TC.brandText} /> : null}
            <Text
              className={`text-[0.9375rem] font-semibold ${isPending ? 'text-muted' : 'text-white'}`}
            >
              {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Dialog>
  );
}
