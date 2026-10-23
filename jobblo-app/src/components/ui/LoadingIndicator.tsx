import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export type LoadingVariant = 'list' | 'detail' | 'form' | 'chat';

/**
 * Loading placeholder in the shape of the screen that is coming (no spinner):
 * - list:   header + rows (avatar, two lines)
 * - detail: header + large block + text + two cards
 * - form:   header + labelled fields + button
 * - chat:   message bubbles left and right
 * `message` is kept for screen readers.
 */
export function LoadingIndicator({ message = 'Laster...', variant = 'list', inline = false }: { message?: string; variant?: LoadingVariant; /** Inside a section: no page padding, no title placeholder, 3 rows. */ inline?: boolean }) {
  return (
    <View className={inline ? 'py-2' : 'flex-1 px-4 pt-6'} accessible accessibilityRole="progressbar" accessibilityLabel={message}>
      {variant === 'chat' || inline ? null : (
        <View className="mb-6 gap-2.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-3/5" />
        </View>
      )}

      {variant === 'list' ? (
        <View className="gap-3">
          {Array.from({ length: inline ? 3 : 6 }).map((_, i) => (
            <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <View style={{ flex: 1 }} className="gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {variant === 'detail' ? (
        <View className="gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <View className="gap-2.5 rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-8 w-2/5" />
          </View>
          <View className="gap-2.5 rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </View>
        </View>
      ) : null}

      {variant === 'form' ? (
        <View className="gap-5 rounded-2xl border border-line bg-surface p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="gap-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </View>
          ))}
          <Skeleton className="mt-1 h-11 w-full rounded-full" />
        </View>
      ) : null}

      {variant === 'chat' ? (
        <View className="gap-3">
          {[
            ['self-start', 'w-3/5', 'h-10'],
            ['self-end', 'w-1/2', 'h-10'],
            ['self-start', 'w-2/3', 'h-16'],
            ['self-end', 'w-2/5', 'h-10'],
            ['self-start', 'w-1/2', 'h-10'],
            ['self-end', 'w-3/5', 'h-14'],
          ].map(([align, width, height], i) => (
            <View key={i} className={`${align} ${width}`}>
              <Skeleton className={`${height} w-full rounded-2xl`} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
