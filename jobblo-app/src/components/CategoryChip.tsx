import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { getCategoryIcon, getAllCategoriesIcon } from '../utils/categoryIcons';
import type { Category } from '../types/Category';

interface CategoryChipProps {
  category: Category | { name: 'Alle' }; // "Alle" is synthetic
  isSelected: boolean;
  onPress: () => void;
  showIcon?: boolean;
}

/**
 * Reusable category filter chip component.
 *
 * Displays category icon, label, and selected/unselected state.
 * Matches the frontend responsive design with icon + text.
 *
 * Used by: Home screen and Explore/Search screen
 */
export const CategoryChip = React.memo(
  ({ category, isSelected, onPress, showIcon = true }: CategoryChipProps) => {
    const label = category.name;
    const IconComponent = label === 'Alle' ? getAllCategoriesIcon() : getCategoryIcon(category);
    const iconColor = isSelected ? '#2E6641' : '#63665F';

    return (
      <TouchableOpacity
        onPress={onPress}
        className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${
          isSelected
            ? 'bg-[#EAF1E9] border-[#2E6641]'
            : 'bg-white border-[#E6E7E1]'
        }`}
        activeOpacity={0.7}
      >
        {showIcon && (
          <IconComponent size={16} color={iconColor} strokeWidth={2} />
        )}
        <Text
          className={`text-[0.75rem] font-medium ${
            isSelected ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
);

CategoryChip.displayName = 'CategoryChip';
