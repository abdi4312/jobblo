import React from 'react';
import styles from './JobDetails.module.css';

interface JobDetailsProps {
  job?: {
    title: string;
    createdAt: string;
    duration?: {
      value: number;
      unit: string;
    };
    categories?: string[];
    equipment?: string;
  } | null;
}

const equipmentLabels: Record<string, string> = {
  'utstyrfri': 'Trenger ikke utstyr',
  'delvis utstyr': 'Delvis utstyr',
  'trengs utstyr': 'Trengs utstyr'
};

const unitLabels: Record<string, string> = {
  'timer': 'timer',
  'minutter': 'minutter',
  'dager': 'dager'
};

const JobDetails: React.FC<JobDetailsProps> = ({ job }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDurationText = () => {
    if (!job?.duration) return 'Ikke spesifisert';
    return `${job.duration.value} ${unitLabels[job.duration.unit] || job.duration.unit}`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.jobTitle}>{job?.title || 'Ingen tittel'}</h1>
      
      <div className={styles.detailsGrid}>
        <div className={styles.detailItem}>
          <svg className={styles.icon} width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M9.20768 15.1673C9.56683 15.1673 9.91127 15.0246 10.1652 14.7707C10.4192 14.5167 10.5618 14.1723 10.5618 13.8132C10.5618 13.454 10.4192 13.1096 10.1652 12.8556C9.91127 12.6017 9.56683 12.459 9.20768 12.459C8.84853 12.459 8.5041 12.6017 8.25014 12.8556C7.99619 13.1096 7.85352 13.454 7.85352 13.8132C7.85352 14.1723 7.99619 14.5167 8.25014 14.7707C8.5041 15.0246 8.84853 15.1673 9.20768 15.1673ZM9.20768 18.959C9.56683 18.959 9.91127 18.8163 10.1652 18.5624C10.4192 18.3084 10.5618 17.964 10.5618 17.6048C10.5618 17.2457 10.4192 16.9012 10.1652 16.6473C9.91127 16.3933 9.56683 16.2507 9.20768 16.2507C8.84853 16.2507 8.5041 16.3933 8.25014 16.6473C7.99619 16.9012 7.85352 17.2457 7.85352 17.6048C7.85352 17.964 7.99619 18.3084 8.25014 18.5624C8.5041 18.8163 8.84853 18.959 9.20768 18.959ZM14.3535 13.8132C14.3535 14.1723 14.2108 14.5167 13.9569 14.7707C13.7029 15.0246 13.3585 15.1673 12.9993 15.1673C12.6402 15.1673 12.2958 15.0246 12.0418 14.7707C11.7879 14.5167 11.6452 14.1723 11.6452 13.8132C11.6452 13.454 11.7879 13.1096 12.0418 12.8556C12.2958 12.6017 12.6402 12.459 12.9993 12.459C13.3585 12.459 13.7029 12.6017 13.9569 12.8556C14.2108 13.1096 14.3535 13.454 14.3535 13.8132ZM12.9993 18.959C13.3585 18.959 13.7029 18.8163 13.9569 18.5624C14.2108 18.3084 14.3535 17.964 14.3535 17.6048C14.3535 17.2457 14.2108 16.9012 13.9569 16.6473C13.7029 16.3933 13.3585 16.2507 12.9993 16.2507C12.6402 16.2507 12.2958 16.3933 12.0418 16.6473C11.7879 16.9012 11.6452 17.2457 11.6452 17.6048C11.6452 17.964 11.7879 18.3084 12.0418 18.5624C12.2958 18.8163 12.6402 18.959 12.9993 18.959ZM18.1452 13.8132C18.1452 14.1723 18.0025 14.5167 17.7486 14.7707C17.4946 15.0246 17.1502 15.1673 16.791 15.1673C16.4319 15.1673 16.0874 15.0246 15.8335 14.7707C15.5795 14.5167 15.4368 14.1723 15.4368 13.8132C15.4368 13.454 15.5795 13.1096 15.8335 12.8556C16.0874 12.6017 16.4319 12.459 16.791 12.459C17.1502 12.459 17.4946 12.6017 17.7486 12.8556C18.0025 13.1096 18.1452 13.454 18.1452 13.8132Z" fill="var(--color-accent)"/>
          </svg>
          <span className={styles.detailText}>{job?.createdAt ? formatDate(job.createdAt) : 'Ikke spesifisert'}</span>
        </div>
        
        <div className={styles.detailItem}>
          <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM12 4C9.87827 4 7.84344 4.84285 6.34315 6.34315C4.84285 7.84344 4 9.87827 4 12C4 14.1217 4.84285 16.1566 6.34315 17.6569C7.84344 19.1571 9.87827 20 12 20C14.1217 20 16.1566 19.1571 17.6569 17.6569C19.1571 16.1566 20 14.1217 20 12C20 9.87827 19.1571 7.84344 17.6569 6.34315C16.1566 4.84285 14.1217 4 12 4ZM12 6C12.2449 6.00003 12.4813 6.08996 12.6644 6.25272C12.8474 6.41547 12.9643 6.63975 12.993 6.883L13 7V11.586L15.707 14.293C15.8863 14.473 15.9905 14.7144 15.9982 14.9684C16.006 15.2223 15.9168 15.4697 15.7488 15.6603C15.5807 15.8508 15.3464 15.9703 15.0935 15.9944C14.8406 16.0185 14.588 15.9454 14.387 15.79L14.293 15.707L11.293 12.707C11.1376 12.5514 11.0378 12.349 11.009 12.131L11 12V7C11 6.73478 11.1054 6.48043 11.2929 6.29289C11.4804 6.10536 11.7348 6 12 6Z" fill="#183A1D"/>
          </svg>
          <span className={styles.detailText}>{getDurationText()}</span>
        </div>
        
        <div className={styles.detailItem}>
          <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M17 10C18.6569 10 20 8.65685 20 7C20 5.34315 18.6569 4 17 4C15.3431 4 14 5.34315 14 7C14 8.65685 15.3431 10 17 10Z" stroke="#183A1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 20C8.65685 20 10 18.6569 10 17C10 15.3431 8.65685 14 7 14C5.34315 14 4 15.3431 4 17C4 18.6569 5.34315 20 7 20Z" stroke="#183A1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 14H20V19C20 19.2652 19.8946 19.5196 19.7071 19.7071C19.5196 19.8946 19.2652 20 19 20H15C14.7348 20 14.4804 19.8946 14.2929 19.7071C14.1054 19.5196 14 19.2652 14 19V14ZM4 4H10V9C10 9.26522 9.89464 9.51957 9.70711 9.70711C9.51957 9.89464 9.26522 10 9 10H5C4.73478 10 4.48043 9.89464 4.29289 9.70711C4.10536 9.51957 4 9.26522 4 9V4Z" stroke="#183A1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={styles.detailText}>{job?.categories?.[0] || 'Ingen kategori'}</span>
        </div>
        
        <div className={styles.detailItem}>
          <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 2C20.2652 2 20.5196 2.10536 20.7071 2.29289C20.8946 2.48043 21 2.73478 21 3V8C21 8.26522 20.8946 8.51957 20.7071 8.70711C20.5196 8.89464 20.2652 9 20 9H15V22C15 22.2652 14.8946 22.5196 14.7071 22.7071C14.5196 22.8946 14.2652 23 14 23H10C9.73478 23 9.48043 22.8946 9.29289 22.7071C9.10536 22.5196 9 22.2652 9 22V9H3.5C3.23478 9 2.98043 8.89464 2.79289 8.70711C2.60536 8.51957 2.5 8.26522 2.5 8V5.618C2.5001 5.43234 2.55188 5.25037 2.64955 5.09247C2.74722 4.93458 2.88692 4.80699 3.053 4.724L8.5 2H20ZM15 4H8.972L4.5 6.236V7H11V21H13V7H15V4ZM19 4H17V7H19V4Z" fill="#183A1D"/>
          </svg>
          <span className={styles.detailText}>{job?.equipment ? equipmentLabels[job.equipment] || job.equipment : 'Ikke spesifisert'}</span>
        </div>
      </div>
      
      <div className={styles.divider}></div>
    </div>
  );
};

export default JobDetails;
