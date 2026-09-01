import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Trash2 } from 'lucide-react-native';
import type { Job } from '../../types/Jobs';

interface SavedJobCardProps {
  job: Job;
  onRemove?: () => void;
  isRemoving?: boolean;
}

/**
 * A saved job inside a list — the horizontal, single-column counterpart of
 * `src/components/JobCard.tsx`.
 *
 * It takes the same `Job` model, so there is no second service shape to keep in sync;
 * only the layout differs. The grid card cannot be reused as-is here because a saved row
 * has to carry a remove control, and a 4:5 photo per row would put roughly one and a half
 * saved jobs on screen at a time.
 *
 * Tapping the card opens the canonical job detail route, `/(app)/jobs/[id]` — the same
 * one the grid card pushes. No second detail screen exists.
 */
export function SavedJobCard({ job, onRemove, isRemoving = false }: SavedJobCardProps) {
  const router = useRouter();

  const image = job.images?.[0];
  const place = job.location?.city || job.location?.address || 'Norge';
  const price = typeof job.price === 'number' ? `${job.price.toLocaleString('nb-NO')} kr` : null;
  const isClosed =
    job.status === 'closed' ||
    job.status === 'completed' ||
    job.status === 'cancelled' ||
    job.status === 'expired';

  return (
    <View className="flex-row items-center gap-3.5 rounded-[24px] border border-[#E6E7E1] bg-white p-3">
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } })}
        className="flex-1 flex-row items-center gap-3.5"
        accessibilityRole="button"
        accessibilityLabel={`Åpne ${job.title || 'oppdrag'}`}
      >
        <View className="h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl bg-[#EAF1E9]">
          {image ? (
            <Image source={{ uri: image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-[0.625rem] text-[#63665F]">Ingen bilde</Text>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>
            {job.title || 'Uten tittel'}
          </Text>

          <View className="mt-1.5 flex-row items-center gap-1">
            <MapPin size={12} color="#9B9E96" strokeWidth={2} />
            <Text className="flex-1 text-[0.8125rem] text-[#63665F]" numberOfLines={1}>
              {place}
            </Text>
          </View>

          <View className="mt-1.5 flex-row items-center gap-2">
            {price ? (
              <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">{price}</Text>
            ) : (
              <Text className="text-[0.8125rem] text-[#63665F]">Pris ikke satt</Text>
            )}
            {isClosed ? (
              <View className="rounded-full bg-[#F4F6F0] px-2 py-0.5">
                <Text className="text-[0.625rem] font-semibold text-[#63665F]">Lukket</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={isRemoving}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white"
          accessibilityRole="button"
          accessibilityLabel={`Fjern ${job.title || 'oppdrag'} fra listen`}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color="#B4544A" />
          ) : (
            <Trash2 size={16} color="#B4544A" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
