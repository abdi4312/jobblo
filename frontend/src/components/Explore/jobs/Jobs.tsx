import { useEffect, useState } from 'react';
import { mainLink } from "../../../api/mainURLs";
import type { Jobs } from '../../../types/Jobs';
import Utforsk from './tabs/Utforsk';
import { Button, Dropdown } from 'antd';
import { JobCard } from './JobCard/JobCard';
import { useUserStore } from '../../../stores/userStore';

interface JobsContainerProps {
  selectedCategories?: string[];
  searchQuery?: string;
}

export default function JobsContainer({ selectedCategories = [], searchQuery = "" }: JobsContainerProps) {
    const [activeTab, setActiveTab] = useState('utforsk');
    const [jobs, setJobs] = useState<Jobs[]>([]);
    const [nearbyJobs, setNearbyJobs] = useState<Jobs[]>([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [gridColumns, setGridColumns] = useState(2); // Default to 2 columns
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [nearbyJobsToShow, setNearbyJobsToShow] = useState(16);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalJobs, setTotalJobs] = useState(0);
    const limit = 16;
    
    const { user, tokens } = useUserStore();
    const userId = user?._id;

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLayoutChange = (columns: number) => {
        setGridColumns(columns);
    };

    const items = [
        { key: '1', label: '1 Card per Row', onClick: () => handleLayoutChange(1) },
        { key: '2', label: '2 Cards per Row', onClick: () => handleLayoutChange(2) },
        { key: '4', label: '4 Cards per Row', onClick: () => handleLayoutChange(4), disabled: isMobile }
    ];
    
    // Fetch jobs from API
    useEffect(() => {
      async function fetchJobs() {
        setLoadingJobs(true);
        setCurrentPage(1); // Reset to page 1 when filters change
        try {
          let url = `${mainLink}/api/services`;
          const params = new URLSearchParams();
          
          params.append('page', '1');
          params.append('limit', String(limit));
          
          if (selectedCategories.length > 0) {
            params.append('category', selectedCategories.join(','));
          }
          if (searchQuery) {
            params.append('search', searchQuery);
          }
          
          url += `?${params.toString()}`;
          
          console.log('Fetching jobs from:', url);
          const res = await fetch(url);
          const data = await res.json();
          console.log('API response:', data);
          
          // Handle pagination response format
          if (data && Array.isArray(data.data)) {
            setJobs(data.data);
            if (data.pagination) {
              setTotalPages(data.pagination.totalPages || 1);
              setTotalJobs(data.pagination.total || 0);
            }
          } else if (Array.isArray(data)) {
            setJobs(data);
          } else if (data && Array.isArray(data.services)) {
            setJobs(data.services);
          } else {
            console.error("API response is not an array:", data);
            setJobs([]);
          }
        } catch (err) {
          console.error("Failed to fetch jobs:", err);
          setJobs([]);
        } finally {
          setLoadingJobs(false);
        }
      }
    
      fetchJobs();
    }, [selectedCategories, searchQuery]);

    // Load more jobs (next page)
    const loadMoreJobs = async () => {
      if (currentPage >= totalPages || loadingMore) return;
      
      setLoadingMore(true);
      try {
        const nextPage = currentPage + 1;
        let url = `${mainLink}/api/services`;
        const params = new URLSearchParams();
        
        params.append('page', String(nextPage));
        params.append('limit', String(limit));
        
        if (selectedCategories.length > 0) {
          params.append('category', selectedCategories.join(','));
        }
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        
        url += `?${params.toString()}`;
        
        console.log('Loading more jobs from:', url);
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && Array.isArray(data.data)) {
          setJobs(prev => [...prev, ...data.data]);
          setCurrentPage(nextPage);
        }
      } catch (err) {
        console.error("Failed to load more jobs:", err);
      } finally {
        setLoadingMore(false);
      }
    };

    // Get user's current location
    useEffect(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation([position.coords.longitude, position.coords.latitude]);
          },
          (error) => {
            console.error('Error getting user location:', error);
            setUserLocation(null);
          }
        );
      } else {
        setUserLocation(null);
      }
    }, []);

    // Fetch nearby jobs for "For deg" tab
    useEffect(() => {
      async function fetchNearbyJobs() {
        if (!userLocation || activeTab !== 'fordeg') {
          return;
        }

        setLoadingNearby(true);
        try {
          const [longitude, latitude] = userLocation;
          const res = await fetch(
            `${mainLink}/api/services/nearby?lat=${latitude}&lng=${longitude}&radius=50000`
          );
          
          if (res.ok) {
            const data = await res.json();
            setNearbyJobs(data);
          } else {
            console.error('Failed to fetch nearby jobs:', res.status);
            setNearbyJobs([]);
          }
        } catch (err) {
          console.error('Error fetching nearby jobs:', err);
          setNearbyJobs([]);
        } finally {
          setLoadingNearby(false);
        }
      }

      fetchNearbyJobs();
    }, [userLocation, activeTab]);

    // Fetch Followers jobs from API IKKE FERDIG IKKE FERDIG IKKE FERDIG IKKE FERDIG SE PÅ DENNE.
    useEffect(() => {
      async function fetchFollowingJobs() {
        if (!userId || !tokens?.accessToken) {
          console.log('User not logged in, skipping following feed');
          return;
        }

        try {
          const res = await fetch(`${mainLink}/api/feed/following?userId=${userId}`, {
            headers: {
              'Authorization': `Bearer ${tokens.accessToken}`,
              'Content-Type': 'application/json',
            }
          });
          
          if (!res.ok) {
            throw new Error(`Failed to fetch following feed: ${res.status}`);
          }
          
          const data = await res.json();
          // Handle the following feed data appropriately
          console.log('Following feed:', data);
        } catch (err) {
          console.error("Failed to fetch following jobs:", err);
        }
      }
    
      fetchFollowingJobs();
    }, [userId, tokens]);    

    const tabs = [
    { id: 'utforsk', label: 'Utforsk' },
    { id: 'fordeg', label: 'Nær deg' },
    { id: 'folger', label: 'Følger' }
  ];

  return (
    <div>
      <div style={{ padding: "0px 30px"}}>
        {/* Tab Headers */}
        <div style={{
          backgroundColor: "var(--color-surface)",
          display: "flex",
          justifyContent: "space-between",
          height: '50%',
          borderRadius: '16px',
        }}>
          {tabs.map(tab => (
            <h3
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                cursor: 'pointer',
                color: activeTab === tab.id ? "var(--color-white)" : "var(--color-text)",
                backgroundColor: activeTab === tab.id ? "var(--color-primary)" : "var(--color-surface)",
                padding: '5px 18px',
                borderRadius: '8px',
              }}
            >
              {tab.label}
            </h3>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <Dropdown menu={{ items }} placement="bottomRight">
                <Button icon={<span className="material-symbols-outlined">grid_view</span>}>
                    Layout
                </Button>
            </Dropdown>
        </div>

        {/* Tab Content */}
        {activeTab === 'utforsk' && loadingJobs && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text)' }}>
            Laster jobber...
          </div>
        )}

        {activeTab === 'utforsk' && !loadingJobs && jobs.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text)' }}>
            <h3>Ingen jobber funnet</h3>
            {selectedCategories.length > 0 && (
              <p>Prøv å fjerne noen filtre for å se flere resultater</p>
            )}
          </div>
        )}

        {activeTab === 'utforsk' && !loadingJobs && jobs.length > 0 && (
          <>
            <Utforsk jobs={jobs} gridColumns={gridColumns} />
            {currentPage < totalPages && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                <button
                  onClick={loadMoreJobs}
                  disabled={loadingMore}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: loadingMore ? 'var(--color-surface)' : 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                  }}
                >
                  {loadingMore ? 'Laster...' : `Last inn flere (${totalJobs - jobs.length} gjenstår)`}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'fordeg' && userLocation === null && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text)' }}>
            <h3>Tilgang til posisjon kreves</h3>
            <p>For å se jobber nær deg må du tillate posisjonstilgang i nettleseren din.</p>
          </div>
        )}

        {activeTab === 'fordeg' && userLocation !== null && loadingNearby && (
          <div style={{ padding: '20px', textAlign: 'center' }}>Laster jobber i nærheten...</div>
        )}

        {activeTab === 'fordeg' && userLocation !== null && !loadingNearby && nearbyJobs.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text)' }}>
            Ingen jobber i nærheten funnet
          </div>
        )}

        {activeTab === 'fordeg' && userLocation !== null && !loadingNearby && nearbyJobs.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3>Jobber nær deg</h3>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridColumns === 1 ? '1fr' : gridColumns === 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
              gap: '20px',
              padding: '20px 0'
            }}>
              {nearbyJobs.slice(0, nearbyJobsToShow).map((job) => (
                <div key={job._id}>
                  <JobCard job={job} gridColumns={gridColumns} />
                </div>
              ))}
            </div>
            {nearbyJobs.length > nearbyJobsToShow && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                <button
                  onClick={() => setNearbyJobsToShow(prev => prev + 16)}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                  }}
                >
                  Last inn flere ({nearbyJobs.length - nearbyJobsToShow} gjenstår)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'folger' && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>Følger</h3>
          </div>
        )}
      </div>
    </div>
  );
}