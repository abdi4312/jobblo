import OppdragStack, { type OppdragItem } from '../shared/OppdragStack';

/**
 * The showcase panel on the auth screens.
 *
 * Uses the same oppdrag stack as the landing hero, so signing up does not look like a
 * different product from the page you arrived on. Drawn entirely with DOM elements — the
 * auth pages used to download ~640 KB of PNG phone mockups before showing anything.
 *
 * These listings are illustrative. They deliberately carry no company names, star ratings
 * or response statistics — inventing trust signals on the way in would be the same
 * mistake as the mocked "verified" badges on the applicants page.
 */
const EXAMPLES: OppdragItem[] = [
  { id: 'a', title: 'Flyttehjelp', place: 'Trondheim', price: '2 400 kr' },
  { id: 'b', title: 'Male stue, 24 m²', place: 'Bergen', price: '3 100 kr' },
  { id: 'c', title: 'Montere kjøkken', place: 'Oslo', price: '4 800 kr' },
];

export default function AuthShowcase() {
  return (
    <div className="max-w-104">
      <h2 className="text-[2.25rem] font-bold leading-[1.12] tracking-[-0.035em] text-[#0B0B0B] xl:text-[2.5rem]">
        Ett oppdrag ut.
        <span className="block text-[#2E6641]">Flere tilbud inn.</span>
      </h2>

      <p className="mt-5 max-w-88 text-[0.9375rem] leading-relaxed text-[#63665F]">
        Beskriv jobben, så svarer folk i nærheten med pris. Pengene holdes trygt til du har
        godkjent resultatet.
      </p>

      <OppdragStack
        className="mt-11"
        label="Oppdrag i nærheten"
        items={EXAMPLES}
        highlight={{ title: 'Frigis når du har godkjent', price: '2 850 kr' }}
      />
    </div>
  );
}
