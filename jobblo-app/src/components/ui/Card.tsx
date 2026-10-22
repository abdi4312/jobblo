import React from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

/** shadcn-style Card: a white rounded surface. Pass `className` to adjust spacing. */
export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('rounded-3xl border border-[#E6E7E1] bg-white', className)} {...props} />;
}

/** Small uppercase heading above a Card or a group of rows. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={cn('mb-2 px-1 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]', className)}>
      {children}
    </Text>
  );
}
