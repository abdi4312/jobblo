import { Spinner } from "../Ui/Spinner";

export const JobDetailCardSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 overflow-hidden">
        {Array(6).fill(0).map((_, i) => (
            <div
                key={i}
                className="mx-auto bg-[#FFFFFF1A] w-full rounded-xl shadow-md cursor-pointer overflow-hidden border border-gray-100"
            >
                {/* Image Section Placeholder */}
                <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
                    <Spinner size={150} />
                </div>

                {/* Content Placeholder */}
                <div className="gap-3 p-4 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>

                {/* Footer Placeholder */}
                <div className="flex justify-between items-center p-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                </div>
            </div>
        ))}
    </div>
);