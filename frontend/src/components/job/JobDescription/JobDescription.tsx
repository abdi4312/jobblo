import React from 'react';
import styles from './JobDescription.module.css';

interface JobDescriptionProps {
  description?: string;
  price?: number;
  urgent?: boolean;
}

const JobDescription: React.FC<JobDescriptionProps> = ({ description, price, urgent }) => {
  return (
    <div className={styles.container}>
      <div className={styles.priceSection}>
        <h3 className={styles.priceLabel}>Lønn</h3>
        <div className={styles.priceValue}>{price ? `${price} kroner` : 'Ikke spesifisert'}</div>
      </div>
      
      <div className={styles.divider}></div>
      
      <div className={styles.descriptionSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className={styles.descriptionLabel} style={{ margin: 0 }}>Beskrivelse</h3>
          {urgent && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '16px',
              backgroundColor: '#FFEBEE',
              color: '#C62828',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              <span style={{ fontSize: '14px' }}>⚡</span>
              Haster
            </div>
          )}
        </div>
        <p className={styles.descriptionText}>
          {description || 'Ingen beskrivelse tilgjengelig'}
        </p>
      </div>
      
      <div className={styles.divider}></div>
    </div>
  );
};

export default JobDescription;
