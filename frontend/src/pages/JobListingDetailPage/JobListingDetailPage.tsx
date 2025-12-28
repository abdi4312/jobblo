import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/JobListingDetailPage.module.css';
import JobHeader from '../../components/job/JobHeader/JobHeader';
import JobImageCarousel from '../../components/job/JobImageCarousel/JobImageCarousel';
import JobDetails from '../../components/job/JobDetails/JobDetails';
import JobDescription from '../../components/job/JobDescription/JobDescription';
import JobLocation from '../../components/job/JobLocation/JobLocation';
import RelatedJobs from '../../components/job/RelatedJobs/RelatedJobs';
import { mainLink } from '../../api/mainURLs';
import { getFavorites, setFavorites, deleteFavorites } from '../../api/favoriteAPI';
import { useUserStore } from '../../stores/userStore';
import { toast } from 'react-toastify';

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

const JobListingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const userToken = useUserStore((state) => state.tokens);
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);
  
  const isOwnJob = job?.userId?._id === currentUser?._id;

  const getStatusConfig = (status: string) => {
    const userToken = useUserStore((state) => state.tokens);
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

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!userToken || !id) return;
      try {
        const res = await getFavorites(userToken);
        const favorited = res.data.some(
          (fav: any) => fav.service._id === id,
        );
        setIsFavorited(favorited);
      } catch (err) {
        console.error("Error checking favorite status", err);
      }
    };

    void checkFavoriteStatus();
  }, [userToken, id]);

  const handleFavoriteClick = async () => {
    if (!isAuth) {
      toast.error("Du må logge inn for å legge til favoritter");
      navigate("/login");
      return;
    }

    if (!id) return;

    try {
      if (isFavorited) {
        await deleteFavorites(id, userToken);
        toast.success("Fjernet fra favoritter");
      } else {
        await setFavorites(id, userToken);
        toast.success("Lagt til i favoritter");
      }
      setIsFavorited(!isFavorited);
    } catch (err) {
      console.error("Failed to update favorites", err);
      toast.error("Kunne ikke oppdatere favoritter");
    }
  };

  const handleSendMessage = () => {
    if (!isAuth) {
      toast.error("Du må logge inn for å sende melding");
      navigate("/login");
      return;
    }
    // TODO: Implement message functionality
    toast.info("Meldingsfunksjon kommer snart");
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '40px', textAlign: 'center' }}>Laster...</div>
      </div>
    );
  }

const handleSendMessagess = async (providerId: string) => {
      if (!userToken?.accessToken) {
      setError('Du må være logget inn for å se dine annonser');
      setLoading(false);
      return;
    }
  try {
    const res = await fetch(`${mainLink}/api/chats/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Agar token use kar rahe ho to yahan Authorization header bhi add karo
        'Authorization': `Bearer ${userToken.accessToken}`
      },
      body: JSON.stringify({ providerId }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create/get chat: ${res.status}`);
    }
    navigate(`/chat`);
  } catch (err) {
    console.error("Error creating/getting chat:", err);
  }
};


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

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        margin: '20px',
        marginBottom: '24px'
      }}>
        <button
          onClick={handleFavoriteClick}
          style={{
            flex: 1,
            backgroundColor: isFavorited ? '#ff4d4f' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span className="material-symbols-outlined">
            {isFavorited ? 'favorite' : 'favorite_border'}
          </span>
          {isFavorited ? 'Fjern favoritt' : 'Legg til favoritt'}
        </button>
        <button
          onClick={handleSendMessage}
          disabled={isOwnJob}
          style={{
            flex: 1,
            backgroundColor: isOwnJob ? '#cccccc' : 'var(--color-primary)',
            color: isOwnJob ? '#666666' : 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: isOwnJob ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: isOwnJob ? 0.6 : 1
          }}
        >
          <span className="material-symbols-outlined">
            send
          </span>
          {isOwnJob ? 'Din egen annonse' : 'Send melding'}
        </button>
      </div>

      <div className={styles.content}>
        <JobDetails job={job} />
        <button onClick={()=>handleSendMessagess(job?.userId._id)}>Chat Service Provider</button>
        <JobDescription description={job?.description} price={job?.price} urgent={job?.urgent} />
        <JobLocation location={job?.location} />
        
        <RelatedJobs coordinates={job?.location?.coordinates} currentJobId={job?._id} />
      </div>
    </div>
  );
};

export default JobListingDetailPage;
