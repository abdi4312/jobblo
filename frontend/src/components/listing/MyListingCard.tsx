import { MapPin, Users, Zap } from 'lucide-react';
import { jobImage } from '../../assets/images/categories';
import type { Service } from '../../features/services/types';
import { ListingStatusBadge } from './ListingStatusBadge';
import { ListingOwnerActions } from './ListingOwnerActions';

/**
 * One of the owner's own listings, on the "Mine annonser" page.
 *
 * This is a management card, not the discovery card in `component/jobCard/JobCard.tsx`,
 * and the difference is deliberate: it carries a status and a row of actions, so it gets
 * a surface (`CARD` from `theme/brand.ts` — the same `rounded-3xl border-[#E6E7E1]
 * bg-white` used for every panel on the site) to group them with the listing they act
 * on. The discovery card has no surface because a grid of them should read as a wall of
 * work; a grid of these should read as a list of things you own and can change.
 *
 * Everything else is the discovery card's language, unchanged: the same photo fallback,
 * the same badge geometry, the same `price · place` line, the same greens.
 *
 * What it replaces, on the same page:
 *   - a pencil in a translucent grey pill floating over the photo, 36 px, unlabelled,
 *     sitting on top of the picture it obscured;
 *   - a red circular bin, 32 px, next to the price — a destructive control a thumb's
 *     width from the number people scan for;
 *   - no status anywhere on the card at all. The only way to know what state a listing
 *     was in was to notice which filter you had selected.
 */

interface MyListingCardProps {
  service: Service;
  onOpen: () => void;
  onDelete: () => void | Promise<void>;
  isDeleting?: boolean;
}

export const MyListingCard = ({ service, onOpen, onDelete, isDeleting }: MyListingCardProps) => {
  const price =
    typeof service.price === 'number'
      ? service.price.toLocaleString('nb-NO')
      : service.price || '0';
  const place = service.location?.city || service.location?.address || 'Ikke angitt';
  const applicants = service.maxApplicants;

  return (
    // Holds its own buttons, so it cannot be a <button>. Behaves as a link and answers
    // Enter and Space, matching JobCard.
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={service.title || 'Uten tittel'}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white transition-colors duration-150 hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
    >
      {/* 16:10 rather than the feed's 4:5. A management list is scanned top to bottom,
          and a portrait photo per row makes the page twice as long for no extra
          information. */}
      <div className="relative aspect-16/10 overflow-hidden bg-[#EAF1E9]">
        <img
          src={jobImage(service)}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />

        {service.urgent && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex h-6.5 items-center gap-1 rounded-full bg-[#122A1C] px-2.5 text-[0.6875rem] font-semibold text-white shadow-sm">
            <Zap size={11} strokeWidth={2.4} />
            Haster
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-[-0.02em] text-[#0B0B0B]">
          {service.title || 'Uten tittel'}
        </h3>

        {/* price · place, the way a listing reads everywhere else in the product. The
            separator is decorative, so it is hidden from screen readers. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] leading-5 text-[#63665F]">
          <span className="font-semibold tabular-nums text-[#0B0B0B]">{price} kr</span>
          <span aria-hidden="true" className="text-[#9B9E96]">
            ·
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin size={12} strokeWidth={2} className="shrink-0 text-[#9B9E96]" />
            <span className="truncate">{place}</span>
          </span>
          {typeof applicants === 'number' && applicants > 0 && (
            <>
              <span aria-hidden="true" className="text-[#9B9E96]">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} strokeWidth={2} className="shrink-0 text-[#9B9E96]" />
                {applicants}
              </span>
            </>
          )}
        </p>

        <div className="mt-3">
          <ListingStatusBadge status={service.status} />
        </div>

        {/* Actions pinned to the bottom, so every card in a row lines them up even when
            the titles wrap to different heights. */}
        <div className="mt-4 flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-semibold text-[#0B0B0B] transition duration-150 hover:border-[#D4D6CD] hover:bg-[#FAFBF7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.995] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Se annonse
          </button>

          <ListingOwnerActions
            serviceId={service._id}
            title={service.title || 'Uten tittel'}
            capabilities={service.capabilities}
            onDelete={onDelete}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </article>
  );
};

export default MyListingCard;
