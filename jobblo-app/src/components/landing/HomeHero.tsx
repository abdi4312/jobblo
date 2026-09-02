import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCategories } from '../../hooks/useCategories';
import apiClient from '../../api/client';

const SERVICE_SHOWCASE = [
  { name: 'Maling', src: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80' },
  { name: 'Rengjøring', src: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80' },
  { name: 'Rørlegger', src: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80' },
  { name: 'Flytting', src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80' },
  { name: 'Hagearbeid', src: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80' },
  { name: 'Montering', src: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80' },
  { name: 'Oppussing', src: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80' },
  { name: 'Transport', src: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=900&q=80' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'God morgen';
  if (hour >= 12 && hour < 18) return 'God ettermiddag';
  return 'God kveld';
}

export function HomeHero() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const { data } = useCategories();
  const categories = data?.categories ?? [];

  const words = useMemo(
    () => (categories.length ? categories.slice(0, 6).map((cat: { name: string }) => cat.name.toLowerCase()) : ['maling', 'flytting', 'hagearbeid', 'rørlegger', 'rengjøring']),
    [categories]
  );

  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/public/stats');
      return response.data;
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const categoryShortcuts = categories.slice(0, 6);

  return (
    <View style={{ backgroundColor: '#EFF0EA', paddingBottom: 10 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E6E7E1',
              borderRadius: 999,
              paddingVertical: 10,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ color: '#0B0B0B', fontSize: 13, fontWeight: '700' }}>Logg inn</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Text style={{ color: '#9B9E96', fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
            Norges lokale jobbplattform
          </Text>
          {stats ? (
            <Text style={{ color: '#9B9E96', fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
              {stats.jobs ?? 0} aktive oppdrag · {stats.users ?? 0} brukere
            </Text>
          ) : null}
        </View>

        <Text style={{ color: '#0B0B0B', fontSize: 42, fontWeight: '800', lineHeight: 44, letterSpacing: -1.4 }}>
          Jeg trenger hjelp til
        </Text>
        <Text style={{ color: '#2E6641', fontSize: 42, fontWeight: '800', lineHeight: 44, letterSpacing: -1.4 }}>
          {words[wordIndex % words.length]}
        </Text>

        <Text style={{ marginTop: 14, color: '#63665F', fontSize: 16, lineHeight: 24 }}>
          Beskriv oppdraget, få tilbud fra folk i nærheten, og betal først når jobben er godkjent.{' '}
          <Text style={{ color: '#2E6641', fontWeight: '700' }}>Gratis å legge ut</Text> —{' '}
          <Text style={{ color: '#2E6641', fontWeight: '700' }}>3 % når jobben faktisk blir gjort</Text>.
        </Text>

        <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E6E7E1', backgroundColor: '#FFFFFF', borderRadius: 999, paddingLeft: 14, paddingRight: 6, paddingVertical: 7 }}>
          <Search size={18} color="#9B9E96" style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Hva gjelder det?"
            placeholderTextColor="#9B9E96"
            style={{ flex: 1, fontSize: 15, color: '#0B0B0B', paddingVertical: 10 }}
          />
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            style={{ backgroundColor: '#122A1C', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Finn hjelp</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        {categoryShortcuts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>
            {categoryShortcuts.map((cat: { _id?: string; name: string }) => (
              <Pressable
                key={cat._id}
                onPress={() => router.push('/(auth)/register')}
                style={{ borderWidth: 1, borderColor: '#E6E7E1', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Text style={{ color: '#0B0B0B', fontSize: 13, fontWeight: '600' }}>{cat.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={15} color="#2E6641" />
          <Text style={{ color: '#2E6641', fontWeight: '700' }}>Betaling holdes trygt til du har godkjent</Text>
        </View>
      </View>

      <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {SERVICE_SHOWCASE.map((service) => (
            <Pressable
              key={service.name}
              onPress={() => router.push('/(auth)/register')}
              style={{ width: 150, height: 180, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#E6E7E1', backgroundColor: '#EAF1E9' }}
            >
              <Image source={{ uri: service.src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: 'rgba(11,11,11,0.56)' }} />
              <Text style={{ position: 'absolute', left: 12, bottom: 12, right: 12, color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                {service.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
