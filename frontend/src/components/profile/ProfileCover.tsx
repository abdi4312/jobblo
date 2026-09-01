/**
 * The band behind every profile.
 *
 * Three things were wrong with what it replaced. It tiled the *wordmark* — a base64 PNG of
 * "Jobblo." — forty times in a flex-wrap, so the band was a wall of the company's name
 * across a page that is supposed to be about a person. It landed differently at every
 * viewport width, because it was laid out by line-wrapping rather than drawn. And it was
 * the same on all of them: one grey-green rectangle, however many users there are.
 *
 * This draws instead, and the motif is the sprout from the logo — the mark on its own,
 * from `public/favicon.svg`, not the wordmark. Two notes on why it looks the way it does:
 *
 * The mark is two leaves rising from a point, and *floating* it reads as a bird. It is
 * drawn here with a stem running down out of the frame, which is what makes a scattered
 * field of them read as seedlings in a row rather than a flock. The stem is not in the
 * favicon; it is the one line added to it.
 *
 * And the sprigs sit in the top half. The identity card overlaps the foot of the band, so
 * the stems run down behind it — the card sits in the planting rather than on top of a
 * pattern that stops dead where it begins.
 *
 * Everything else — which of the four brand gradients, its angle, where the arc system is
 * centred, and each sprig's size, lean and opacity — comes from a hash of the user's id.
 * Same person, same cover, every time; two people, two covers. It is one inline SVG with
 * no images, so it costs nothing, scales to any band height, and can back a company banner
 * or a profile card just as well as this page.
 */

/** The sprout from the logo — leaves, inner leaf, stem shadow. From `public/favicon.svg`. */
const LEAF_PATHS = [
  'M0 0 C7.26153846 -0.49230769 7.26153846 -0.49230769 11 2 C11.66 2.66 12.32 3.32 13 4 C13.515625 3.34 14.03125 2.68 14.5625 2 C17.82641319 -0.67808262 19.88399525 -0.38111155 24 0 C24.66 0.33 25.32 0.66 26 1 C24.75023244 4.65316671 24.32901247 5.78065836 21 8 C18.66800612 8.07905064 16.33167378 8.08798769 14 8 C14 8.66 14 9.32 14 10 C13.01 10 12.02 10 11 10 C11 9.34 11 8.68 11 8 C9.7625 7.9175 8.525 7.835 7.25 7.75 C4.01117036 7.36524541 3.12092117 7.09975997 0.5 4.9375 C0.005 4.298125 -0.49 3.65875 -1 3 C-0.67 2.01 -0.34 1.02 0 0 Z',
  'M0 0 C7.38461538 -0.49230769 7.38461538 -0.49230769 10.5 2 C10.995 2.66 11.49 3.32 12 4 C11.67 4.66 11.34 5.32 11 6 C9.35 5.01 7.7 4.02 6 3 C7.22880216 4.2941742 7.22880216 4.2941742 10 6 C10 6.66 10 7.32 10 8 C3.6 7.50769231 3.6 7.50769231 0.5625 4.9375 C-0.2109375 3.9784375 -0.2109375 3.9784375 -1 3 C-0.67 2.01 -0.34 1.02 0 0 Z',
];

const LEAF_SHADOW =
  'M0 0 C2.75435594 0.4721753 4.93576879 0.96706092 7.4375 2.25 C10.13879522 3.33905601 10.13879522 3.33905601 13.125 1.625 C14.07375 1.08875 15.0225 0.5525 16 0 C16.99 0 17.98 0 19 0 C19 0.66 19 1.32 19 2 C17.865625 2.433125 16.73125 2.86625 15.5625 3.3125 C14.386875 3.869375 13.21125 4.42625 12 5 C11.67 5.99 11.34 6.98 11 8 C10.01 8 9.02 8 8 8 C7.79375 7.401875 7.5875 6.80375 7.375 6.1875 C5.49073918 3.18981233 3.18867916 2.38638224 0 1 C0 0.67 0 0.34 0 0 Z';

/** The added stem. Slightly off-straight, so a row of them does not read as a barcode. */
const STEM = 'M13.4 13.5 C 14.2 23 12.4 31 13.1 43';

/** Gradient pairs, all from `theme/brand.ts`. Nothing here is a new colour. */
const GRADIENTS: [string, string][] = [
  ['#2E6641', '#122A1C'],
  ['#347028', '#255335'],
  ['#122A1C', '#2E6641'],
  ['#255335', '#122A1C'],
];

const VIEW_W = 1200;
const VIEW_H = 260;
/** The symbol's box: 27 × 14 of leaves plus the stem running to 44. */
const SPRIG_RATIO = 44 / 27;
const SPRIG_COUNT = 7;

/** FNV-1a. Any two ids that differ at all differ here. */
const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32 — small, and identical across reloads for the same seed. */
const rng = (state: number) => () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface Sprig {
  x: number;
  y: number;
  width: number;
  rotate: number;
  opacity: number;
}

export function ProfileCover({ seed, className = '' }: { seed?: string; className?: string }) {
  // A signed-out or still-loading profile gets a valid cover rather than a blank band.
  const h = hash(seed || 'jobblo');
  const next = rng(h);

  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  const angle = 15 + Math.round(next() * 60);

  // The arc system and the glow share a centre, so the band has one light source.
  const cx = VIEW_W * (0.5 + next() * 0.42);
  const cy = VIEW_H * (0.02 + next() * 0.35);

  const arcs: { r: number; opacity: number; width: number }[] = [];
  const innerRadius = 140 + next() * 70;
  for (let i = 0; i < 5; i += 1) {
    arcs.push({
      r: innerRadius + i * (78 + next() * 46),
      opacity: 0.13 - i * 0.017,
      width: 1.3 + next() * 1.2,
    });
  }

  // Evenly spaced slots with only a little horizontal jitter: free scatter overlaps, and
  // two translucent sprigs on top of each other make a blot rather than two plants. One
  // slot per cover is a head taller than the rest, so the row has a subject.
  const feature = 1 + Math.floor(next() * (SPRIG_COUNT - 2));
  const sprigs: Sprig[] = [];
  for (let i = 0; i < SPRIG_COUNT; i += 1) {
    const width = i === feature ? 118 + next() * 30 : 46 + next() * 36;
    sprigs.push({
      width,
      x: VIEW_W * (0.055 + i * 0.137) + (next() - 0.5) * 34,
      y: VIEW_H * (0.03 + next() * 0.2),
      opacity: 0.09 + next() * 0.055,
      rotate: (next() - 0.5) * 30,
    });
  }

  const gradientId = `jb-cover-${h}`;
  const glowId = `jb-glow-${h}`;
  const sprigId = `jb-sprig-${h}`;

  return (
    <div className={`relative overflow-hidden bg-[#122A1C] ${className}`}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id={gradientId} gradientTransform={`rotate(${angle})`}>
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>

          <radialGradient id={glowId}>
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* The mark, once. Every sprig below is a <use> of this. */}
          <symbol id={sprigId} viewBox="0 0 27 44">
            <g fill="#FFFFFF">
              {LEAF_PATHS.map((d, i) => (
                <path key={i} d={d} transform="translate(1,4)" />
              ))}
              <path d={LEAF_SHADOW} transform="translate(4,6)" />
            </g>
            <path d={STEM} fill="none" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
          </symbol>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gradientId})`} />
        <ellipse
          cx={cx}
          cy={cy}
          rx={VIEW_W * 0.45}
          ry={VIEW_H * 0.9}
          fill={`url(#${glowId})`}
        />

        <g fill="none" stroke="#FFFFFF">
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={arc.r}
              strokeOpacity={arc.opacity}
              strokeWidth={arc.width}
            />
          ))}
        </g>

        {sprigs.map((sprig, i) => {
          const height = sprig.width * SPRIG_RATIO;
          return (
            <use
              key={i}
              href={`#${sprigId}`}
              x={sprig.x}
              y={sprig.y}
              width={sprig.width}
              height={height}
              opacity={sprig.opacity}
              // Pivot on the leaves rather than the middle of the box, so a leaning sprig
              // stays rooted where it was placed instead of swinging across the band.
              transform={`rotate(${sprig.rotate} ${sprig.x + sprig.width / 2} ${sprig.y + height / 3})`}
            />
          );
        })}
      </svg>

      {/* Scrim, so the identity card that overlaps the foot of the band always lands on a
          settled tone rather than on whichever sprig happened to fall there. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[#0B0B0B]/35 to-transparent"
      />
    </div>
  );
}

export default ProfileCover;
