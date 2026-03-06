import { Upload } from "lucide-react";
import React, { useState, useRef } from "react";

interface ImageUploadProps {
    onImagesChange: (files: File[]) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImagesChange }) => {
    const [previews, setPreviews] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const updatedFiles = [...selectedFiles, ...files];

        setSelectedFiles(updatedFiles);
        onImagesChange(updatedFiles);

        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setPreviews((prev) => [...prev, ...newPreviews]);
    };

    const removeImage = (index: number) => {
        const updatedFiles = selectedFiles.filter((_, i) => i !== index);
        const updatedPreviews = previews.filter((_, i) => i !== index);

        setSelectedFiles(updatedFiles);
        setPreviews(updatedPreviews);
        onImagesChange(updatedFiles);
    };

    return (
        <div className="w-full bg-[#FFFFFFB2]">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Upload Box */}
            <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 gap-2 text-[#99A1AF] border-[#D1D5DC] rounded-[14px] py-10 px-5 text-center cursor-pointer transition-all duration-300 ease-in-out hover:border-[#4CAF50] hover:bg-[#f0f9f0] group"
            >
                <p className=""><Upload size={24} /></p>
                <p className="text-[12px] font-medium">Last opp</p>
            </div>

            {/* Image Previews Grid */}
            {previews.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3 mt-4">
                    {previews.map((src, index) => (
                        <div
                            key={index}
                            className="relative pt-[100%] rounded-[8px] overflow-hidden border-2 border-[#e0e0e0] group"
                        >
                            <img
                                src={src}
                                alt="preview"
                                className="absolute top-0 left-0 w-full h-full object-cover"
                            />

                            {/* Delete Button */}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                className="absolute top-1 right-1 bg-red-600/70 hover:bg-red-600 text-white border-none rounded-full w-5 h-5 flex items-center justify-center text-[12px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};