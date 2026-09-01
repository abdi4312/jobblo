import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { privacyPolicy } from '../../../../src/content/privacyPolicy';

/**
 * Read-only privacy + cookie policy page.
 *
 * Source: frontend/src/pages/CookiePolicyPage/CookiePolicyPage.tsx
 * Web route: /cookies
 * Mobile route: /profile/settings/privacy
 *
 * Content is static — no API, no TanStack Query, no consent toggles.
 * See src/content/privacyPolicy.ts for stale-language and policy-gap audit.
 */

function renderContent(text: string, keyBase: string) {
    // Split on double newlines to get paragraph/block groups.
    const blocks = String(text || '').split(/\n{2,}/);
    return blocks.map((block, blockIdx) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const allBullets = lines.length > 0 && lines.every((l) => l.trim().startsWith('•'));
        const allNumbered = lines.length > 0 && lines.every((l) => /^\d+\./.test(l.trim()));

        if (allBullets) {
            return (
                <View key={`${keyBase}-${blockIdx}`} className="mt-3">
                    {lines.map((line, lineIdx) => {
                        const content = line.replace(/^•\s*/, '').trim();
                        if (!content) return null;
                        return (
                            <View
                                key={`${keyBase}-${blockIdx}-b${lineIdx}`}
                                className="mt-2 flex-row"
                            >
                                <Text className="mt-[2px] w-4 shrink-0 text-[0.9375rem] leading-6 text-[#2E6641]">
                                    •
                                </Text>
                                <Text className="flex-1 text-[0.9375rem] leading-6 text-[#0B0B0B]">
                                    {content}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            );
        }

        if (allNumbered) {
            return (
                <View key={`${keyBase}-${blockIdx}`} className="mt-3">
                    {lines.map((line, lineIdx) => {
                        const match = line.match(/^(\d+)\.\s*(.*)/);
                        if (!match) return null;
                        return (
                            <View
                                key={`${keyBase}-${blockIdx}-n${lineIdx}`}
                                className="mt-2 flex-row"
                            >
                                <Text className="mt-[2px] w-6 shrink-0 text-[0.9375rem] leading-6 text-[#63665F]">
                                    {match[1]}.
                                </Text>
                                <Text className="flex-1 text-[0.9375rem] leading-6 text-[#0B0B0B]">
                                    {match[2]}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            );
        }

        // Plain paragraph — preserve inline newlines as line breaks.
        const trimmed = block.trim();
        return (
            <Text
                key={`${keyBase}-${blockIdx}`}
                className="mt-3 text-[0.9375rem] leading-6 text-[#0B0B0B]"
            >
                {trimmed}
            </Text>
        );
    });
}

export default function PrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-[#EFF0EA]">
            {/* Header */}
            <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
                <Pressable
                    onPress={() => router.back()}
                    accessibilityLabel="Tilbake"
                    className="h-10 w-10 items-center justify-center rounded-full"
                >
                    <ArrowLeft size={22} color="#0B0B0B" />
                </Pressable>
                <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">
                    {privacyPolicy.title}
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Title card */}
                <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                    <View className="flex-row items-start gap-3">
                        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1E9]">
                            <ShieldCheck size={20} color="#2E6641" />
                        </View>
                        <View className="min-w-0 flex-1">
                            <Text className="text-[1.375rem] font-bold leading-tight tracking-[-0.02em] text-[#0B0B0B]">
                                {privacyPolicy.title}
                            </Text>
                            <Text className="mt-2 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-[#63665F]">
                                Sist oppdatert: {privacyPolicy.lastUpdatedDisplay}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-5 rounded-2xl bg-[#FBFCF8] px-4 py-4">
                        <Text className="text-[0.9375rem] leading-6 text-[#0B0B0B]">
                            {privacyPolicy.intro}
                        </Text>
                    </View>
                </View>

                {/* Sections */}
                {privacyPolicy.sections.map((section) => (
                    <View
                        key={section.id}
                        className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"
                    >
                        <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">
                            {section.id}. {section.title}
                        </Text>
                        {renderContent(section.content, `s${section.id}`)}
                    </View>
                ))}

                {/* Footer */}
                <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                    <Text className="text-[0.8125rem] italic leading-5 text-[#63665F]">
                        {privacyPolicy.footer}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
