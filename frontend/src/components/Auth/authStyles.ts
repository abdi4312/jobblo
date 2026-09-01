/**
 * The auth screens share their palette and controls with the marketing pages, so the
 * tokens live in one place. This module only re-exports what the auth components use —
 * keeping the imports short without letting the two surfaces drift apart.
 *
 * @see src/theme/brand.ts
 */
export {
  INK,
  GREEN,
  LEAF,
  MICRO_LABEL,
  PRIMARY_BUTTON as PRIMARY_BUTTON_BASE,
  TEXT_LINK,
  FIELD_ICON_BUTTON,
} from '../../theme/brand';

/**
 * Auth buttons are full width — the marketing ones size to their label — so the shared
 * base gets `w-full` here rather than every form repeating it.
 */
export const PRIMARY_BUTTON =
  'flex h-11.5 w-full items-center justify-center gap-2 rounded-xl bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50';
