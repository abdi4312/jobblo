import React from 'react';
import { Image, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';

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
              'h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EAF1E9]',
              index > 0 ? '-ml-1.5' : '',
            ].join(' ')}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
              <UserRound size={11} color="#2E6641" />
            )}
          </View>
        );
      })}
      {applicantCount > 3 ? (
        <View className="-ml-1.5 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#F4F6F0]">
          <Text className="text-[0.5625rem] font-semibold text-[#63665F]">+{applicantCount - 3}</Text>
        </View>
      ) : null}
    </View>
  );
}