import React from 'react';
import { Text, View } from 'react-native';

export function EmptyState({
  title = 'Oppdraget finnes ikke',
  message = 'Annonsen er kanskje fjernet eller lenken er feil.',
  icon,
  action,
}: {
  title?: string;
  message?: string;
  /** Optional illustration above the title, e.g. a lucide icon in a tinted circle. */
  icon?: React.ReactNode;
  /** Optional call to action below the message, e.g. a <Button />. */
  action?: React.ReactNode;
}) {
  return (
    <View className="mx-4 my-8 items-center rounded-3xl border border-line bg-surface p-8">
      {icon ? <View className="mb-4">{icon}</View> : null}
      <Text className="text-center text-[1.0625rem] font-semibold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-muted">{message}</Text>
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
