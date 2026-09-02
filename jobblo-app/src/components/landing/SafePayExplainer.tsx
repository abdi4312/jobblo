import React from 'react';
import { Text, View } from 'react-native';

const STAGES = [
  {
    step: '01',
    tag: 'Betaling',
    title: 'Du betaler til SafePay',
    body: 'Beløpet reserveres hos vår betalingspartner. Tilbyderen ser at pengene er sikret, men får dem ikke ennå.',
  },
  {
    step: '02',
    tag: 'Utførelse',
    title: 'Jobben blir gjort',
    body: 'Dere avtaler i chatten. Tilbyderen markerer jobben som ferdig når den er utført.',
  },
  {
    step: '03',
    tag: 'Utbetaling',
    title: 'Du godkjenner — så utbetales det',
    body: 'Pengene frigis først når du har sagt deg fornøyd. Er noe galt, kan du åpne en tvist i stedet.',
  },
];

export function SafePayExplainer() {
  return (
    <View style={{ backgroundColor: '#122A1C', paddingVertical: 64 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ color: '#9B9E96', fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' }}>
          02 — SafePay
        </Text>
        <Text style={{ marginTop: 18, color: '#EFF0EA', fontSize: 38, fontWeight: '700', lineHeight: 42, letterSpacing: -1.3 }}>
          Er pengene mine <Text style={{ color: '#8FBF9A' }}>trygge</Text>? Ja.
        </Text>

        <View style={{ marginTop: 28, gap: 1, backgroundColor: '#EFF0EA1A', borderWidth: 1, borderColor: '#EFF0EA1A' }}>
          {STAGES.map(({ step, tag, title, body }) => (
            <View key={step} style={{ backgroundColor: '#122A1C', padding: 24, minHeight: 220, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Text style={{ color: '#8FBF9A', fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase' }}>
                  {step}
                </Text>
                <Text style={{ color: '#9B9E96', fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase' }}>
                  {tag}
                </Text>
              </View>

              <View>
                <Text style={{ color: '#EFF0EA', fontSize: 22, fontWeight: '700', letterSpacing: -0.8, lineHeight: 28 }}>
                  {title}
                </Text>
                <Text style={{ marginTop: 12, color: '#9B9E96', fontSize: 15, lineHeight: 22 }}>
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={{ marginTop: 28, color: '#9B9E96', fontSize: 15, lineHeight: 22 }}>
          Du betaler aldri direkte til en fremmed. Beløpet står hos SafePay til jobben er godkjent av deg — og begge parter kan åpne en tvist i stedet for å godkjenne.
        </Text>
      </View>
    </View>
  );
}
