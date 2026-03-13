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
      {/* <div className="flex justify-between pb-6">
        <div className="flex gap-2 items-center">
          <p className="text-[20px] md:text-[24px] font-bold">{totalJobs}</p>
          <span className="font-normal text-[12px] md:text-base text-[#4A5565]">oppdrag</span>
        </div>

        <div>
          <Button icon={<SlidersHorizontal size={16} />} label="Filter"
            className="bg-transparent text-[#D67E2B]! font-medium!
            border border-[#D67E2B]! rounded-xl! hover:bg-[#D67E2B]! hover:text-white! hidden! md:flex!" size="lg" />
          <Button
            icon={<SlidersHorizontal size={16} />}
            className="bg-transparent text-[#D67E2B]! md:hidden!" />
        </div>

      </div> */}

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
