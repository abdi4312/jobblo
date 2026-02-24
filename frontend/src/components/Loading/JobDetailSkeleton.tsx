import { Spinner } from "../Ui/Spinner";

export const JobDetailSkeleton = () => (
    // <div className="min-w-42 min-h-34.75 p-6 flex items-center justify-center rounded-xl bg-white border border-gray-100">
    //     <Spinner size={200} />
    // </div>
    <div className="w-full sm:min-w-180 md:max-w-180 h-full pb-6 bg-white mx-auto">
        {/* <JobImageCarousel images={job?.images} loading={isJobLoading} /> */}
        <div className="relative w-full p-3">
            <div className="h-2 w-px"></div>
            <div className="relative w-full h-58.5 md:h-74.25 overflow-hidden rounded-t-lg bg-gray-200 animate-pulse flex items-center justify-center">
                <Spinner size={150} />
            </div>
        </div>
        <div className="px-6">
            <div className="animate-pulse">
                <div className="">
                    {/* Title Skeleton */}
                    <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>

                    {/* Tags Skeleton */}
                    <div className="flex gap-2 pt-4">
                        <div className="h-6 bg-gray-200 rounded-xl w-16"></div>
                        <div className="h-6 bg-gray-200 rounded-xl w-20"></div>
                        <div className="h-6 bg-gray-200 rounded-xl w-14"></div>
                    </div>
                </div>
            </div>

            <div className="pt-4 space-y-2 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>

            <div className="pt-6">
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className='flex flex-col max-w-82 h-23.75 gap-2 rounded-[14px] bg-gray-100 p-6 animate-pulse'>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='border border-amber-100 my-6 rounded-[14px] animate-pulse'>
                <div className='flex flex-col justify-center items-center gap-3 py-6'>
                    <div className='size-12 bg-gray-200 rounded-full'></div>
                    <div className='flex flex-col items-center gap-2'>
                        <div className="h-6 bg-gray-200 rounded w-32"></div>
                        <div className="h-4 bg-gray-200 rounded w-48"></div>
                    </div>
                    <div className="h-8 bg-gray-100 rounded-[14px] w-28"></div>
                </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                {/* Salary Skeleton */}
                <div className='h-33.75 rounded-[14px] bg-amber-50 p-6 flex flex-col justify-between'>
                    <div className="h-4 bg-amber-200/50 rounded w-12"></div>
                    <div className="h-10 bg-amber-200/50 rounded w-32 self-end"></div>
                </div>

                {/* Provider Skeleton */}
                <div className='h-33.75 rounded-[14px] bg-gray-100 p-6 flex flex-col gap-4'>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className='flex gap-3 items-center'>
                        <div className='size-14 bg-gray-200 rounded-full'></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-5 bg-gray-200 rounded w-24"></div>
                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-10 flex gap-4 animate-pulse">
                <div className="w-full h-12.5 bg-gray-200 rounded-xl"></div>
                <div className="w-32 h-12.5 bg-gray-200 rounded-xl"></div>
            </div>

            {/* <JobDetails job={job} loading={isJobLoading} /> */}
            {/* <JobDescription description={job?.description} loading={isJobLoading} /> */}
            {/* <JobContainer job={job} loading={isJobLoading} /> */}
            {/* <JobLocation location={job?.location} loading={isJobLoading} /> */}
            {/* <JobProvider job={job} loading={isJobLoading} /> */}
            {/* <JobButton
                handleSendMessage={() => handleSendMessage(job?.userId?._id)}
                handleFavoriteClick={handleFavoriteClick}
                isFavorited={!!isFavorited}
                isOwnJob={isOwnJob}
                isLoading={isMessageLoading}
                loading={isJobLoading}
            /> */}
        </div>
    </div>
);