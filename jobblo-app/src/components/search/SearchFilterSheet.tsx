import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { PriceRangeFilter } from '../domain/PriceRangeFilter';
import { UrgentFilter } from '../domain/UrgentFilter';
import { LocationFilter } from '../domain/LocationFilter';
import { CategoryChip } from '../CategoryChip';
import type { SearchFiltersState } from '../../hooks/useSearchFilters';
import type { LocationNode } from '../../types/Location';

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFiltersState;
  categories: Array<{ _id: string; name: string }>;
  locationTree?: LocationNode[];
  categoriesLoading: boolean;
  locationsLoading: boolean;
  // Callbacks
  onToggleCategory: (category: string) => void;
  onSetMinPrice: (price: number) => void;
  onSetMaxPrice: (price: number) => void;
  onResetPrice: () => void;
  onSetIsUrgent: (urgent: boolean) => void;
  onToggleCounty: (code: string) => void;
  onToggleCountyExpand: (code: string) => void;
  onToggleMunicipality: (code: string) => void;
  onToggleMunicipalityExpand: (code: string) => void;
  onToggleArea: (code: string) => void;
  onResetLocation: () => void;
  onSetUserLocation: (location: { lat: number; lng: number } | null) => void;
  onSetIsLocating: (locating: boolean) => void;
  onResetAllFilters: () => void;
  jobsCount: number;
  hasNextPage: boolean;
}

/**
 * Filter sheet containing all search filters.
 * Includes categories, price, urgent, location, and current location button.
 */
export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  categories,
  locationTree,
  categoriesLoading,
  locationsLoading,
  onToggleCategory,
  onSetMinPrice,
  onSetMaxPrice,
  onResetPrice,
  onSetIsUrgent,
  onToggleCounty,
  onToggleCountyExpand,
  onToggleMunicipality,
  onToggleMunicipalityExpand,
  onToggleArea,
  onResetLocation,
  onSetUserLocation,
  onSetIsLocating,
  onResetAllFilters,
  jobsCount,
  hasNextPage,
}: SearchFilterSheetProps) {
  const hasActiveFilters =
    filters.selectedCategories.length > 0 ||
    filters.minPrice !== 0 ||
    filters.maxPrice !== 100000 ||
    filters.isUrgent ||
    filters.selectedCountyCodes.length > 0 ||
    filters.selectedMunicipalityCodes.length > 0 ||
    filters.selectedAreaCodes.length > 0 ||
    filters.userLocation !== null;

  const handleUseCurrentLocation = async () => {
    onSetIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        onSetUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (err) {
      console.error('Failed to get current location:', err);
    } finally {
      onSetIsLocating(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrer oppdrag"
      footer={
        <View className="gap-2">
          <Button
            label={`Vis ${jobsCount}${hasNextPage ? '+' : ''} oppdrag`}
            onPress={onClose}
          />
          {hasActiveFilters && (
            <Button
              label="Nullstill alle filtre"
              variant="secondary"
              onPress={onResetAllFilters}
            />
          )}
        </View>
      }
    >
      <View className="gap-4">
        {/* Categories */}
        <View>
          <Text className="mb-2 text-[0.9375rem] font-semibold text-[#0B0B0B]">
            Kategorier
          </Text>
          {categoriesLoading ? (
            <View className="py-3">
              <ActivityIndicator color="#2E6641" size="small" />
            </View>
          ) : (
            <View className="flex-row flex-wrap -mx-1.5">
              <View className="w-1/2 px-1.5 pb-2">
                <CategoryChip
                  category={{ name: 'Alle' }}
                  isSelected={filters.selectedCategories.length === 0}
                  onPress={() => onToggleCategory('')}
                />
              </View>
              {categories.map((cat) => (
                <View key={cat._id} className="w-1/2 px-1.5 pb-2">
                  <CategoryChip
                    category={{ name: cat.name }}
                    isSelected={filters.selectedCategories.includes(cat.name)}
                    onPress={() => onToggleCategory(cat.name)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Price Filter */}
        <PriceRangeFilter
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinChange={onSetMinPrice}
          onMaxChange={onSetMaxPrice}
          onReset={onResetPrice}
        />

        {/* Urgent Filter */}
        <UrgentFilter
          isUrgent={filters.isUrgent}
          onChange={onSetIsUrgent}
        />

        {/* Location Filter */}
        {locationTree && locationTree.length > 0 && (
          <LocationFilter
            locationTree={locationTree}
            selectedCountyCodes={filters.selectedCountyCodes}
            selectedMunicipalityCodes={filters.selectedMunicipalityCodes}
            selectedAreaCodes={filters.selectedAreaCodes}
            expandedCounties={filters.expandedCounties}
            expandedMunicipalities={filters.expandedMunicipalities}
            onToggleCounty={onToggleCounty}
            onToggleMunicipality={onToggleMunicipality}
            onToggleArea={onToggleArea}
            onToggleCountyExpand={onToggleCountyExpand}
            onToggleMunicipalityExpand={onToggleMunicipalityExpand}
            onReset={onResetLocation}
          />
        )}

        {/* Current Location Button */}
        <View className="border-b border-[#E6E7E1] py-4">
          <Button
            label={
              filters.isLocating
                ? 'Henter din posisjon…'
                : filters.userLocation
                  ? 'Bruk min posisjon (aktivt)'
                  : 'Bruk min posisjon'
            }
            disabled={filters.isLocating}
            variant={filters.userLocation ? 'primary' : 'secondary'}
            onPress={handleUseCurrentLocation}
          />
          <Text className="mt-2 text-[0.75rem] text-[#9B9E96]">
            Viser oppdrag innen 5 km
          </Text>
        </View>
      </View>
    </Sheet>
  );
}
