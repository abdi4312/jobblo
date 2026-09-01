import { ShieldCheck } from 'lucide-react';
import { MICRO_LABEL } from '../../theme/brand';

/**
 * A staggered stack of oppdrag cards, closing on the SafePay escrow card.
 *
 * Shared by the auth showcase panel and the landing hero so the first two screens a new
 * customer sees use the same visual. Drawn entirely with DOM elements — no images — so
 * it paints with the first frame and costs nothing over the network.
 *
 * On the landing page the items are real listings and clicking one opens it. On the auth
 * screens they are illustrative examples: plain job descriptions with no company names,
 * ratings or response statistics, because inventing trust signals on the way in would be
 * the same mistake as the mocked "verified" badges on the applicants page.
 */
export type OppdragItem = {
  id: string;
  title: string;
  place: string;
  /** Pre-formatted, so the caller decides on thousands separators and currency. */
  price: string;
};

type OppdragStackProps = {
  label: string;
  items: OppdragItem[];
  /** The escrow card that closes the stack. Omit to end on the last listing. */
  highlight?: { title: string; price?: string };
  onSelect?: (id: string) => void;
  className?: string;
};

/** How far each card steps right, in rem. Reads as depth rather than as a list. */
const STEP = 1.25;

export default function OppdragStack({
  label,
  items,
  highlight,
  onSelect,
  className = '',
}: OppdragStackProps) {
  return (
    <div className={className}>
      <p className={`mb-3.5 ${MICRO_LABEL}`}>{label}</p>

      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const inner = (
            <>
              <div className="min-w-0 text-left">
                <p className="truncate text-[0.875rem] font-semibold text-[#0B0B0B]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-[#9B9E96]">{item.place}</p>
              </div>
              <p className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-[#63665F]">
                {item.price}
              </p>
            </>
          );

          const shared =
            'flex w-full items-center justify-between gap-4 rounded-xl border border-[#E6E7E1] bg-white px-4 py-3';

          return onSelect ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              style={{ marginLeft: `${i * STEP}rem` }}
              className={`${shared} cursor-pointer text-left transition-colors duration-150 hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
            >
              {inner}
            </button>
          ) : (
            <div key={item.id} style={{ marginLeft: `${i * STEP}rem` }} className={shared}>
              {inner}
            </div>
          );
        })}

        {highlight && (
          <div
            style={{ marginLeft: `${items.length * STEP}rem` }}
            className="flex items-center justify-between gap-4 rounded-xl bg-[#2E6641] px-4 py-3.5 shadow-[0_10px_26px_-12px_rgba(46,102,65,0.55)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/60">
                <ShieldCheck size={12} strokeWidth={2.5} />
                Trygg betaling
              </p>
              <p className="mt-1 truncate text-[0.875rem] font-semibold text-white">
                {highlight.title}
              </p>
            </div>
            {highlight.price && (
              <p className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-white">
                {highlight.price}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
