import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowUpRight, Grid3x3, HelpCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCategories } from '../../hooks/useCategories';
import { TC, tc } from '../../theme/colors';

export function Categories() {
  const router = useRouter();
  const { data, isLoading } = useCategories();
  const categories = data?.categories ?? [];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={{ color: tc('#9B9E96', 'subtle'), fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
        01 — Kategorier
      </Text>
      <Text style={{ marginTop: 16, color: TC.ink, fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -1.1 }}>
        Hva trenger du <Text style={{ color: TC.brandText }}>hjelp</Text> til?
      </Text>
      <Text style={{ marginTop: 12, color: tc('#63665F', 'muted'), fontSize: 15, lineHeight: 22 }}>
        Velg en kategori, så viser vi oppdragene som ligger ute nå.
      </Text>

      <Pressable
        onPress={() => router.push('/(auth)/register')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: TC.line, backgroundColor: TC.surface }}
      >
        <Grid3x3 size={16} color={TC.brandText} />
        <Text style={{ color: TC.ink, fontWeight: '600' }}>Se alle kategorier</Text>
      </Pressable>

      <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: TC.line }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: TC.line, paddingVertical: 18 }}>
              <Text style={{ color: tc('#9B9E96', 'subtle') }}>Laster kategorier…</Text>
            </View>
          ))
        ) : (
          categories.map((cat, i) => {
            const safeName = cat.name || 'Kategori';
            const Icon = HelpCircle;

            return (
              <Pressable
                key={cat._id ?? `${safeName}-${i}`}
                onPress={() => router.push({ pathname: '/(auth)/register' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: TC.line, paddingVertical: 18 }}
              >
                <Text style={{ color: tc('#9B9E96', 'subtle'), fontSize: 12, fontWeight: '700', letterSpacing: 2.2, minWidth: 36, textAlign: 'center' }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Icon size={22} color={TC.brandText} />
                <Text style={{ flex: 1, color: TC.ink, fontSize: 22, fontWeight: '600', letterSpacing: -0.6 }}>
                  {safeName}
                </Text>
                <ArrowUpRight size={20} color={TC.brandText} />
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}
