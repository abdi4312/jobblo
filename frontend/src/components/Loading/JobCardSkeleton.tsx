export const JobCardSkeleton = () => (
    <div className="flex flex-col gap-2 w-full animate-pulse group">
        {/* Image Section Placeholder */}
        <div className="relative aspect-4/5 w-full bg-gray-200 rounded-[20px] overflow-hidden flex items-center justify-center">
            <div className="size-12 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>

        {/* Info Section Placeholder */}
        <div className="flex flex-col gap-2 mt-1 px-1">
            {/* Title Placeholder */}
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            
            {/* Location and Price Row Placeholder */}
            <div className="flex items-center gap-2">
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                <div className="h-4 bg-gray-100 rounded w-4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            </div>
        </div>
    </div>
);