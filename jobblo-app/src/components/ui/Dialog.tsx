import React from 'react';
import { Modal, Pressable, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  onBackdropPress?: () => void;
  contentClassName?: string;
}

export function Dialog({
  visible,
  onClose,
  children,
  onBackdropPress,
  contentClassName,
}: DialogProps) {
  const handleBackdropPress = onBackdropPress ?? onClose;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[#0B0B0B]/60 px-4"
        onPress={handleBackdropPress}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
      >
        <Pressable onPress={() => undefined} className="w-full max-w-[420px]">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="w-full"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ justifyContent: 'center', paddingVertical: 24 }}
            >
              <View
                className={[
                  'w-full rounded-[20px] bg-white p-6 shadow-[0_18px_50px_rgba(11,11,11,0.20)]',
                  contentClassName,
                ].join(' ')}
              >
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
