import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { tc } from '../../theme/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional left-hand action in the header, e.g. a "Tilbake" step control. */
  headerLeft?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Blocks the backdrop, the close button and the drag while a write is in flight. */
  dismissable?: boolean;
  /** Hides the X; the grabber and the backdrop still close it (pickers). */
  hideClose?: boolean;
}

/**
 * Bottom sheet in the iOS style: the backdrop fades while the panel springs up from the
 * bottom, with a grabber you can drag down to close.
 *
 * `src/components/ui/Sheet.tsx` is the left-edge filter drawer and is the wrong shape for
 * a pick-one flow, so this is its bottom-anchored sibling. The body caps at 68% of the
 * screen and scrolls, and the panel keeps clear of the home indicator via the safe-area inset.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  headerLeft,
  children,
  footer,
  dismissable = true,
  hideClose = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(height);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
  }, [visible, height, translateY]);

  const handleClose = () => {
    if (dismissable) onClose();
  };

  // Drag the grabber/header down to close, like a native sheet.
  const drag = Gesture.Pan()
    .runOnJS(true)
    .enabled(dismissable)
    .activeOffsetY(8)
    .onUpdate((event) => translateY.setValue(Math.max(0, event.translationY)))
    .onEnd((event) => {
      if (event.translationY > 110 || event.velocityY > 900) {
        Animated.timing(translateY, { toValue: height, duration: 180, useNativeDriver: true }).start(() => onClose());
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
      }
    });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-[#0B0B0B]/45"
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          />

          <Animated.View style={{ maxHeight: '68%', transform: [{ translateY }] }}>
            <View className="rounded-t-[24px] border-t border-line bg-surface" style={{ paddingBottom: insets.bottom, flexShrink: 1 }}>
            <GestureDetector gesture={drag}>
              <View>
                <View className="items-center pt-2">
                  <View className="h-1.5 w-10 rounded-full bg-line-strong" />
                </View>
                <View className="flex-row items-center justify-between border-b border-line px-5 pb-3 pt-2">
                  <View className="min-w-[64px] items-start">{headerLeft}</View>

                  <Text className="flex-1 text-center text-[1.0625rem] font-semibold text-ink" numberOfLines={1}>
                    {title}
                  </Text>

                  <View className="min-w-[64px] items-end">
                    {hideClose ? null : (
                      <Pressable
                        onPress={handleClose}
                        disabled={!dismissable}
                        className="h-9 w-9 items-center justify-center rounded-full"
                        accessibilityRole="button"
                        accessibilityLabel="Lukk"
                      >
                        <X size={19} color={dismissable ? tc('#63665F', 'muted') : '#C7C9C2'} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </GestureDetector>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 18 }}
            >
              {children}
            </ScrollView>

            {footer ? <View className="border-t border-line px-5 py-4">{footer}</View> : null}
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
