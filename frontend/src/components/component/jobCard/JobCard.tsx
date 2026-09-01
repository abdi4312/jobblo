import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { Bookmark, MapPin, ShieldCheck, Zap } from 'lucide-react';
import type { Jobs } from '../../../types/Jobs.ts';
import { useUserStore } from '../../../stores/userStore.ts';
import AddToListModal from '../../Explore/jobs/AddToListModal';
import { useFavoriteLists } from '../../../features/favoriteLists/hooks';
import { useServiceActions } from '../../../features/services/hooks';
import { jobImage } from '../../../assets/images/categories';
import { ListingOwnerActions } from '../../listing/ListingOwnerActions';

/**
 * The job card — one implementation, used everywhere a job is listed.
 *
 * Before this there were three: this one, a second in `components/listing` that nothing
 * imported, and a third written inline on the home page. They disagreed on every value
 * that matters — six greens (#16a34a, #166534, #238CEB, custom-blue, custom-green,
 * #f0faf0), four radii, three grey ramps, and two different accent colours for the same
 * "Sponset" badge. The palette is now `theme/brand.ts` and nothing else, so a job looks
 * the same on the landing page, the home feed, search, a profile grid and a saved list.
 *
 * The card carries no surface of its own — no panel, no border, no padding. The photo is
 * the card, and the two lines under it sit directly on the page. Marketplace grids read
 * as one continuous wall of work that way instead of a field of floating boxes, and on a
 * phone it is what lets two columns fit without either one feeling cramped.
 *
 * Only the *presentation* was consolidated. Everything this card already did — saving to
 * a list, the owner's edit and delete actions, promoted/urgent/closed states — is intact.
 */
interface JobCardProps {
  job: Jobs;
  isOwner?: boolean;
  /** Feeds show a line of the brief; dense grids (profile, saved lists) leave it off. */
  showDescription?: boolean;
}

const BADGE =
  'inline-flex h-6.5 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-semibold';

/** Round action on the photo — same geometry for save, edit and delete. */
const PHOTO_ACTION =
  'flex size-8 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95';

export const JobCard = ({ job, isOwner, showDescription = false }: JobCardProps) => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const { data: lists = [], isLoading: listsLoading } = useFavoriteLists();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { deleteMutation } = useServiceActions();

  const open = () => navigate(`/job-listing/${job._id}`);

  // `userId` is typed as a string, but the list endpoints return it populated. Narrowing
  // on the shape covers both without reaching for `any`.
  const ownerId =
    typeof job.userId === 'string' ? job.userId : (job.userId as { _id?: string } | null)?._id;
  const isOwnJob = isOwner || (!!user?._id && ownerId === user._id);

  // Is the job in ANY of the user's lists
  const isInAnyList = lists.some((list: { services?: Array<{ _id?: string } | string> }) =>
    list.services?.some((s: { _id?: string } | string) =>
      typeof s === 'string' ? s === job._id : s._id === job._id
    )
  );

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) {
      navigate('/login');
      return;
    }
    setIsModalOpen(true);
  };

  const price =
    typeof job?.price === 'number' ? job.price.toLocaleString('nb-NO') : job?.price || '0';
  const place = job?.location?.city || job?.location?.address || 'Norge';
  const isClosed = job.status === 'closed';

  return (
    // The card holds its own buttons (save, edit, delete), so it cannot itself be a
    // <button> — nesting them is invalid and breaks keyboard order. It behaves like a
    // link instead, and answers Enter and Space the way one does.
    <article
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={job?.title || 'Uten tittel'}
      className="group flex cursor-pointer flex-col focus-visible:outline-none"
    >
      {/* One ratio at every breakpoint, so a row of cards has one baseline and the grid
          never goes ragged when a photo arrives in an unexpected shape. */}
      <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-[#EAF1E9] transition-[border-radius] duration-200 group-focus-visible:ring-4 group-focus-visible:ring-[#2E6641]/25">
        <img
          src={jobImage(job)}
          alt=""
          loading="lazy"
          decoding="async"
          className={`size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${
            isClosed ? 'opacity-55' : ''
          }`}
        />

        {/* Promoted / urgent, bottom left over the photo. Both use the brand's own greens
            rather than the amber and coral they used to, which appeared nowhere else. */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5">
          {job.promoted && (
            <span className={`${BADGE} bg-white/95 text-[#63665F] shadow-sm backdrop-blur-sm`}>
              <Zap size={11} strokeWidth={2.4} />
              Sponset
            </span>
          )}
          {job.urgent && (
            <span className={`${BADGE} bg-[#122A1C] text-white shadow-sm`}>
              <Zap size={11} strokeWidth={2.4} />
              Haster
            </span>
          )}
          {isClosed && (
            <span className={`${BADGE} bg-white/95 text-[#63665F] shadow-sm backdrop-blur-sm`}>
              Fullført
            </span>
          )}
        </div>

        {isOwnJob ? (
          /* One overflow menu, not a row of unlabelled icons — the same control and the
             same confirmation dialog the "Mine annonser" cards use, so managing a
             listing behaves identically wherever you meet it.

             It replaces a pencil and a bin that appeared only on hover (so a phone
             showed them permanently via `max-sm:opacity-100`, and a keyboard user
             reached them only through `group-focus-within`), were 32 px against a
             ~44 px target, and confirmed deletion with `window.confirm` — a browser
             dialog that carries none of the product's typography, cannot say which
             listing it is about, and does not match any other confirmation in Jobblo. */
          <div className="absolute right-2.5 top-2.5 z-10">
            <ListingOwnerActions
              serviceId={job._id}
              title={job?.title || 'Uten tittel'}
              onDelete={() => deleteMutation.mutateAsync(job._id)}
              isDeleting={deleteMutation.isPending}
              onPhoto
              // Full 44px where it is tapped; discreet where there is a pointer.
              className="size-11 sm:size-9"
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label={isInAnyList ? 'Endre lagring' : 'Lagre oppdraget'}
            onClick={handleFavClick}
            className={`${PHOTO_ACTION} absolute right-2.5 top-2.5 z-10 ${
              isInAnyList ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
            }`}
          >
            {listsLoading ? (
              <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-[#E6E7E1] border-t-[#2E6641]" />
            ) : (
              <Bookmark size={15} strokeWidth={2} className={isInAnyList ? 'fill-current' : ''} />
            )}
          </button>
        )}
      </div>

      <AddToListModal job={job} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <h3 className="mt-3 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-[-0.02em] text-[#0B0B0B]">
        {job?.title || 'Uten tittel'}
      </h3>

      {showDescription && job.description && (
        <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-[#63665F]">
          {job.description}
        </p>
      )}

      {/* Price · place · SafePay, on one line the way a marketplace listing reads. The
          separators are decorative, so they are hidden from screen readers. */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] leading-5 text-[#63665F]">
        <span className="font-semibold text-[#0B0B0B] tabular-nums">{price} kr</span>
        <span aria-hidden="true" className="text-[#9B9E96]">
          ·
        </span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin size={12} strokeWidth={2} className="shrink-0 text-[#9B9E96]" />
          <span className="truncate">{place}</span>
        </span>
        <span aria-hidden="true" className="text-[#9B9E96]">
          ·
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#2E6641]">
          <ShieldCheck size={12} strokeWidth={2.2} />
          SafePay
        </span>
      </p>
    </article>
  );
};
