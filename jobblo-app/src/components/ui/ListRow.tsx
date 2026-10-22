import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface ListRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  /** Red text and icon, no chevron (e.g. "Logg ut"). */
  destructive?: boolean;
  /** Draws a divider above the row; set on every row but the first inside a Card. */
  divider?: boolean;
}

/** A tappable settings/menu row: tinted icon, label, optional description and a chevron. */
export function ListRow({ icon: Icon, label, description, onPress, destructive = false, divider = false }: ListRowProps) {
  const color = destructive ? '#B4544A' : '#2E6641';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      className={cn('flex-row items-center gap-3 px-4 py-3.5 active:bg-[#F4F6F0]', divider && 'border-t border-[#E6E7E1]')}
    >
      <View className={cn('h-9 w-9 items-center justify-center rounded-xl', destructive ? 'bg-[#FBF4F2]' : 'bg-[#EAF1E9]')}>
        <Icon size={17} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={cn('text-[0.9375rem] font-semibold', destructive ? 'text-[#B4544A]' : 'text-[#0B0B0B]')}>
          {label}
        </Text>
        {description ? (
          <Text className="mt-0.5 text-[0.8125rem] text-[#63665F]" numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {!destructive ? <ChevronRight size={18} color="#9B9E96" /> : null}
    </Pressable>
  );
}
