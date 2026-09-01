import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { userTerms } from '../../../../src/content/userTerms';

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
        disabled ? 'opacity-50' : 'active:bg-[#F4F6F0]',
      ].join(' ')}
    >
      <View
        className={[
          'h-10 w-10 items-center justify-center rounded-xl',
          accent === 'green' ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]',
        ].join(' ')}
      >
        <Icon size={18} color={accent === 'green' ? '#2E6641' : '#63665F'} />
      </View>
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-sm font-semibold text-[#0B0B0B]">{title}</Text>
        {subtitle ? (
          <Text className="mt-1 text-xs leading-4 text-[#63665F]">{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color="#63665F" /> : null}
    </Pressable>
  );
}

export default function AboutScreen() {
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
        <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Om Jobblo</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1E9]">
              <Building2 size={22} color="#2E6641" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.375rem] font-bold tracking-[-0.02em] text-[#0B0B0B]">
                {userTerms.company}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-[#63665F]">
                Organisasjonsnummer {userTerms.organisationNumber}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-2xl bg-[#FBFCF8] px-4 py-4">
            <View className="flex-row items-start gap-2">
              <Info size={16} color="#2E6641" className="mt-[2px]" />
              <Text className="flex-1 text-[0.9375rem] leading-6 text-[#0B0B0B]">
                Jobblo er en digital markedsplass som kobler folk som trenger hjelp med de som vil utføre oppdrag. Les gjennom våre vilkår for å forstå hvordan plattformen fungerer og hvilke regler som gjelder for bruk av tjenesten.
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
          <Text className="border-b border-[#E6E7E1] px-4 pb-3 pt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">
            Juridisk
          </Text>
          <AboutRow
            title="Vilkår for bruk"
            subtitle={`Sist oppdatert ${userTerms.lastUpdatedDisplay}`}
            icon={FileText}
            onPress={() => router.push('/(app)/profile/settings/terms')}
          />
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
          <Text className="border-b border-[#E6E7E1] px-4 pb-3 pt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">
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
