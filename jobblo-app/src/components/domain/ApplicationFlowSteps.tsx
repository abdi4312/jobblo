import React from 'react';
import { Text, View } from 'react-native';

const steps = [
  { key: 'applied', label: 'Søkt' },
  { key: 'selected', label: 'Valgt' },
  { key: 'paid', label: 'Betalt' },
  { key: 'working', label: 'Under arbeid' },
  { key: 'done', label: 'Fullført' },
] as const;

export function ApplicationFlowSteps({
  applicationStatus,
  orderStatus,
}: {
  applicationStatus?: 'pending' | 'accepted' | 'declined';
  orderStatus?: string | null;
}) {
  const hasAccepted = applicationStatus === 'accepted';
  const hasOrder = !!orderStatus;
  const hasPaid = orderStatus === 'paid';
  const isWorking = ['in_progress', 'ready_for_review', 'completed'].includes(orderStatus ?? '');
  const isDone = orderStatus === 'completed';

  const completedStates = [
    true,
    hasAccepted || hasOrder,
    hasPaid,
    isWorking,
    isDone,
  ];

  const completedCount = completedStates.filter(Boolean).length;
  const current = steps[Math.min(completedCount, steps.length - 1)];

  return (
    <View className="mt-4">
      <View className="flex-row items-center gap-1.5">
        {steps.map((step, index) => {
          const active = index < completedCount;
          return (
            <View
              key={step.key}
              className={['h-1.5 flex-1 rounded-full', active ? 'bg-brand' : 'bg-line'].join(' ')}
            />
          );
        })}
      </View>
      <Text className="mt-2 text-[0.8125rem] text-muted">
        <Text className="font-semibold text-ink">Steg {Math.min(completedCount, steps.length)} av {steps.length}</Text>
        {' · '}
        {completedCount === steps.length ? 'Fullført' : current.label}
      </Text>
    </View>
  );
}
