import React, { useState } from 'react';
import { Modal, View, Text, ActivityIndicator, Pressable, ScrollView, Switch } from 'react-native';
import * as Location from 'expo-location';
import { Button } from '../ui/Button';
import { PriceRangeFilter } from '../domain/PriceRangeFilter';
import { LocationFilter } from '../domain/LocationFilter';
import { SearchAreaMap } from './SearchAreaMap';
import { Check, ChevronDown, ChevronRight, Locate, MapPin, X, Zap } from 'lucide-react-native';
import type { SearchFiltersState } from '../../hooks/useSearchFilters';
import type { LocationNode } from '../../types/Location';
import type { CategoryWithCount } from '../../types/Category';

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFiltersState;
  categories: CategoryWithCount[];
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
  mapCenter: [number, number];
  mapRadius: number;
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
  mapCenter,
  mapRadius,
}: SearchFilterSheetProps) {
  const [locationError, setLocationError] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
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
      } else {
        setLocationError('Posisjonstillatelse ble avslått.');
      }
    } catch {
      setLocationError('Kunne ikke hente posisjonen din. Prøv igjen.');
    } finally {
      onSetIsLocating(false);
    }
  };

  const visibleCategories: CategoryWithCount[] = categories.filter((category) => !['alle', 'all', 'alle kategorier', 'all categories', 'ingen'].includes(category.name.trim().toLowerCase()));
  const allCategoryCount = visibleCategories.reduce((sum, category) => sum + (Number(category.count) || 0), 0);
  const categoryRows: CategoryWithCount[] = [{ _id: 'all', name: 'Alle', icon: '', count: allCategoryCount }, ...visibleCategories];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-[#0B0B0B]/45">
        <View className="h-[94%] overflow-hidden rounded-t-[28px] bg-white">
          <View className="border-b border-[#E6E7E1] px-5 pb-3 pt-2">
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-[#D4D6CD]" />
            <View className="flex-row items-center justify-between">
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk filter" className="h-10 w-10 items-center justify-center">
                <X size={20} color="#0B0B0B" />
              </Pressable>
              <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">Filtrer</Text>
              {hasActiveFilters ? <Pressable onPress={onResetAllFilters} accessibilityRole="button" className="h-10 justify-center"><Text className="text-[0.8125rem] font-semibold text-[#2E6641]">Nullstill</Text></Pressable> : <View className="h-10 w-10" />}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        {/* Urgent */}
        <Pressable onPress={() => onSetIsUrgent(!filters.isUrgent)} accessibilityRole="switch" accessibilityState={{ checked: filters.isUrgent }} className="flex-row items-center justify-between border-b border-[#E6E7E1] py-4">
          <View className="flex-row items-center"><View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1E9]"><Zap size={16} color="#2E6641" /></View><View className="ml-3"><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Haster</Text><Text className="mt-0.5 text-[0.8125rem] text-[#63665F]">Vis kun hasteoppdrag</Text></View></View>
          <Switch value={filters.isUrgent} onValueChange={onSetIsUrgent} trackColor={{ false: '#E6E7E1', true: '#2E6641' }} thumbColor="#FFFFFF" />
        </Pressable>

        {/* Categories */}
        <View>
          <Text className="mb-2 mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">Kategorier</Text>
          {categoriesLoading ? (
            <View className="py-3">
              <ActivityIndicator color="#2E6641" size="small" />
            </View>
          ) : (
            <View className="gap-0.5">
              {categoryRows.map((cat) => {
                const selected = cat.name === 'Alle'
                  ? filters.selectedCategories.length === 0
                  : filters.selectedCategories.includes(cat.name);
                const categoryClass = selected ? 'bg-[#EAF1E9]' : '';
                const textClass = selected ? 'font-semibold text-[#2E6641]' : 'text-[#0B0B0B]';
                return (
                  <View key={cat._id}>
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={() => onToggleCategory(cat.name === 'Alle' ? '' : cat.name)}
                        className={`flex-1 flex-row items-center rounded-lg px-2.5 py-2 ${categoryClass}`}
                      >
                        {selected ? <Check size={14} color="#2E6641" /> : null}<Text className={`flex-1 text-[0.875rem] ${textClass}`}>{cat.name}</Text>
                        <Text className={`text-[0.75rem] ${selected ? 'text-[#2E6641]' : 'text-[#9B9E96]'}`}>
                          {cat.count || 0}
                        </Text>
                      </Pressable>
                      {cat.subcategories?.length ? (
                        <Pressable
                          onPress={() => setExpandedCategories((current) => current.includes(cat._id) ? current.filter((id) => id !== cat._id) : [...current, cat._id])}
                          className="h-9 w-9 items-center justify-center"
                        >
                          {expandedCategories.includes(cat._id) ? <ChevronDown size={16} color="#63665F" /> : <ChevronRight size={16} color="#63665F" />}
                        </Pressable>
                      ) : <View className="h-9 w-9" />}
                    </View>
                    {expandedCategories.includes(cat._id) ? (
                      <View className="ml-3 border-l border-[#E6E7E1] pl-2">
                        {cat.subcategories?.map((sub) => (
                          <Pressable
                            key={sub._id}
                            onPress={() => onToggleCategory(sub.name)}
                            className={`flex-row items-center rounded-lg px-2.5 py-1.5 ${filters.selectedCategories.includes(sub.name) ? 'bg-[#EAF1E9]' : ''}`}
                          >
                            <Text className={`flex-1 text-[0.8125rem] ${filters.selectedCategories.includes(sub.name) ? 'font-semibold text-[#2E6641]' : 'text-[#63665F]'}`}>
                              {sub.name}
                            </Text>
                            <Text className="text-[0.75rem] text-[#9B9E96]">{sub.count || 0}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Location Filter */}
        {locationTree && locationTree.length > 0 && (
          <View className="mt-5"><LocationFilter
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
          /></View>
        )}

        {/* Current Location Button */}
        <View className="mt-5 border-t border-b border-[#E6E7E1] py-4">
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
            icon={filters.userLocation ? <Check size={15} color="#FFFFFF" /> : <Locate size={15} color="#2E6641" />}
            onPress={handleUseCurrentLocation}
          />
          <Text className="mt-2 text-[0.75rem] text-[#9B9E96]">
            Viser oppdrag innen 5 km
          </Text>
          {locationError ? <Text className="mt-2 text-[0.75rem] text-[#B4544A]">{locationError}</Text> : null}
        </View>

        <View className="mt-5 border-t border-[#E6E7E1] pt-5"><View className="mb-3 flex-row items-center justify-between"><View className="flex-row items-center gap-1.5"><MapPin size={13} color="#2E6641" /><Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">Kart</Text></View><Text className="text-[0.75rem] text-[#63665F]">{filters.userLocation ? 'Min posisjon' : 'Søkeområde'}</Text></View>{visible ? <SearchAreaMap center={mapCenter} radius={mapRadius} /> : null}</View>
        <PriceRangeFilter minPrice={filters.minPrice} maxPrice={filters.maxPrice} onMinChange={onSetMinPrice} onMaxChange={onSetMaxPrice} onReset={onResetPrice} />

          </ScrollView>
          <View className="border-t border-[#E6E7E1] bg-white px-5 py-4">
            <Button label={`Vis ${jobsCount}${hasNextPage ? '+' : ''} oppdrag`} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
