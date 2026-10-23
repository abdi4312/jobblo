import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Trash2 } from 'lucide-react-native';
import type { Job } from '../../types/Jobs';
import { TC, tc } from '../../theme/colors';

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
    <View className="flex-row items-center gap-3.5 rounded-[24px] border border-line bg-surface p-3">
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } })}
        className="flex-1 flex-row items-center gap-3.5"
        accessibilityRole="button"
        accessibilityLabel={`Åpne ${job.title || 'oppdrag'}`}
      >
        <View className="h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl bg-tint">
          {image ? (
            <Image source={{ uri: image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-[0.6875rem] text-muted">Ingen bilde</Text>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[0.9375rem] font-semibold text-ink" numberOfLines={2}>
            {job.title || 'Uten tittel'}
          </Text>

          <View className="mt-1.5 flex-row items-center gap-1">
            <MapPin size={12} color={tc('#9B9E96', 'subtle')} strokeWidth={2} />
            <Text className="flex-1 text-[0.8125rem] text-muted" numberOfLines={1}>
              {place}
            </Text>
          </View>

          <View className="mt-1.5 flex-row items-center gap-2">
            {price ? (
              <Text className="text-[0.875rem] font-semibold text-ink">{price}</Text>
            ) : (
              <Text className="text-[0.8125rem] text-muted">Pris ikke satt</Text>
            )}
            {isClosed ? (
              <View className="rounded-full bg-surface-2 px-2 py-0.5">
                <Text className="text-[0.6875rem] font-semibold text-muted">Lukket</Text>
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
          className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface"
          accessibilityRole="button"
          accessibilityLabel={`Fjern ${job.title || 'oppdrag'} fra listen`}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={tc('#B4544A', 'danger')} />
          ) : (
            <Trash2 size={16} color={tc('#B4544A', 'danger')} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
