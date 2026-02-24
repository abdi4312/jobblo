import React from 'react';

interface JobDescriptionProps {
  description?: string;
}

const JobDescription: React.FC<JobDescriptionProps> = ({ description }) => {

  return (
    <p className="text-base font-light pt-4">
      {description || 'Ingen beskrivelse tilgjengelig'}
    </p>
  );
};

export default JobDescription;
