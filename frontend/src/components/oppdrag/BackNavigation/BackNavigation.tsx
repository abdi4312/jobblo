import React from 'react';
import styles from './BackNavigation.module.css';

const BackNavigation: React.FC = () => {
  const handleBackClick = () => {
    // Navigate back to profile page
    window.history.back();
  };

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={handleBackClick}>
        <svg 
          className={styles.backIcon} 
          width="24" 
          height="24" 
          viewBox="0 0 25 24" 
          fill="none"
        >
          <path 
            d="M11.4488 12L16.0488 16.6L14.6488 18L8.64883 12L14.6488 6L16.0488 7.4L11.4488 12Z" 
            fill="#303030"
          />
        </svg>
      </button>
      <span className={styles.backText}>Tilbake til Min Side</span>
    </div>
  );
};

export default BackNavigation;
