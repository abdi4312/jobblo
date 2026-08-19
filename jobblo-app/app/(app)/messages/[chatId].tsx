import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function MessagesBoundary() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#EFF0EA] px-6">
      <View className="rounded-2xl border border-[#E6E7E1] bg-white p-6">
        <Text className="text-center text-[1rem] font-semibold text-[#0B0B0B]">Melding</Text>
        <Text className="mt-2 text-center text-[0.875rem] text-[#63665F]">Chat {chatId} er opprettet. Chat-skjermen kommer i neste steg.</Text>
      </View>
    </SafeAreaView>
  );
}
