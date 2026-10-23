import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';

/** One shared pulse, so every placeholder on screen breathes in step. */
const pulse = new Animated.Value(0.55);
let mounted = 0;
let loop: Animated.CompositeAnimation | null = null;

function usePulse() {
  useEffect(() => {
    mounted += 1;
    if (mounted === 1) {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (reduce || mounted === 0 || loop) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    }
    return () => {
      mounted -= 1;
      if (mounted === 0) {
        loop?.stop();
        loop = null;
        pulse.setValue(0.55);
      }
    };
  }, []);
}

/** shadcn-style Skeleton: a softly pulsing block. Size and shape come from `className`. */
export function Skeleton({ className, style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  usePulse();
  return (
    // The pulse lives on the wrapper; size/shape (className + style) on the inner block.
    <Animated.View style={{ opacity: pulse }}>
      <View className={cn('rounded-md bg-line', className)} style={style} />
    </Animated.View>
  );
}
