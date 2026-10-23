import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { SearchInput } from '../ui/SearchInput';
import { TC } from '../../theme/colors';

interface SearchHeaderProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  onFilterPress: () => void;
  activeFilterCount: number;
}

/**
 * Search header with search input and filter button.
 * Displays active filter count badge.
 */
export function SearchHeader({
  searchText,
  onSearchChange,
  onFilterPress,
  activeFilterCount,
}: SearchHeaderProps) {
  return (
    <View className="px-4 pb-3 pt-3 flex-row items-center gap-2">
      <TouchableOpacity
        onPress={onFilterPress}
        className="h-12 shrink-0 flex-row items-center gap-2 rounded-full border border-line bg-surface px-4"
      >
        <SlidersHorizontal size={17} color={TC.brandText} strokeWidth={2} />
        <Text className="text-[0.875rem] font-semibold text-ink">
          Filtrer
        </Text>
        {activeFilterCount > 0 && (
          <View className="ml-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5">
            <Text className="text-[0.8125rem] font-bold text-white">
              {activeFilterCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <SearchInput
        value={searchText}
        onChange={onSearchChange}
        placeholder="Søk etter oppdrag"
      />
    </View>
  );
}
