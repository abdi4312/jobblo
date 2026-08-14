/**
 * The placeholder row for the category tiles.
 *
 * Was eight boxes each holding a 145 px lime spinner — the spinners were larger than the
 * tiles they stood in and overflowed them. Now each tile is the shape of the tile it is
 * standing in for.
 */
export const CategorySkeleton = () => (
  <div className="mx-auto grid max-w-300 grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#E6E7E1] bg-white p-4"
      >
        <div className="jb-skeleton size-5.5 rounded-md" />
        <div className="jb-skeleton h-3 w-14 rounded" />
      </div>
    ))}
  </div>
);

export default CategorySkeleton;
