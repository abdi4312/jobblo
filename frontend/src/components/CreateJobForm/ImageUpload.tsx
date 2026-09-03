import { Upload, Camera, Loader2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import React, { useState, useRef, useEffect } from 'react';
import { compressImages } from '../../utils/compressImage';

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void;
  existingImages?: string[];
  onExistingImageRemove?: (url: string) => void;
  initialFiles?: File[];
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImagesChange,
  existingImages = [],
  onExistingImageRemove,
  initialFiles = [],
}) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle initial files
  useEffect(() => {
    if (initialFiles.length > 0 && selectedFiles.length === 0) {
      const newPreviews = initialFiles.map((file) => URL.createObjectURL(file));
      setPreviews(newPreviews);
      setSelectedFiles(initialFiles);
    }
  }, [initialFiles]);

  /**
   * The server's own cap is 8 MB per file (backend/middleware/upload.js). Nothing should
   * ever reach it: photos are scaled down before this check, and a 1920px re-encode lands
   * a few hundred KB. This is the floor for the cases compression cannot help with — a
   * huge PNG screenshot, or a browser where the canvas path failed and the original came
   * back unchanged.
   */
  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const MAX_IMAGES = 6;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Let the same file be chosen again if it was rejected the first time.
    e.target.value = '';
    if (files.length === 0) return;

    const room = MAX_IMAGES - (selectedFiles.length + existingImages.length);
    if (room <= 0) {
      toast.error(`Du kan laste opp inntil ${MAX_IMAGES} bilder.`);
      return;
    }
    if (files.length > room) {
      toast.error(`Inntil ${MAX_IMAGES} bilder — de første ${room} ble lagt til.`);
    }

    setIsProcessing(true);
    try {
      // This used to reject anything over 2 MB with a toast. A photo straight off a phone
      // is 3–8 MB, so the common outcome was a person picking an ordinary picture and
      // being told no — the "entity too large" complaints started here. Scaling it down
      // first turns the same photo into something every limit in the stack accepts.
      const processed = await compressImages(files.slice(0, room));

      const validFiles: File[] = [];
      const rejected: string[] = [];
      for (const file of processed) {
        if (file.size > MAX_FILE_SIZE) rejected.push(file.name);
        else validFiles.push(file);
      }

      if (rejected.length > 0) {
        toast.error(`Disse filene er for store og ble ikke lagt til: ${rejected.join(', ')}`);
      }
      if (validFiles.length === 0) return;

      const updatedFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(updatedFiles);
      onImagesChange(updatedFiles);

      const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);
    } finally {
      setIsProcessing(false);
    }
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Box */}
      <div className="flex gap-4">
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          aria-busy={isProcessing}
          className={`flex-1 flex flex-col items-center justify-center border-2 gap-2 text-[#99A1AF] border-[#D1D5DC] rounded-[14px] py-10 px-5 text-center transition-all duration-300 ease-in-out group ${
            isProcessing ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-[#4CAF50] hover:bg-[#f0f9f0]'
          }`}
        >
          <p className="">
            {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
          </p>
          <p className="text-[12px] font-medium">{isProcessing ? 'Behandler…' : 'Last opp'}</p>
          {/* Was "Maks 2 MB per bilde" — a rule that rejected almost every phone photo.
              Large pictures are scaled down automatically now, so there is nothing for the
              person to do about size and nothing to warn them about. */}
          <p className="text-[10px] text-gray-400">Inntil 6 bilder · store bilder komprimeres</p>
        </div>
        <div
          onClick={() => !isProcessing && cameraInputRef.current?.click()}
          aria-busy={isProcessing}
          className={`flex-1 flex flex-col items-center justify-center border-2 gap-2 text-[#99A1AF] border-[#D1D5DC] rounded-[14px] py-10 px-5 text-center transition-all duration-300 ease-in-out group ${
            isProcessing ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-[#4CAF50] hover:bg-[#f0f9f0]'
          }`}
        >
          <p className="">
            <Camera size={24} />
          </p>
          <p className="text-[12px] font-medium">Ta bilde</p>
        </div>
      </div>

      {/* Image Previews Grid */}
      {(existingImages.length > 0 || previews.length > 0) && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3 mt-4">
          {/* Existing Images */}
          {existingImages.map((url, index) => (
            <div
              key={`existing-${index}`}
              className="relative pt-[100%] rounded-[8px] overflow-hidden border-2 border-[#4CAF50] group"
            >
              <img
                src={url}
                alt="existing"
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExistingImageRemove?.(url);
                }}
                aria-label="Slett bilde"
                className="absolute top-1 right-1 z-10 bg-red-600/90 hover:bg-red-600 text-white border-none rounded-full w-7 h-7 flex items-center justify-center cursor-pointer shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] py-0.5 text-center">
                Eksisterende
              </div>
            </div>
          ))}

          {/* New Previews */}
          {previews.map((src, index) => (
            <div
              key={`new-${index}`}
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
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                aria-label="Slett bilde"
                className="absolute top-1 right-1 z-10 bg-red-600/90 hover:bg-red-600 text-white border-none rounded-full w-7 h-7 flex items-center justify-center cursor-pointer shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
