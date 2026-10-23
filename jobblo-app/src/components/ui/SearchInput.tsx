import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { TC, tc } from '../../theme/colors';

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
    <View className="h-12 min-w-0 flex-1 flex-row items-center rounded-full border border-line bg-surface pl-4 pr-2">
      <Search size={17} color={tc('#9B9E96', 'subtle')} strokeWidth={2.2} />

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={TC.placeholder}
        className="ml-2 flex-1 text-[0.9375rem] text-ink"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {value && showClear ? (
        <Pressable
          onPress={() => onChange('')}
          className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-surface-2"
        >
          <X size={14} color={tc('#63665F', 'muted')} strokeWidth={2.5} />
        </Pressable>
      ) : null}

      {rightAction}
    </View>
  );
}
