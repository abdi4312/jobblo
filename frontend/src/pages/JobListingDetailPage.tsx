import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import styles from '../styles/JobListingDetailPage.module.css';
import JobHeader from '../components/job/JobHeader/JobHeader';
import JobImageCarousel from '../components/job/JobImageCarousel/JobImageCarousel';
import JobDetails from '../components/job/JobDetails/JobDetails';
import JobDescription from '../components/job/JobDescription/JobDescription';
import JobLocation from '../components/job/JobLocation/JobLocation';
import RelatedJobs from '../components/job/RelatedJobs/RelatedJobs';
import { jobs as sampleJobs } from '../data/jobs';

const JobListingDetailPage: React.FC = () => {
  const location = useLocation();
  const params = useParams();

  type LocationState = {
    job?: {
      id?: number;
      title?: string;
      image?: string;
      location?: string;
    };
  };

  const jobFromState = (location.state as LocationState)?.job;
  const jobFromId = params.id ? sampleJobs.find((j) => String(j.id) === params.id) : undefined;
  const job = jobFromState ?? jobFromId;

  return (
    <div className={styles.container}>
      <JobHeader />

      {/* Small preview for verification: uses passed job state when available */}
  <div style={{ padding: '12px', borderBottom: '1px solid var(--color-light-gray)' }}>
        {job ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={job.image} alt={job.title} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
            <div>
              <div style={{ fontWeight: 700 }}>{job.title}</div>
              <div style={{ color: 'var(--color-muted-gray)' }}>{job.location}</div>
            </div>
          </div>
        ) : (
          <div>Showing details for job id: <strong>{params.id}</strong></div>
        )}
      </div>

      <JobImageCarousel />
      <div className={styles.content}>
        <JobDetails />
        <JobDescription />
        <JobLocation />
        <RelatedJobs />
      </div>
    </div>
  );
};

export default JobListingDetailPage;
