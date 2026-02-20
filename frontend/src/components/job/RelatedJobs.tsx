import { useNavigate } from "react-router-dom";
import { Clock4, MapPin } from "lucide-react";
import { Button } from "../Ui/Button.tsx";
import { InfinitySpin } from "react-loader-spinner";
import { useNearbyJobsQuery } from "../../features/jobDetail/hook.ts";

interface RelatedJobsProps {
  coordinates?: [number, number];
  currentJobId?: string;
}

const categoryColorMap: Record<string, string> = {
  "Rørlegger": "#EF7909",   // Orange
  "Renhold": "#2F7E47",     // Green
  "Maling": "#238CEB",      // Blue
  "Hagearbeid": "#EF7909",  // Purple
  "Flytting": "#2F7E47",    // Red
};

const RelatedJobs: React.FC<RelatedJobsProps> = ({
  coordinates,
  currentJobId,
}) => {
  const navigate = useNavigate();

  const { data: nearbyJobs = [], isLoading: loading } = useNearbyJobsQuery(
    coordinates,
    currentJobId || ""
  );

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="mx-auto bg-[#FFFFFF1A] w-full rounded-xl shadow-md overflow-hidden border border-gray-100"
          >
            <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
              <InfinitySpin width="150" color="#4fa94d" />
            </div>
            <div className="gap-3 p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="flex justify-between items-center p-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (nearbyJobs.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-6">
        <h3 className="text-xl font-bold text-[#0A0A0A] mb-6">Jobber i nærheten</h3>

        <div className="flex flex-col items-center justify-center p-10 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl">
          {/* Search Icon or Illustration */}
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <MapPin size={32} className="text-gray-400" />
          </div>

          <h4 className="text-lg font-semibold text-gray-900 mb-1">
            Ingen jobber funnet
          </h4>

          <p className="text-gray-500 text-center max-w-[250px] text-sm leading-relaxed">
            Vi fant dessverre ingen jobber i nærheten av din posisjon akkurat nå.
          </p>

          <button
            onClick={() => navigate("/job-listing")}
            className="mt-6 text-sm font-medium text-[#2F7E47] hover:underline"
          >
            Se alle tilgjengelige jobber
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
      {nearbyJobs.map((job) => {
        // Map ke andar in variables ko define karna zaroori hai
        const catName = Array.isArray(job.categories) ? job.categories[0] : job.categories;
        const badgeColor = categoryColorMap[catName as string] || "#EF7909";

        const handleCardClick = () => {
          navigate(`/job-listing/${job._id}`);
        };

        return (
          <div
            key={job._id}
            onClick={handleCardClick}
            className={`mx-auto bg-[#FFFFFF1A] w-full rounded-xl shadow-md cursor-pointer overflow-hidden`}
          >
            {/* Image Section */}
            <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
              {job.images[0] ? (
                <img
                  src={job.images[0]}
                  alt={job.title}
                  className="w-full h-full p-2 object-cover rounded-t-2xl"
                />
              ) : (
                <span className="text-[#666] text-base">No image available</span>
              )}

              <div
                className="absolute top-4 right-2 bg-[#EF7909] px-3 py-1.5 text-white rounded-[20px] flex items-center justify-center"
                style={{ backgroundColor: badgeColor }}
              >
                <span className="text-[12px]">
                  {catName || "Rørlegger"}
                </span>
              </div>

              <div
                className="absolute text-[#0A0A0A] bottom-4 left-4.5 bg-[#D9D9D9]/80 px-3 py-1.5 rounded-[20px] flex items-center justify-center gap-1.5"
              >
                <MapPin size={13} />
                <span className="text-[12px] font-normal">
                  {job.location.city}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="gap-3 p-4">
              <h2 className="text-[#0A0A0A] whitespace-nowrap overflow-hidden text-ellipsis font-bold text-[20px]">
                {job.title}
              </h2>

              <p className="text-[#0A0A0A] text-base font-light">
                {job.description}
              </p>
            </div>

            {/* Job Details */}
            <div className="flex justify-between p-4">

              <div className="flex items-center gap-1">
                {/* <span className="material-symbols-outlined text-[12.5px] text-[#4A5565]">Schedule</span> */}
                <Clock4 size={13} />
                <h3 className="m-0 whitespace-nowrap overflow-hidden text-ellipsis text-[12px] font-normal">
                  {job.duration.value
                    ? `${job.duration.value} ${job.duration.unit}`
                    : "Ikke angitt"}
                </h3>
              </div>

              <div className="flex items-center gap-6">
                <p className="text-[24px] font-bold">{job.price}Kr</p>
                <Button label="Søk nå" className="bg-[#2F7E47]! rounded-xl" />
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default RelatedJobs;