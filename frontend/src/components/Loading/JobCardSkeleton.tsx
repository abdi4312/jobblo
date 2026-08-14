/**
 * The placeholder for a job card, matched to the real card's geometry.
 *
 * It used to put a 200 px lime spinner inside a card-sized box and pulse the whole thing
 * grey — two competing animations in one placeholder, neither the shape of what was
 * about to arrive. Now it is the card's own silhouette in `jb-skeleton`, so the swap to
 * real content is a fill rather than a re-layout.
 */
export const JobCardSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-3xl border border-[#E6E7E1] bg-white p-4 pb-5">
    <div className="jb-skeleton h-45 rounded-2xl" />

    <div className="flex items-center justify-between gap-3 px-1">
      <div className="jb-skeleton h-7 w-24 rounded-full" />
      <div className="jb-skeleton h-3.5 w-16 rounded-full" />
    </div>

    <div className="space-y-2 px-1">
      <div className="jb-skeleton h-4.5 w-full rounded" />
      <div className="jb-skeleton h-4.5 w-2/3 rounded" />
    </div>

    <div className="mx-1 mt-auto flex items-center justify-between gap-3 border-t border-[#E6E7E1] pt-4">
      <div className="jb-skeleton h-3.5 w-20 rounded" />
      <div className="jb-skeleton h-4.5 w-16 rounded" />
    </div>
  </div>
);

export default JobCardSkeleton;
