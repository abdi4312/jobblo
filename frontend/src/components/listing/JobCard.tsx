import styles from '../../styles/JobListingPage.module.css';
import { useNavigate } from 'react-router-dom';

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

export default function JobCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  const goToDetail = () => navigate(`/job-listing/${job.id}`, { state: { job } });
  const renderRatingDots = (rating: number) => {
    return Array.from({ length: 4 }, (_, index) => (
      <div
        key={index}
        className={`${styles.ratingDot} ${index < rating ? styles.ratingDotActive : ''}`}
      />
    ));
  };

  return (
    <div
      className={styles.jobCard}
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={(e) => { if (e.key === 'Enter') goToDetail(); }}
    >
      {job.isNew && (
        <div className={styles.newBadge}><span>Ny!</span></div>
      )}
      <div className={styles.jobImageContainer}>
        <img src={job.image} alt={job.title} className={styles.jobImage} />
        <button
          className={styles.favoriteButton}
          onClick={(e) => { e.stopPropagation(); /* handle favorite action */ }}
          aria-label="Toggle favorite"
        >
          <svg className={styles.heartIcon} viewBox="0 0 23 23" fill="none">
            <path d="M11.4481 17.5496L11.3535 17.6443L11.2494 17.5496C6.7555 13.472 3.78477 10.7756 3.78477 8.04141C3.78477 6.14922 5.20391 4.73008 7.09609 4.73008C8.55308 4.73008 9.97222 5.67617 10.4736 6.96286H12.2334C12.7348 5.67617 14.154 4.73008 15.6109 4.73008C17.5031 4.73008 18.9223 6.14922 18.9223 8.04141C18.9223 10.7756 15.9515 13.472 11.4481 17.5496ZM15.6109 2.83789C13.9647 2.83789 12.3848 3.60423 11.3535 4.80577C10.3223 3.60423 8.7423 2.83789 7.09609 2.83789C4.18213 2.83789 1.89258 5.11798 1.89258 8.04141C1.89258 11.6082 5.1093 14.5316 9.98168 18.9499L11.3535 20.1987L12.7254 18.9499C17.5977 14.5316 20.8145 11.6082 20.8145 8.04141C20.8145 5.11798 18.5249 2.83789 15.6109 2.83789Z" fill="var(--color-warning)"/>
              <path d="M11.4481 17.5496L11.3535 17.6443L11.2494 17.5496C6.7555 13.472 3.78477 10.7756 3.78477 8.04141C3.78477 6.14922 5.20391 4.73008 7.09609 4.73008C8.55308 4.73008 9.97222 5.67617 10.4736 6.96286H12.2334C12.7348 5.67617 14.154 4.73008 15.6109 4.73008C17.5031 4.73008 18.9223 6.14922 18.9223 8.04141C18.9223 10.7756 15.9515 13.472 11.4481 17.5496ZM15.6109 2.83789C13.9647 2.83789 12.3848 3.60423 11.3535 4.80577C10.3223 3.60423 8.7423 2.83789 7.09609 2.83789C4.18213 2.83789 1.89258 5.11798 1.89258 8.04141C1.89258 11.6082 5.1093 14.5316 9.98168 18.9499L11.3535 20.1987L12.7254 18.9499C17.5977 14.5316 20.8145 11.6082 20.8145 8.04141C20.8145 5.11798 18.5249 2.83789 15.6109 2.83789Z" fill="var(--color-warning)"/>
          </svg>
        </button>
        <div className={styles.ratingContainer}>{renderRatingDots(job.rating)}</div>
      </div>
      <div className={styles.jobContent}>
        <h3
          className={styles.jobTitle}
          onClick={() => navigate(`/job-listing/${job.id}`, { state: { job } })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(`/job-listing/${job.id}`, { state: { job } });
          }}
          role="link"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          {job.title}
        </h3>
        <div className={styles.jobTags}>
          {job.tags.map((tag: Tag, tagIndex: number) => (
            <span key={tagIndex} className={`${styles.jobTag} ${tag.type === 'primary' ? styles.jobTagPrimary : styles.jobTagSecondary}`}>
              {tag.name}
            </span>
          ))}
        </div>
        <div className={styles.jobDetails}>
          <div className={styles.jobDetail}><span>{job.location}</span></div>
          <div className={styles.jobDetail}><span>{job.duration}</span></div>
          <div className={styles.jobDetail}><span>{job.date}</span></div>
        </div>
        <div className={styles.jobPrice}>{job.price}</div>
      </div>
    </div>
  );
}
