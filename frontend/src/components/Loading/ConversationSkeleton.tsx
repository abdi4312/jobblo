export const ConversationSkeleton = () => {
  return (
    <div className="flex flex-col box-card-custom animate-pulse">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="relative flex items-center border-b border-custom-green-light p-4 gap-4"
        >
          {/* Avatar Skeleton */}
          <div className="relative shrink-0">
            <div className="w-[56px] h-[56px] rounded-full bg-gray-200"></div>
          </div>

          {/* Content Skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline gap-2">
              <div className="h-5 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-100 rounded w-12 ml-auto"></div>
            </div>
            <div className="h-4 bg-gray-100 rounded w-2/3"></div>
          </div>

          {/* Service Image Skeleton */}
          <div className="shrink-0 ml-2">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 border border-[#F1F3F5]"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
