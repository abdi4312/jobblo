import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Jobs } from "../../types/Jobs.ts";
import { mainLink } from "../../api/mainURLs.ts";
import { Button, Dropdown } from 'antd';
import Utforsk from "../../components/Explore/jobs/tabs/Utforsk.tsx";

export default function CategoryJobs() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Jobs[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridColumns, setGridColumns] = useState(2);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [jobsToShow, setJobsToShow] = useState(16);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${mainLink}/api/services`);
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        if (Array.isArray(data)) {
          setJobs(data);
        } else if (data && Array.isArray(data.services)) {
          setJobs(data.services);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.error("Failed to fetch jobs", err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [categoryName]);

  const handleLayoutChange = (columns: number) => {
    setGridColumns(columns);
  };

  const items = [
    { key: '1', label: '1 Card per Row', onClick: () => handleLayoutChange(1) },
    { key: '2', label: '2 Cards per Row', onClick: () => handleLayoutChange(2) },
    { key: '4', label: '4 Cards per Row', onClick: () => handleLayoutChange(4), disabled: isMobile }
  ];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "80px" }}>
      <div style={{ padding: "20px 30px" }}>
        {/* TODO: Replace API endpoint with category-specific endpoint */}
        <div style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '16px',
          fontSize: '14px',
          color: '#856404'
        }}>
          ⚠️ API Placeholder: Update fetch endpoint to filter by category
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <button 
            onClick={() => navigate("/job-listing")}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
            }}
          >
            ← Tilbake
          </button>
          <h2 style={{ fontSize: '32px', margin: 0 }}>{decodeURIComponent(categoryName || '')}</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <Dropdown menu={{ items }} placement="bottomRight">
            <Button icon={<span className="material-symbols-outlined">grid_view</span>}>
              Layout
            </Button>
          </Dropdown>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Laster jobber...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Ingen jobber funnet i denne kategorien</div>
        ) : (
          <>
            <Utforsk jobs={jobs.slice(0, jobsToShow)} gridColumns={gridColumns} />
            {jobs.length > jobsToShow && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                <button
                  onClick={() => setJobsToShow(prev => prev + 16)}
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
                  Last inn flere ({jobs.length - jobsToShow} gjenstår)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
