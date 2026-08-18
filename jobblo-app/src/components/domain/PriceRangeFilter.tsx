import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface PriceRangeFilterProps {
  minPrice: number;
  maxPrice: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  onReset: () => void;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100000;

/**
 * Interactive price range filter for job search.
 * Allows setting minimum and maximum price thresholds via input fields.
 * 
 * UI matches web implementation:
 * - "Fra" (From) input: min price
 * - "Til" (To) input: max price (shows empty at default 100000)
 * - Reset button when not at defaults
 * 
 * Defaults: 0 - 100000 kr
 * Step: manual input (no fixed step)
 * Display: Norwegian locale formatting (kr currency)
 */
export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  onReset,
}: PriceRangeFilterProps) {
  const hasValue = minPrice !== DEFAULT_MIN || maxPrice !== DEFAULT_MAX;

  const handleMinChange = (text: string) => {
    const value = text === '' ? DEFAULT_MIN : parseInt(text, 10);
    if (!isNaN(value) && value >= DEFAULT_MIN) {
      onMinChange(Math.min(value, maxPrice));
    }
  };

  const handleMaxChange = (text: string) => {
    // Empty means default max (100000)
    const value = text === '' ? DEFAULT_MAX : parseInt(text, 10);
    if (!isNaN(value) && value >= DEFAULT_MIN) {
      onMaxChange(Math.max(value, minPrice));
    }
  };

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('nb-NO', {
      useGrouping: true,
    }).format(value);
  };

  return (
    <View className="border-b border-[#E6E7E1] py-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Pris</Text>
        {hasValue && (
          <Text
            onPress={onReset}
            className="text-[0.8125rem] font-medium text-[#2E6641]"
          >
            Nullstill
          </Text>
        )}
      </View>

      <View className="gap-3">
        {/* From input */}
        <View>
          <Text className="mb-1.5 text-[0.8125rem] font-medium text-[#63665F]">
            Fra (minimum)
          </Text>
          <View className="relative">
            <TextInput
              value={minPrice === DEFAULT_MIN ? '' : formatPrice(minPrice)}
              onChangeText={handleMinChange}
              placeholder="0"
              placeholderTextColor="#9B9E96"
              keyboardType="number-pad"
              className="rounded-lg border border-[#E6E7E1] bg-white px-3 py-2.5 pr-10 text-[0.875rem] text-[#0B0B0B]"
            />
            <Text className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] font-semibold text-[#9B9E96]">
              kr
            </Text>
          </View>
        </View>

        {/* To input */}
        <View>
          <Text className="mb-1.5 text-[0.8125rem] font-medium text-[#63665F]">
            Til (maksimum)
          </Text>
          <View className="relative">
            <TextInput
              value={
                maxPrice === DEFAULT_MAX
                  ? ''
                  : formatPrice(maxPrice)
              }
              onChangeText={handleMaxChange}
              placeholder="∞"
              placeholderTextColor="#9B9E96"
              keyboardType="number-pad"
              className="rounded-lg border border-[#E6E7E1] bg-white px-3 py-2.5 pr-10 text-[0.875rem] text-[#0B0B0B]"
            />
            <Text className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] font-semibold text-[#9B9E96]">
              kr
            </Text>
          </View>
        </View>

        {/* Price summary */}
        <View className="mt-1 rounded-lg bg-[#F4F6F0] px-3 py-2">
          <Text className="text-center text-[0.8125rem] font-medium text-[#2E6641]">
            {formatPrice(minPrice)}–{maxPrice === DEFAULT_MAX ? '∞' : formatPrice(maxPrice)} kr
          </Text>
        </View>
      </View>
    </View>
  );
}
