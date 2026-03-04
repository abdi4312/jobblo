import { CircleCheck, Star, TrendingUp } from 'lucide-react';
import React from 'react';

// 1. User ki shape define karein
interface UserProps {
    averageRating?: number;
}

// 2. Component ke Props ki type define karein
interface ProfileCardProps {
    user: UserProps;
    activeJobs: number;
    completedJobs: number;
}

// 3. Functional Component (FC) use karein
const ProfileCard: React.FC<ProfileCardProps> = ({ user, activeJobs, completedJobs }) => {
    return (
        <>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 my-12.25'>
                <div className='flex flex-col bg-[#FFFFFF1A] shadow-md py-5.25 rounded-[14px] px-6 gap-2.5'>
                    <div className='flex items-center text-[#2F7E47] gap-2'>
                        <span><CircleCheck size={18} /></span>
                        <p className='text-[14px] font-medium leading-5'>Fullført</p>
                    </div>
                    <div className='text-end text-[16px] font-bold leading-9'>{completedJobs}</div>
                </div>

                <div className='flex flex-col bg-[#FFFFFF1A] shadow-md py-5.25 rounded-[14px] px-6 gap-2.5'>
                    <div className='flex items-center text-[#2F7E47] gap-2'>
                        <span><TrendingUp size={18} /></span>
                        <p className='text-[14px] font-medium leading-5'>Aktive</p>
                    </div>
                    <div className='text-end text-[16px] font-bold leading-9'>{activeJobs}</div>
                </div>

                <div className='flex flex-col bg-[#FFFFFF1A] shadow-md py-5.25 rounded-[14px] px-6 gap-2.5'>
                    <div className='flex items-center text-[#2F7E47] gap-2'>
                        <span><Star size={18} fill='#2F7E47' /></span>
                        <p className='text-[14px] font-medium leading-5'>Rating</p>
                    </div>
                    <div className='text-end text-[16px] font-bold leading-9'>{user?.averageRating ? user.averageRating.toFixed(1) : '0.0'}</div>
                </div>

            </div>
        </>
    );
};

export default ProfileCard;