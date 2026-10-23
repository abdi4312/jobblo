import React, { useRef } from 'react';
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { TC } from '../../theme/colors';

export interface PopoverAction {
  label: string;
  onPress: () => void;
}

export interface PopoverAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PopoverProps {
  visible: boolean;
  onClose: () => void;
  /** Where the trigger is on screen (measureInWindow); the popover opens below it. */
  anchor: PopoverAnchor | null;
  title?: string;
  actions: PopoverAction[];
}

const WIDTH = 260;
const ARROW_W = 36;
const ARROW_H = 12;
/** Soft iOS-style arrow: a rounded tip easing out into the panel edge on both sides. */
/**
 * iOS 26+: the panel and a small round tip are two glass shapes inside one GlassContainer,
 * which melts them into a single piece of Liquid Glass with a soft bump towards the trigger.
 */
const LIQUID_GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
const TIP = 22;
const ARROW_EDGE = 'M0 12 C 8 12, 12 10, 15 4 Q 18 -1.5, 21 4 C 24 10, 28 12, 36 12';

/**
 * iOS-style popover (like FINN's profile menu): opens under the trigger with a small arrow,
 * a centred title and full-width pill buttons. Liquid Glass on iOS 26+, a solid panel with an
 * SVG arrow elsewhere.
 * The chosen action runs after the popover has closed, so it can open a picker or a dialog.
 */
export function Popover({ visible, onClose, anchor, title, actions }: PopoverProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const centerX = anchor ? anchor.x + anchor.width / 2 : screenWidth / 2;
  const left = Math.min(Math.max(12, centerX - WIDTH / 2), screenWidth - WIDTH - 12);
  const top = anchor ? anchor.y + anchor.height + 12 : 120;
  const arrowLeft = Math.min(Math.max(22, centerX - left - ARROW_W / 2), WIDTH - ARROW_W - 22);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={runPending}>
      <Pressable className="flex-1 bg-black/10" onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk">
        <View style={{ position: 'absolute', top, left, width: WIDTH }} onStartShouldSetResponder={() => true}>
          {LIQUID_GLASS ? (
            <GlassContainer spacing={14} style={{ position: 'absolute', top: -ARROW_H, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
              <GlassView glassEffectStyle="regular" colorScheme="auto" style={{ position: 'absolute', top: ARROW_H, left: 0, right: 0, bottom: 0, borderRadius: 28 }} />
              <GlassView
                glassEffectStyle="regular"
                colorScheme="auto"
                style={{ position: 'absolute', top: 1, left: arrowLeft + ARROW_W / 2 - TIP / 2, width: TIP, height: TIP, borderRadius: TIP / 2 }}
              />
            </GlassContainer>
          ) : null}
          <View
            className={LIQUID_GLASS ? 'rounded-[28px]' : 'overflow-hidden rounded-[28px] border border-line bg-surface'}
            style={LIQUID_GLASS ? undefined : { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}
          >
            <View className="gap-2.5 px-4 pb-4 pt-3.5">
              {title ? <Text className="pb-1 text-center text-[1.0625rem] font-semibold text-ink">{title}</Text> : null}
              {actions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => {
                    pending.current = action.onPress;
                    onClose();
                    // Android has no Modal onDismiss.
                    if (Platform.OS !== 'ios') runPending();
                  }}
                  accessibilityRole="button"
                  className={`h-12 items-center justify-center rounded-full active:opacity-70 ${LIQUID_GLASS ? '' : 'bg-surface-2'}`}
                  // On glass, iOS's translucent fill instead of an opaque grey.
                  style={LIQUID_GLASS ? { backgroundColor: 'rgba(120,120,128,0.18)' } : undefined}
                >
                  <Text className="text-[1.0625rem] font-medium text-ink">{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {LIQUID_GLASS ? null : (
          <Svg
            width={ARROW_W}
            height={ARROW_H + 1}
            viewBox={`0 0 ${ARROW_W} ${ARROW_H + 1}`}
            style={{ position: 'absolute', top: -ARROW_H, left: arrowLeft }}
            pointerEvents="none"
          >
            {/* Fill covers the panel's border under the arrow; the stroke continues it over the tip. */}
            <Path d={`${ARROW_EDGE} L 36 13 L 0 13 Z`} fill={TC.surface} />
            <Path d={ARROW_EDGE} fill="none" stroke={TC.line} strokeWidth={1} />
          </Svg>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
