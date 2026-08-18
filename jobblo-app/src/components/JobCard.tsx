import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Badge } from 'lucide-react-native';
import type { Job } from '../types/Jobs';

interface JobCardProps {
  job: Job;
  showDescription?: boolean;
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
export const JobCard: React.FC<JobCardProps> = ({ job, showDescription = false }) => {
  const router = useRouter();

  const handlePress = () => {
    // Navigate to job detail page
    // Note: Job detail page is not yet implemented; placeholder routing for now
    // router.push(`/(app)/job-detail/${job._id}`);
    // Using explore as placeholder since job-detail route doesn't exist yet
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
      <View className="relative aspect-4/5 overflow-hidden rounded-2xl bg-[#EAF1E9]">
        <Image
          source={{ uri: imageUrl }}
          className="w-full h-full"
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
          <Text
            className="text-[0.8125rem] text-[#63665F] leading-tight mt-1"
            numberOfLines={1}
          >
            {job.description}
          </Text>
        )}

        {/* Price and location row */}
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-[0.875rem] font-semibold text-[#0B0B0B] tabular-nums">
            {priceFormatted} kr
          </Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={13} color="#63665F" strokeWidth={2} />
            <Text
              className="text-[0.8125rem] text-[#63665F]"
              numberOfLines={1}
            >
              {location}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
