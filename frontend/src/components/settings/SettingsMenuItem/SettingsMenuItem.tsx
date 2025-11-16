import styles from './SettingsMenuItem.module.css';

interface SettingsMenuItemProps {
  icon: React.ReactNode;
  text: string;
  showDivider?: boolean;
  onClick?: () => void;
}

export function SettingsMenuItem({ icon, text, showDivider = true, onClick }: SettingsMenuItemProps) {
  return (
    <div className={styles.container}>
      <div className={styles.itemContent} onClick={onClick}>
        <div className={styles.leftSection}>
          <div className={styles.iconContainer}>
            {icon}
          </div>
          <div className={styles.text}>{text}</div>
        </div>
        <div className={styles.arrowContainer}>
          <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5512 12L8.95117 7.4L10.3512 6L16.3512 12L10.3512 18L8.95117 16.6L13.5512 12Z" fill="#303030"/>
          </svg>
        </div>
      </div>
      {showDivider && (
        <div className={styles.divider}>
          <svg width="326" height="2" viewBox="0 0 326 2" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M305 1H29" stroke="black" strokeOpacity="0.36"/>
          </svg>
        </div>
      )}
    </div>
  );
}
