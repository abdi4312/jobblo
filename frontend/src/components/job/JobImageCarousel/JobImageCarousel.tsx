import React, { useState } from 'react';
import styles from './JobImageCarousel.module.css';

interface JobImageCarouselProps {
  images?: string[];
}

const JobImageCarousel: React.FC<JobImageCarouselProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const jobImages = images && images.length > 0 
    ? images 
    : ['https://api.dicebear.com/7.x/avataaars/svg?seed=default'];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? jobImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === jobImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={styles.container}>
        <div style={{height:"8px", width:"1px"}}></div>
      <div className={styles.imageContainer}>
        <img 
          src={jobImages[currentIndex]} 
          alt={`Job image ${currentIndex + 1}`} 
          className={styles.mainImage}
          style={{ borderRadius: "16px" }}
        />
      </div>
      
      {/* Always show dots */}
      <div className={styles.navigationDots}>
        <div className={styles.dotContainer} style={{
          opacity: jobImages.length <= 1 ? 0.4 : 1
        }}>
          {jobImages.map((_, index) => (
            <div 
              key={index}
              className={`${styles.dot} ${index === currentIndex ? styles.activeDot : ''}`}
              onClick={() => jobImages.length > 1 && setCurrentIndex(index)}
              style={{ cursor: jobImages.length > 1 ? 'pointer' : 'default' }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Always show navigation buttons */}
      <div className={styles.carouselNavigation}>
        <button 
          className={styles.navButton} 
          onClick={handlePrevious}
          disabled={jobImages.length <= 1}
        >
          <div className={styles.navCircle} style={{
            opacity: jobImages.length <= 1 ? 0.4 : 1,
            cursor: jobImages.length <= 1 ? 'not-allowed' : 'pointer'
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="var(--color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
        
        <button 
          className={styles.navButton} 
          onClick={handleNext}
          disabled={jobImages.length <= 1}
        >
          <div className={styles.navCircle} style={{
            opacity: jobImages.length <= 1 ? 0.4 : 1,
            cursor: jobImages.length <= 1 ? 'not-allowed' : 'pointer'
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="var(--color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
};

export default JobImageCarousel;
