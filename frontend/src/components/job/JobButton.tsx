import React, { useState } from 'react';
import { Button } from '../Ui/Button';
import { Heart, MessageCircle } from 'lucide-react';
import { TailSpin } from "react-loader-spinner";
import { useUserStore } from '../../stores/userStore';
import AddToListModal from '../Explore/jobs/AddToListModal';
import { useNavigate } from 'react-router-dom';
import { useFavoriteLists } from '../../features/favoriteLists/hooks';
import type { Jobs } from '../../types/Jobs';

interface JobButtonProps {
    handleSendMessage: () => void;
    handleFavoriteClick?: () => void; // Optional now
    isFavorited?: boolean; // Optional now
    isOwnJob: boolean;
    isMsgLoading: boolean; // Button action loading (spinner)
    id: string;
    job?: Jobs; // Added job prop to pass to modal
}

const JobButton: React.FC<JobButtonProps> = ({
    id,
    handleSendMessage,
    isOwnJob,
    isMsgLoading,
    job
}
) => {
    const isAuth = useUserStore((state) => state.isAuthenticated);
    const navigate = useNavigate();
    const { data: lists = [], isLoading } = useFavoriteLists();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Check if job is in ANY of the user's lists
    const isInAnyList = lists.some((list) =>
        list.services?.some((s) => (typeof s === 'string' ? s === id : s._id === id))
    );

    const handleHeartClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAuth) {
            navigate("/login");
            return;
        }
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col gap-3">
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
                    onClick={handleHeartClick}
                    disabled={isLoading}
                    label={isInAnyList ? 'Lagret' : 'Lagre'}
                    icon={<Heart size={18} fill={isInAnyList ? 'currentColor' : 'none'} />}
                    className={`h-12 px-5 border rounded-xl text-[14px]! font-semibold! transition-all! whitespace-nowrap
                        ${isInAnyList
                            ? 'bg-[#F0B100]! border-[#F0B100]! text-white!'
                            : 'bg-transparent! text-[#2F7E47]! border-[#2F7E47]! hover:bg-[#2F7E47]! hover:text-white!'}
                    `}
                />
            </div>

            {job && (
                <AddToListModal
                    job={job}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default JobButton;