import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
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
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <View className="rounded-full border border-[#E6E7E1] bg-white px-3 py-2">
        <Pressable className="flex-row items-center gap-2" onPress={() => setVisible(true)}>
        <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={14} color="#63665F" />
        </Pressable>
      </View>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable className="flex-1 justify-end bg-black/25" onPress={() => setVisible(false)}>
          <Pressable className="rounded-t-3xl bg-white p-5" onPress={(event) => event.stopPropagation()}>
            <Text className="mb-3 text-[1rem] font-semibold text-[#0B0B0B]">{placeholder}</Text>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onValueChange(option.value);
                  setVisible(false);
                }}
                className={[
                  'border-b border-[#E6E7E1] py-3',
                  option.value === value ? 'bg-[#F4F6F0]' : 'bg-white',
                ].join(' ')}
              >
                <Text className="text-[0.9375rem] text-[#0B0B0B]">{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
