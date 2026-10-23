import React from 'react';
import { View, Text } from 'react-native';
import { RangeSlider } from '../ui/RangeSlider';

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
 */
export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  onReset,
}: PriceRangeFilterProps) {
  const hasValue = minPrice !== DEFAULT_MIN || maxPrice !== DEFAULT_MAX;

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('nb-NO', {
      useGrouping: true,
    }).format(value);
  };

  return (
    <View className="border-b border-line py-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[0.9375rem] font-semibold text-ink">Pris</Text>
        {hasValue && (
          <Text
            onPress={onReset}
            className="text-[0.8125rem] font-medium text-brand-text"
          >
            Nullstill
          </Text>
        )}
      </View>

      <View className="gap-2">
        <RangeSlider min={DEFAULT_MIN} max={DEFAULT_MAX} minValue={minPrice} maxValue={maxPrice} step={100} onMinChange={onMinChange} onMaxChange={onMaxChange} />
        <View className="flex-row justify-between"><Text className="text-[0.8125rem] text-muted">0 kr</Text><Text className="text-[0.8125rem] text-muted">∞</Text></View>
        <View className="rounded-lg bg-surface-2 px-3 py-2"><Text className="text-center text-[0.8125rem] font-medium text-brand-text">{formatPrice(minPrice)} – {maxPrice === DEFAULT_MAX ? '∞' : formatPrice(maxPrice)} kr</Text></View>
      </View>
    </View>
  );
}
