import {
  CARD_INTERACTIVE,
  CONTAINER,
  HEADING,
  MICRO_LABEL,
  SECTION,
  SUBHEADING,
} from '../../theme/brand';

const STEPS = [
  {
    id: '01',
    title: 'Opprett profil',
    description: 'Registrer deg gratis på under to minutter og kom i gang med en gang.',
  },
  {
    id: '02',
    title: 'Finn oppdrag',
    // Was "tusenvis av spennende jobber". Don't promise a volume nothing verifies.
    description: 'Søk blant oppdrag i nærområdet ditt, eller legg ut ditt eget.',
  },
  {
    id: '03',
    title: 'Søk og match',
    description: 'Send søknad og bli kontaktet av oppdragsgiver direkte i appen.',
  },
  {
    id: '04',
    title: 'Få betalt trygt',
    description: 'Betalingen frigis via SafePay så snart jobben er godkjent.',
  },
];

export function HowItWorks() {
  return (
    <section id="slik-fungerer-det" className={`${CONTAINER} ${SECTION} scroll-mt-20`}>
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className={MICRO_LABEL}>03 — Prosessen</p>
          <h2 className={`mt-4 ${HEADING}`}>
            Hvordan <span className="text-[#2E6641]">fungerer</span> det?
          </h2>
        </div>
        <p className={`max-w-[34ch] ${SUBHEADING}`}>
          Fire trinn fra du trenger hjelp til jobben er gjort og betalt.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ id, title, description }) => (
          <article
            key={id}
            className={`${CARD_INTERACTIVE} flex min-h-70 flex-col justify-between gap-7 p-7`}
          >
            {/* The number is the ornament — set in the mist green so it reads as a mark
                on the card rather than as a second heading competing with the title. */}
            <span
              aria-hidden="true"
              className="text-[clamp(2.5rem,5vw,3.75rem)] font-bold leading-none tracking-[-0.05em] text-[#EAF1E9]"
            >
              {id}
            </span>
            <div>
              <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                {title}
              </h3>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-[#63665F]">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
