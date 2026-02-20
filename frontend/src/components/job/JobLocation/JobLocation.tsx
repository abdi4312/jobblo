import React from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface JobLocationProps {
  location?: {
    address?: string;
    city?: string;
  };
  loading?: boolean; // Interface mein loading add kar diya
}

const JobLocation: React.FC<JobLocationProps> = ({ location, loading }) => {
  const getLocationText = () => {
    if (location?.city) {
      return location.city;
    }
    return 'Ingen by spesifisert';
  };

  return (
    <div className='border border-amber-200 my-6 rounded-[14px]'>
      <div className='flex flex-col justify-center items-center gap-3 py-6'>

        <span className={`pl-2.5 pt-3.25 pr-3.5 pb-2.75 text-[#2F7E47]! bg-[#CBDBD0]! rounded-full ${loading ? 'animate-pulse' : ''}`}>
          <Navigation size={24} />
        </span>

        <div className='text-center flex flex-col items-center'>
          {loading ? (
            <>
              <div className="h-7 bg-gray-200 animate-pulse rounded w-32 mb-2"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-24"></div>
            </>
          ) : (
            <>
              <h2 className='text-[20px] font-bold text-[#101828]'>{getLocationText()}</h2>
              <p className='text-[14px] font-normal text-[#4A5565]'>{location?.address || 'Ingen adresse spesifisert'}</p>
            </>
          )}
        </div>

        <div className="rounded-[14px] flex items-center justify-center gap-2 px-3 py-1.5 shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.1)] bg-white">
          <span className='text-[#3F8F6B]'>
            <MapPin size={15} />
          </span>
          {loading ? (
            <div className="h-4 bg-gray-100 animate-pulse rounded w-20"></div>
          ) : (
            <p className='text-[#0A0A0A9E] text-[14px] font-light'>Ca. 800m radius</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default JobLocation;