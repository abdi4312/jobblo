import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useCategories } from '../../features/categories/hooks';
import {
  CONTAINER,
  HEADING,
  MICRO_LABEL,
  PILL_SECONDARY,
  SECTION,
  SUBHEADING,
} from '../../theme/brand';

/**
 * The categories, as an index rather than a grid of tiles.
 *
 * A row gives a category name room to be read at a glance, which a 12-across tile grid
 * did not — and it keeps working however many categories the API returns. The heading
 * sticks while the list scrolls past it, so the question stays on screen with the answers.
 */
export function Categories() {
  const { data: categories = [], isLoading } = useCategories();
  const navigate = useNavigate();

  return (
    <section id="kategorier" className={`${CONTAINER} ${SECTION} scroll-mt-20`}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className={MICRO_LABEL}>01 — Kategorier</p>
          <h2 className={`mt-4 ${HEADING}`}>
            Hva trenger du <span className="text-[#2E6641]">hjelp</span> til?
          </h2>
          <p className={`mt-4 max-w-[34ch] ${SUBHEADING}`}>
            Velg en kategori, så viser vi oppdragene som ligger ute nå.
          </p>
          <button
            type="button"
            onClick={() => navigate('/search/job/all')}
            className={`mt-7 ${PILL_SECONDARY}`}
          >
            <Icons.LayoutGrid size={17} strokeWidth={1.9} className="text-[#2E6641]" />
            Se alle kategorier
          </button>
        </div>

        <ul className="border-t border-[#E6E7E1]">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="border-b border-[#E6E7E1] px-2 py-6.5">
                  <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[#E6E7E1]" />
                </li>
              ))
            : categories.map((cat, i) => {
                const LucideIcon =
                  (Icons as unknown as Record<string, Icons.LucideIcon>)[cat.icon] ||
                  Icons.HelpCircle;
                return (
                  <li key={cat._id} className="border-b border-[#E6E7E1]">
                    <button
                      type="button"
                      onClick={() => navigate(`/search/job/${encodeURIComponent(cat.name)}`)}
                      className="group flex w-full cursor-pointer items-center gap-6 rounded-lg px-2 py-6 text-left transition-colors hover:bg-[#F4F6F0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                    >
                      <span className={`w-9 shrink-0 tabular-nums ${MICRO_LABEL}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <LucideIcon
                        size={22}
                        strokeWidth={1.7}
                        className="shrink-0 text-[#2E6641]"
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-[clamp(1.25rem,2.6vw,1.875rem)] font-semibold leading-tight tracking-[-0.035em] text-[#0B0B0B]">
                        {cat.name}
                      </span>
                      <Icons.ArrowUpRight
                        size={20}
                        strokeWidth={1.6}
                        aria-hidden="true"
                        className="shrink-0 text-[#2E6641] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </button>
                  </li>
                );
              })}
        </ul>
      </div>
    </section>
  );
}
