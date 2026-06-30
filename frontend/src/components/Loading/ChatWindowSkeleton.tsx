export const ChatWindowSkeleton = () => {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full animate-pulse bg-white">
      {/* Header Skeleton */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-100 rounded w-20"></div>
          </div>
        </div>
        <div className="w-24 h-9 bg-gray-200 rounded-xl"></div>
      </div>

      {/* Messages Area Skeleton */}
      <div className="flex-1 overflow-hidden p-4 space-y-6">
        {/* Left message */}
        <div className="flex justify-start">
          <div className="max-w-[70%] space-y-2">
            <div className="h-10 bg-gray-100 rounded-2xl rounded-tl-none w-48"></div>
            <div className="h-3 bg-gray-50 rounded w-12"></div>
          </div>
        </div>

        {/* Right message */}
        <div className="flex justify-end">
          <div className="max-w-[70%] space-y-2 items-end flex flex-col">
            <div className="h-16 bg-custom-green-light opacity-50 rounded-2xl rounded-tr-none w-64"></div>
            <div className="h-3 bg-gray-50 rounded w-12"></div>
          </div>
        </div>

        {/* Left message */}
        <div className="flex justify-start">
          <div className="max-w-[70%] space-y-2">
            <div className="h-12 bg-gray-100 rounded-2xl rounded-tl-none w-56"></div>
            <div className="h-3 bg-gray-50 rounded w-12"></div>
          </div>
        </div>

        {/* Right message */}
        <div className="flex justify-end">
          <div className="max-w-[70%] space-y-2 items-end flex flex-col">
            <div className="h-10 bg-custom-green-light opacity-50 rounded-2xl rounded-tr-none w-40"></div>
            <div className="h-3 bg-gray-50 rounded w-12"></div>
          </div>
        </div>
      </div>

      {/* Input Area Skeleton */}
      <div className="p-4 border-t border-gray-100 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0"></div>
        <div className="flex-1 h-12 bg-gray-100 rounded-2xl"></div>
        <div className="w-12 h-12 rounded-2xl bg-gray-200 shrink-0"></div>
      </div>
    </div>
  );
};
