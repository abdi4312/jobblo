import styles from './ProfilePictureSection.module.css';

interface ProfilePictureSectionProps {
  profileImageUrl?: string;
  onChangeImage?: () => void;
}

export function ProfilePictureSection({ 
  profileImageUrl = "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332",
  onChangeImage 
}: ProfilePictureSectionProps) {
  const handleChangeImage = () => {
    if (onChangeImage) {
      onChangeImage();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.profileImageContainer}>
        <img 
          className={styles.profileImage} 
          src={profileImageUrl} 
          alt="Profile picture" 
        />
      </div>
      <button 
        className={styles.changeImageButton} 
        onClick={handleChangeImage}
        aria-label="Change profile picture"
      >
        <span className={styles.changeImageText}>Endre bilde</span>
      </button>
    </div>
  );
}
