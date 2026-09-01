import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional left-hand action in the header, e.g. a "Tilbake" step control. */
  headerLeft?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Blocks the backdrop and the close button while a write is in flight. */
  dismissable?: boolean;
}

/**
 * Bottom sheet.
 *
 * `src/components/ui/Sheet.tsx` is the left-edge filter drawer and is the wrong shape for
 * a pick-one-of-your-lists flow, so this is its bottom-anchored sibling rather than a
 * variant of it — the two share no layout, only the token set.
 *
 * The body caps at 68% of the screen and scrolls, so a user with many saved lists still
 * reaches the footer, and the panel keeps clear of the home indicator via the safe-area
 * inset instead of a guessed padding value.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  headerLeft,
  children,
  footer,
  dismissable = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const handleClose = () => {
    if (dismissable) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="flex-1 bg-[#0B0B0B]/45"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Lukk"
        />

        <View
          className="max-h-[68%] rounded-t-[24px] border-t border-[#E6E7E1] bg-white"
          style={{ paddingBottom: insets.bottom }}
        >
          <View className="flex-row items-center justify-between border-b border-[#E6E7E1] px-5 py-4">
            <View className="min-w-[64px] items-start">{headerLeft}</View>

            <Text
              className="flex-1 text-center text-[1.0625rem] font-semibold text-[#0B0B0B]"
              numberOfLines={1}
            >
              {title}
            </Text>

            <View className="min-w-[64px] items-end">
              <Pressable
                onPress={handleClose}
                disabled={!dismissable}
                className="h-9 w-9 items-center justify-center rounded-full"
                accessibilityRole="button"
                accessibilityLabel="Lukk"
              >
                <X size={19} color={dismissable ? '#63665F' : '#C7C9C2'} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 18 }}
          >
            {children}
          </ScrollView>

          {footer ? <View className="border-t border-[#E6E7E1] px-5 py-4">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
