import { colorScheme } from 'nativewind';
import { DARK, LIGHT } from './tokens';

/**
 * Theme colours for props that cannot take a className (icon `color`, `placeholderTextColor`,
 * ActivityIndicator, inline `style`). Same tokens and values as app/global.css.
 *
 * Each property is a getter that reads NativeWind's current scheme at render time:
 * `<Icon color={TC.ink} />`.
 *
 * ponytail: a getter does not subscribe, so an icon re-colours on its component's next
 * render after the system theme flips (className colours flip at once). Use NativeWind's
 * `useColorScheme()` in a screen if it must react instantly.
 */
// Values live in design-tokens/tokens.json (shared with the website).


/**
 * Exact light colour, themed dark colour: `tc('#63665F', 'muted')`. Used where the original
 * light shade differs slightly from the token, so light mode stays pixel-identical.
 */
export function tc(light: string, dark: keyof typeof LIGHT): string {
  return colorScheme.get() === 'dark' ? DARK[dark] : light;
}

export const TC = Object.defineProperties(
  {} as typeof LIGHT,
  Object.fromEntries(
    (Object.keys(LIGHT) as Array<keyof typeof LIGHT>).map((key) => [
      key,
      { enumerable: true, get: () => (colorScheme.get() === 'dark' ? DARK : LIGHT)[key] },
    ])
  )
);
