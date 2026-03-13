import React from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface JobLocationProps {
  location?: {
    address?: string;
    city?: string;
  };
}

const JobLocation: React.FC<JobLocationProps> = ({ location }) => {
  return (
    <div className='border border-amber-200 my-6 rounded-[14px]'>
      <div className='flex flex-col justify-center items-center gap-3 py-6'>

        <span className='pl-2.5 pt-3.25 pr-3.5 pb-2.75 text-[#2F7E47]! bg-[#CBDBD0]! rounded-full'>
          <Navigation size={24} />
        </span>

        <div className='text-center'>
          <h2 className='text-[20px] font-bold text-[#101828]'>
            {location?.city || 'Ingen by spesifisert'}
          </h2>
          <p className='text-[14px] font-normal text-[#4A5565]'>
            {location?.address || 'Området for oppdraget'}
          </p>
        </div>

        <div className="rounded-[14px] flex items-center justify-center gap-2 px-3 py-1.5 shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.1)] bg-white">
          <span className='text-[#3F8F6B]'>
            <MapPin size={15} />
          </span>
          <p className='text-[#0A0A0A9E] text-[14px] font-light'>Ca. 800m radius</p>
        </div>

      </div>
    </div>
  );
};

export default JobLocation;