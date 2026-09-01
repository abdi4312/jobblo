import React, { useEffect } from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { X } from 'lucide-react-native';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (!visible) return;
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-[#0B0B0B]/45" onPress={onClose} />
      <View className="absolute inset-y-0 left-0 w-[86%] max-w-[360px] border-r border-[#E6E7E1] bg-white">
        <View className="h-16 flex-row items-center justify-between border-b border-[#E6E7E1] px-5">
          <Text className="text-[1.0625rem] font-semibold text-[#0B0B0B]">{title ?? 'Filtrer'}</Text>
          <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full">
            <X size={19} color="#63665F" />
          </Pressable>
        </View>

        <View className="flex-1 px-5 py-6">{children}</View>

        {footer ? <View className="border-t border-[#E6E7E1] p-4">{footer}</View> : null}
      </View>
    </Modal>
  );
}
