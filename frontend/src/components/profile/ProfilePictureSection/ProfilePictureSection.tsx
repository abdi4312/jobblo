import styles from './ProfilePictureSection.module.css';
import { DEFAULT_AVATAR } from '../../../constants/assets';

interface ProfilePictureSectionProps {
  profileImageUrl?: string;
  onChangeImage?: () => void;
}

export function ProfilePictureSection({
  profileImageUrl = DEFAULT_AVATAR,
  onChangeImage,
}: ProfilePictureSectionProps) {
  const handleChangeImage = () => {
    if (onChangeImage) {
      onChangeImage();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.profileImageContainer}>
        <img className={styles.profileImage} src={profileImageUrl} alt="Profile picture" />
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
