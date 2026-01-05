import React, { useState, useEffect } from "react";
import styles from "./RelatedJobs.module.css";
import { JobCard } from "../../Explore/jobs/JobCard/JobCard";
import type { Jobs } from "../../../types/Jobs";
import { getNearbyJobs } from "../../../api/servicesAPI.ts";

interface RelatedJobsProps {
  coordinates?: [number, number];
  currentJobId?: string;
}

const RelatedJobs: React.FC<RelatedJobsProps> = ({
  coordinates,
  currentJobId,
}) => {
  const [nearbyJobs, setNearbyJobs] = useState<Jobs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNearbyJobs = async () => {
      if (!coordinates || coordinates.length !== 2) {
        setLoading(false);
        return;
      }

      try {
        const [longitude, latitude] = coordinates;
        // Use lat, lng, and radius as expected by the backend

        const data = await getNearbyJobs(latitude, longitude, 50000);
        // Filter out the current job and limit to 4
        const filtered = data
          .filter((job: Jobs) => job._id !== currentJobId)
          .slice(0, 4);
        setNearbyJobs(filtered);
      } catch (err) {
        console.error("Error fetching nearby jobs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyJobs();
  }, [coordinates, currentJobId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.sectionTitle}>Jobber i nærheten</h3>
        <div style={{ padding: "20px", textAlign: "center" }}>Laster...</div>
      </div>
    );
  }

  if (nearbyJobs.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.sectionTitle}>Jobber i nærheten</h3>
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--color-text)",
          }}
        >
          Ingen jobber i nærheten funnet
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Jobber i nærheten</h3>

      <div className={styles.jobsGrid}>
        {nearbyJobs.map((job) => (
          <JobCard key={job._id} job={job} gridColumns={2} />
        ))}
      </div>
    </div>
  );
};

export default RelatedJobs;
