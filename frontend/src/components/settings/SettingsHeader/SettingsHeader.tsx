import styles from './SettingsHeader.module.css';

interface SettingsHeaderProps {
  title: string;
}

export function SettingsHeader({ title }: SettingsHeaderProps) {
  return (
    <div className={styles.container}>
      <div className={styles.headerContent}>
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.divider}>
          <svg width="390" height="2" viewBox="0 0 390 2" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 1H391" stroke="#83A790"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
