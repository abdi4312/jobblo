import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';

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
            ? 'h-11 justify-between rounded-lg border bg-white px-3'
            : 'self-start rounded-full border border-[#E6E7E1] bg-white px-3 py-2',
          isField && (invalid ? 'border-[#B4453A]' : 'border-[#E6E7E1]'),
          disabled && 'opacity-50'
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'shrink',
            isField ? 'text-[0.9375rem]' : 'text-[0.875rem] font-semibold',
            selected ? 'text-[#0B0B0B]' : 'text-[#9B9E96]'
          )}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={isField ? 16 : 14} color="#63665F" />
      </Pressable>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable className="flex-1 justify-end bg-black/25" onPress={() => setVisible(false)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-white p-5" onPress={(event) => event.stopPropagation()}>
            <Text className="mb-3 text-[1rem] font-semibold text-[#0B0B0B]">{placeholder}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onValueChange(option.value);
                    setVisible(false);
                  }}
                  className={cn(
                    'flex-row items-center justify-between border-b border-[#EFF0EA] px-2 py-3',
                    option.value === value ? 'bg-[#F4F6F0]' : 'bg-white'
                  )}
                >
                  <Text className="text-[0.9375rem] text-[#0B0B0B]">{option.label}</Text>
                  {option.value === value ? <Check size={16} color="#2E6641" /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
