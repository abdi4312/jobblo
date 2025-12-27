import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from '../styles/JobListingDetailPage.module.css';
import JobHeader from '../components/job/JobHeader/JobHeader';
import JobImageCarousel from '../components/job/JobImageCarousel/JobImageCarousel';
import JobDetails from '../components/job/JobDetails/JobDetails';
import JobDescription from '../components/job/JobDescription/JobDescription';
import JobLocation from '../components/job/JobLocation/JobLocation';
import RelatedJobs from '../components/job/RelatedJobs/RelatedJobs';
import { mainLink } from '../api/mainURLs';

interface Service {
  _id: string;
  title: string;
  description: string;
  price: number;
  location: {
    address: string;
    city: string;
    coordinates: [number, number];
  };
  categories: string[];
  images: string[];
  urgent: boolean;
  status: string;
  equipment: string;
  duration?: {
    value: number;
    unit: string;
  };
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

const JobListingDetailPage: React.FC = () => {
  const { id } = useParams();
  const [job, setJob] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${mainLink}/api/services/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setJob(data);
        } else {
          console.error('Failed to fetch job');
        }
      } catch (err) {
        console.error('Error fetching job:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '40px', textAlign: 'center' }}>Laster...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <JobHeader />

      <JobImageCarousel images={job?.images} />
      <div className={styles.content}>
        <JobDetails job={job} />
        <JobDescription description={job?.description} />
        <JobLocation location={job?.location} />
        <RelatedJobs />
      </div>
    </div>
  );
};

export default JobListingDetailPage;
