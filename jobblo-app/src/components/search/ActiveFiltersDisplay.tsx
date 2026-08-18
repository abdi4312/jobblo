import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ActiveFilterChip } from '../domain/ActiveFilterChip';
import type { SearchFiltersState } from '../../hooks/useSearchFilters';
import type { LocationNode } from '../../types/Location';

interface ActiveFiltersDisplayProps {
  filters: SearchFiltersState;
  locationTree?: LocationNode[];
  onRemoveCategory: (category: string) => void;
  onRemovePrice: () => void;
  onRemoveUrgent: () => void;
  onRemoveCounty: (code: string) => void;
  onRemoveMunicipality: (code: string) => void;
  onRemoveLocation: () => void;
}

/**
 * Display active filters as removable chips.
 * Shows all applied filters with individual remove actions.
 */
export function ActiveFiltersDisplay({
  filters,
  locationTree,
  onRemoveCategory,
  onRemovePrice,
  onRemoveUrgent,
  onRemoveCounty,
  onRemoveMunicipality,
  onRemoveLocation,
}: ActiveFiltersDisplayProps) {
  const chips = useMemo(() => {
    const items: { key: string; label: string; onRemove: () => void }[] = [];

    // Categories
    filters.selectedCategories.forEach((cat) => {
      items.push({
        key: `cat-${cat}`,
        label: cat,
        onRemove: () => onRemoveCategory(cat),
      });
    });

    // Price
    const hasPriceFilter =
      filters.minPrice !== 0 || filters.maxPrice !== 100000;
    if (hasPriceFilter) {
      const formatPrice = (value: number): string => {
        return new Intl.NumberFormat('nb-NO', {
          useGrouping: true,
        }).format(value);
      };

      items.push({
        key: 'price',
        label: `${formatPrice(filters.minPrice)}–${
          filters.maxPrice === 100000 ? '∞' : formatPrice(filters.maxPrice)
        } kr`,
        onRemove: onRemovePrice,
      });
    }

    // Urgent
    if (filters.isUrgent) {
      items.push({
        key: 'urgent',
        label: 'Kun haster',
        onRemove: onRemoveUrgent,
      });
    }

    // Counties
    filters.selectedCountyCodes.forEach((code) => {
      const county = locationTree?.find((c) => c.code === code);
      if (county) {
        items.push({
          key: `county-${code}`,
          label: county.name,
          onRemove: () => onRemoveCounty(code),
        });
      }
    });

    // Municipalities
    filters.selectedMunicipalityCodes.forEach((code) => {
      const mun = locationTree
        ?.flatMap((c) => c.children ?? [])
        .find((m) => m.code === code);
      if (mun) {
        items.push({
          key: `mun-${code}`,
          label: mun.name,
          onRemove: () => onRemoveMunicipality(code),
        });
      }
    });

    // Current location
    if (filters.userLocation) {
      items.push({
        key: 'location',
        label: 'Min posisjon (5 km)',
        onRemove: onRemoveLocation,
      });
    }

    return items;
  }, [
    filters.selectedCategories,
    filters.minPrice,
    filters.maxPrice,
    filters.isUrgent,
    filters.selectedCountyCodes,
    filters.selectedMunicipalityCodes,
    filters.userLocation,
    locationTree,
    onRemoveCategory,
    onRemovePrice,
    onRemoveUrgent,
    onRemoveCounty,
    onRemoveMunicipality,
    onRemoveLocation,
  ]);

  if (chips.length === 0) {
    return null;
  }

  return (
    <View className="mb-4 flex-row flex-wrap items-center gap-2 px-4">
      {chips.map((chip) => (
        <ActiveFilterChip
          key={chip.key}
          label={chip.label}
          onRemove={chip.onRemove}
        />
      ))}
    </View>
  );
}
