import styles from './NotificationOption.module.css';
import { NotificationToggle } from '../NotificationToggle/NotificationToggle';

interface NotificationState {
  push: boolean;
  sms: boolean;
  email: boolean;
}

interface NotificationOptionProps {
  title: string;
  notifications: NotificationState;
  onChange: (type: keyof NotificationState, enabled: boolean) => void;
}

export function NotificationOption({ title, notifications, onChange }: NotificationOptionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.togglesSection}>
        <NotificationToggle
          label="Push"
          enabled={notifications.push}
          onChange={(enabled) => onChange('push', enabled)}
        />
        <NotificationToggle
          label="SMS"
          enabled={notifications.sms}
          onChange={(enabled) => onChange('sms', enabled)}
        />
        <NotificationToggle
          label="Epost"
          enabled={notifications.email}
          onChange={(enabled) => onChange('email', enabled)}
        />
      </div>
    </div>
  );
}
