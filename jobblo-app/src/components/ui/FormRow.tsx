import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface FormRowProps extends TextInputProps {
  label: string;
  /** Red line under the input. */
  error?: string;
  /** Shows "used / maxLength" next to the label. */
  showCount?: boolean;
  /** Draws a divider above the row; set on every row but the first inside a Card. */
  divider?: boolean;
}

/**
 * One field of a grouped form (iOS / Android settings style): small label on top, a
 * borderless input below, hairline dividers between rows. Put several inside a <Card>.
 */
export function FormRow({ label, error, showCount, divider = false, multiline, maxLength, value, ...input }: FormRowProps) {
  return (
    <View className={divider ? 'border-t border-[#EFF0EA] px-4 py-3' : 'px-4 py-3'}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[0.75rem] font-medium text-[#63665F]">{label}</Text>
        {showCount && maxLength ? (
          <Text className="text-[0.6875rem] tabular-nums text-[#9B9E96]">
            {(value ?? '').length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={label}
        placeholderTextColor="#B5B8B0"
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{ paddingVertical: 4, paddingHorizontal: 0, minHeight: multiline ? 96 : undefined }}
        className="mt-0.5 text-[1rem] text-[#0B0B0B]"
        {...input}
      />
      {error ? <Text className="mt-1 text-[0.75rem] text-[#B4544A]">{error}</Text> : null}
    </View>
  );
}
