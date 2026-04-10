import { useState } from "react";
import styles from "./NotificationSettings.module.css";
import { NotificationManager } from "../NotificationManager/NotificationManager";
import BellIcon from "../../../assets/icons/bell.svg?react";

export function NotificationSettings() {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection} onClick={handleToggleExpanded}>
        <div className={styles.leftSection}>
          <div className={styles.iconContainer}>
            <BellIcon />
          </div>
          <div className={styles.text}>Varslingsinnstillinger</div>
        </div>
        <div className={styles.arrowContainer}>
          <svg
            width="25"
            height="24"
            viewBox="0 0 25 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={
              isExpanded ? styles.arrowExpanded : styles.arrowCollapsed
            }
          >
            <path
              d="M12.9512 12.6L17.5512 8L18.9512 9.4L12.9512 15.4L6.95117 9.4L8.35117 8L12.9512 12.6Z"
              fill="#303030"
            />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.expandedContent}>
          <NotificationManager />
        </div>
      )}
    </div>
  );
}
