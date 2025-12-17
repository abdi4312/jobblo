import type { Jobs } from '../../../../types/Jobs';
import { JobCard } from '../JobCard/JobCard';

interface UtforskProps {
  jobs: Jobs[];
  gridColumns: number;
}

export const Utforsk = ({ jobs, gridColumns }: UtforskProps) => {
  return (
    <div>
      <div style={{paddingBottom:"30px"}}/>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, 
        gap: "20px",
        maxWidth: "1600px",
        margin: "0 auto",
      }}>
        {jobs.map(job => (
          <JobCard key={job._id} job={job} gridColumns={gridColumns} />
        ))}
      </div>
    </div>
  );
};

export default Utforsk;