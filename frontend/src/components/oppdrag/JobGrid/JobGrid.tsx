import React from 'react';
import OppdragCard from '../OppdragCard/OppdragCard';
import styles from './JobGrid.module.css';

const JobGrid: React.FC = () => {
  const jobs = [
    {
      id: 1,
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/0d8e29846c42e592a0100389997853a366e46652?width=346',
      title: 'Maling av stue',
      category: 'Male',
      equipment: 'Utstyr fri',
      location: 'Gate 12 , Bærum',
      duration: '7 timer',
      date: '07.08.25',
      price: '350kr/ timen',
      imagePosition: 0
    },
    {
      id: 2,
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/4c7889944731b3b3a2b7a7b67a3f5ab1372d9ce1?width=346',
      title: 'Maling av stue',
      category: 'Male',
      equipment: 'Utstyr fri',
      location: 'Gate 12 , Bærum',
      duration: '7 timer',
      date: '07.08.25',
      price: '350kr/ timen',
      imagePosition: 0
    },
    {
      id: 3,
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/4dcea95cbb92944ad1f5c8a8a8c0a199ac1a638c?width=346',
      title: 'Maling av stue',
      category: 'Male',
      equipment: 'Utstyr fri',
      location: 'Gate 12 , Bærum',
      duration: '7 timer',
      date: '07.08.25',
      price: '350kr/ timen',
      imagePosition: 0
    },
    {
      id: 4,
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/fabc6c79d1bc295e56a2b2e4f27520c3554fd155?width=346',
      title: 'Maling av stue',
      category: 'Male',
      equipment: 'Utstyr fri',
      location: 'Gate 12 , Bærum',
      duration: '7 timer',
      date: '07.08.25',
      price: '350kr/ timen',
      imagePosition: 0
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {jobs.map((job) => (
          <OppdragCard
            key={job.id}
            {...job}
          />
        ))}
      </div>
    </div>
  );
};

export default JobGrid;
