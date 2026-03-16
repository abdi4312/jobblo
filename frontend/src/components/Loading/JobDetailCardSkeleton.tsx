export const JobDetailCardSkeleton = () => (
  <aside className="w-full space-y-4">
    {/* Price CTA Card Skeleton */}
    <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
      {/* Green top accent bar placeholder */}
      <div className="h-1.5 bg-gray-100 animate-pulse" />
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded w-16 animate-pulse"></div>
          <div className="flex items-baseline gap-1.5 animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-24"></div>
            <div className="h-5 bg-gray-200 rounded w-8"></div>
          </div>
        </div>

        {/* Buttons Skeleton */}
        <div className="flex gap-3 animate-pulse">
          <div className="flex-1 h-12 bg-gray-200 rounded-xl"></div>
          <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
        </div>

        <div className="h-3 bg-gray-100 rounded w-3/4 mx-auto animate-pulse"></div>
      </div>
    </div>

    {/* Job Info Summary Card Skeleton */}
    <div className="bg-white rounded-[20px] p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
      <div className="h-3 bg-gray-100 rounded w-24 mb-6 animate-pulse"></div>
      
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-50 rounded-[14px] p-4 flex flex-col justify-between animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 self-end"></div>
          </div>
        ))}
      </div>
    </div>
  </aside>
);