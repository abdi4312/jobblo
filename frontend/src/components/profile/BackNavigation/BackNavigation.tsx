import styles from './BackNavigation.module.css';
import ArrowLeftIcon from '../../../assets/icons/arrowLeft.svg?react';

interface BackNavigationProps {
  onBack?: () => void;
  text?: string;
}

export function BackNavigation({ onBack, text = "Tilbake til Min Side" }: BackNavigationProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={handleBack} aria-label="Go back">
        <ArrowLeftIcon className={styles.icon} />
      </button>
      <span className={styles.text}>{text}</span>
    </div>
  );
}
