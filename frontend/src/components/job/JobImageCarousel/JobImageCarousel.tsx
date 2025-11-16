import React from 'react';
import styles from './JobImageCarousel.module.css';

const JobImageCarousel: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <img 
          src="https://api.builder.io/api/v1/image/assets/TEMP/07a79162e8bf8822b40eba4c84db5b0ed481a156?width=782" 
          alt="Klippe plen job" 
          className={styles.mainImage}
        />
      </div>
      
      <div className={styles.actionButtons}>
        <button className={styles.actionButton}>
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <path d="M12.6048 19.3229L12.5007 19.4271L12.3861 19.3229C7.43815 14.8333 4.16732 11.8646 4.16732 8.85417C4.16732 6.77083 5.72982 5.20833 7.81315 5.20833C9.41732 5.20833 10.9798 6.25 11.5319 7.66667H13.4694C14.0215 6.25 15.584 5.20833 17.1882 5.20833C19.2715 5.20833 20.834 6.77083 20.834 8.85417C20.834 11.8646 17.5632 14.8333 12.6048 19.3229ZM17.1882 3.125C15.3757 3.125 13.6361 3.96875 12.5007 5.29167C11.3652 3.96875 9.62565 3.125 7.81315 3.125C4.60482 3.125 2.08398 5.63542 2.08398 8.85417C2.08398 12.7812 5.62565 16 10.9902 20.8646L12.5007 22.2396L14.0111 20.8646C19.3757 16 22.9173 12.7812 22.9173 8.85417C22.9173 5.63542 20.3965 3.125 17.1882 3.125Z" fill="var(--color-accent)"/>
          </svg>
        </button>
        
        <button className={styles.actionButton}>
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
              <path d="M5.20898 21.875V5.20833C5.20898 4.63542 5.41315 4.14514 5.82148 3.7375C6.22982 3.32986 6.7201 3.12569 7.29232 3.125H17.709C18.2819 3.125 18.7725 3.32917 19.1809 3.7375C19.5892 4.14583 19.793 4.63611 19.7923 5.20833V21.875L12.5007 18.75L5.20898 21.875ZM7.29232 18.6979L12.5007 16.4583L17.709 18.6979V5.20833H7.29232V18.6979Z" fill="var(--color-accent)"/>
          </svg>
        </button>
      </div>
      
      <div className={styles.registerButton}>
        <span className={styles.registerText}>Registrer</span>
      </div>
      
      <div className={styles.navigationDots}>
        <div className={styles.dotContainer}>
          <div className={`${styles.dot} ${styles.activeDot}`}></div>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
        </div>
      </div>
      
      <div className={styles.carouselNavigation}>
        <button className={styles.navButton}>
          <div className={styles.navCircle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.4 8L18 3.4L16.6 2L10.6 8L16.6 14L18 12.6L13.4 8Z" fill="var(--color-icon)"/>
            </svg>
          </div>
        </button>
        
        <button className={styles.navButton}>
          <div className={styles.navCircle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.6 8L7.2 12.6L8.6 11.2L5.4 8L8.6 4.8L7.2 3.4L2.6 8Z" fill="var(--color-icon)"/>
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
};

export default JobImageCarousel;
