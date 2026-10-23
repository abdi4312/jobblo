import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { TC, tc } from '../../theme/colors';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Shown in a tinted tile beside the title. */
  icon?: LucideIcon;
  /** Text of the back link; null hides it. */
  backLabel?: string | null;
  /** Defaults to router.back(). */
  onBack?: () => void;
  /** Red icon tile, for destructive screens such as deleting the account. */
  destructive?: boolean;
  className?: string;
}

/** The one header every sub-screen uses: "← Innstillinger", then icon + title + subtitle. */
export function ScreenHeader({
  title,
  subtitle,
  icon: Icon,
  backLabel = 'Innstillinger',
  onBack,
  destructive = false,
  className,
}: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View className={cn('mb-5', className)}>
      {backLabel !== null ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Tilbake til ${backLabel}`}
          className="mb-4 flex-row items-center self-start rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3.5 active:opacity-80"
        >
          <ArrowLeft size={16} color={TC.ink2} />
          <Text className="ml-1.5 text-[0.8125rem] font-medium text-ink-2">{backLabel}</Text>
        </Pressable>
      ) : null}
      <View className="flex-row items-center gap-3">
        {Icon ? (
          <View className={cn('h-11 w-11 items-center justify-center rounded-2xl', destructive ? 'bg-danger-tint' : 'bg-tint')}>
            <Icon size={20} color={destructive ? tc('#B4544A', 'danger') : TC.brandText} />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="text-[1.5rem] font-bold tracking-[-0.02em] text-ink">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-[0.875rem] leading-5 text-muted">{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}
