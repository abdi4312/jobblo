import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { TC } from '../../theme/colors';

export function LoadingIndicator({ message = 'Laster...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color={TC.brandText} />
      <Text className="mt-4 text-[0.875rem] text-muted">{message}</Text>
    </View>
  );
}
