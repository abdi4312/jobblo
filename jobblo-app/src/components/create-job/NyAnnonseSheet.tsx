import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Building2, ChevronRight, Home, type LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '../ui/BottomSheet';
import { TC, tc } from '../../theme/colors';

type CustomerType = 'private' | 'business';

const TYPES: { value: CustomerType; title: string; text: string; icon: LucideIcon }[] = [
  {
    value: 'private',
    title: 'Privat oppdrag',
    text: 'Hjelp hjemme – maling, flytting, rengjøring, hage og småjobber.',
    icon: Home,
  },
  {
    value: 'business',
    title: 'Bedriftsoppdrag',
    text: 'For firmaet ditt – oppdrag i kontor, butikk eller andre lokaler.',
    icon: Building2,
  },
];

interface NyAnnonseSheetProps {
  visible: boolean;
  /** Marked "Anbefalt" (from the account type). */
  suggested: CustomerType;
  onSelect: (type: CustomerType) => void;
  onClose: () => void;
}

/** FINN-style "Ny annonse": pick the kind of job with two large cards before the form. */
export function NyAnnonseSheet({ visible, suggested, onSelect, onClose }: NyAnnonseSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ny annonse" hideClose>
      <Text className="mb-4 text-[0.9375rem] leading-6 text-muted">Hva slags oppdrag vil du legge ut?</Text>
      <View className="gap-3">
        {TYPES.map(({ value, title, text, icon: Icon }) => (
          <Pressable
            key={value}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              onSelect(value);
            }}
            accessibilityRole="button"
            accessibilityLabel={title}
            className="flex-row items-center gap-4 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
          >
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-tint">
              <Icon size={26} color={TC.brandText} />
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[1.0625rem] font-semibold text-ink">{title}</Text>
                {value === suggested ? (
                  <View className="rounded-full bg-tint px-2 py-0.5">
                    <Text className="text-[0.75rem] font-semibold text-brand-text">Anbefalt</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-[0.875rem] leading-5 text-muted">{text}</Text>
            </View>
            <ChevronRight size={20} color={tc('#9B9E96', 'subtle')} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
