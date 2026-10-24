import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { View } from 'react-native';

export function ApplicantOverviewSkeleton() {
  return (
    <View className="flex-row items-center gap-4 rounded-[20px] border border-line bg-surface p-5">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-3 w-2/5 rounded" />
      </View>
      <Skeleton className="h-4 w-16 rounded" />
    </View>
  );
}