import React from 'react';

interface JobDescriptionProps {
  description?: string;
  loading?: boolean;
}

const JobDescription: React.FC<JobDescriptionProps> = ({ description, loading }) => {
  if (loading) {
    return (
      <div className="pt-4 space-y-2 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }
  return (
    <p className="text-base font-light pt-4">
      {description || 'Ingen beskrivelse tilgjengelig'}
    </p>
  );
};

export default JobDescription;
