/**
 * The placeholder for a listing management card.
 *
 * The page used to render one `JobDetailCardSkeleton` — a single, differently shaped
 * placeholder — for a whole grid, so the first paint was one narrow box that then
 * snapped into a three-column layout. This is the card's own silhouette in
 * `jb-skeleton`, the product's shimmer (which already stops itself under
 * `prefers-reduced-motion`), so the swap to real content is a fill rather than a
 * re-layout: same surface, same 16:10 photo, same four lines under it.
 */
export const MyListingCardSkeleton = () => (
  <div className="flex flex-col overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
    <div className="jb-skeleton aspect-16/10" />

    <div className="p-4">
      <div className="jb-skeleton h-3.5 w-10/12 rounded" />
      <div className="jb-skeleton mt-2 h-3.5 w-5/12 rounded" />
      <div className="jb-skeleton mt-3 h-3 w-2/3 rounded" />
      <div className="jb-skeleton mt-3.5 h-6.5 w-24 rounded-full" />

      <div className="mt-4 flex items-center gap-2">
        <div className="jb-skeleton h-11 flex-1 rounded-xl" />
        <div className="jb-skeleton size-11 rounded-full" />
      </div>
    </div>
  </div>
);

/** A grid of them, matched to the listing grid's columns and gap. */
export const MyListingGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    aria-busy="true"
    aria-live="polite"
  >
    <span className="sr-only">Laster annonsene dine …</span>
    {Array.from({ length: count }, (_, i) => (
      <MyListingCardSkeleton key={i} />
    ))}
  </div>
);

export default MyListingCardSkeleton;
