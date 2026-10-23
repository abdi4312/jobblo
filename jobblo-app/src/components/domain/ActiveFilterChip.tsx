import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { TC } from '../../theme/colors';

interface ActiveFilterChipProps {
  label: string;
  onRemove: () => void;
}

/**
 * Reusable chip component for displaying active filter values with remove action.
 * Used to show applied filters like categories, locations, price ranges, etc.
 * User can tap the X icon to remove that specific filter.
 */
export function ActiveFilterChip({ label, onRemove }: ActiveFilterChipProps) {
  return (
    <Pressable
      onPress={onRemove}
      className="flex-row items-center gap-1.5 rounded-full border border-brand-text/30 bg-tint px-3 py-1.5"
    >
      <Text className="text-[0.8125rem] font-medium text-brand-text">
        {label}
      </Text>
      <X size={13} color={TC.brandText} strokeWidth={2.5} />
    </Pressable>
  );
}
