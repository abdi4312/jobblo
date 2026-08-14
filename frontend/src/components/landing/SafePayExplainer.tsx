import { CONTAINER, DISPLAY, MICRO_LABEL, SECTION } from '../../theme/brand';

/**
 * "Er pengene mine trygge?" — the escrow flow, spelled out.
 *
 * This is the question that decides whether a stranger hands money to another stranger,
 * and it is the one thing Jobblo does that a classifieds site does not — so it gets the
 * one inverted section on the page and the only headline sized like the hero's.
 *
 * Every claim here is the actual behaviour of the SafePay controllers.
 */
const STAGES = [
  {
    step: '01',
    tag: 'Betaling',
    title: 'Du betaler til SafePay',
    body: 'Beløpet reserveres hos vår betalingspartner. Tilbyderen ser at pengene er sikret, men får dem ikke ennå.',
  },
  {
    step: '02',
    tag: 'Utførelse',
    title: 'Jobben blir gjort',
    body: 'Dere avtaler i chatten. Tilbyderen markerer jobben som ferdig når den er utført.',
  },
  {
    step: '03',
    tag: 'Utbetaling',
    title: 'Du godkjenner — så utbetales det',
    body: 'Pengene frigis først når du har sagt deg fornøyd. Er noe galt, kan du åpne en tvist i stedet.',
  },
];

export function SafePayExplainer() {
  return (
    <section id="trygghet" className="bg-[#0B0B0B] text-[#EFF0EA] scroll-mt-20">
      <div className={`${CONTAINER} ${SECTION}`}>
        <p className={MICRO_LABEL}>02 — SafePay</p>
        <h2 className={`mt-6 max-w-[18ch] ${DISPLAY}`}>
          Er pengene mine <span className="text-[#8FBF9A]">trygge</span>? Ja.
        </h2>

        {/* One-pixel gaps let the shared border show through as hairlines between stages. */}
        <div className="mt-14 grid gap-px border border-[#EFF0EA]/16 bg-[#EFF0EA]/16 md:grid-cols-3">
          {STAGES.map(({ step, tag, title, body }) => (
            <div
              key={step}
              className="flex min-h-70 flex-col justify-between gap-8 bg-[#0B0B0B] p-8 sm:p-10"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-[0.6875rem] font-semibold tabular-nums tracking-[0.16em] text-[#8FBF9A]">
                  {step}
                </span>
                <span className={MICRO_LABEL}>{tag}</span>
              </div>
              <div>
                <h3 className="text-[1.375rem] font-semibold leading-snug tracking-[-0.03em] text-[#EFF0EA]">
                  {title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-[#9B9E96]">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-9 max-w-[60ch] text-[0.9375rem] leading-relaxed text-[#9B9E96]">
          Du betaler aldri direkte til en fremmed. Beløpet står hos SafePay til jobben er godkjent
          av deg — og begge parter kan åpne en tvist i stedet for å godkjenne.
        </p>
      </div>
    </section>
  );
}
