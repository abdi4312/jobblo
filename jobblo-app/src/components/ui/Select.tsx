import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { TC, tc } from '../../theme/colors';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** 'pill' (default): compact sort/filter trigger. 'field': full-width form input. */
  variant?: 'pill' | 'field';
  invalid?: boolean;
  disabled?: boolean;
}

export function Select({
  value,
  options,
  onValueChange,
  placeholder = 'Sorter',
  variant = 'pill',
  invalid = false,
  disabled = false,
}: SelectProps) {
  const [visible, setVisible] = React.useState(false);
  // An empty value means "nothing chosen yet": show the placeholder, not the first option
  // dressed up as a choice (a form showed the first fylke as if it had been picked).
  const selected = options.find((option) => option.value === value) ?? (value ? options[0] : undefined);
  const isField = variant === 'field';

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={selected?.label ?? placeholder}
        className={cn(
          'flex-row items-center gap-2',
          isField
            ? 'h-11 justify-between rounded-lg border bg-surface px-3'
            : 'self-start rounded-full border border-line bg-surface px-3 py-2',
          isField && (invalid ? 'border-danger' : 'border-line'),
          disabled && 'opacity-50'
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'shrink',
            isField ? 'text-[0.9375rem]' : 'text-[0.875rem] font-semibold',
            selected ? 'text-ink' : 'text-subtle'
          )}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={isField ? 16 : 14} color={tc('#63665F', 'muted')} />
      </Pressable>
      <BottomSheet visible={visible} onClose={() => setVisible(false)} title={placeholder} hideClose>
        <View className="-mx-2 -my-2">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  onValueChange(option.value);
                  setVisible(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={cn('flex-row items-center justify-between rounded-xl px-3 py-3.5', active ? 'bg-tint' : 'active:bg-surface-2')}
              >
                <Text className={cn('text-[1rem]', active ? 'font-semibold text-brand-text' : 'text-ink')}>{option.label}</Text>
                {active ? <Check size={18} color={TC.brandText} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}
