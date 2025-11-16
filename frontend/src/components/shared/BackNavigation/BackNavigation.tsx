import styles from './BackNavigation.module.css';

interface BackNavigationProps {
  text?: string;
  onBack?: () => void;
}

export function BackNavigation({ text = "Oppdrag", onBack }: BackNavigationProps) {
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
        <svg
          className={styles.backIcon}
          width="16"
          height="32"
          viewBox="0 0 16 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2.45677 16.9475L9.99943 24.4902L11.8848 22.6049L5.28477 16.0049L11.8848 9.40486L9.99943 7.51953L2.45677 15.0622C2.2068 15.3122 2.06638 15.6513 2.06638 16.0049C2.06638 16.3584 2.2068 16.6975 2.45677 16.9475Z"
            fill="black"
          />
        </svg>
      </button>
      <div className={styles.title}>
        <span>{text}</span>
      </div>
    </div>
  );
}
