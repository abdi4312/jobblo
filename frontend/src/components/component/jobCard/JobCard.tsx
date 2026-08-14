import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { Bookmark, CheckCircle2, MapPin, Pencil, ShieldCheck, Trash2, Zap } from 'lucide-react';
import type { Jobs } from '../../../types/Jobs.ts';
import { useUserStore } from '../../../stores/userStore.ts';
import AddToListModal from '../../Explore/jobs/AddToListModal';
import { useFavoriteLists } from '../../../features/favoriteLists/hooks';
import { useServiceActions } from '../../../features/services/hooks';
import { jobImage } from '../../../assets/images/categories';
import { dateFormatter } from '../../../utils/dateFormatter';
import { CARD_INTERACTIVE } from '../../../theme/brand';

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
 * Only the *presentation* was consolidated. Everything this card already did — saving to
 * a list, the owner's edit and delete actions, promoted/urgent/closed states — is intact.
 */
interface JobCardProps {
  job: Jobs;
  isOwner?: boolean;
  /** Feeds show a line of the brief; dense grids (profile, saved lists) leave it off. */
  showDescription?: boolean;
}

const BADGE = 'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-semibold';

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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/Publish-job/${job._id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Er du sikker på at du vil slette denne annonsen?')) {
      deleteMutation.mutate(job._id);
    }
  };

  const price =
    typeof job?.price === 'number' ? job.price.toLocaleString('nb-NO') : job?.price || '0';

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
      className={`${CARD_INTERACTIVE} group flex cursor-pointer flex-col gap-4 p-4 pb-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
    >
      <div className="relative h-45 overflow-hidden rounded-2xl bg-[#EAF1E9]">
        <img
          src={jobImage(job)}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />

        {/* Promoted / urgent, top left. Both use the brand's own greens rather than the
            amber and coral they used to, which appeared nowhere else. */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
          {job.promoted && (
            <span className={`${BADGE} bg-white/95 text-[#63665F] shadow-sm backdrop-blur-sm`}>
              <Zap size={12} strokeWidth={2.4} />
              Sponset
            </span>
          )}
          {job.urgent && (
            <span className={`${BADGE} bg-[#122A1C] text-white shadow-sm`}>
              <Zap size={12} strokeWidth={2.4} />
              Haster
            </span>
          )}
        </div>

        {/* Owner actions on hover — also shown on keyboard focus, which the
            opacity-only version hid from anyone not using a mouse. */}
        {isOwnJob ? (
          <div className="absolute bottom-3 right-3 z-10 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              title="Rediger"
              aria-label="Rediger annonsen"
              onClick={handleEditClick}
              className="flex size-9 items-center justify-center rounded-full bg-white text-[#2E6641] shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95"
            >
              <Pencil size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              title="Slett"
              aria-label="Slett annonsen"
              onClick={handleDeleteClick}
              disabled={deleteMutation.isPending}
              className="flex size-9 items-center justify-center rounded-full bg-white text-[#0B0B0B] shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <span className="size-4 animate-spin rounded-full border-[1.5px] border-[#E6E7E1] border-t-[#0B0B0B]" />
              ) : (
                <Trash2 size={16} strokeWidth={2} />
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={isInAnyList ? 'Endre lagring' : 'Lagre oppdraget'}
            onClick={handleFavClick}
            className="absolute bottom-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-[#0B0B0B] shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 group-hover:opacity-100 sm:opacity-0"
          >
            {listsLoading ? (
              <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-[#E6E7E1] border-t-[#2E6641]" />
            ) : (
              <Bookmark size={16} strokeWidth={2} className={isInAnyList ? 'fill-current' : ''} />
            )}
          </button>
        )}
      </div>

      <AddToListModal job={job} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="flex items-center justify-between gap-3 px-1">
        <span className={`${BADGE} bg-[#EAF1E9] text-[#2E6641]`}>
          <ShieldCheck size={12} strokeWidth={2.4} />
          SafePay
        </span>
        {job.createdAt && (
          <span className="truncate text-[0.75rem] text-[#9B9E96]">
            {dateFormatter.toRelative(job.createdAt)}
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 px-1 text-[1.125rem] font-semibold leading-tight tracking-[-0.03em] text-[#0B0B0B]">
        {job?.title || 'Uten tittel'}
      </h3>

      {showDescription && job.description && (
        <p className="line-clamp-2 px-1 text-[0.875rem] leading-relaxed text-[#63665F]">
          {job.description}
        </p>
      )}

      {job.status === 'closed' && (
        <span className={`${BADGE} mx-1 w-fit bg-[#F4F6F0] text-[#63665F]`}>
          <CheckCircle2 size={12} strokeWidth={2.4} />
          Fullført
        </span>
      )}

      <div className="mx-1 mt-auto flex items-center justify-between gap-3 border-t border-[#E6E7E1] pt-4">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-[#63665F]">
          <MapPin size={14} strokeWidth={1.9} className="shrink-0 text-[#9B9E96]" />
          <span className="truncate">
            {job?.location?.city || job?.location?.address || 'Norge'}
          </span>
        </span>
        <span className="shrink-0 text-[1.0625rem] font-bold tabular-nums tracking-[-0.02em] text-[#0B0B0B]">
          {price} kr
        </span>
      </div>
    </article>
  );
};
