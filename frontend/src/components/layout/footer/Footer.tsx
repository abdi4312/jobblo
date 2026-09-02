import { NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import jobbloWordmark from '../../../assets/images/Login/jobblo-wordmark.png';
import { AppleMark, BankIdMark, StripeMark, VippsMark } from '../../landing/paymentMarks';
import { CONTAINER, MICRO_LABEL } from '../../../theme/brand';

/**
 * The site footer.
 *
 * It was a single row of five links with no heading, no brand and no surface of its own —
 * on a long page it read as leftover text rather than the end of the site, and nothing in
 * it told a first-time visitor what Jobblo is or that payment is held safely. It is a
 * proper sitemap now: the wordmark and the SafePay promise on the left, the destinations
 * grouped so a visitor can scan for the one they want, and the four payment systems from
 * the landing page's trust bar repeated at the foot, which is where a marketplace visitor
 * looks for them.
 *
 * Every link below points at a route that exists in `routing/Routes.tsx` — a footer is the
 * easiest place in a codebase to accumulate 404s, so this list is deliberately short.
 */

const CATEGORIES = ['Rengjøring', 'Hagearbeid', 'Flytting', 'Montering', 'Maling', 'Transport'];

const COLUMNS: { title: string; links: { name: string; to: string }[] }[] = [
  {
    title: 'Oppdrag',
    links: [
      { name: 'Finn oppdrag', to: '/search/job/all' },
      { name: 'Legg ut oppdrag', to: '/publish-job' },
      { name: 'Oppdragstakere', to: '/oppdragstakere' },
      { name: 'Priser', to: '/pricing' },
      { name: 'Medlemskap', to: '/membership' },
    ],
  },
  {
    title: 'Kategorier',
    links: CATEGORIES.map((name) => ({ name, to: `/search/job/${encodeURIComponent(name)}` })),
  },
  {
    title: 'Selskap',
    links: [
      { name: 'Om oss', to: '/about' },
      { name: 'Teamet', to: '/team' },
      { name: 'Kundesenter', to: '/support' },
      { name: 'Slett konto', to: '/delete-account' },
      { name: 'Kommer snart', to: '/upcoming' },
    ],
  },
  {
    title: 'Juridisk',
    links: [
      { name: 'Brukervilkår', to: '/user-term' },
      { name: 'Salgs- og abonnementsvilkår', to: '/sale-subscription-terms' },
      { name: 'Informasjonskapsler', to: '/cookies' },
    ],
  },
];

/**
 * The same four marks as the landing page's trust bar, in the same brand colours.
 * Each mark is `fill-current`, so the colour is set on the wrapper rather than baked in.
 */
const PAYMENT_MARKS = [
  { name: 'Apple Pay', colour: '#000000', mark: <AppleMark /> },
  { name: 'BankID', colour: '#39134C', mark: <BankIdMark /> },
  { name: 'Vipps', colour: '#FF5B24', mark: <VippsMark /> },
  { name: 'Stripe', colour: '#635BFF', mark: <StripeMark /> },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t border-[#E6E7E1] bg-[#F4F6F0]">
      <div className={CONTAINER}>
        {/* Brand + sitemap. The brand block keeps its own column on large screens so the
            four link lists stay evenly spaced instead of being squeezed by the tagline. */}
        <div className="grid gap-x-8 gap-y-12 py-14 lg:grid-cols-12 lg:py-18">
          <div className="lg:col-span-4 lg:pr-10">
            <NavLink
              to="/"
              aria-label="Jobblo — til forsiden"
              className="inline-block rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
            >
              <img
                src={jobbloWordmark}
                alt="Jobblo"
                width={340}
                height={128}
                className="h-8 w-auto"
              />
            </NavLink>

            <p className="mt-5 max-w-80 text-[0.9375rem] leading-relaxed text-[#63665F]">
              Norges lokale jobbplattform. Legg ut oppdraget, velg blant folk i nærheten, og
              betal først når jobben er gjort.
            </p>

            <span className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-3.5 text-[0.8125rem] font-medium text-[#0B0B0B]">
              <ShieldCheck size={15} strokeWidth={2.2} className="text-[#2E6641]" />
              Betalingen holdes trygt med SafePay
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className={MICRO_LABEL}>{column.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        className="rounded text-[0.875rem] leading-relaxed text-[#63665F]! transition-colors hover:text-[#0B0B0B]! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                      >
                        {link.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Foot of the foot. Column-reverse on phones puts the payment row above the
            copyright, so the last thing on the page is the last line of the page. */}
        <div className="flex flex-col-reverse gap-6 border-t border-[#E6E7E1] py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-[#9B9E96]">
            <p>© Jobblo AS {currentYear}</p>
            <span aria-hidden="true" className="hidden h-3.5 w-px bg-[#E6E7E1] sm:block" />
            <span className="flex items-center gap-1.5">
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em]">no</span>
              Norge — Norsk
            </span>
          </div>

          <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {PAYMENT_MARKS.map((system) => (
              <li
                key={system.name}
                title={system.name}
                style={{ color: system.colour }}
                className="flex items-center opacity-90 transition-opacity hover:opacity-100"
              >
                {system.mark}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
