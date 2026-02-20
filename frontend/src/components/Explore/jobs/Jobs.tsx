import { SlidersHorizontal } from "lucide-react";
import { useJobs } from "../../../features/jobsList/hooks";
import { Button } from "../../Ui/Button";
import { JobCard } from "./JobCard";
import { InfinitySpin } from "react-loader-spinner";

interface JobsContainerProps {
  selectedCategories?: string[];
  searchQuery?: string;
}

export default function JobsContainer({
  selectedCategories = [],
  searchQuery = "",
}: JobsContainerProps) {

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({
    categories: selectedCategories,
    search: searchQuery,
  });

  const totalJobs = data?.pages[0].pagination.total || 0;
  const jobs = data?.pages.flatMap((page) => page.data) || [];


  return (
    <div>
      <div className="flex justify-between pb-6">

        <div className="flex gap-2 items-center">
          <p className="text-[24px] font-bold">{totalJobs}</p>
          <span className="font-normal text-base text-[#4A5565]">oppdrag</span>
        </div>

        <div>
          <Button icon={<SlidersHorizontal size={16} />} label="Filter"
            className="bg-transparent text-[#D67E2B]! font-medium!
            border border-[#D67E2B]! rounded-xl! hover:bg-[#D67E2B]! hover:text-white!" size="lg" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 justify-center mx-auto w-full">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="mx-auto bg-[#FFFFFF1A] sm:w-110 rounded-xl shadow-md cursor-pointer overflow-hidden border border-gray-100"
            >
              {/* Image Section Placeholder */}
              <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
                <InfinitySpin
                  width="150"
                  color="#4fa94d"
                />
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
