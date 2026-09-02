import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Apple, Landmark, CreditCard, ShieldCheck } from 'lucide-react-native';

const SYSTEMS = [
  { name: 'Apple Pay', color: '#000000', Icon: Apple },
  { name: 'BankID', color: '#39134C', Icon: Landmark },
  { name: 'Vipps', color: '#FF5B24', Icon: CreditCard },
  { name: 'Stripe', color: '#635BFF', Icon: ShieldCheck },
] as const;

const MARQUEE_ITEMS = [...SYSTEMS, ...SYSTEMS, ...SYSTEMS];

function Track() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 18 }}>
      {MARQUEE_ITEMS.map((system, index) => {
        const Icon = system.Icon;
        return (
          <View
            key={`${system.name}-${index}`}
            style={{ alignItems: 'center', justifyContent: 'center', minWidth: 94 }}
          >
            <Icon size={26} color={system.color} />
            <Text style={{ color: system.color, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
              {system.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function TrustBar() {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: -320,
          duration: 16000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E6E7E1',
        backgroundColor: '#FFFFFF',
        paddingVertical: 18,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Track />
          <Track />
        </View>
      </Animated.View>
    </View>
  );
}
