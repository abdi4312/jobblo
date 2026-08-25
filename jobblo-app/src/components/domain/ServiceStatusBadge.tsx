import React from 'react';
import { Text, View } from 'react-native';
import type { ServiceStatus } from '../../types/Applicants';

type Tone = 'quiet' | 'moving' | 'action' | 'closed';

const SERVICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Aktiv', tone: 'moving' },
  in_progress: { label: 'I gang', tone: 'moving' },
  awaiting_payment: { label: 'Venter på betaling', tone: 'action' },
  waiting_for_approval: { label: 'Venter godkjenning', tone: 'action' },
  // The remaining Service.status enum values — without these the raw English
  // status string leaked into the badge.
  paid: { label: 'Betalt', tone: 'moving' },
  pending: { label: 'Ventende', tone: 'quiet' },
  draft: { label: 'Utkast', tone: 'quiet' },
  expired: { label: 'Utløpt', tone: 'closed' },
  completed: { label: 'Fullført', tone: 'closed' },
  cancelled: { label: 'Kansellert', tone: 'closed' },
  closed: { label: 'Lukket', tone: 'closed' },
};

const TONE_CLASS: Record<Tone, string> = {
  quiet: 'bg-[#F4F6F0] text-[#63665F]',
  moving: 'bg-[#EAF1E9] text-[#2E6641]',
  action: 'bg-[#122A1C] text-white',
  closed: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const mapped = SERVICE_STATUS[status] ?? { label: status, tone: 'quiet' as Tone };

  return (
    <View className={['self-start rounded-full px-2.5 py-1', TONE_CLASS[mapped.tone]].join(' ')}>
      <Text className="text-[0.6875rem] font-semibold text-current">{mapped.label}</Text>
    </View>
  );
}
