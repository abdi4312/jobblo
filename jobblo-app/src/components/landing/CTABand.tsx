import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export function CTABand() {
  const router = useRouter();

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 52 }}>
      <View style={{ borderRadius: 28, backgroundColor: '#2E6641', paddingHorizontal: 22, paddingVertical: 28, gap: 16 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 38, fontWeight: '700', lineHeight: 42, letterSpacing: -1.3 }}>
          Klar til å komme i gang?
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 22 }}>
          Gratis å registrere seg — ingen abonnement nødvendig.
        </Text>

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#0B0B0B', fontWeight: '700', fontSize: 15 }}>Legg ut oppdrag</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Finn oppdrag</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
