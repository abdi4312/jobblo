import React, { useRef } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { TC } from '../../theme/colors';

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Small heading above the items (shadcn DropdownMenuLabel). */
  label?: string;
  /** Items; a `null` entry draws a separator. */
  items: Array<DropdownMenuItem | null>;
  /** Distance from the top of the screen, below the trigger. Defaults to under a header. */
  top?: number;
}

/**
 * shadcn-style DropdownMenu: a small card under the trigger (top right), rounded border,
 * soft shadow, icon + label rows, a destructive red row, separators. Tapping outside closes it.
 */
export function DropdownMenu({ visible, onClose, label, items, top }: DropdownMenuProps) {
  const insets = useSafeAreaInsets();
  // iOS cannot present a new Modal (e.g. a confirm dialog) while this one is still
  // dismissing, so the chosen action runs once the menu is fully gone.
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={runPending}>
      <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk meny">
        <View
          className="absolute right-3 w-60 rounded-xl border border-line bg-surface p-1"
          style={{
            top: top ?? insets.top + 58,
            shadowColor: '#000',
            shadowOpacity: 0.14,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
          onStartShouldSetResponder={() => true}
        >
          {label ? (
            <Text className="px-2.5 pb-1.5 pt-2 text-[0.8125rem] font-semibold text-subtle" numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {items.map((item, index) =>
            item === null ? (
              <View key={`sep-${index}`} className="my-1 h-px bg-line" />
            ) : (
              <Pressable
                key={item.label}
                onPress={() => {
                  pending.current = item.onPress;
                  onClose();
                  // Android has no onDismiss for Modal.
                  if (Platform.OS !== 'ios') runPending();
                }}
                accessibilityRole="menuitem"
                className="flex-row items-center gap-2.5 rounded-lg px-2.5 py-2.5 active:bg-surface-2"
              >
                {item.icon ? <item.icon size={17} color={item.destructive ? TC.danger : TC.ink2} /> : null}
                <Text className={cn('text-[0.9375rem]', item.destructive ? 'font-medium text-danger' : 'text-ink')}>{item.label}</Text>
              </Pressable>
            )
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
