import styles from "./ProfileHeader.module.css";
import { useUserStore } from "../../../stores/userStore";
import { useState, useEffect } from "react";
import  mainLink  from "../../../api/mainURLs";

export function ProfileHeader() {
  const user = useUserStore((state) => state.user);
  const [activeJobs, setActiveJobs] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);

  // Format join date if available
  const memberSince = user?._id ? "2024" : "N/A";

  useEffect(() => {
    fetchJobStats();
  }, [user]);

  const fetchJobStats = async () => {

    try {
      const response = await mainLink.get("/api/services/my-posted");

      if (response.data) {
        const data = response.data;
        // Count active jobs (status: 'active' or 'open')
        const active = data.filter((service: any) => 
          service.status === 'active' || service.status === 'open'
        ).length;
        // Count completed jobs (status: 'completed' or 'closed')
        const completed = data.filter((service: any) => 
          service.status === 'completed' || service.status === 'closed'
        ).length;
        
        setActiveJobs(active);
        setCompletedJobs(completed);
      }
    } catch (error) {
      console.error('Error fetching job stats:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topSection}>
        <div className={styles.profileImageContainer}>
          <img 
            src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"} 
            alt="Profile" 
            className={styles.profileImage}
          />
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.nameAndEmail}>
            <span className={styles.name}>{user?.name || "Guest"}</span>
            <span className={styles.email}>{user?.email || "Not logged in"}</span>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.memberSince}>medlem siden {memberSince}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsContainer}>
        <div className={styles.statCard}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
            task_alt
          </span>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{completedJobs}</div>
            <div className={styles.statLabel}>Fullførte</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
            trending_up
          </span>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{activeJobs}</div>
            <div className={styles.statLabel}>Aktive</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
            stars
          </span>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{user?.averageRating ? user.averageRating.toFixed(1) : '0.0'}</div>
            <div className={styles.statLabel}>Vurdering</div>
          </div>
        </div>
      </div>
    </div>
  );
}
