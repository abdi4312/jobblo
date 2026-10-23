import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { TC } from '../../theme/colors';

interface FieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  /** Grey text under the input; replaced by `error` when that is set. */
  hint?: string;
  error?: string;
  /** Small grey tag next to the label, e.g. "Min. 20 tegn". */
  badge?: string;
  /** Shows "length/max" next to the label (uses `maxLength`). */
  showCount?: boolean;
  /** Text inside the input on the left / right, e.g. "kr", "+47", "per time". */
  prefix?: string;
  suffix?: string;
  className?: string;
}

/** shadcn-style Label + Input: 8px radius, optional prefix/suffix, counter, hint and error. */
export function Field({
  label,
  required = false,
  hint,
  error,
  badge,
  showCount = false,
  prefix,
  suffix,
  multiline,
  maxLength,
  value,
  className,
  ...input
}: FieldProps) {
  return (
    <View className={cn('gap-1.5', className)}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[0.8125rem] font-semibold text-ink">
          {label}
          {required ? <Text className="text-danger"> *</Text> : null}
        </Text>
        <View className="flex-row items-center gap-2">
          {badge ? (
            <View className="rounded bg-surface-2 px-1.5 py-0.5">
              <Text className="text-[0.8125rem] font-medium text-muted">{badge}</Text>
            </View>
          ) : null}
          {showCount && maxLength ? (
            <Text className="text-[0.8125rem] tabular-nums text-subtle">
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        className={cn(
          'flex-row rounded-lg border bg-surface px-3',
          multiline ? 'items-start py-2' : 'h-11 items-center',
          error ? 'border-danger' : 'border-line'
        )}
      >
        {prefix ? <Text className="mr-2 text-[0.9375rem] text-muted">{prefix}</Text> : null}
        <TextInput
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={TC.placeholder}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label}
          style={{ paddingVertical: multiline ? 4 : 0, minHeight: multiline ? 110 : undefined }}
          className="flex-1 text-[0.9375rem] text-ink"
          {...input}
        />
        {suffix ? <Text className="ml-2 text-[0.8125rem] text-muted">{suffix}</Text> : null}
      </View>
      {error ? (
        <Text className="text-[0.8125rem] font-medium text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-[0.8125rem] leading-4 text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
