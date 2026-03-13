import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Loader2
} from "lucide-react";
import { JobCard } from "../../components/Explore/jobs/JobCard";
import { useJobs } from "../../features/jobsList/hooks";
import toast from "react-hot-toast";

const sortOptions = [
  { label: "Newest first", value: "-createdAt" },
  { label: "Price: low to high", value: "price" },
  { label: "Price: high to low", value: "-price" },
  { label: "Most relevant", value: "" }
];

const ServiceListing = () => {
  const { categoryName } = useParams();
  const [isSortOpen, setIsSortOpen] = useState(false);
  // const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState(sortOptions[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useJobs({
    categories: categoryName ? [categoryName] : [],
    sort: selectedSort.value,
    limit: 16
  });

  const jobs = data?.pages.flatMap((page) => page.data) || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setIsFilterOpen = () => {
    toast.success("Coming soon")
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 pb-10 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-10 relative">
        <button
          onClick={() => setIsFilterOpen()}
          className="relative flex items-center bg-white gap-2 border-none py-3.5 px-7 rounded-full font-bold
          text-base shadow-[0_4px_25px_rgba(0,0,0,0.06)] cursor-pointer transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] active:scale-95"
        >
          <SlidersHorizontal size={19} />
          <span>Filters</span>
          {/* <span className="absolute -top-1 -right-1 bg-[#ff8a7a] text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold text-white border-2 border-white">
            1
          </span> */}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center gap-2 bg-white border-none py-3.5 px-7 rounded-full font-bold
            text-base shadow-[0_4px_25px_rgba(0,0,0,0.06)] cursor-pointer transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] active:scale-95"
          >
            <ArrowUpDown size={19} />
            <span>Sort</span>
          </button>

          {isSortOpen && (
            <div className="absolute right-0 mt-3 w-72 bg-white rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden z-100 p-2 animate-in fade-in zoom-in duration-200 origin-top-right">
              {sortOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => { setSelectedSort(option); setIsSortOpen(false); }}
                  className={`w-full flex items-center justify-between px-6 py-4 rounded-[24px] text-left font-bold text-[17px] transition-colors ${selectedSort.label === option.label ? "bg-[#f8f8f8] text-[#ff8a7a]" : "text-[#0A0A0A] hover:bg-gray-50"
                    }`}
                >
                  <span>{option.label}</span>
                  {selectedSort.label === option.label && <Check size={20} className="text-[#ff8a7a]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid of JobCards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#ff8a7a] mb-4" size={48} />
          <p className="text-gray-500 font-medium">Laster tjenester...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-red-500 font-bold text-xl">Kunne ikke laste data.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-[#ff8a7a] text-white px-6 py-2 rounded-full font-bold"
          >
            Prøv igjen
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-bold text-xl">Ingen tjenester funnet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {jobs.map((job) => <JobCard key={job._id} job={job} />)}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-12">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="bg-white border-2 border-[#ff8a7a] text-[#ff8a7a] py-3.5 px-10 rounded-full font-bold text-lg hover:bg-[#ff8a7a] hover:text-white transition-all disabled:opacity-50"
              >
                {isFetchingNextPage ? "Laster mer..." : "Last inn flere"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Filter Sidebar Modal */}
    </div>
  );
};

export default ServiceListing;