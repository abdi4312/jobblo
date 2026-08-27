import React from 'react';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { safePayFee, safePayNetToProvider } from '../../utils/safePayFee';

const STEPS = ['Velg søker', 'Kontrakt og betaling', 'Jobb utføres', 'Godkjenn og utbetal'];

export function SafePayProgressSteps({ currentStep = 1 }: { currentStep?: number; orderId?: string; serviceId?: string } = {}) {
  return (
    <View className="mb-6 flex-row items-start">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const current = step === currentStep;
        const done = step < currentStep;
        return (
          <View key={label} className="relative flex-1 items-center gap-2">
            {index > 0 ? <View className={['absolute right-1/2 top-3.5 h-px w-full', done || current ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'].join(' ')} /> : null}
            <View className={['z-10 h-7 w-7 items-center justify-center rounded-full', current ? 'bg-[#122A1C]' : done ? 'bg-[#2E6641]' : 'border border-[#E6E7E1] bg-white'].join(' ')}>
              {done ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : <Text className={current ? 'text-[0.6875rem] font-bold text-white' : 'text-[0.6875rem] text-[#9B9E96]'}>{step}</Text>}
            </View>
            <Text className={['text-center text-[0.6875rem] leading-tight', current ? 'font-semibold text-[#0B0B0B]' : done ? 'font-medium text-[#2E6641]' : 'text-[#9B9E96]'].join(' ')} numberOfLines={2}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function getApplicantProgressStep(status?: string) {
  if (status === 'awaiting_payment') return 2;
  if (status === 'paid' || status === 'in_progress') return 3;
  if (status === 'ready_for_review' || status === 'completed') return 4;
  return 1;
}

export function ApplicantNextSteps({ activeOrderStatus, jobDate, payout }: { activeOrderStatus?: string; jobDate: string; payout: string }) {
  const progressStep = getApplicantProgressStep(activeOrderStatus);
  const steps = [
    ['Velg en søker', 'Søker valgt'],
    ['Start SafePay', 'Kontrakt genereres automatisk'],
    ['Jobben utføres', jobDate],
    ['Godkjenn og utbetal', `${payout} kr til oppdragstaker`],
  ];

  return (
    <View className="rounded-2xl border border-[#E6E7E1] bg-white p-5">
      <Text className="mb-4 text-[0.9375rem] font-bold text-[#0B0B0B]">Neste steg</Text>
      {steps.map(([label, description], index) => {
        const step = index + 1;
        // Was hardcoded to `step === 1`, which pinned "Du er her nå" to "Velg en søker" and left
        // the final "Godkjenn og utbetal" row permanently greyed out even when the order was
        // already `ready_for_review`.
        const current = step === progressStep;
        const done = step < progressStep;
        return (
          <View key={label} className="flex-row gap-3">
            <View className="items-center">
              <View className={['h-2.5 w-2.5 rounded-full', current ? 'bg-[#122A1C]' : done ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'].join(' ')} />
              {step < steps.length ? <View className="my-1 min-h-[30px] w-px flex-1 bg-[#E6E7E1]" /> : null}
            </View>
            <View className={step < steps.length ? 'pb-5' : ''}>
              <Text className={current ? 'text-[0.8125rem] font-bold text-[#0B0B0B]' : 'text-[0.8125rem] font-semibold text-[#63665F]'}>{step}. {label}</Text>
              <Text className={['mt-0.5 text-[0.6875rem]', current || done ? 'text-[#2E6641]' : 'text-[#9B9E96]'].join(' ')}>{current ? 'Du er her nå' : done ? 'Fullført' : description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function SafePayInfoCard({ price }: { price: number }) {
  return (
    <View className="rounded-2xl border border-[#E6E7E1] bg-white p-5">
      <Text className="text-[0.8125rem] font-medium text-[#0B0B0B]">SafePay beskytter deg</Text>
      <View className="mt-4 rounded-xl bg-[#EAF1E9] p-3">
        <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">Slik fungerer det</Text>
        <Text className="mt-1 text-[0.75rem] leading-relaxed text-[#2E6641]">Pengene holdes trygt til du godkjenner jobben. Ingen betaling før du er fornøyd.</Text>
      </View>
      <View className="mt-3 gap-1">
        <View className="flex-row justify-between"><Text className="text-[0.6875rem] text-[#9B9E96]">Oppdragsbeløp:</Text><Text className="text-[0.6875rem] font-semibold text-[#0B0B0B]">{price} kr</Text></View>
        <View className="flex-row justify-between"><Text className="text-[0.6875rem] text-[#9B9E96]">SafePay-gebyr (3%):</Text><Text className="text-[0.6875rem] font-semibold text-[#0B0B0B]">{safePayFee(price)} kr</Text></View>
        <View className="flex-row justify-between"><Text className="text-[0.6875rem] text-[#9B9E96]">Utbetalt til søker:</Text><Text className="text-[0.6875rem] font-semibold text-[#2E6641]">{safePayNetToProvider(price)} kr</Text></View>
      </View>
    </View>
  );
}

export function ApplicantSelectionGuide() {
  return (
    <View className="rounded-2xl border border-[#E6E7E1] bg-white p-5">
      <Text className="text-[0.8125rem] font-medium text-[#0B0B0B]">Hva bør du se etter?</Text>
      <View className="mt-3 gap-2">
        {['Høy rating (over 4.5)', 'Mange fullførte oppdrag', 'BankID eller ID verifisert', 'God og detaljert melding', 'Rask svartid'].map((item) => (
          <View key={item} className="flex-row items-center gap-2"><Check size={14} color="#2E6641" /><Text className="text-[0.75rem] text-[#63665F]">{item}</Text></View>
        ))}
      </View>
    </View>
  );
}