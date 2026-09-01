/**
 * The spinner: a quarter-arc travelling around a faint ring.
 *
 * This was `InfinitySpin` from `react-loader-spinner` in #4fa94d — a lime-green figure
 * of eight that belonged to no part of the palette, rendered at whatever pixel size the
 * caller asked for (one skeleton asked for 200). It is now inline SVG on `currentColor`,
 * so it takes the colour of whatever it sits in and adds nothing to the bundle.
 *
 * `size` and `color` keep their old names and defaults so every existing call site is
 * unaffected, but `color` is only a fallback — set the text colour on a parent and the
 * spinner follows it.
 */
interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  /** Fallback colour when nothing upstream sets one. */
  color?: string;
  /** Announced to assistive tech; pass null for decorative use beside a text label. */
  label?: string | null;
  className?: string;
}

export const Spinner = ({
  size = 20,
  color = 'currentColor',
  label = 'Laster',
  className = '',
}: SpinnerProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    role={label ? 'status' : undefined}
    aria-label={label ?? undefined}
    aria-hidden={label ? undefined : true}
    style={{ color }}
    className={`animate-spin motion-reduce:animate-none ${className}`}
  >
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
    <path
      d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export default Spinner;
