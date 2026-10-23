import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, Info } from 'lucide-react-native';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { TC } from '../../../../src/theme/colors';

export default function VisibilityScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScreenHeader title="Søkemotorsynlighet" icon={Eye} className="px-4 pt-2" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="rounded-3xl border border-line bg-surface p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tint">
              <Eye size={21} color={TC.brandText} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.25rem] font-bold text-ink">
                Synlighet i søkemotorer
              </Text>
              <Text className="mt-2 text-[0.9375rem] leading-6 text-muted">
                Oppdrag du legger ut er offentlige, slik at oppdragstakere kan finne dem. Det betyr
                at de også kan bli indeksert av søkemotorer som Google.
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row items-start gap-2.5 rounded-2xl border border-[#D8E8D9] bg-[#F2F8F1] p-3">
            <Info size={16} color={TC.brandText} />
            <Text className="flex-1 text-[0.8125rem] leading-5 text-brand-text">
              Ønsker du at profilen din ikke skal vises i søkemotorer? Ta kontakt med kundeservice,
              så ordner vi det for deg.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
