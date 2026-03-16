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
        <div className="flex gap-3">
            {/* Søk / Apply Button */}
            <Button
                onClick={handleSendMessage}
                disabled={isOwnJob || isMsgLoading}
                label={isMsgLoading ? '' : (isOwnJob ? 'Din annonse' : 'Søk på oppdraget')}
                icon={isMsgLoading ? <TailSpin height={18} width={18} color="#ffffff" /> : <MessageCircle size={18} />}
                className={`flex-1 h-12 text-[14px]! rounded-xl font-semibold! transition-all! whitespace-nowrap
                    ${isOwnJob
                        ? 'bg-gray-100! text-gray-400! cursor-not-allowed!'
                        : 'bg-[#2F7E47]! text-white! hover:bg-[#266b3c]!'} 
                `}
            />

            {/* Lagre / Save Button */}
            <Button
                onClick={handleFavoriteClick}
                disabled={isLoading}
                label={isFavorited ? 'Lagret' : 'Lagre'}
                icon={<Heart size={18} fill={isFavorited ? 'currentColor' : 'none'} />}
                className={`h-12 px-5 border rounded-xl text-[14px]! font-semibold! transition-all! whitespace-nowrap
                    ${isFavorited
                        ? 'bg-[#F0B100]! border-[#F0B100]! text-white!'
                        : 'bg-transparent! text-[#2F7E47]! border-[#2F7E47]! hover:bg-[#2F7E47]! hover:text-white!'}
                `}
            />
        </div>
    );
};

export default JobButton;