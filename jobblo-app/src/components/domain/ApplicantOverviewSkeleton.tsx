import React from 'react';
import { View } from 'react-native';

export function ApplicantOverviewSkeleton() {
  return (
    <View className="flex-row items-center gap-4 rounded-[20px] border border-[#E6E7E1] bg-white p-5">
      <View className="h-11 w-11 rounded-xl bg-[#E6E7E1]" />
      <View className="flex-1 gap-2">
        <View className="h-3 w-24 rounded bg-[#E6E7E1]" />
        <View className="h-4 w-4/5 rounded bg-[#E6E7E1]" />
        <View className="h-3 w-2/5 rounded bg-[#E6E7E1]" />
      </View>
      <View className="h-4 w-16 rounded bg-[#E6E7E1]" />
    </View>
  );
}