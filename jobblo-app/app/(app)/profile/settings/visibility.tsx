import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function VisibilityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Tilbake"
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <ArrowLeft size={22} color="#0B0B0B" />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Søkemotorsynlighet</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1E9]">
              <Eye size={21} color="#2E6641" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.25rem] font-bold text-[#0B0B0B]">
                Synlighet i søkemotorer
              </Text>
              <Text className="mt-2 text-[0.9375rem] leading-6 text-[#63665F]">
                Oppdrag du legger ut er offentlige, slik at oppdragstakere kan finne dem. Det betyr
                at de også kan bli indeksert av søkemotorer som Google.
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row items-start gap-2.5 rounded-2xl border border-[#D8E8D9] bg-[#F2F8F1] p-3">
            <Info size={16} color="#2E6641" />
            <Text className="flex-1 text-[0.8125rem] leading-5 text-[#2E6641]">
              Ønsker du at profilen din ikke skal vises i søkemotorer? Ta kontakt med kundeservice,
              så ordner vi det for deg.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
