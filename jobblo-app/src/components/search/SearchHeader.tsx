import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { SearchInput } from '../ui/SearchInput';

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
        className="h-12 shrink-0 flex-row items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4"
      >
        <SlidersHorizontal size={17} color="#2E6641" strokeWidth={2} />
        <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">
          Filtrer
        </Text>
        {activeFilterCount > 0 && (
          <View className="ml-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-[#2E6641] px-1.5">
            <Text className="text-[0.6875rem] font-bold text-white">
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
