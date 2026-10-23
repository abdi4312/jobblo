import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';

interface UrgentFilterProps {
  isUrgent: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Urgent job filter checkbox.
 * Allows users to filter for jobs marked as urgent/haste.
 */
export function UrgentFilter({ isUrgent, onChange }: UrgentFilterProps) {
  return (
    <Pressable
      onPress={() => onChange(!isUrgent)}
      className="flex-row items-center gap-3 border-b border-line py-3.5"
    >
      <View
        className={`flex size-5 items-center justify-center rounded-[0.3rem] border ${
          isUrgent
            ? 'border-brand-text bg-brand'
            : 'border-[#D4D6CD] bg-surface'
        }`}
      >
        {isUrgent && <Check size={12} color="white" strokeWidth={3} />}
      </View>
      <View className="flex-1">
        <Text className="text-[0.9375rem] font-medium text-ink">
          Kun haster
        </Text>
        <Text className="text-[0.8125rem] text-muted mt-0.5">
          Vis bare oppdrag markert som haster
        </Text>
      </View>
    </Pressable>
  );
}
