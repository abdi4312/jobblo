import React from 'react';
import { Button } from '../Ui/Button';
import { Heart, MessageCircle } from 'lucide-react';
import { TailSpin } from "react-loader-spinner";

interface JobButtonProps {
    handleSendMessage: () => void;
    handleFavoriteClick: () => void;
    isFavorited: boolean;
    isOwnJob: boolean;
    isLoading: boolean; // Button action loading (spinner)
    loading?: boolean;   // Page/Data initial loading (skeleton)
}

const JobButton: React.FC<JobButtonProps> = ({
    handleSendMessage,
    handleFavoriteClick,
    isFavorited,
    isOwnJob,
    isLoading,
    loading
}) => {

    // Agar pure page ka loading true hai, toh skeleton buttons dikhao
    if (loading) {
        return (
            <div className="mt-10 flex gap-4 animate-pulse">
                <div className="w-full h-[50px] bg-gray-200 rounded-xl"></div>
                <div className="w-32 h-[50px] bg-gray-200 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="mt-10">
            <div className='flex gap-4'>
                {/* Søk Button: isLoading par spinner dikhayega */}
                <Button
                    onClick={handleSendMessage}
                    disabled={isOwnJob || isLoading}
                    label={isLoading ? '' : (isOwnJob ? "Din egen annonse" : "Søk på oppdraget")}
                    icon={isLoading ? <TailSpin height={20} width={20} color="#ffffff" /> : <MessageCircle size={20} />}
                    className={`w-full text-[16px]! rounded-xl font-semibold! transition-all!
                        ${isOwnJob
                            ? 'bg-gray-300! text-gray-500! cursor-not-allowed!'
                            : 'bg-[#2F7E47]! text-white! hover:bg-transparent! hover:text-[#2F7E47]! hover:border hover:border-[#2F7E47]!'} 
                    `}
                />

                {/* Lagre Button */}
                <Button
                    onClick={handleFavoriteClick}
                    label={isFavorited ? 'Lagret' : 'Lagre'}
                    icon={<Heart size={20} fill={isFavorited ? "#ffff" : "transparent"} />}
                    className={`px-8 py-[11.5px] border rounded-xl text-[16px]! font-semibold! transition-all!
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