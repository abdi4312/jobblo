import { useJobs } from "../../../features/jobsList/hooks";
import { JobCard } from "./JobCard";
import { JobCardSkeleton } from "../../Loading/JobCardSkeleton";

interface JobsContainerProps { selectedCategories?: string[]; searchQuery?: string; }

export default function JobsContainer({ selectedCategories = [], searchQuery = "", }: JobsContainerProps) {

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, } = useJobs({
    categories: selectedCategories,
    search: searchQuery,
  });

  // const totalJobs = data?.pages[0].pagination.total || 0;
  const jobs = data?.pages.flatMap((page) => page.data) || [];


  return (
    <div>
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0A0A0A] tracking-tight">Explore Jobs</h2>
          <p className="text-gray-500 mt-2 text-[15px]">Find your next opportunity from our latest listings</p>
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-start items-start mx-auto w-full">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <JobCardSkeleton key={index} />
          ))
        ) : (
          jobs.map((job) => <JobCard key={job._id} job={job} />)
        )}

      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-3 bg-[#2F7E47] text-white rounded-lg font-semibold"
          >
            {isFetchingNextPage ? "Laster..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
