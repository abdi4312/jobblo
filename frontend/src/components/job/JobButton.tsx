import React from 'react';
import { Button } from '../Ui/Button';
import { Heart, MessageCircle } from 'lucide-react';
import { TailSpin } from "react-loader-spinner";
import { useFavoriteToggle } from '../../features/favorites/hook/useFavoriteToggle';
import { useUserStore } from '../../stores/userStore';

interface JobButtonProps {
    handleSendMessage: () => void;
    handleFavoriteClick: () => void;
    isFavorited: boolean;
    isOwnJob: boolean;
    isMsgLoading: boolean; // Button action loading (spinner)
    id: string
}

const JobButton: React.FC<JobButtonProps> = ({
    id,
    handleSendMessage,
    isOwnJob,
    isMsgLoading
}
) => {
    const isAuth = useUserStore((state) => state.isAuthenticated);
    const { isFavorited, handleFavoriteClick, isLoading } = useFavoriteToggle(id, isAuth);

    return (
        <div className="mt-10">
            <div className='flex gap-4'>
                {/* Søk Button: isLoading par spinner dikhayega */}
                <Button
                    onClick={handleSendMessage}
                    disabled={isOwnJob || isLoading}
                    label={isMsgLoading ? '' : (isOwnJob ? "Din egen annonse" : "Søk på oppdraget")}
                    icon={isMsgLoading ? <TailSpin height={20} width={20} color="#ffffff" /> : <MessageCircle size={20} />}
                    className={`w-full text-[12px]! sm:text-[16px]! rounded-xl font-semibold! transition-all!
                        ${isOwnJob
                            ? 'bg-gray-300! text-gray-500! cursor-not-allowed!'
                            : 'bg-[#2F7E47]! text-white! hover:bg-transparent! hover:text-[#2F7E47]! hover:border hover:border-[#2F7E47]!'} 
                    `}
                />

                {/* Lagre Button */}
                <Button
                    onClick={handleFavoriteClick}
                    disabled={isLoading}
                    label={isFavorited ? 'Lagret' : 'Lagre'}
                    icon={<Heart size={20} fill={isFavorited ? "#ffff" : "transparent"} />}
                    className={`px-8 py-[11.5px] border rounded-xl text-[12px]! sm:text-[16px]! font-semibold! transition-all!
                        ${isFavorited
                            ? 'bg-[#F0B100]! border-[#F0B100]! text-white!'
                            : 'bg-transparent! text-[#2F7E47]! border-[#2F7E47]! hover:bg-[#2F7E47]! hover:text-white!'}
                    `}
                />
            </div>
        </div>
    );
};

export default JobButton;