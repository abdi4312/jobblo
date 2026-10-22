import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface StepperProps {
  steps: string[];
  /** 1-based current step. */
  current: number;
  /** Called with a 1-based step; only steps already reached are tappable. */
  onStepPress?: (step: number) => void;
}

/** Numbered step indicator: done steps show a tick, the current one is filled. */
export function Stepper({ steps, current, onStepPress }: StepperProps) {
  return (
    <View>
      <View className="mb-2.5 flex-row items-baseline justify-between">
        <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{steps[current - 1]}</Text>
        <Text className="text-[0.8125rem] text-[#63665F]">
          Steg {current} av {steps.length}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        {steps.map((label, index) => {
          const number = index + 1;
          const done = number < current;
          const active = number === current;
          return (
            <Pressable
              key={label}
              disabled={number > current || !onStepPress}
              onPress={() => onStepPress?.(number)}
              accessibilityRole="button"
              accessibilityLabel={`Steg ${number}: ${label}`}
              accessibilityState={{ selected: active, disabled: number > current }}
              className="flex-1 gap-1.5"
            >
              <View className={cn('h-1 rounded-full', number <= current ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]')} />
              <View className="flex-row items-center gap-1">
                {done ? <Check size={11} color="#2E6641" /> : null}
                <Text
                  numberOfLines={1}
                  className={cn(
                    'text-[0.6875rem]',
                    active ? 'font-semibold text-[#0B0B0B]' : done ? 'text-[#2E6641]' : 'text-[#9B9E96]'
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
