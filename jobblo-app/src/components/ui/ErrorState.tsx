import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ErrorStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = 'Kunne ikke laste oppdrag',
  message = 'Sjekk internettforbindelsen din og prøv igjen.',
  actionLabel = 'Prøv igjen',
  onAction,
}: ErrorStateProps) {
  return (
    <View className="mx-4 my-8 rounded-3xl border border-line bg-surface p-6">
      <Text className="text-[0.9375rem] font-semibold text-ink">{title}</Text>
      <Text className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">{message}</Text>

      {onAction && (
        <TouchableOpacity onPress={onAction} className="mt-4 rounded-full bg-brand px-4 py-2.5">
          <Text className="text-center text-[0.875rem] font-semibold text-white">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
