import React from 'react';
import { Image, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { TC } from '../../theme/colors';

export function ApplicantAvatarStack({
  avatars,
  applicantCount,
}: {
  avatars: string[];
  applicantCount: number;
}) {
  const visibleCount = Math.min(Math.max(applicantCount, 0), 3);
  const visibleAvatars = avatars.slice(0, visibleCount);

  return (
    <View className="flex-row items-center justify-end">
      {Array.from({ length: visibleCount }).map((_, index) => {
        const avatar = visibleAvatars[index];
        return (
          <View
            key={`${avatar ?? 'fallback'}-${index}`}
            className={[
              'h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-tint',
              index > 0 ? '-ml-1.5' : '',
            ].join(' ')}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
              <UserRound size={11} color={TC.brandText} />
            )}
          </View>
        );
      })}
      {applicantCount > 3 ? (
        <View className="-ml-1.5 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-surface-2">
          <Text className="text-[0.6875rem] font-semibold text-muted">+{applicantCount - 3}</Text>
        </View>
      ) : null}
    </View>
  );
}