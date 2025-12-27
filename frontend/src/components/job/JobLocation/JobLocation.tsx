import React from 'react';
import styles from './JobLocation.module.css';

interface JobLocationProps {
  location?: {
    address?: string;
    city?: string;
  };
}

const JobLocation: React.FC<JobLocationProps> = ({ location }) => {
  const getLocationText = () => {
    if (location?.address && location?.city) {
      return `${location.address}, ${location.city}`;
    } else if (location?.city) {
      return location.city;
    } else if (location?.address) {
      return location.address;
    }
    return 'Ingen adresse spesifisert';
  };

  return (
    <div className={styles.container}>
      <div className={styles.locationItem}>
        <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 21L9 18.9L4.35 20.7C4.01667 20.8333 3.70833 20.796 3.425 20.588C3.14167 20.38 3 20.1007 3 19.75V5.75C3 5.53333 3.06267 5.34167 3.188 5.175C3.31333 5.00833 3.484 4.88333 3.7 4.8L9 3L15 5.1L19.65 3.3C19.9833 3.16667 20.2917 3.20433 20.575 3.413C20.8583 3.62167 21 3.90067 21 4.25V18.25C21 18.4667 20.9377 18.6583 20.813 18.825C20.6883 18.9917 20.5173 19.1167 20.3 19.2L15 21ZM14 18.55V6.85L10 5.45V17.15L14 18.55ZM16 18.55L19 17.55V5.7L16 6.85V18.55ZM5 18.3L8 17.15V5.45L5 6.45V18.3Z" fill="var(--color-blue)"/>
        </svg>
        <span className={styles.locationText}>{getLocationText()}</span>
      </div>
      
      <div className={styles.shareItem}>
        <svg className={styles.icon} width="23" height="23" viewBox="0 0 23 23" fill="none">
          <path d="M13.4167 2.875H20.125V9.58333M20.125 14.123V18.6875C20.125 19.0687 19.9735 19.4344 19.704 19.704C19.4344 19.9735 19.0687 20.125 18.6875 20.125H4.3125C3.93125 20.125 3.56562 19.9735 3.29603 19.704C3.02645 19.4344 2.875 19.0687 2.875 18.6875V4.3125C2.875 3.93125 3.02645 3.56562 3.29603 3.29603C3.56562 3.02645 3.93125 2.875 4.3125 2.875H8.625M12.3625 10.6375L19.6937 3.30625" stroke="var(--color-text-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className={styles.shareText}>Del annonsen</span>
      </div>
      
      <div className={styles.divider}></div>
    </div>
  );
};

export default JobLocation;
