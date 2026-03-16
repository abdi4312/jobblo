export const JobDetailSkeleton = () => (
  <div className="w-full space-y-5">
    {/* Main Job Card Skeleton */}
    <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
      {/* Image Carousel Skeleton */}
      <div className="bg-gray-200 animate-pulse aspect-4/3 sm:aspect-16/8 md:aspect-16/7 w-full flex items-center justify-center">
        <div className="size-20 border-4 border-gray-300 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
      
      <div className="px-6 pt-6 pb-8 sm:px-8 space-y-6">
        {/* Title and Tags */}
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded-md w-3/4 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-6 bg-gray-100 rounded-full w-20 animate-pulse"></div>
            <div className="h-6 bg-gray-100 rounded-full w-24 animate-pulse"></div>
          </div>
        </div>
        
        <div className="border-t border-gray-100" />
        
        {/* Description */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-100 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-100 rounded w-4/5 animate-pulse"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse"></div>
        </div>
      </div>
    </div>

    {/* Provider Card Skeleton */}
    <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Salary Skeleton */}
        <div className="h-32 bg-gray-50 rounded-[20px] p-6 animate-pulse border border-gray-100 flex flex-col justify-between">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-10 bg-gray-200 rounded w-32 self-end"></div>
        </div>
        
        {/* Employer Skeleton */}
        <div className="h-32 bg-gray-50 rounded-[20px] p-6 animate-pulse border border-gray-100 flex gap-4 items-center">
          <div className="size-14 bg-gray-200 rounded-full shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    </div>

    {/* Location Card Skeleton */}
    <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
        <div className="flex items-start gap-4">
          <div className="size-10 bg-gray-100 rounded-xl animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);