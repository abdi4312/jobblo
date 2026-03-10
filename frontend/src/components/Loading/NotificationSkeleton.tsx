// src/components/Ui/NotificationSkeleton.tsx

export const NotificationSkeleton = () => {
    return (
        <div className="bg-[#FFFFFF1A] shadow p-2 md:p-6 rounded-xl w-full">
            {/* Hum 3 cards dikhayenge loading ke waqt */}
            {[1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mx-auto my-2 animate-pulse"
                >
                    <div className="flex items-start gap-4">

                        {/* LEFT SIDE: Icon Circle Skeleton */}
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 bg-gray-200 rounded-full border border-gray-100" />
                        </div>

                        {/* MIDDLE & RIGHT CONTENT Skeleton */}
                        <div className="flex-1 flex flex-col sm:flex-row justify-between gap-4">
                            <div className="space-y-3 w-full">

                                {/* Title and Mobile Icons */}
                                <div className="flex items-center justify-between sm:justify-start">
                                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                                    <div className="flex gap-3 sm:hidden">
                                        <div className="h-5 w-5 bg-gray-100 rounded" />
                                        <div className="h-5 w-5 bg-gray-100 rounded" />
                                    </div>
                                </div>

                                {/* Content Lines */}
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-full" />
                                    <div className="h-4 bg-gray-200 rounded w-4/5" />
                                </div>

                                {/* Badge Skeleton */}
                                <div className="h-6 bg-gray-100 rounded-full w-24" />

                                {/* Time Skeleton */}
                                <div className="flex items-center gap-1.5 pt-1">
                                    <div className="h-4 w-4 bg-gray-100 rounded-full" />
                                    <div className="h-4 bg-gray-100 rounded w-32" />
                                </div>
                            </div>

                            {/* Desktop Actions Skeleton */}
                            <div className="flex flex-col justify-between items-end min-w-[120px]">
                                <div className="hidden sm:flex gap-4 items-center">
                                    <div className="h-6 w-6 bg-gray-200 rounded" />
                                    <div className="h-6 w-6 bg-gray-200 rounded" />
                                </div>
                                <div className="h-10 bg-gray-200 rounded-2xl w-28 mt-4 sm:mt-0" />
                            </div>

                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};