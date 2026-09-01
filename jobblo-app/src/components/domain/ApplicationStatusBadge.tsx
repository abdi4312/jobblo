import React from 'react';
import { Text, View } from 'react-native';

export type ApplicationStatusBadgeVariant = 'pending' | 'accepted' | 'declined';

const badgeClasses: Record<ApplicationStatusBadgeVariant, string> = {
  pending: 'bg-[#F4F6F0] text-[#63665F]',
  accepted: 'bg-[#EAF1E9] text-[#2E6641]',
  declined: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
};

const labelMap: Record<ApplicationStatusBadgeVariant, string> = {
  pending: 'Venter på svar',
  accepted: 'Du ble valgt',
  declined: 'Avslått',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatusBadgeVariant }) {
  return (
    <View className={['self-start rounded-full px-2.5 py-1', badgeClasses[status]].join(' ')}>
      <Text className="text-[0.6875rem] font-semibold text-current">
        {labelMap[status]}
      </Text>
    </View>
  );
}
