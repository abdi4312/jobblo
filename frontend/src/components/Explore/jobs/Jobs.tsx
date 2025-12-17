import { useEffect, useState } from 'react';
import { mainLink } from "../../../api/mainURLs";
import type { Jobs } from '../../../types/Jobs';
import Utforsk from './tabs/Utforsk';
import { Button, Dropdown } from 'antd';

export default function JobsContainer() {
    const [activeTab, setActiveTab] = useState('utforsk');
    const [jobs, setJobs] = useState<Jobs[]>([]);
    const [gridColumns, setGridColumns] = useState(2); // Default to 2 columns

    const handleLayoutChange = (columns: number) => {
        setGridColumns(columns);
    };

    const items = [
        { key: '1', label: '1 Card per Row', onClick: () => handleLayoutChange(1) },
        { key: '2', label: '2 Cards per Row', onClick: () => handleLayoutChange(2) },
        { key: '4', label: '4 Cards per Row', onClick: () => handleLayoutChange(4) }
    ];

    const userId = '68d98d54a60a9dfeeaec8dc6';
    
    // Fetch jobs from API
    useEffect(() => {
      async function fetchJobs() {
        try {
          const res = await fetch(`${mainLink}/api/services`);
          const data = await res.json();
          // Ensure data is an array before setting it
          if (Array.isArray(data)) {
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
        }
      }
    
      fetchJobs();
    }, []);

    // Fetch Followers jobs from API IKKE FERDIG IKKE FERDIG IKKE FERDIG IKKE FERDIG SE PÅ DENNE.
    useEffect(() => {
      async function fetchJobs() {
        try {
          const res = await fetch(`${mainLink}/api/feed/following?userId=${userId}`);
          const data = await res.json();
          setJobs(data);
        } catch (err) {
          console.error("Failed to fetch jobs:", err);
        }
      }
    
      fetchJobs();
    }, []);    

    const tabs = [
    { id: 'utforsk', label: 'Utforsk' },
    { id: 'fordeg', label: 'For deg' },
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
        {activeTab === 'utforsk' && jobs.length > 0 && <Utforsk jobs={jobs} gridColumns={gridColumns} />}
        {activeTab === 'utforsk' && jobs.length === 0 && <div>Loading jobs...</div>}

        {activeTab === 'fordeg' && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>For deg</h3>
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