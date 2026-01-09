import { useState, useRef } from "react";

interface ImageUploadProps {
  onImagesChange?: (images: File[]) => void;
}

export default function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newImages = [...selectedImages, ...files];
      setSelectedImages(newImages);

      // Create preview URLs for the new images
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

      // Notify parent component
      if (onImagesChange) {
        onImagesChange(newImages);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));

    // Notify parent component
    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />
      
      <button
        type="button"
        onClick={handleButtonClick}
        style={{
          marginBottom: '16px',
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px dashed var(--color-icon)",
          backgroundColor: "white",
          cursor: "pointer",
          fontSize: "14px",
          color: "var(--color-text)",
        }}
      >
          + Legg til bilder  
      </button>

      {/* Image previews */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '16px',
      }}>
        {imagePreviews.map((preview, index) => (
          <div key={index} style={{ position: 'relative' }}>
            <img
              src={preview}
              alt={`Preview ${index + 1}`}
              style={{
                width: '100%',
                height: '150px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: "1px solid var(--color-icon)",
              }}
            />
            <button
              onClick={() => handleRemoveImage(index)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
