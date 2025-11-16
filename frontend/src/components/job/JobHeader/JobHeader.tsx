import React from 'react';
import styles from './JobHeader.module.css';

const JobHeader: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.topSection}></div>
      <div className={styles.headerSection}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/2c213166c1012e0d151a24cbe2c41708a8e525ac?width=81" 
              alt="Kari Henriksen" 
              className={styles.avatarImage}
            />
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>Kari Henriksen</div>
            <div className={styles.userLocation}>
              <img 
                src="https://api.builder.io/api/v1/image/assets/TEMP/927f9e994cd2e9bd65f4a586488cd0d39310d01a?width=24" 
                alt="" 
                className={styles.locationIcon}
              />
              <span className={styles.locationText}>Kariksen</span>
            </div>
          </div>
          <div className={styles.ratingBadge}>
            <svg className={styles.starIcon} width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.54196 3.49612L5.60917 0.448623C5.42515 -0.149541 4.57485 -0.149541 4.39718 0.448623L3.45804 3.49612H0.634295C0.018781 3.49612 -0.235039 4.28317 0.266256 4.63578L2.57602 6.27286L1.66861 9.17553C1.48459 9.7611 2.16991 10.2333 2.65851 9.86185L5 8.09883L7.34149 9.86814C7.83009 10.2396 8.51541 9.7674 8.33139 9.18183L7.42398 6.27915L9.73374 4.64207C10.235 4.28317 9.98122 3.50241 9.36571 3.50241H6.54196V3.49612Z" fill="var(--color-cta)"/>
            </svg>
            <span className={styles.rating}>4.5</span>
          </div>
        </div>
        <div className={styles.reportButton}>
          <svg className={styles.reportIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 16.423C12.1747 16.423 12.321 16.364 12.439 16.246C12.5563 16.128 12.615 15.982 12.615 15.808C12.615 15.634 12.556 15.4877 12.438 15.369C12.32 15.2503 12.174 15.1913 12 15.192C11.826 15.1927 11.68 15.2517 11.562 15.369C11.444 15.4863 11.385 15.6327 11.385 15.808C11.385 15.9833 11.444 16.1293 11.562 16.246C11.68 16.3627 11.826 16.4217 12 16.423ZM11.5 13.462H12.5V7.384H11.5V13.462ZM8.673 20L4 15.336V8.673L8.664 4H15.327L20 8.664V15.327L15.336 20H8.673ZM9.1 19H14.9L19 14.9V9.1L14.9 5H9.1L5 9.1V14.9L9.1 19Z" fill="#183A1D"/>
          </svg>
          <span className={styles.reportText}>Rapporter</span>
        </div>
      </div>
    </div>
  );
};

export default JobHeader;
