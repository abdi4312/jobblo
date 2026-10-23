import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { TC } from '../../theme/colors';

interface StepperProps {
  steps: string[];
  /** 1-based current step. */
  current: number;
  /** Called with a 1-based step; only steps already reached are tappable. */
  onStepPress?: (step: number) => void;
  /** Furthest step reached so far (defaults to `current`), so the user can jump forward again after going back. */
  maxReached?: number;
}

/** Numbered step indicator: done steps show a tick, the current one is filled. */
export function Stepper({ steps, current, onStepPress, maxReached = current }: StepperProps) {
  return (
    <View>
      <View className="mb-2.5 flex-row items-baseline justify-between">
        <Text className="text-[0.9375rem] font-semibold text-ink">{steps[current - 1]}</Text>
        <Text className="text-[0.8125rem] text-muted">
          Steg {current} av {steps.length}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        {steps.map((label, index) => {
          const number = index + 1;
          const done = number < current;
          const active = number === current;
          const reachable = number <= Math.max(current, maxReached) && !active && !!onStepPress;
          return (
            <Pressable
              key={label}
              disabled={!reachable}
              onPress={() => onStepPress?.(number)}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Steg ${number}: ${label}`}
              accessibilityState={{ selected: active, disabled: !reachable }}
              className="flex-1 gap-1.5 active:opacity-50"
            >
              <View className={cn('h-1 rounded-full', number <= current ? 'bg-brand' : 'bg-line')} />
              <View className="flex-row items-center gap-1">
                {done ? <Check size={11} color={TC.brandText} /> : null}
                <Text
                  numberOfLines={1}
                  className={cn(
                    'text-[0.8125rem]',
                    active ? 'font-semibold text-ink' : done || reachable ? 'text-brand-text' : 'text-subtle'
                  )}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
