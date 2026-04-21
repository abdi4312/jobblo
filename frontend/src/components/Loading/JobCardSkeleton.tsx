export const JobCardSkeleton = () => (
  <div className="flex flex-col gap-1 w-full animate-pulse">
    {/* Image Section Placeholder */}
    <div className="relative aspect-square w-full bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
      <div className="size-8 border-3 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>

    {/* Info Section Placeholder */}
    <div className="flex flex-col gap-1.5 mt-1 px-0.5">
      {/* Title Placeholder */}
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>

      {/* Price Placeholder */}
      <div className="h-4 bg-gray-200 rounded w-1/4 mt-1"></div>

      {/* Location Placeholder */}
      <div className="h-3 bg-gray-100 rounded w-1/3"></div>
    </div>
  </div>
);