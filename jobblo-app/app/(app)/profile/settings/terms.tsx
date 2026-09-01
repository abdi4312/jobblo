import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { userTerms } from '../../../../src/content/userTerms';

function renderParagraphs(text: string, keyBase: string) {
  const blocks = String(text || '').split(/\n{2,}/);
  return blocks.map((block, index) => {
    const trimmed = block.replace(/^\s+/gm, '');
    const lines = trimmed.split('\n');
    const hasBullets = lines.every((line) => !line.trim() || line.trim().startsWith('•'));
    if (hasBullets) {
      return (
        <View key={`${keyBase}-${index}`} className="mt-3">
          {lines.filter((l) => l.trim().startsWith('•')).map((line, lineIdx) => {
            const content = line.replace(/^•\s*/, '').trim();
            if (!content) return null;
            return (
              <View key={`${keyBase}-${index}-bullet-${lineIdx}`} className="mt-2 flex-row">
                <Text className="mt-[2px] w-4 shrink-0 text-[0.9375rem] leading-6 text-[#2E6641]">•</Text>
                <Text className="flex-1 text-[0.9375rem] leading-6 text-[#0B0B0B]">{content}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    return (
      <Text
        key={`${keyBase}-${index}`}
        className="mt-3 text-[0.9375rem] leading-6 text-[#0B0B0B]"
      >
        {trimmed}
      </Text>
    );
  });
}

export default function TermsScreen() {
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
        <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Brukervilkår</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1E9]">
              <FileText size={20} color="#2E6641" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[1.375rem] font-bold leading-tight tracking-[-0.02em] text-[#0B0B0B]">
                {userTerms.title}
              </Text>
              <Text className="mt-2 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-[#63665F]">
                Sist oppdatert: {userTerms.lastUpdatedDisplay}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-2xl bg-[#FBFCF8] px-4 py-4">
            <Text className="text-[0.9375rem] leading-6 text-[#0B0B0B]">{userTerms.intro}</Text>
          </View>
        </View>

        {userTerms.sections.map((section) => (
          <View
            key={section.id}
            className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"
          >
            <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">
              {section.id}. {section.title}
            </Text>
            {renderParagraphs(section.content, `section-${section.id}`)}
          </View>
        ))}

        <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <Text className="text-[0.8125rem] italic leading-5 text-[#63665F]">
            {userTerms.footer}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
