import React from 'react';
import { BackNavigation, PageHeader, JobGrid } from '../components/oppdrag';
import styles from './MineOppdragPage.module.css';

const MineOppdragPage: React.FC = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <BackNavigation />
        <PageHeader />
        <JobGrid />
      </div>
    </div>
  );
};

export default MineOppdragPage;
