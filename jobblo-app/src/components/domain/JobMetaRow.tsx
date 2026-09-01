import React from 'react';
import { View, Text } from 'react-native';

export function JobMetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <View className="flex-row items-center justify-between gap-4 border-b border-[#E6E7E1] py-2.5 last:border-b-0 last:pb-0">
      <Text className="text-[0.875rem] text-[#63665F]">{label}</Text>
      <Text className="text-right text-[0.875rem] font-medium text-[#0B0B0B]">{value}</Text>
    </View>
  );
}
