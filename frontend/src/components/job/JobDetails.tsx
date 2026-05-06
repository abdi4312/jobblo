import React from "react";

interface JobDetailsProps {
  job?: {
    title: string;
    tags?: string[];
  } | null;
}

const JobDetails: React.FC<JobDetailsProps> = ({ job }) => {
  console.log(job);

  return (
    <>
      <h1 className="text-[24px] font-bold">{job?.title || "Ingen tittel"}</h1>

      <div className="flex gap-2 pt-3">
        {/* {
          job?.tags?.map((tag, index) => (
            <span key={index} className="bg-[#2F7E471A] text-custom-green text-[12px]! font-normal! px-4 py-1 rounded-xl">
              {tag}
            </span>
          ))
        } */}
        <span className="bg-[#2F7E471A] text-custom-green text-[12px]! font-normal! px-4 py-1 rounded-xl">
          {job?.categories}
        </span>
      </div>
    </>
  );
};

export default JobDetails;
