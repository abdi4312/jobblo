import type { ReactNode } from 'react';
import { AppleMark, BankIdMark, StripeMark, VippsMark } from './paymentMarks';

/**
 * The strip under the hero: the payment and identity systems Jobblo runs on, moving.
 *
 * It used to carry four written claims. Norwegians do not read a promise of safety off a
 * marketing line — they read it off the marks they already bank with. Apple Pay, BankID,
 * Vipps and Stripe do the whole job in four logos, so the claims came out and the systems
 * went in.
 *
 * Each is the brand owner's own artwork in the brand owner's own colour (see
 * `paymentMarks.tsx`) — a redrawn or recoloured logo is worth less than no logo, because
 * the recognition is the entire point. What keeps four unrelated palettes from turning a
 * quiet strip into a carnival is everything around them: a white band, hairline rules, one
 * logo's worth of air between each, and nothing else on the line. No labels, no separator
 * glyphs, no tiles.
 *
 * Three details finish it. The band is masked to transparent at both ends, so a logo
 * dissolves instead of being sliced by the viewport edge. The loop is slow enough to read
 * rather than scan. And it stops under the cursor, so anyone who wants to look at a mark
 * can.
 *
 * The track holds the list twice so `jb-marquee` (see `styles/index.css`) can shift it
 * half its width and land on an identical frame. The duplicate is hidden from assistive
 * tech — it is the same four names a second time, not new content — and the whole thing
 * holds still for anyone who has asked for reduced motion.
 */

/** How many times the four systems repeat inside one track. */
// Four marks plus their gaps run about 700 px; a track has to be at least as wide as the
// viewport or the loop shows a bare stretch on a wide screen before it wraps.
const REPEATS = 3;

const SYSTEMS: { name: string; colour: string; mark: ReactNode }[] = [
  { name: 'Apple Pay', colour: '#000000', mark: <AppleMark /> },
  { name: 'BankID', colour: '#39134C', mark: <BankIdMark /> },
  { name: 'Vipps', colour: '#FF5B24', mark: <VippsMark /> },
  { name: 'Stripe', colour: '#635BFF', mark: <StripeMark /> },
];

function Track({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center gap-12 pr-12 sm:gap-18 sm:pr-18"
    >
      {Array.from({ length: REPEATS }).flatMap((_, pass) =>
        SYSTEMS.map((system) => (
          <span
            key={`${pass}-${system.name}`}
            title={system.name}
            // The marks are drawn in `currentColor`, so the brand colour is set once here
            // rather than baked into each path.
            style={{ color: system.colour }}
            className="flex shrink-0 items-center"
          >
            {system.mark}
          </span>
        ))
      )}
    </div>
  );
}

export function TrustBar() {
  return (
    <div
      role="group"
      aria-label="Betaling og innlogging: Apple Pay, BankID, Vipps, Stripe"
      className="overflow-hidden border-y border-[#E6E7E1] bg-white py-6"
    >
      <div
        // Fading the ends rather than cutting them is the whole difference between a
        // marquee that looks placed and one that looks clipped.
        className="mask-[linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]"
      >
        <div className="flex w-max animate-[jb-marquee_52s_linear_infinite] hover:paused motion-reduce:animate-none">
          <Track />
          <Track ariaHidden />
        </div>
      </div>
    </div>
  );
}
