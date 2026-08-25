import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Globe, Lock } from 'lucide-react-native';
import {
  favoriteListCount,
  favoriteListCoverImage,
  type FavoriteList,
} from '../../types/FavoriteList';

interface FavoriteListCardProps {
  list: FavoriteList;
  onPress: () => void;
}

/**
 * One saved list on the Favorites overview.
 *
 * Mirrors the web FavoritesPage card — newest saved service as the cover, name over a
 * scrim — with two additions the phone can carry: the number of saved services, and the
 * visibility pill.
 *
 * The pill is shown only when the list is public. `public: false` is the model default
 * and every list starts there, so a "Privat" badge on every card would be noise; the
 * badge that matters is the one saying this list is reachable by anyone with the link.
 *
 * The name sits on an opaque strip under the photo rather than over it. At 360 dp a
 * column is ~164 dp wide, and text over a photo at that size is where the web layout
 * stops being readable.
 */
export function FavoriteListCard({ list, onPress }: FavoriteListCardProps) {
  const cover = favoriteListCoverImage(list);
  const count = favoriteListCount(list);

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 overflow-hidden rounded-[24px] border border-[#E6E7E1] bg-white"
      accessibilityRole="button"
      accessibilityLabel={`${list.name}, ${count} oppdrag`}
    >
      <View className="relative aspect-[4/5] bg-[#EAF1E9]">
        {cover ? (
          <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="px-3 text-center text-[0.75rem] text-[#63665F]">Ingen bilder</Text>
          </View>
        )}

        {list.public ? (
          <View className="absolute left-2.5 top-2.5 flex-row items-center gap-1 rounded-full bg-white/95 px-2 py-1">
            <Globe size={11} color="#2E6641" />
            <Text className="text-[0.625rem] font-semibold text-[#2E6641]">Offentlig</Text>
          </View>
        ) : null}
      </View>

      <View className="px-3.5 py-3">
        <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>
          {list.name}
        </Text>
        <Text className="mt-1 text-[0.75rem] text-[#63665F]">
          {count === 1 ? '1 oppdrag' : `${count} oppdrag`}
        </Text>
      </View>
    </Pressable>
  );
}

/** Kept next to the card so both places show visibility the same way. */
export function ListVisibilityPill({ isPublic }: { isPublic?: boolean }) {
  const Icon = isPublic ? Globe : Lock;
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-[#E6E7E1] bg-[#F4F6F0] px-2.5 py-1.5">
      <Icon size={12} color="#2E6641" />
      <Text className="text-[0.6875rem] font-semibold text-[#0B0B0B]">
        {isPublic ? 'Offentlig' : 'Privat'}
      </Text>
    </View>
  );
}
