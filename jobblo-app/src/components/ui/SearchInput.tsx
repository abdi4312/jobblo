import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  showClear?: boolean;
  rightAction?: React.ReactNode;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Søk etter oppdrag',
  showClear = true,
  rightAction,
}: SearchInputProps) {
  return (
    <View className="h-12 min-w-0 flex-1 flex-row items-center rounded-full border border-[#E6E7E1] bg-white pl-4 pr-2">
      <Search size={17} color="#9B9E96" strokeWidth={2.2} />

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9B9E96"
        className="ml-2 flex-1 text-[0.9375rem] text-[#0B0B0B]"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {value && showClear ? (
        <Pressable
          onPress={() => onChange('')}
          className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-[#F4F6F0]"
        >
          <X size={14} color="#63665F" strokeWidth={2.5} />
        </Pressable>
      ) : null}

      {rightAction}
    </View>
  );
}
