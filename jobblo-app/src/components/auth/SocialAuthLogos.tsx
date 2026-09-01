import Svg, { Path } from 'react-native-svg';

/**
 * The Vipps and Google marks, ported from the website rather than approximated.
 *
 * Same path data, same viewBoxes, same colours as
 * frontend/src/components/SocialAuthButtons/AuthButton.tsx — one artwork, two renderers, so
 * the buttons cannot drift apart. The app previously drew the word "Vipps" in a bold system
 * font and a blue letter "G" in place of the Google mark, which is both off-brand and, for
 * Google, against their sign-in branding guidelines.
 *
 * react-native-svg needs explicit pixel dimensions where the web can say `h-[1.15rem]
 * w-auto`, so the heights below match the web rendering (18.4px → 18) and the widths are
 * derived from each viewBox's aspect ratio.
 */

/** Vipps wordmark: "V", the smile, "pp", "s". viewBox 22 21 121 28, as on the web. */
const VIPPS_WORDMARK_PATHS = [
  // "V"
  'M28 22l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 22z',
  // the smile
  'M57.3 40.6c3.7 0 5.8-1.8 7.8-4.4 1.1-1.4 2.5-1.7 3.5-.9 1 .8 1.1 2.3 0 3.7-2.9 3.8-6.6 6.1-11.3 6.1-5.1 0-9.6-2.8-12.7-7.7-.9-1.3-.7-2.7.3-3.4 1-.7 2.5-.4 3.4 1 2.2 3.3 5.2 5.6 9 5.6zm6.9-12.3c0 1.8-1.4 3-3 3s-3-1.2-3-3 1.4-3 3-3 3 1.3 3 3z',
  // "p"
  'M78.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8s-5.5 2.1-5.5 6.8z',
  // "p"
  'M104.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8-2.9 0-5.5 2.1-5.5 6.8z',
  // "s"
  'M132.3 21.4c4.5 0 7.7 2.1 9.1 7.3l-4.9.8c-.1-2.6-1.7-3.5-4.1-3.5-1.8 0-3.2.8-3.2 2.1 0 1 .7 2 2.8 2.4l3.7.7c3.6.7 5.6 3.1 5.6 6.3 0 4.8-4.3 7.2-8.4 7.2-4.3 0-9.1-2.2-9.8-7.6l4.9-.8c.3 2.8 2 3.8 4.8 3.8 2.1 0 3.5-.8 3.5-2.1 0-1.2-.7-2.1-3-2.5l-3.4-.6c-3.6-.7-5.8-3.2-5.8-6.4.1-5 4.6-7.1 8.2-7.1z',
];

/**
 * The wordmark is the brand name — it replaces the word "Vipps" in the label rather than
 * sitting next to it, so the button reads "Fortsett med [Vipps]" and not
 * "Fortsett med Vipps Vipps".
 */
export function VippsWordmark({ color = '#FFFFFF', height = 18 }: { color?: string; height?: number }) {
  // 121 × 28 viewBox, so the width follows from the height.
  const width = Math.round((height * 121) / 28);
  return (
    <Svg width={width} height={height} viewBox="22 21 121 28">
      {VIPPS_WORDMARK_PATHS.map((d) => (
        <Path key={d.slice(0, 12)} d={d} fill={color} />
      ))}
    </Svg>
  );
}

/** Google's four-colour "G". The fills are fixed by Google's branding guidelines. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z"
        fill="#EA4335"
      />
      <Path
        d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z"
        fill="#4285F4"
      />
      <Path
        d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z"
        fill="#FBBC05"
      />
      <Path
        d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z"
        fill="#34A853"
      />
    </Svg>
  );
}
