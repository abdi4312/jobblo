import React from 'react';
import styles from './RelatedJobs.module.css';
import JobCard from '../JobCard/JobCard';

const RelatedJobs: React.FC = () => {
  const jobsData = [
    {
      image: "https://api.builder.io/api/v1/image/assets/TEMP/0d8e29846c42e592a0100389997853a366e46652?width=346",
      title: "Maling av stue",
      category: "Male",
      equipment: "Utstyr fri",
      location: "Gate 12 , Bærum",
      duration: "7 timer",
      date: "07.08.25",
      price: "350kr/ timen",
      isFirst: true
    },
    {
      image: "https://api.builder.io/api/v1/image/assets/TEMP/4dcea95cbb92944ad1f5c8a8a8c0a199ac1a638c?width=346",
      title: "Maling av stue",
      category: "Male",
      equipment: "Utstyr fri",
      location: "Gate 12 , Bærum",
      duration: "7 timer",
      date: "07.08.25",
      price: "350kr/ timen",
      isFirst: false
    },
    {
      image: "https://api.builder.io/api/v1/image/assets/TEMP/ad33659c33381eac40061641b81f19d65a13ad9f?width=346",
      title: "Maling av stue",
      category: "Male",
      equipment: "Utstyr fri",
      location: "Gate 12 , Bærum",
      duration: "7 timer",
      date: "07.08.25",
      price: "350kr/ timen",
      isFirst: false
    },
    {
      image: "https://api.builder.io/api/v1/image/assets/TEMP/fabc6c79d1bc295e56a2b2e4f27520c3554fd155?width=346",
      title: "Maling av stue",
      category: "Male",
      equipment: "Utstyr fri",
      location: "Gate 12 , Bærum",
      duration: "7 timer",
      date: "07.08.25",
      price: "350kr/ timen",
      isFirst: false
    }
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Andre annonser i samme kategori</h3>
      
      <div className={styles.jobsGrid}>
        {jobsData.map((job, index) => (
          <JobCard
            key={index}
            image={job.image}
            title={job.title}
            category={job.category}
            equipment={job.equipment}
            location={job.location}
            duration={job.duration}
            date={job.date}
            price={job.price}
            isFirst={job.isFirst}
          />
        ))}
      </div>
    </div>
  );
};

export default RelatedJobs;
