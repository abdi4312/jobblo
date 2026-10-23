import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small counter after the label, hidden when 0 or undefined. */
  count?: number;
  icon?: React.ReactNode;
  className?: string;
}

/** A selectable pill for filters (shadcn Toggle / Badge style). */
export function Chip({ label, selected = false, onPress, count, icon, className }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5',
        selected ? 'border-brand-text bg-brand' : 'border-line bg-surface',
        className
      )}
    >
      {icon}
      <Text className={cn('text-[0.8125rem] font-medium', selected ? 'text-white' : 'text-ink-2')}>{label}</Text>
      {count ? (
        <View className={cn('min-w-5 items-center rounded-full px-1.5 py-0.5', selected ? 'bg-white/20' : 'bg-tint')}>
          <Text className={cn('text-[0.8125rem] font-semibold tabular-nums', selected ? 'text-white' : 'text-brand-text')}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
