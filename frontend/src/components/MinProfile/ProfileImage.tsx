interface ProfileImageProps {
    imageUrl?: string;
    name?: string;
    onImageChange?: () => void;
}

export const ProfileImage = ({ imageUrl, name, onImageChange }: ProfileImageProps) => {
    return (
        <div className="flex flex-col items-center gap-4">
            {/* Image Container */}
            <div className="w-[100px] h-[100px] md:w-[128px] md:h-[128px] rounded-full overflow-hidden border-[5px] border-[#FFFFFF00] bg-white flex items-center justify-center shadow-lg relative group">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-4xl text-[#2F7E47] font-bold">
                        {name ? name.charAt(0).toUpperCase() : "?"}
                    </span>
                )}
            </div>

            {/* Change Button */}
            <button
                onClick={onImageChange}
                className="px-5 py-2 bg-transparent text-[#2F7E47] border-2 border-[#2F7E47] rounded-full text-sm font-semibold hover:bg-[#2F7E47] hover:text-white transition-all duration-200 active:scale-95 shadow-sm"
            >
                Endre bilde
            </button>
        </div>
    );
};