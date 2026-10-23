import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Building2,
  ChevronRight,
  FileText,
  Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { userTerms } from '../../../../src/content/userTerms';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { TC, tc } from '../../../../src/theme/colors';

type AboutRowProps = {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress?: () => void;
  accent?: 'green' | 'muted';
};

function AboutRow({ title, subtitle, icon: Icon, onPress, accent = 'green' }: AboutRowProps) {
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={[
        'flex-row items-center px-4 py-4',
        disabled ? 'opacity-50' : 'active:bg-surface-2',
      ].join(' ')}
    >
      <View
        className={[
          'h-10 w-10 items-center justify-center rounded-xl',
          accent === 'green' ? 'bg-tint' : 'bg-surface-2',
        ].join(' ')}
      >
        <Icon size={18} color={accent === 'green' ? TC.brandText : tc('#63665F', 'muted')} />
      </View>
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-1 text-[0.8125rem] leading-4 text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={tc('#63665F', 'muted')} /> : null}
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScreenHeader title="Om Jobblo" icon={Info} className="px-4 pt-2" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-line bg-surface p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tint">
              <Building2 size={22} color={TC.brandText} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.375rem] font-bold tracking-[-0.02em] text-ink">
                {userTerms.company}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Organisasjonsnummer {userTerms.organisationNumber}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-2xl bg-[#FBFCF8] dark:bg-surface-2 px-4 py-4">
            <View className="flex-row items-start gap-2">
              <Info size={16} color={TC.brandText} className="mt-[2px]" />
              <Text className="flex-1 text-[0.9375rem] leading-6 text-ink">
                Jobblo er en digital markedsplass som kobler folk som trenger hjelp med de som vil utføre oppdrag. Les gjennom våre vilkår for å forstå hvordan plattformen fungerer og hvilke regler som gjelder for bruk av tjenesten.
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface">
          <Text className="border-b border-line px-4 pb-3 pt-4 text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            Juridisk
          </Text>
          <AboutRow
            title="Vilkår for bruk"
            subtitle={`Sist oppdatert ${userTerms.lastUpdatedDisplay}`}
            icon={FileText}
            onPress={() => router.push('/(app)/profile/settings/terms')}
          />
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface">
          <Text className="border-b border-line px-4 pb-3 pt-4 text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            Personvern
          </Text>
          <AboutRow
            title="Personvern og informasjonskapsler"
            subtitle="Sist oppdatert 8. januar 2026"
            icon={Info}
            onPress={() => router.push('/(app)/profile/settings/privacy')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
