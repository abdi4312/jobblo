/**
 * The strip under the hero: the four things Jobblo guarantees, moving.
 *
 * The track holds the list twice so `jb-marquee` (see `styles/index.css`) can shift it
 * half its width and land on an identical frame. The duplicate is hidden from assistive
 * tech — it is the same four claims a second time, not new content — and the whole thing
 * holds still for anyone who has asked for reduced motion.
 */
const TRUST_ITEMS = [
  'Trygg betaling med SafePay',
  'Automatisk digital kontrakt',
  'Verifiserte anmeldelser',
  'Kom i gang på under 2 min',
];

function Track({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center gap-9 pr-9 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]"
    >
      {TRUST_ITEMS.map((text) => (
        <span key={text} className="flex items-center gap-9 whitespace-nowrap">
          {text}
          <span aria-hidden="true" className="text-[#2E6641]">
            ✳
          </span>
        </span>
      ))}
    </div>
  );
}

export function TrustBar() {
  return (
    <div className="overflow-hidden border-y border-[#E6E7E1] bg-[#F4F6F0] py-4">
      <div className="flex w-max animate-[jb-marquee_38s_linear_infinite] motion-reduce:animate-none">
        <Track />
        <Track ariaHidden />
      </div>
    </div>
  );
}
