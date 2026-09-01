import React from 'react';
import { Text, View } from 'react-native';

export function EmptyState({
  title = 'Oppdraget finnes ikke',
  message = 'Annonsen er kanskje fjernet eller lenken er feil.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <View className="mx-4 my-8 rounded-3xl border border-[#E6E7E1] bg-white p-8">
      <Text className="text-center text-[1.0625rem] font-semibold text-[#0B0B0B]">{title}</Text>
      <Text className="mt-2 text-center text-[0.875rem] leading-relaxed text-[#63665F]">{message}</Text>
    </View>
  );
}
