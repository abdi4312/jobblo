import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Symbol, Use } from 'react-native-svg';

/**
 * The band behind the profile, ported 1:1 from the website
 * (frontend/src/components/profile/ProfileCover.tsx): one of four brand gradients, a soft
 * glow with arcs, and seven sprouts from the logo, all seeded from the user's id, so the
 * same person gets the same cover on the web and in the app.
 */

const LEAF_PATHS = [
  'M0 0 C7.26153846 -0.49230769 7.26153846 -0.49230769 11 2 C11.66 2.66 12.32 3.32 13 4 C13.515625 3.34 14.03125 2.68 14.5625 2 C17.82641319 -0.67808262 19.88399525 -0.38111155 24 0 C24.66 0.33 25.32 0.66 26 1 C24.75023244 4.65316671 24.32901247 5.78065836 21 8 C18.66800612 8.07905064 16.33167378 8.08798769 14 8 C14 8.66 14 9.32 14 10 C13.01 10 12.02 10 11 10 C11 9.34 11 8.68 11 8 C9.7625 7.9175 8.525 7.835 7.25 7.75 C4.01117036 7.36524541 3.12092117 7.09975997 0.5 4.9375 C0.005 4.298125 -0.49 3.65875 -1 3 C-0.67 2.01 -0.34 1.02 0 0 Z',
  'M0 0 C7.38461538 -0.49230769 7.38461538 -0.49230769 10.5 2 C10.995 2.66 11.49 3.32 12 4 C11.67 4.66 11.34 5.32 11 6 C9.35 5.01 7.7 4.02 6 3 C7.22880216 4.2941742 7.22880216 4.2941742 10 6 C10 6.66 10 7.32 10 8 C3.6 7.50769231 3.6 7.50769231 0.5625 4.9375 C-0.2109375 3.9784375 -0.2109375 3.9784375 -1 3 C-0.67 2.01 -0.34 1.02 0 0 Z',
];
const LEAF_SHADOW =
  'M0 0 C2.75435594 0.4721753 4.93576879 0.96706092 7.4375 2.25 C10.13879522 3.33905601 10.13879522 3.33905601 13.125 1.625 C14.07375 1.08875 15.0225 0.5525 16 0 C16.99 0 17.98 0 19 0 C19 0.66 19 1.32 19 2 C17.865625 2.433125 16.73125 2.86625 15.5625 3.3125 C14.386875 3.869375 13.21125 4.42625 12 5 C11.67 5.99 11.34 6.98 11 8 C10.01 8 9.02 8 8 8 C7.79375 7.401875 7.5875 6.80375 7.375 6.1875 C5.49073918 3.18981233 3.18867916 2.38638224 0 1 C0 0.67 0 0.34 0 0 Z';
const STEM = 'M13.4 13.5 C 14.2 23 12.4 31 13.1 43';

const GRADIENTS: [string, string][] = [
  ['#2E6641', '#122A1C'],
  ['#347028', '#255335'],
  ['#122A1C', '#2E6641'],
  ['#255335', '#122A1C'],
];

const VIEW_W = 1200;
const VIEW_H = 260;
const SPRIG_RATIO = 44 / 27;
const SPRIG_COUNT = 7;

/** FNV-1a. */
const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: the same seed gives the same cover every time. */
const rng = (state: number) => () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function ProfileCover({ seed, height = 168 }: { seed?: string; height?: number }) {
  const h = hash(seed || 'jobblo');
  const next = rng(h);
  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  const angle = 15 + Math.round(next() * 60);
  const cx = VIEW_W * (0.5 + next() * 0.42);
  const cy = VIEW_H * (0.02 + next() * 0.35);

  const innerRadius = 140 + next() * 70;
  const arcs = Array.from({ length: 5 }, (_, i) => ({
    r: innerRadius + i * (78 + next() * 46),
    opacity: 0.13 - i * 0.017,
    width: 1.3 + next() * 1.2,
  }));

  const feature = 1 + Math.floor(next() * (SPRIG_COUNT - 2));
  const sprigs = Array.from({ length: SPRIG_COUNT }, (_, i) => {
    const width = i === feature ? 118 + next() * 30 : 46 + next() * 36;
    return {
      width,
      x: VIEW_W * (0.055 + i * 0.137) + (next() - 0.5) * 34,
      y: VIEW_H * (0.03 + next() * 0.2),
      opacity: 0.09 + next() * 0.055,
      rotate: (next() - 0.5) * 30,
    };
  });

  return (
    <View style={{ height, backgroundColor: '#122A1C', overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="cover" gradientTransform={`rotate(${angle})`}>
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </LinearGradient>
          <RadialGradient id="glow">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.13} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <Symbol id="sprig" viewBox="0 0 27 44">
            <G fill="#FFFFFF">
              {LEAF_PATHS.map((d, i) => (
                <Path key={i} d={d} transform="translate(1,4)" />
              ))}
              <Path d={LEAF_SHADOW} transform="translate(4,6)" />
            </G>
            <Path d={STEM} fill="none" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
          </Symbol>
        </Defs>

        <Rect width={VIEW_W} height={VIEW_H} fill="url(#cover)" />
        <Ellipse cx={cx} cy={cy} rx={VIEW_W * 0.45} ry={VIEW_H * 0.9} fill="url(#glow)" />
        <G fill="none" stroke="#FFFFFF">
          {arcs.map((arc, i) => (
            <Circle key={i} cx={cx} cy={cy} r={arc.r} strokeOpacity={arc.opacity} strokeWidth={arc.width} />
          ))}
        </G>
        {sprigs.map((sprig, i) => {
          const sprigHeight = sprig.width * SPRIG_RATIO;
          return (
            <Use
              key={i}
              href="#sprig"
              x={sprig.x}
              y={sprig.y}
              width={sprig.width}
              height={sprigHeight}
              opacity={sprig.opacity}
              transform={`rotate(${sprig.rotate} ${sprig.x + sprig.width / 2} ${sprig.y + sprigHeight / 3})`}
            />
          );
        })}
      </Svg>
      {/* Scrim under the card that overlaps the foot of the band. */}
      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-16 bg-black/20" />
    </View>
  );
}
