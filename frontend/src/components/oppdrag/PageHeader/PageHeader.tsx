import React from 'react';
import styles from './PageHeader.module.css';

const PageHeader: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>Mine Oppdrag</h1>
      </div>
      <div className={styles.divider}></div>
    </div>
  );
};

export default PageHeader;
