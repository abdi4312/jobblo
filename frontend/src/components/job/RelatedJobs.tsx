import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useNearbyJobsQuery } from "../../features/jobDetail/hook.ts";
import { JobCard } from "../Explore/jobs/JobCard.tsx";
import { JobCardSkeleton } from "../Loading/JobCardSkeleton.tsx";
import type { Jobs } from "../../types/Jobs";

interface RelatedJobsProps {
  coordinates?: [number, number];
  currentJobId?: string;
}

const RelatedJobs: React.FC<RelatedJobsProps> = ({ coordinates, currentJobId }) => {
  const navigate = useNavigate();

  const { data: nearbyJobs = [], isLoading: isNearbyLoading } = useNearbyJobsQuery(
    coordinates,
    currentJobId || ""
  );

  if (isNearbyLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (nearbyJobs.length === 0) {
    return (
      <div className="py-10 px-4">
        <div className="flex flex-col items-center justify-center p-10 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <MapPin size={28} className="text-gray-400" />
          </div>
          <h4 className="text-base font-semibold text-gray-800 mb-1">
            Ingen jobber funnet
          </h4>
          <p className="text-gray-500 text-center text-sm leading-relaxed">
            Vi fant ingen jobber i nærheten akkurat nå.
          </p>
          <button
            onClick={() => navigate("/job-listing")}
            className="mt-5 text-sm font-semibold text-[#2F7E47] hover:underline"
          >
            Se alle tilgjengelige jobber →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {nearbyJobs.map((job: Jobs) => (
        <JobCard key={job._id} job={job} />
      ))}
    </div>
  );
};

export default RelatedJobs;