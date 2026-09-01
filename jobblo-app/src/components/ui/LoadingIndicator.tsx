import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export function LoadingIndicator({ message = 'Laster...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color="#2E6641" />
      <Text className="mt-4 text-[0.875rem] text-[#63665F]">{message}</Text>
    </View>
  );
}
