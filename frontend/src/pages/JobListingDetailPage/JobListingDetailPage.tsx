import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/JobListingDetailPage.module.css';
import JobHeader from '../../components/job/JobHeader/JobHeader';
import JobImageCarousel from '../../components/job/JobImageCarousel/JobImageCarousel';
import JobDetails from '../../components/job/JobDetails/JobDetails';
import JobDescription from '../../components/job/JobDescription/JobDescription';
import JobLocation from '../../components/job/JobLocation/JobLocation';
import RelatedJobs from '../../components/job/RelatedJobs/RelatedJobs';
import { mainLink } from '../../api/mainURLs';

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
  const navigate = useNavigate();
  const [job, setJob] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  const getStatusConfig = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    if (normalizedStatus === 'open' || normalizedStatus === 'åpen') {
      return {
        text: 'Åpen',
        bgColor: '#E8F5E9',
        textColor: '#2E7D32',
        icon: '✓'
      };
    } else if (normalizedStatus === 'closed' || normalizedStatus === 'lukket') {
      return {
        text: 'Lukket',
        bgColor: '#FFEBEE',
        textColor: '#C62828',
        icon: '✕'
      };
    } else if (normalizedStatus === 'in progress' || normalizedStatus === 'pågår') {
      return {
        text: 'Pågår',
        bgColor: '#FFF3E0',
        textColor: '#E65100',
        icon: '⟳'
      };
    } else {
      return {
        text: status || 'Ukjent',
        bgColor: '#F5F5F5',
        textColor: '#616161',
        icon: '?'
      };
    }
  };

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
      {/* Back button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-light-gray)'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
            arrow_back
          </span>
        </button>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Tilbake</h2>
      </div>

      <JobImageCarousel images={job?.images} />

      <div className={styles.content}>
        <JobDetails job={job} />
        <JobDescription description={job?.description} price={job?.price} urgent={job?.urgent} />
        <JobLocation location={job?.location} />
        
        <RelatedJobs coordinates={job?.location?.coordinates} currentJobId={job?._id} />
      </div>
    </div>
  );
};

export default JobListingDetailPage;
