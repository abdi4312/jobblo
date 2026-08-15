/**
 * The placeholder for a job card, matched to the real card's geometry.
 *
 * It used to put a 200 px lime spinner inside a card-sized box and pulse the whole thing
 * grey — two competing animations in one placeholder, neither the shape of what was
 * about to arrive. Now it is the card's own silhouette in `jb-skeleton`, so the swap to
 * real content is a fill rather than a re-layout: same 4:5 photo, same two lines under it,
 * and no panel around either — the card carries no surface of its own.
 */
export const JobCardSkeleton = () => (
  <div className="flex flex-col">
    <div className="jb-skeleton aspect-4/5 rounded-2xl" />

    <div className="mt-3 space-y-2">
      <div className="jb-skeleton h-3.5 w-11/12 rounded" />
      <div className="jb-skeleton h-3.5 w-2/3 rounded" />
    </div>

    <div className="jb-skeleton mt-2.5 h-3 w-4/5 rounded" />
  </div>
);

export default JobCardSkeleton;
