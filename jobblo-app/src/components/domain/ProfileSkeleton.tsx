import React from 'react';
import { View } from 'react-native';

/** Placeholder in the shape of a profile (avatar, name, stats, two cards) while it loads. */
export function ProfileSkeleton() {
  return (
    <View className="gap-5 px-4 pt-6" accessibilityLabel="Laster profil">
      <View className="items-center gap-3">
        <View className="h-20 w-20 rounded-full bg-line" />
        <View className="h-6 w-40 rounded bg-line" />
        <View className="h-4 w-24 rounded bg-page" />
      </View>
      <View className="flex-row gap-2.5">
        {[0, 1, 2].map((key) => (
          <View key={key} className="h-16 flex-1 rounded-xl bg-surface" />
        ))}
      </View>
      <View className="h-28 rounded-2xl bg-surface" />
      <View className="h-40 rounded-2xl bg-surface" />
    </View>
  );
}
