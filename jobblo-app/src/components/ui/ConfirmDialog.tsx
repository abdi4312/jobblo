import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Dialog } from './Dialog';

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
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog visible={visible} onClose={isPending ? () => undefined : onClose}>
      <View className="w-full">
        <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">{title}</Text>

        {message ? (
          <Text className="mt-2 text-[0.875rem] leading-relaxed text-[#63665F]">{message}</Text>
        ) : null}

        {errorMessage ? (
          <View className="mt-4 rounded-2xl border border-[#E7CFCB] bg-[#FBF1F0] px-3.5 py-3">
            <Text className="text-[0.8125rem] font-medium text-[#B4544A]">{errorMessage}</Text>
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
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{cancelLabel}</Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            disabled={isPending}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3.5 ${
              isPending ? 'bg-[#EAF1E9]' : destructive ? 'bg-[#B4544A]' : 'bg-[#2E6641]'
            }`}
            accessibilityRole="button"
          >
            {isPending ? <ActivityIndicator size="small" color="#2E6641" /> : null}
            <Text
              className={`text-[0.9375rem] font-semibold ${isPending ? 'text-[#63665F]' : 'text-white'}`}
            >
              {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Dialog>
  );
}
