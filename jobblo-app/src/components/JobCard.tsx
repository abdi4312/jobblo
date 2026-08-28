import React from 'react';
import { View, Text, Image, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, MapPin, Badge } from 'lucide-react-native';
import type { Job } from '../types/Jobs';
import { useIsServiceSaved } from '../hooks/useFavoriteLists';
import { useAuthStore } from '../store/authStore';

interface JobCardProps {
  job: Job;
  showDescription?: boolean;
  /** Compact/grid variant for 2-column layouts — prevents price/location row overflow at narrow widths. */
  compact?: boolean;
  /**
   * Called when the bookmark icon is pressed. The parent screen owns the
   * SaveToListSheet — the card only provides the visual entry point and
   * the service id. When absent the bookmark icon is hidden entirely.
   */
  onSavePress?: (serviceId: string) => void;
}

/**
 * Mobile job card component — matches the web frontend JobCard design.
 *
 * Shows job photo, title, price, location, and status badges.
 * Photo is 4:5 aspect ratio. Card uses brand colors from theme.
 *
 * Pressing the card navigates to the job detail page.
 *
 * Reused across Home, Search, and other job listing contexts.
 */
export const JobCard: React.FC<JobCardProps> = ({ job, showDescription = false, compact = false, onSavePress }) => {
  const router = useRouter();
  const { isSaved, isLoading: savedLoading } = useIsServiceSaved(job._id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handlePress = () => {
    router.push({ pathname: '/(app)/jobs/[id]', params: { id: job._id } });
  };

  // Get the first image or use a fallback
  const imageUrl = job.images?.[0] || 'https://via.placeholder.com/300x375?text=No+Image';

  // Format price as Norwegian locale
  const priceFormatted = job.price ? job.price.toLocaleString('nb-NO') : 'Variabelt';
  const location = job.location?.city || job.location?.address || 'Norge';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="flex-1 focus-visible:outline-none"
    >
      {/* Photo container — 4:5 aspect ratio, rounded 2xl, brand bg */}
      <View
        className="relative overflow-hidden rounded-2xl bg-[#EAF1E9]"
        style={{ aspectRatio: 4 / 5, minHeight: 130 }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%', aspectRatio: 4 / 5 }}
          resizeMode="cover"
        />

        {/* Status badges overlay — top left */}
        {(job.promoted || job.urgent) && (
          <View className="absolute top-3 left-3 flex gap-2">
            {job.urgent && (
              <View className="bg-[#E8A8A0] px-2.5 py-1 rounded-full">
                <Text className="text-[0.65rem] font-semibold text-white">Haster</Text>
              </View>
            )}
            {job.promoted && (
              <View className="bg-[#2E6641] px-2.5 py-1 rounded-full">
                <Text className="text-[0.65rem] font-semibold text-white">Sponset</Text>
              </View>
            )}
          </View>
        )}

        {/* Status overlay — closed jobs get a grey overlay */}
        {job.status === 'closed' && (
          <View className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Text className="text-white text-sm font-semibold">Lukket</Text>
          </View>
        )}

        {/* Bookmark — top right, only shown when the parent provides onSavePress */}
        {onSavePress && (
          <View className="absolute right-3 top-3" pointerEvents="box-none">
            <Pressable
              onPress={() => {
                if (!isAuthenticated) {
                  router.push('/(auth)/login');
                  return;
                }
                onSavePress(job._id);
              }}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/95"
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Fjern fra lagrede lister' : 'Lagre i liste'}
            >
              {savedLoading ? (
                <View className="h-4 w-4" />
              ) : (
                <Bookmark size={16} color="#0B0B0B" fill={isSaved ? '#0B0B0B' : 'none'} />
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Text content below photo — sits directly on page, no card bg */}
      <View className="mt-2.5">
        {/* Title — 2 line clamp */}
        <Text
          className="text-[0.875rem] font-semibold text-[#0B0B0B] leading-tight"
          numberOfLines={2}
        >
          {job.title}
        </Text>

        {/* Description — optional, 1 line clamp if shown */}
        {showDescription && (
          <Text className="text-[0.8125rem] text-[#63665F] leading-tight mt-1" numberOfLines={1}>
            {job.description}
          </Text>
        )}

        {/* Price and location row */}
        <View className="flex-row items-center justify-between mt-2">
          <Text className={['text-[0.875rem] font-semibold text-[#0B0B0B] tabular-nums', compact && 'flex-shrink'].join(' ')} numberOfLines={1}>
            {priceFormatted} kr
          </Text>
          <View className={['flex-row items-center gap-1', compact && 'ml-2 flex-1 min-w-0'].join(' ')}>
            <MapPin size={13} color="#63665F" strokeWidth={2} />
            <Text className="text-[0.8125rem] text-[#63665F]" numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
