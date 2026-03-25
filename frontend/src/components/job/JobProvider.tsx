import { CircleCheck, Star } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface JobProviderProps {
    job: {
        price?: number;
        userId?: {
            _id: string;
            avatarUrl: string;
            name: string;
            verified: boolean;
            averageRating: number;
        };
    };
}

const JobProvider: React.FC<JobProviderProps> = ({ job }) => {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lønn Section */}
            <div className='flex flex-col max-h-33.75 text-[#0A0A0A] gap-2 rounded-[14px] bg-white shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)] p-6'>
                <p className='text-base font-medium'>Lønn</p>
                <p className='text-[36px] font-bold text-end'>
                    {job?.price ? `${job?.price.toLocaleString('nb-NO')} kr` : 'N/A'}
                </p>
            </div>

            {/* Provider Section */}
            <div 
                onClick={() => job?.userId?._id && navigate(`/profile/${job.userId._id}`)}
                className='flex flex-col max-h-33.75 gap-2 rounded-[14px] bg-[linear-gradient(111.15deg,#2BFF00_-59.46%,#A9FF98_100%)] p-6 cursor-pointer hover:opacity-90 transition-opacity'
            >
                <p className='text-base font-bold text-[#0A0A0A]'>Om oppdragsgiveren</p>
                <div className='flex gap-3 items-center'>
                    <div className='size-14 shadow-[0px_0px_0px_3px_#FFFFFF] rounded-full overflow-hidden bg-white'>
                        <img src={job?.userId?.avatarUrl} className='size-full object-cover' alt={job?.userId?.name} />
                    </div>
                    <div className="flex-1">
                        <div className='flex items-center gap-2'>
                            <h2 className='text-[18px] font-bold'>{job?.userId?.name}</h2>
                            <p className='text-white text-[12px] py-0.75 px-3 font-medium bg-[#00000099] rounded-[35px]'>
                                {job?.userId?.verified ? 'Verified' : 'Not Verified'}
                            </p>
                        </div>
                        <div className='flex gap-4'>
                            <p className='flex items-center gap-1'>
                                <Star size={17} fill='#F0B100' className='text-[#F0B100]' />
                                <span className='text-[16px] font-bold'>{job?.userId?.averageRating}</span>
                            </p>
                            <div className='flex items-center gap-1'>
                                <CircleCheck size={17} />
                                <p className='text-[14px] font-medium text-[#0A0A0A9E]'>12 fullførte</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobProvider;