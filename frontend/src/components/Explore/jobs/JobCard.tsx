import { useNavigate } from "react-router-dom";
import type { Jobs } from "../../../types/Jobs.ts";
import { Button } from "../../Ui/Button.tsx";
import { Clock4, MapPin } from "lucide-react";

interface JobCardProps {
  job: Jobs;
}

const categoryColorMap: Record<string, string> = {
  "Rørlegger": "bg-[#EF7909]",
  "Renhold": "bg-[#2F7E47]",
  "Maling": "bg-[#238CEB]",
  "Hagearbeid": "bg-[#EF7909]",
  "Flytting": "bg-[#2F7E47]",
};

export const JobCard = ({ job }: JobCardProps) => {
  const navigate = useNavigate();
  const handleCardClick = () => {
    navigate(`/job-listing/${job._id}`);
  };

  const catName = Array.isArray(job.categories) ? job.categories[0] : job.categories;
  const badgeColor = categoryColorMap[catName] || "bg-[#EF7909]";

  return (
    <div className={`mx-auto bg-[#FFFFFF1A] w-full max-w-110 lg:min-w-100 rounded-xl shadow-md cursor-pointer overflow-hidden`} onClick={handleCardClick}>
      {/* Image Section */}
      <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">

        {job.images[0] ? (
          <img src={job.images[0]} alt={job.title} className="w-full h-full p-2 object-cover rounded-t-2xl" />
        ) : (
          <span className="text-[#666] text-base">No image available</span>
        )}

        <div className={`absolute top-4 right-2 px-3 py-1.5 text-white rounded-[20px] flex items-center justify-center ${badgeColor}`} >
          <span className="text-[12px]">
            {catName || "Rørlegger"}
          </span>
        </div>

        <div className="absolute text-[#0A0A0A] bottom-4 left-4.5 bg-[#D9D9D9]/80 px-3 py-1.5 rounded-[20px] flex items-center justify-center gap-1.5">
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
};