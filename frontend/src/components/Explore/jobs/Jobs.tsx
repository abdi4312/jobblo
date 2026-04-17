import { useJobs } from "../../../features/jobsList/hooks";
import { JobCard } from "./JobCard";
import { JobCardSkeleton } from "../../Loading/JobCardSkeleton";
import type { Tab } from "../../../types/tabs";
import { useEffect, useRef } from "react";

interface JobsContainerProps {
  selectedCategories?: string[];
  searchQuery?: string;
  activeTab?: Tab;
}

export default function JobsContainer({
  selectedCategories = [],
  searchQuery = "",
  activeTab = "Discover",
}: JobsContainerProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobs({
      categories: selectedCategories,
      search: searchQuery,
      tab: activeTab,
    });

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // const totalJobs = data?.pages[0].pagination.total || 0;
  const jobs = data?.pages.flatMap((page) => page.data) || [];

  return (
    <div>
      <div className="grid gap-x-4 gap-y-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-start items-start mx-auto w-full">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))
          : jobs.map((job) => <JobCard key={job._id} job={job} />)}
      </div>

      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-gray-50 p-6 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Ingen tjenester funnet
          </h3>
          <p className="text-gray-500 max-w-xs">
            {activeTab === "Favorites"
              ? "Du har ikke lagt til noen tjenester i dine favoritter ennå."
              : activeTab === "People’s"
                ? "Ingen populære tjenester akkurat nå. Prøv igjen senere!"
                : "Vi fant ingen tjenester som samsvarer med ditt søk eller kategori."}
          </p>
        </div>
      )}

      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="flex justify-center mt-12 pb-10 min-h-[100px]"
        >
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 px-10 py-3.5 bg-[#2F7E47] text-white rounded-full font-bold shadow-md">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Laster...
            </div>
          ) : (
            <div className="h-4 w-full" />
          )}
        </div>
      )}
    </div>
  );
}
