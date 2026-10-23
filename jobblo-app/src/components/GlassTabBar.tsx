import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import type { Tabs } from 'expo-router';
import { TC } from '../theme/colors';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const BAR_HEIGHT = 64;
const VISIBLE_TABS = ['index', 'create-job', 'messages', 'alerts', 'profile'];

/**
 * iOS 26+: Apple's Liquid Glass (the App Store / FINN tab bar material).
 * Older iOS: frosted blur. Android: near-opaque white (no cheap native blur).
 * Both checks are needed: some iOS 26 betas lack the API and crash without the first.
 */
const LIQUID_GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

/** Height the floating bar covers at the bottom of the screen (bar + gap + home indicator). */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 12) + 8;
}

/**
 * Floating pill tab bar in Liquid Glass (FINN / iOS App Store style).
 * The active tab gets its own rounded highlight; badges come from each tab's icon.
 */
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((route) => VISIBLE_TABS.includes(route.name));
  const dark = useColorScheme().colorScheme === 'dark';

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) }}
    >
      {LIQUID_GLASS ? (
        // The glass itself is the background: no fill, border or shadow on top of it.
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          colorScheme="auto"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2 }}
        />
      ) : null}
      <View
        style={
          LIQUID_GLASS
            ? { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2 }
            : {
                height: BAR_HEIGHT,
                borderRadius: BAR_HEIGHT / 2,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 6 },
                elevation: 10,
                backgroundColor: dark
                  ? Platform.OS === 'ios' ? 'rgba(28,31,27,0.35)' : 'rgba(28,31,27,0.96)'
                  : Platform.OS === 'ios' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.96)',
              }
        }
      >
        {Platform.OS === 'ios' && !LIQUID_GLASS ? (
          <BlurView intensity={60} tint="systemChromeMaterial" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : null}
        <View className="flex-1 flex-row items-center px-1.5">
          {routes.map((route) => {
            const { options } = descriptors[route.key];
            const focused = state.routes[state.index]?.key === route.key;
            const color = focused ? TC.brandText : TC.ink2;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                className="h-[54px] flex-1 items-center justify-center rounded-full"
                style={focused ? { backgroundColor: LIQUID_GLASS ? 'rgba(120,120,128,0.16)' : 'rgba(46,102,65,0.13)' } : undefined}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: focused ? '600' : '500', marginTop: 3 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
