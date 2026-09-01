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
    <View className="mx-4 my-8 rounded-3xl border border-[#E6E7E1] bg-white p-6">
      <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{title}</Text>
      <Text className="mt-1.5 text-[0.875rem] leading-relaxed text-[#63665F]">{message}</Text>

      {onAction && (
        <TouchableOpacity onPress={onAction} className="mt-4 rounded-full bg-[#2E6641] px-4 py-2.5">
          <Text className="text-center text-[0.875rem] font-semibold text-white">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
