import React from 'react';

interface JobDetailsProps {
  job?: {
    title: string;
    tags?: string[];
  } | null;
  loading?: boolean;
}

const JobDetails: React.FC<JobDetailsProps> = ({ job, loading }) => {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="">
          {/* Title Skeleton */}
          <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>

          {/* Tags Skeleton */}
          <div className="flex gap-2 pt-4">
            <div className="h-6 bg-gray-200 rounded-xl w-16"></div>
            <div className="h-6 bg-gray-200 rounded-xl w-20"></div>
            <div className="h-6 bg-gray-200 rounded-xl w-14"></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="">
      <div className=''>
        <h1 className="text-[24px] font-bold">{job?.title || 'Ingen tittel'}</h1>

        <div className='flex gap-2 pt-3'>
          {
            job?.tags?.map((tag, index) => (
              <span key={index} className="bg-[#2F7E471A] text-[#2F7E47] text-[12px]! font-normal! px-4 py-1 rounded-xl">
                {tag}
              </span>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default JobDetails;
