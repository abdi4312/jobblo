import React from 'react';
import styles from './JobDescription.module.css';

const JobDescription: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.priceSection}>
        <h3 className={styles.priceLabel}>Lønn</h3>
        <div className={styles.priceValue}>600 kroner</div>
      </div>
      
      <div className={styles.divider}></div>
      
      <div className={styles.descriptionSection}>
        <h3 className={styles.descriptionLabel}>Beskrivelse</h3>
        <p className={styles.descriptionText}>
          Jeg trenger en som kan klippe plen i bakgården vår. Hagen er ca. 30kvm. Jeg trenger en som kan sage ned et tre som har
          vært i veien for oss. Treet er ca 7 meter høy og 
          er ca 1 i diameter.
        </p>
      </div>
      
      <div className={styles.divider}></div>
    </div>
  );
};

export default JobDescription;
