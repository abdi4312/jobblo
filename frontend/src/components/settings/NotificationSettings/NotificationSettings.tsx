import { useState } from 'react';
import styles from './NotificationSettings.module.css';
import { NotificationOption } from '../NotificationOption/NotificationOption';
import BellIcon from '../../../assets/icons/bell.svg?react';

interface NotificationState {
  push: boolean;
  sms: boolean;
  email: boolean;
}

interface NotificationData {
  newMessage: NotificationState;
  marketing: NotificationState;
  reminders: NotificationState;
}

export function NotificationSettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData>({
    newMessage: { push: true, sms: false, email: true },
    marketing: { push: false, sms: false, email: false },
    reminders: { push: true, sms: false, email: false }
  });

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleNotificationChange = (
    category: keyof NotificationData,
    type: keyof NotificationState,
    enabled: boolean
  ) => {
    setNotifications(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: enabled
      }
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection} onClick={handleToggleExpanded}>
        <div className={styles.leftSection}>
          <div className={styles.iconContainer}>
            <BellIcon />
          </div>
          <div className={styles.text}>Varsler</div>
        </div>
        <div className={styles.arrowContainer}>
          <svg 
            width="25" 
            height="24" 
            viewBox="0 0 25 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={isExpanded ? styles.arrowExpanded : styles.arrowCollapsed}
          >
            <path d="M12.9512 12.6L17.5512 8L18.9512 9.4L12.9512 15.4L6.95117 9.4L8.35117 8L12.9512 12.6Z" fill="#303030"/>
          </svg>
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles.expandedContent}>
          <NotificationOption
            title="Ny melding"
            notifications={notifications.newMessage}
            onChange={(type, enabled) => handleNotificationChange('newMessage', type, enabled)}
          />
          <NotificationOption
            title="Markedsføring"
            notifications={notifications.marketing}
            onChange={(type, enabled) => handleNotificationChange('marketing', type, enabled)}
          />
          <NotificationOption
            title="Påminnelser"
            notifications={notifications.reminders}
            onChange={(type, enabled) => handleNotificationChange('reminders', type, enabled)}
          />
        </div>
      )}
    </div>
  );
}
