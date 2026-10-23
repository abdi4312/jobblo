import React from 'react';
import { Text, View } from 'react-native';

export type ApplicationStatusBadgeVariant = 'pending' | 'accepted' | 'declined';

const badgeClasses: Record<ApplicationStatusBadgeVariant, string> = {
  pending: 'bg-surface-2 text-muted',
  accepted: 'bg-tint text-brand-text',
  declined: 'border border-line bg-surface text-subtle',
};

const labelMap: Record<ApplicationStatusBadgeVariant, string> = {
  pending: 'Venter på svar',
  accepted: 'Du ble valgt',
  declined: 'Avslått',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatusBadgeVariant }) {
  return (
    <View className={['self-start rounded-full px-2.5 py-1', badgeClasses[status]].join(' ')}>
      <Text className="text-[0.8125rem] font-semibold text-current">
        {labelMap[status]}
      </Text>
    </View>
  );
}
