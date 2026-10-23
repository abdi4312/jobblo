import React from 'react';
import { Text, View } from 'react-native';
import { TC, tc } from '../../theme/colors';

const STEPS = [
  {
    id: '01',
    title: 'Opprett profil',
    description: 'Registrer deg gratis på under to minutter og kom i gang med en gang.',
  },
  {
    id: '02',
    title: 'Finn oppdrag',
    description: 'Søk blant oppdrag i nærområdet ditt, eller legg ut ditt eget.',
  },
  {
    id: '03',
    title: 'Søk og match',
    description: 'Send søknad og bli kontaktet av oppdragsgiver direkte i appen.',
  },
  {
    id: '04',
    title: 'Få betalt trygt',
    description: 'Betalingen frigis via SafePay så snart jobben er godkjent.',
  },
];

export function HowItWorks() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 48 }}>
      <View style={{ marginBottom: 28, gap: 8 }}>
        <Text style={{ color: tc('#9B9E96', 'subtle'), fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
          03 — Prosessen
        </Text>
        <Text style={{ color: TC.ink, fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -1.1 }}>
          Hvordan <Text style={{ color: TC.brandText }}>fungerer</Text> det?
        </Text>
      </View>

      <Text style={{ color: tc('#63665F', 'muted'), fontSize: 15, lineHeight: 22, marginBottom: 24 }}>
        Fire trinn fra du trenger hjelp til jobben er gjort og betalt.
      </Text>

      <View style={{ gap: 14 }}>
        {STEPS.map(({ id, title, description }) => (
          <View
            key={id}
            style={{
              minHeight: 180,
              backgroundColor: TC.surface,
              borderWidth: 1,
              borderColor: TC.line,
              borderRadius: 24,
              padding: 20,
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: TC.tint, fontSize: 42, fontWeight: '700', letterSpacing: -1.7, lineHeight: 46 }}>
              {id}
            </Text>
            <View>
              <Text style={{ color: TC.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.5 }}>
                {title}
              </Text>
              <Text style={{ marginTop: 8, color: tc('#63665F', 'muted'), fontSize: 14, lineHeight: 20 }}>
                {description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
