import styles from "./ProfileMenuItem.module.css";

interface ProfileMenuItemProps {
  icon: React.ReactNode;
  text: string;
  showDivider?: boolean;
  onClick?: () => void;
}

export function ProfileMenuItem({ icon, text, showDivider = true, onClick }: ProfileMenuItemProps) {
  return (
    <div className={styles.container}>
      <div className={styles.itemContent} onClick={onClick}>
        <div className={styles.leftSection}>
          <div className={styles.iconContainer}>
            {icon}
          </div>
          <div className={styles.text}>{text}</div>
        </div>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-accent)', fontSize: 24 }}>
          chevron_right
        </span>
      </div>
    </div>
  );
}
