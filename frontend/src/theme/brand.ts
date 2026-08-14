/**
 * The one place the marketing and auth surfaces get their palette and shared class
 * strings from.
 *
 * Every colour here is taken from the logo — nothing invented:
 *
 *   #0B0B0B  the wordmark black
 *   #2E6641  the sprout stem
 *   #347028  the leaves
 *
 * Before this file the landing page carried six different greens (#2f7e47, #4ade80,
 * #16a34a, #166534, #1a3a1a, #f0faf0), three border alphas and five corner radii, none
 * of which matched the auth screens. Green now carries the actions and one highlighted
 * element per section; everything else is black, white and two greys. The only colour
 * from outside the logo is Vipps' orange, which is brand mandated on their button.
 */

// ── Colour ───────────────────────────────────────────────────────────────────
export const INK = '#0B0B0B';
export const INK_MUTED = '#63665F';
export const INK_FAINT = '#9B9E96';
export const GREEN = '#2E6641';
export const GREEN_DARK = '#255335';
export const LEAF = '#347028';
/** The stem green lifted for legibility on the ink-black SafePay section. */
export const GREEN_ON_INK = '#8FBF9A';
/** The stem green at 12 % — the tint behind icon plates and SafePay badges. */
export const GREEN_MIST = '#EAF1E9';
export const LINE = '#E6E7E1';
export const SURFACE = '#F5F6F1';
export const PANEL = '#F4F6F0';
export const PAGE = '#EFF0EA';

// ── Layout ───────────────────────────────────────────────────────────────────
/**
 * Page gutter and max width. Matched to the app header and footer (`max-w-300`) so a
 * landing section's edge lines up with the wordmark above it.
 */
export const CONTAINER = 'mx-auto w-full max-w-300 px-5 sm:px-8 lg:px-12';

/** Vertical rhythm between landing sections. */
export const SECTION = 'py-16 sm:py-24 lg:py-28';

// ── Type ─────────────────────────────────────────────────────────────────────
/** The hero and the one section headline allowed to fill its column. */
export const DISPLAY =
  'text-[clamp(2.5rem,6.4vw,5rem)] font-bold leading-[0.98] tracking-[-0.05em] text-balance';

export const HEADING =
  'text-[clamp(1.875rem,4.4vw,3.25rem)] font-bold leading-[1.03] tracking-[-0.045em] text-[#0B0B0B]';

export const SUBHEADING = 'text-[0.9375rem] leading-relaxed text-[#63665F]';

export const MICRO_LABEL =
  'text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#9B9E96]';

// ── Surfaces ─────────────────────────────────────────────────────────────────
/** The standard card. One radius, one border — used for every tile on the site. */
export const CARD = 'rounded-3xl border border-[#E6E7E1] bg-white';

export const CARD_INTERACTIVE = `${CARD} transition-colors duration-150 hover:border-[#2E6641]/45`;

// ── Controls ─────────────────────────────────────────────────────────────────
/** The single filled action in a given context. */
export const PRIMARY_BUTTON =
  'flex h-11.5 items-center justify-center gap-2 rounded-xl bg-[#2E6641] px-5 text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50';

export const SECONDARY_BUTTON =
  'flex h-11.5 items-center justify-center gap-2 rounded-xl border border-[#E6E7E1] bg-white px-5 text-[0.9375rem] font-semibold text-[#0B0B0B] transition duration-150 hover:border-[#D4D6CD] hover:bg-[#FAFBF7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.995]';

/**
 * The landing page's own control shape. The marketing surface runs on pills; the auth
 * screens and the app keep the 12 px radius of `PRIMARY_BUTTON` above, so the two are
 * separate tokens rather than one with an override.
 */
export const PILL_PRIMARY =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995]';

export const PILL_SECONDARY =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-6 text-[0.9375rem] font-medium text-[#0B0B0B] transition duration-150 hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.995]';

/** The small pill used for shortcuts and filters — same shape, one step down. */
export const CHIP =
  'inline-flex h-9 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.8125rem] font-medium text-[#63665F] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';

export const TEXT_LINK =
  'rounded font-semibold text-[#2E6641] underline-offset-[3px] transition-colors hover:text-[#347028] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25';

export const FIELD_ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-lg text-[#9B9E96] transition-colors hover:bg-[#EDEEE8] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25';

/** Small round icon plate that sits above a feature title. */
export const ICON_PLATE =
  'flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]';
