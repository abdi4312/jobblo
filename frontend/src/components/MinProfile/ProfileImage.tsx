import { useRef, useState, useEffect } from "react";

interface ProfileImageProps {
    imageUrl?: string;
    name?: string;
    onImageChange?: (file: File) => void;
    isUploading?: boolean;
}

export const ProfileImage = ({ imageUrl, name, onImageChange, isUploading }: ProfileImageProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUploadClick = () => {
        if (selectedFile && onImageChange) {
            onImageChange(selectedFile);
        }
    };

    // Clean up preview URL on unmount or when image changes
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // Reset when upload completes or imageUrl updates from parent
    useEffect(() => {
        if (imageUrl) {
            setSelectedFile(null);
            setPreviewUrl(null);
        }
    }, [imageUrl]);

    const displayUrl = previewUrl || imageUrl;

    return (
        <div className="flex flex-col items-center gap-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
            
            {/* Image Container */}
            <div className="w-[100px] h-[100px] md:w-[128px] md:h-[128px] rounded-full overflow-hidden border-[5px] border-[#FFFFFF00] bg-white flex items-center justify-center shadow-lg relative group">
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-4xl text-[#2F7E47] font-bold">
                        {name ? name.charAt(0).toUpperCase() : "?"}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-2">
                {!selectedFile ? (
                    <button
                        onClick={handleButtonClick}
                        className="px-5 py-2 bg-transparent text-[#2F7E47] border-2 border-[#2F7E47] rounded-full text-sm font-semibold hover:bg-[#2F7E47] hover:text-white transition-all duration-200 active:scale-95 shadow-sm"
                    >
                        Endre bilde
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={handleUploadClick}
                            disabled={isUploading}
                            className="px-5 py-2 bg-[#2F7E47] text-white rounded-full text-sm font-semibold hover:bg-[#205a32] transition-all duration-200 active:scale-95 shadow-md flex items-center gap-2"
                        >
                            {isUploading ? "Laster opp..." : "Lagre bilde"}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-5 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-300 transition-all duration-200"
                        >
                            Avbryt
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};