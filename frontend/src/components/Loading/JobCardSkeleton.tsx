import { Spinner } from "../Ui/Spinner";
export const JobCardSkeleton = () => (
  <div className="flex flex-col gap-1 w-full animate-pulse">
    {/* Image Section Placeholder */}
    <div className="relative aspect-2/2 w-full bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
      <Spinner size={200} />
    </div>

    {/* Info Section Placeholder */}
    <div className="flex flex-col gap-0.5 mt-1 px-0.5">
      {/* Title Placeholder */}
      <div className="h-3.75 bg-gray-200 rounded w-full mb-1"></div>
      <div className="h-3.75 bg-gray-200 rounded w-2/3"></div>

      {/* Price Placeholder */}
      <div className="h-4.5 bg-gray-200 rounded w-1/4 mt-1.5"></div>

      {/* Location Placeholder */}
      <div className="h-3 bg-gray-100 rounded w-1/3 mt-1"></div>

      {/* Status Placeholder (optional space) */}
      <div className="h-6 mt-2"></div>
    </div>
  </div>
);