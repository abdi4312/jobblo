import styles from '../../styles/JobListingPage.module.css';
import JobCard from './JobCard';

type Tag = { name: string; type: string };

type Job = {
  id: number;
  title: string;
  image: string;
  tags: Tag[];
  location: string;
  duration: string;
  date: string;
  price: string;
  rating: number;
  isNew?: boolean;
};

export default function JobsSection({ jobs }: { jobs: Job[] }) {
  return (
    <section className={styles.jobsSection}>
      <div className={styles.jobsHeader}>
        <h2 className={styles.sectionTitle}>Ledig arbeid i nærheten av deg</h2>
        <button className={styles.filterButton}>
          <span>Filter</span>
          <svg className={styles.filterIcon} viewBox="0 0 21 21" fill="none">
            <path d="M6.125 9.625H14.875V11.375H6.125V9.625ZM3.5 6.125H17.5V7.875H3.5V6.125ZM8.75 13.125H12.25V14.875H8.75V13.125Z" fill="var(--color-text-strong)"/>
          </svg>
        </button>
      </div>

      <div className={styles.jobsGrid}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}
