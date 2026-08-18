import { useQuery } from '@tanstack/react-query';
import { locationService } from '../services/location.service';
import { queryKeys } from '../queryKeys';

/**
 * Fetch the complete location tree (counties with nested municipalities and areas).
 * Used by filter components to populate location selection.
 */
export function useLocationTree() {
  return useQuery({
    queryKey: queryKeys.locations.tree,
    queryFn: () => locationService.getLocationTree(),
    staleTime: 60 * 60 * 1000, // 1 hour — location hierarchy rarely changes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Fetch location statistics (job counts per region).
 * Used by filter components to show availability counts.
 */
export function useLocationStats() {
  return useQuery({
    queryKey: queryKeys.locations.stats,
    queryFn: () => locationService.getLocationStats(),
    staleTime: 30 * 60 * 1000, // 30 minutes — job counts update frequently
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}
