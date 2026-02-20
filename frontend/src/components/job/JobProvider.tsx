import { CircleCheck, Star } from 'lucide-react';
import React from 'react';

interface JobProviderProps {
    job?: {
        price?: number; // Price field interface mein honi chahiye
        title: string;
        createdAt: string;
        location?: {
            city: string;
        };
        userId?: {
            avatarUrl: string;
            name: string;
            verified: boolean;
            averageRating: number;
        };
        categories?: string[];
        equipment?: string;
    } | null;
    loading?: boolean; // Added loading prop
}

const JobProvider: React.FC<JobProviderProps> = ({ job, loading }) => {
    return (
        <div className="">
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>

                {/* Lønn (Salary/Price) Section */}
                <div className='flex flex-col max-w-82 max-h-33.75 text-[#0A0A0A] gap-2 rounded-[14px] bg-amber-100 p-6'>
                    <p className='text-base font-medium'>Lønn</p>
                    {loading ? (
                        <div className="h-10 bg-black/10 animate-pulse rounded w-32 self-end"></div>
                    ) : (
                        <p className='text-[36px] font-bold text-end'>
                            {job?.price ? `${job.price.toLocaleString('nb-NO')} kr` : '2.500 kr'}
                        </p>
                    )}
                </div>

                {/* Oppdragsgiver (Provider) Section */}
                <div className='flex flex-col max-w-82 max-h-33.75 gap-2 rounded-[14px] bg-[linear-gradient(111.15deg,#2BFF00_-59.46%,#A9FF98_100%)] p-6'>
                    <p className='text-base font-bold text-[#0A0A0A]'>Om oppdragsgiveren</p>

                    <div className='flex gap-3 items-center'>
                        {/* Avatar */}
                        <div className={`size-14 shadow-[0px_0px_0px_3px_#FFFFFF] rounded-full overflow-hidden ${loading ? 'bg-white/50 animate-pulse' : ''}`}>
                            {!loading && (
                                <img src={job?.userId?.avatarUrl || ''} className='size-full object-cover' alt="" />
                            )}
                        </div>

                        <div className="flex-1">
                            {loading ? (
                                <div className="space-y-2">
                                    <div className="h-5 bg-black/10 animate-pulse rounded w-24"></div>
                                    <div className="h-4 bg-black/10 animate-pulse rounded w-32"></div>
                                </div>
                            ) : (
                                <>
                                    <div className='flex items-center gap-2'>
                                        <h2 className='text-[18px] font-bold'>{job?.userId?.name || 'Navn'}</h2>
                                        <p className='text-white text-[12px] py-0.75 px-3 font-medium bg-[#00000099] rounded-[35px]'>
                                            <span>{job?.userId?.verified ? 'Verified' : 'Not Verified'}</span>
                                        </p>
                                    </div>

                                    <div className='flex gap-4'>
                                        <p className='flex items-center'>
                                            <span className='text-[#F0B100]'><Star size={17} fill='#F0B100' /></span>
                                            <span className='text-[16px] font-bold'>{job?.userId?.averageRating || 0}</span>
                                        </p>

                                        <div className='flex items-center gap-1'>
                                            <span><CircleCheck size={17} /></span>
                                            <p className='text-[14px] font-medium text-[#0A0A0A9E]'>12 fullførte oppdrag</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default JobProvider;