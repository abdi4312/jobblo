import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function Select({ value, options, onValueChange, placeholder = 'Sorter' }: SelectProps) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <View className="rounded-full border border-[#E6E7E1] bg-white px-3 py-2">
      <Pressable className="flex-row items-center gap-2" onPress={() => {}}>
        <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={14} color="#63665F" />
      </Pressable>
    </View>
  );
}
