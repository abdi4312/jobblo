import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { useCategories } from '../../features/categories/hooks';
import { getPublicStats } from '../../api/publicAPI';
import { CHIP, CONTAINER, DISPLAY, MICRO_LABEL, TEXT_LINK } from '../../theme/brand';
import { SERVICE_SHOWCASE } from '../../assets/images/categories';

/**
 * The hero: one sentence that finishes itself, and one field that runs the search.
 *
 * The rotating word in the headline is *display only* — it cycles the categories the
 * platform actually has so the line reads as an example of what people ask for, and it
 * is deliberately not a control. Category is chosen either from the shortcut pills below
 * the field or on the listing page itself; the field here contributes `?search=`, which
 * is what `ServiceListing` reads.
 *
 * There is no county picker for the same reason: the listing page filters location
 * through its own sidebar state and accepts no county in the URL, so a picker here would
 * look like it worked and quietly do nothing.
 *
 * The collage is a fixed showcase of the services Jobblo covers — `SERVICE_SHOWCASE` —
 * not a view of the database. It was the six newest open jobs, which meant it vanished
 * entirely on an empty database and showed whatever art the records happened to carry.
 * Now it is always there and always the same, each frame labelled with the service it
 * shows so picture and caption cannot disagree, and each one a link into that category's
 * listing. Real job photos still lead the job cards further down the page.
 */

/** Shown until the categories land, so the rotating line never starts empty. */
const FALLBACK_WORDS = ['maling', 'flytting', 'hagearbeid', 'rørlegger', 'rengjøring'];

/** The arch cycles the first four of the showcase; the plates hold the next two. */
const CAROUSEL = SERVICE_SHOWCASE.slice(0, 4);

/** The two still frames: which showcase entry each takes, and the shape it is cut to. */
const PLATES = [
  { at: 4, frame: 'left-0 top-24 size-47.5 rounded-full bg-[#EAF1E9]' },
  { at: 5, frame: 'bottom-24 left-9 h-45 w-62.5 rounded-3xl bg-white' },
].map(({ at, frame }) => ({ ...SERVICE_SHOWCASE[at], frame }));

const WORD_MS = 2400;
const SLIDE_MS = 4600;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const listingHref = (name: string) => `/search/job/${encodeURIComponent(name)}`;

export function HomeHero() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const [detail, setDetail] = useState('');
  const [word, setWord] = useState(0);
  const [slide, setSlide] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: getPublicStats,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  // The words in the headline are the categories the platform actually has, lowercased —
  // not an invented list that might name something nobody can be hired for.
  const words = categories.length
    ? categories.slice(0, 6).map((cat) => cat.name.toLowerCase())
    : FALLBACK_WORDS;

  // Both counters run unbounded and are read modulo their own list, so neither has to
  // know how long that list is — `words` in particular changes length as the API answers.
  const current = slide % CAROUSEL.length;

  // Both rotators, unless the visitor has asked for less motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const wordTimer = setInterval(() => setWord((i) => i + 1), WORD_MS);
    const slideTimer = setInterval(() => setSlide((i) => i + 1), SLIDE_MS);
    return () => {
      clearInterval(wordTimer);
      clearInterval(slideTimer);
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = detail.trim() ? `?search=${encodeURIComponent(detail.trim())}` : '';
    navigate(`/search/job/all${query}`);
  };

  return (
    <section className="relative overflow-hidden">
      {/* The one soft light on the page, behind the collage. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-55 size-180 rounded-full bg-[radial-gradient(circle,rgba(46,102,65,0.10),rgba(46,102,65,0)_68%)]"
      />

      <div className={`${CONTAINER} relative pt-6 pb-12 sm:pt-14 sm:pb-20 lg:pb-24`}>
        {/* ── Rail: who we are, and what is live right now ─────────────────── */}
        {/* Phones skip the rail entirely — on a 360 px screen it was two lines of
            uppercase micro-type standing between the visitor and the search box. */}
        <div className="mb-10 hidden flex-wrap items-baseline gap-x-4 gap-y-2 sm:mb-14 sm:flex">
          <span className={`${MICRO_LABEL} shrink-0`}>Norges lokale jobbplattform</span>
          <span aria-hidden="true" className="hidden h-px flex-1 bg-[#E6E7E1] sm:block" />
          {stats && (
            <span className={`${MICRO_LABEL} shrink-0`}>
              {stats.jobs} aktive oppdrag · {stats.users} brukere
            </span>
          )}
        </div>

        {/* `min-w-0` is load-bearing on both the grid and the column inside it. A grid
            item defaults to `min-width: auto`, which refuses to shrink below its content's
            intrinsic minimum — so the edge-bled scroller rows below widened the column
            past the viewport, `w-full` on the search pill resolved against that wider
            column, and the section's `overflow-hidden` sliced the result off. */}
        <div className="grid min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          {/* ── The sentence ──────────────────────────────────────────────── */}
          <div className="min-w-0">
            <form onSubmit={handleSubmit}>
              {/* The display headline is for desktop. On a phone it cost most of the
                  first screen before anything could be done, so it is carried as an
                  accessible heading only — the page still has an <h1> for screen
                  readers and search engines, it just is not painted. */}
              <h1 className={`sr-only lg:not-sr-only ${DISPLAY} lg:text-[#0B0B0B]`}>
                Jeg trenger hjelp til
                {/* The line clips its own overflow so each word rises into place from
                    below; the padding keeps that clip clear of the descenders. */}
                <span className="mt-2 block overflow-hidden pb-[0.12em] text-[#2E6641]">
                  {/* Re-keying on the index remounts the span, which restarts the CSS
                      animation — no timers or transition classes to keep in sync. */}
                  <span
                    key={word}
                    className="inline-block animate-[jb-word-in_0.5s_ease-out] motion-reduce:animate-none"
                  >
                    {words[word % words.length]}
                  </span>
                </span>
              </h1>

              <p className="mt-7 hidden max-w-[46ch] text-[1.0625rem] leading-relaxed text-[#63665F] lg:block">
                Beskriv oppdraget, få tilbud fra folk i nærheten, og betal først når jobben er
                godkjent.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/Publish-job')}
                  className={TEXT_LINK}
                >
                  Gratis å legge ut
                </button>{' '}
                —{' '}
                <button type="button" onClick={() => navigate('/pricing')} className={TEXT_LINK}>
                  3 % når jobben faktisk blir gjort
                </button>
                .
              </p>

              {/* One control, not two: the icon, the field and the action share a single
                  pill that lights up as a whole on focus, with the button seated inside
                  it. Every part shrinks on a phone — the pill loses 8 px of height and
                  padding, the icon drops out under 400 px, and the button keeps only its
                  arrow. `min-w-0` on the input is what actually lets it shrink; without
                  it the field holds its intrinsic size and pushes the button off the
                  edge, which is what was cutting the control off on a narrow screen. */}
              <div className="mt-7 flex h-13 w-full max-w-150 items-center rounded-full border border-[#E6E7E1] bg-white pl-4 pr-1.5 transition focus-within:border-[#2E6641]/35 focus-within:ring-4 focus-within:ring-[#2E6641]/12 sm:mt-8 sm:h-14 sm:pl-5">
                <Search
                  size={18}
                  strokeWidth={2.1}
                  aria-hidden="true"
                  className="hidden shrink-0 text-[#9B9E96] min-[400px]:block"
                />
                {/* Short enough to fit a 360 px screen whole. The long example that used
                    to live here was clipped mid-word on every phone; the category chips
                    below give the same steer without competing for the width. */}
                <input
                  type="text"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Hva gjelder det?"
                  aria-label="Beskriv oppdraget"
                  className="min-w-0 flex-1 bg-transparent px-1 text-[0.9375rem] text-[#0B0B0B] outline-none placeholder:text-[#9B9E96] min-[400px]:ml-2"
                />
                <button
                  type="submit"
                  aria-label="Finn hjelp"
                  className="ml-1.5 flex h-10.5 shrink-0 items-center gap-2 rounded-full bg-[#122A1C] px-4 text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.98] sm:ml-2 sm:h-11 sm:px-6"
                >
                  <span className="hidden sm:inline">Finn hjelp</span>
                  <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </form>

            {/* Shortcuts straight into the listing, one per real category. On a phone
                they scroll sideways rather than wrapping onto three stacked rows. */}
            {categories.length > 0 && (
              <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:mt-6 sm:flex-wrap sm:px-0">
                {categories.slice(0, 6).map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => navigate(listingHref(cat.name))}
                    className={`${CHIP} shrink-0`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* ── The showcase, phone edition ───────────────────────────────
                The collage is three absolutely-positioned frames 560 px tall — it
                cannot survive a 360 px screen. The same eight services become a
                swipeable row instead, bled to the screen edges so the next card
                peeks in and the gesture is discoverable. */}
            <div className="no-scrollbar -mx-5 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:hidden">
              {SERVICE_SHOWCASE.map((service) => (
                <button
                  key={service.name}
                  type="button"
                  onClick={() => navigate(listingHref(service.name))}
                  aria-label={`Se oppdrag i ${service.name}`}
                  className="relative h-44 w-36 shrink-0 snap-start overflow-hidden rounded-3xl border border-[#E6E7E1] bg-[#EAF1E9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
                >
                  <img
                    src={service.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#0B0B0B]/80 via-[#0B0B0B]/40 to-transparent px-3.5 pb-3 pt-8 text-left text-[0.8125rem] font-semibold text-white">
                    {service.name}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-6 flex items-center gap-1.5 text-[0.875rem] font-medium text-[#2E6641] sm:mt-7">
              <ShieldCheck size={15} strokeWidth={2.3} className="shrink-0" />
              Betaling holdes trygt til du har godkjent
            </p>
          </div>

          {/* ── The collage ───────────────────────────────────────────────── */}
          <div className="relative hidden h-140 lg:block">
            {/* The arch — the service currently on show. */}
            <button
              type="button"
              onClick={() => navigate(listingHref(CAROUSEL[current].name))}
              aria-label={`Se oppdrag i ${CAROUSEL[current].name}`}
              className="absolute right-0 top-0 block h-130 w-[min(420px,86%)] cursor-pointer overflow-hidden rounded-t-[220px] rounded-b-3xl border border-[#E6E7E1] bg-[#F4F6F0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
            >
              {CAROUSEL.map((service, i) => (
                <img
                  key={service.name}
                  src={service.src}
                  alt=""
                  // The first slide is the hero's own LCP candidate; the rest can wait.
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
                    i === current ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
            </button>

            {/* Two more services, held still so only the arch animates. They are links
                like the arch is — every frame in the collage goes somewhere. */}
            {PLATES.map((plate) => (
              <button
                key={plate.name}
                type="button"
                onClick={() => navigate(listingHref(plate.name))}
                aria-label={`Se oppdrag i ${plate.name}`}
                className={`absolute cursor-pointer overflow-hidden border border-[#E6E7E1] shadow-[0_22px_48px_rgba(11,11,11,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 ${plate.frame}`}
              >
                <img
                  src={plate.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            ))}

            {/* Caption and controls. The label is the service in the picture, so the two
                can never drift apart the way a job title over a stock photo could. */}
            <div className="absolute bottom-0 left-0 flex items-center gap-3.5 rounded-full border border-[#E6E7E1] bg-white py-3 pl-5 pr-3 shadow-[0_18px_40px_rgba(11,11,11,0.10)]">
              <span className="text-[0.8125rem] font-semibold text-[#0B0B0B]">
                {CAROUSEL[current].name}
              </span>
              <span className="text-[0.8125rem] text-[#9B9E96]">Se oppdrag</span>

              <span className="flex gap-1.5">
                {CAROUSEL.map((service, i) => (
                  <button
                    key={service.name}
                    type="button"
                    onClick={() => setSlide(i)}
                    aria-label={`Vis ${service.name}`}
                    aria-current={i === current}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === current ? 'w-5.5 bg-[#2E6641]' : 'w-2 bg-[#E6E7E1]'
                    }`}
                  />
                ))}
              </span>

              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setSlide((i) => i + CAROUSEL.length - 1)}
                  aria-label="Forrige tjeneste"
                  className="flex size-9 items-center justify-center rounded-full border border-[#E6E7E1] text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                >
                  <ChevronLeft size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => setSlide((i) => i + 1)}
                  aria-label="Neste tjeneste"
                  className="flex size-9 items-center justify-center rounded-full bg-[#2E6641] text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
                >
                  <ChevronRight size={16} strokeWidth={2.2} />
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
