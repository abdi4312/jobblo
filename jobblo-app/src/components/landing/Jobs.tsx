import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { MapPin, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useJobs } from '../../hooks/useJobs';

const FallbackImages: Record<string, string> = {
  Maling: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  Rengjøring: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  'Rørlegger': 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80',
  Flytting: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  Hagearbeid: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
  Montering: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
  Oppussing: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  Transport: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=900&q=80',
};

export function Jobs() {
  const router = useRouter();
  const { data, isLoading } = useJobs({ limit: 6 });

  const jobs = data?.data ?? [];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 }}>
      <View style={{ marginBottom: 22, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#9B9E96', fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
            05 — Ute nå
          </Text>
          <Text style={{ marginTop: 12, color: '#0B0B0B', fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -1.1 }}>
            Hvem trenger <Text style={{ color: '#2E6641' }}>hjelp</Text> nå?
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/register')}
          style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7E1', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 }}
        >
          <Text style={{ color: '#0B0B0B', fontWeight: '600' }}>Se alle oppdrag</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ width: 260, borderRadius: 24, backgroundColor: '#F4F6F0', borderWidth: 1, borderColor: '#E6E7E1', padding: 12 }}>
              <View style={{ height: 200, borderRadius: 18, backgroundColor: '#EAF1E9' }} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ gap: 14 }}>
          {jobs.slice(0, 6).map((job, index) => {
            const imageUri = job.images?.[0] || FallbackImages[job.categories?.[0] ?? 'Maling'] || FallbackImages.Maling;
            const location = job.location?.city || job.location?.address || 'Norge';
            const price = typeof job.price === 'number' ? job.price.toLocaleString('nb-NO') : job.price ?? 'Variabelt';

            return (
              <Pressable
                key={job._id}
                onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } })}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E6E7E1',
                  borderRadius: 24,
                  padding: 14,
                  gap: 14,
                }}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: 200, borderRadius: 18, backgroundColor: '#EAF1E9' }}
                  resizeMode="cover"
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EAF1E9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <ShieldCheck size={12} color="#2E6641" />
                    <Text style={{ color: '#2E6641', fontSize: 12, fontWeight: '700' }}>SafePay</Text>
                  </View>
                  <Text style={{ color: '#9B9E96', fontSize: 12 }}>{index < 2 ? 'Nå' : 'Ny'}</Text>
                </View>

                <Text style={{ color: '#0B0B0B', fontSize: 21, fontWeight: '700', lineHeight: 26, letterSpacing: -0.5 }}>
                  {job.title}
                </Text>

                {job.description ? (
                  <Text style={{ color: '#63665F', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                    {job.description}
                  </Text>
                ) : null}

                <View style={{ borderTopWidth: 1, borderTopColor: '#E6E7E1', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                    <MapPin size={14} color="#9B9E96" />
                    <Text style={{ color: '#63665F', fontSize: 12 }} numberOfLines={1}>{location}</Text>
                  </View>
                  <Text style={{ color: '#0B0B0B', fontSize: 18, fontWeight: '700' }}>
                    {price} kr
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
