import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { TC, tc } from '../../theme/colors';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'price_low', label: 'Pris – lavest først' },
  { value: 'price_high', label: 'Pris – høyest først' },
  { value: 'relevant', label: 'Mest relevant' },
] as const;

interface SearchResultsHeaderProps {
  totalCount: number;
  isLoading: boolean;
  sortValue: string;
  onSortChange: (value: string) => void;
}

/**
 * Header showing total results count and sort options menu.
 */
export function SearchResultsHeader({
  totalCount,
  isLoading,
  sortValue,
  onSortChange,
}: SearchResultsHeaderProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);

  return (
    <View className="mb-4 flex-row items-center justify-between px-4">
      <Text className="text-[0.875rem] text-muted">
        {isLoading
          ? 'Henter oppdrag…'
          : `${totalCount} ${totalCount === 1 ? 'resultat' : 'resultater'}`}
      </Text>

      <View className="relative">
        <TouchableOpacity
          onPress={() => setShowSortMenu((prev) => !prev)}
          className="flex-row items-center gap-2 rounded-full border border-line bg-surface px-3 py-2"
        >
          <Text className="text-[0.8125rem] font-medium text-ink">
            {SORT_OPTIONS.find((option) => option.value === sortValue)
              ?.label ?? 'Sorter'}
          </Text>
          <ChevronRight size={14} color={tc('#63665F', 'muted')} strokeWidth={2} />
        </TouchableOpacity>

        {showSortMenu && (
          <View className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  onSortChange(option.value);
                  setShowSortMenu(false);
                }}
                className="flex-row items-center justify-between border-b border-line px-3 py-3 last:border-b-0"
              >
                <Text className="text-[0.875rem] text-ink">
                  {option.label}
                </Text>
                {sortValue === option.value && (
                  <Check size={15} color={TC.brandText} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
