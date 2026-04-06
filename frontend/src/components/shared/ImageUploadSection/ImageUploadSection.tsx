import { useRef } from "react";
import styles from "./ImageUploadSection.module.css";
import { Camera } from "lucide-react";

interface ImageItem {
  id: string;
  url: string;
  description: string;
}

interface ImageUploadSectionProps {
  images: ImageItem[];
  onImageRemove: (imageId: string) => void;
  onImageDescriptionChange: (imageId: string, description: string) => void;
  onAddImages: (files: File[]) => void;
}

export function ImageUploadSection({
  images,
  onImageRemove,
  onImageDescriptionChange,
  onAddImages,
}: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onAddImages(files);
    }
  };

  return (
    <div className={styles.container}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <div className={styles.imagesList}>
        {images.map((image) => (
          <div key={image.id} className={styles.imageItem}>
            <div className={styles.imageWrapper}>
              <img className={styles.image} src={image.url} alt="" />
            </div>
            <div className={styles.imageControls}>
              <div className={styles.deleteButton}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => onImageRemove(image.id)}
                  aria-label="Delete image"
                >
                  <svg
                    className={styles.deleteIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1.4 14.6914L0 13.2914L5.6 7.69141L0 2.09141L1.4 0.691406L7 6.29141L12.6 0.691406L14 2.09141L8.4 7.69141L14 13.2914L12.6 14.6914L7 9.09141L1.4 14.6914Z"
                      fill="black"
                      fillOpacity="0.43"
                    />
                  </svg>
                  <span className={styles.deleteText}>Slett</span>
                </button>
              </div>
              <div className={styles.textareaField}>
                <div className={styles.textarea}>
                  <textarea
                    className={styles.textareaInput}
                    placeholder="Bildebeskrivelse"
                    value={image.description}
                    onChange={(e) =>
                      onImageDescriptionChange(image.id, e.target.value)
                    }
                    rows={3}
                  />
                  <svg
                    className={styles.dragIcon}
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.02495 0.345703L0.855469 6.51519M7.4826 3.88808L4.39785 6.97282"
                      stroke="#B3B3B3"
                      strokeWidth="1"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 w-full">
        <button
          className={styles.addButton + " flex-1"}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={styles.addButtonContent}>
            <div className={styles.addButtonStateLayer}>
              <div className={styles.addButtonLabel}>Legg til bilder</div>
            </div>
          </div>
        </button>
        <button
          className={styles.addButton + " flex-1"}
          onClick={() => cameraInputRef.current?.click()}
        >
          <div className={styles.addButtonContent}>
            <div className={styles.addButtonStateLayer}>
              <div
                className={styles.addButtonLabel + " flex items-center gap-2"}
              >
                <Camera size={18} />
                Ta bilde
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
