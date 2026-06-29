import { useNavigate } from "react-router-dom";
import { useJobs } from "../../features/jobsList/hooks";
import { MapPin, ShieldCheck, Sprout } from "lucide-react";

export function Jobs() {
  const navigate = useNavigate();
  const { data: jobsData, isLoading: jobsLoading } = useJobs({
    limit: 6,
    tab: "Discover"
  });
  
  const jobs = jobsData?.pages.flatMap((page) => page.data) || [];

  return (
    <section className="py-10 sm:py-15 px-4 sm:px-12 max-w-[1100px] mx-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[22px] sm:text-[28px] font-normal text-custom-black">
          Populære <em className="text-custom-green not-italic">oppdrag</em>
        </h2>
        <button
          onClick={() => navigate("/search/job/all")}
          className="text-[12px] sm:text-[14px] text-custom-green no-underline bg-transparent border-none cursor-pointer"
        >
          Se alle
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {jobsLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] overflow-hidden animate-pulse"
            >
              <div className="h-[70px] sm:h-[90px] bg-gray-200" />
              <div className="p-2 sm:p-[10px_12px]">
                <div className="h-3 sm:h-4 bg-gray-200 rounded mb-0.5 sm:mb-1 w-3/4" />
                <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1.5 sm:mb-2 w-1/2" />
                <div className="flex justify-between items-center">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 sm:h-5 bg-gray-200 rounded-full w-16 sm:w-20" />
                </div>
              </div>
            </div>
          ))
        ) : jobs.length > 0 ? (
          jobs.slice(0, 6).map((job: any) => (
            <div
              key={job._id}
              className={`bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] overflow-hidden cursor-pointer ${job.promoted ? "border-[1.5px] border-[#ca8a04]" : ""}`}
              onClick={() => navigate(`/job-listing/${job._id}`)}
            >
              <div className="h-[70px] sm:h-[90px] bg-[#f0faf0] flex items-center justify-center overflow-hidden">
                {job.images && job.images[0] ? (
                  <img
                    src={job.images[0]}
                    alt={job.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Sprout size={28} className="text-[#16a34a] sm:w-9 sm:h-9" />
                )}
              </div>
              <div className="p-2 sm:p-[10px_12px]">
                <div className="flex items-start justify-between gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                  <div className="text-xs sm:text-sm font-medium text-[#1a1a1a] leading-tight line-clamp-2">
                    {job.title}
                  </div>
                  {job.promoted && (
                    <span className="text-[8px] sm:text-[9px] text-[#92400e] bg-[#fef9c3] rounded-full px-1.5 sm:px-[6px] py-0.5 sm:py-[2px] border border-[#fde68a] whitespace-nowrap flex-shrink-0">
                      Sponset
                    </span>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-[#888] mb-1.5 sm:mb-2 flex items-center gap-0.5 sm:gap-1">
                  <MapPin size={8} sm={10} />
                  {job.location?.city || job.location?.address || "Norge"}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-[#1a1a1a]">
                    {typeof job.price === 'number' ? job.price.toLocaleString() : job.price} kr
                  </span>
                  <span className="flex items-center gap-0.5 sm:gap-1 bg-[#f0faf0] rounded-full px-1.5 sm:px-[7px] py-0.5 sm:py-[2px] text-[10px] sm:text-xs text-[#166534] font-medium">
                    <ShieldCheck size={9} sm={11} />
                    SafePay
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>
    </section>
  );
}
