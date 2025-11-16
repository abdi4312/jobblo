import { useState } from 'react';
import type { Jobs } from '../../../../types/Jobs';

interface UtforskProps {
  jobs: Jobs[];
  gridColumns: number;
}

const JobCard = ({ job, gridColumns }: { job: Jobs, gridColumns: number }) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  return (
  <div style={{ 
    borderRadius: "16px", 
    backgroundColor: "var(--color-surface)",
    width: gridColumns === 1 ? "80vw" : gridColumns === 4 ? "16vw" : "40vw",
    maxWidth: gridColumns === 1 ? "800px" : gridColumns === 4 ? "200px" : "400px",
    margin: "0 auto",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  }}>
    {/* Image Section */}
    <div style={{ 
      width: "100%", 
      height: "100px", 
      borderRadius: "16px 16px 0 0",
      backgroundColor: "#f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      {job.images[0] ? (
        <img 
          src={job.images[0]} 
          alt={job.title}
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover", 
          }}
        />
      ) : (
        <span style={{
          color: "#666",
          fontSize: "16px"
        }}>
          No image available
        </span>
      )}
      
      {/* Favorite Heart Button */}
      <button
        onClick={handleFavoriteClick}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "rgba(255, 255, 255, 0.9)",
          border: "none",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        <span 
          className="material-symbols-outlined"
          style={{
            fontSize: "24px",
            color: isFavorited ? "#ff4444" : "#666",
            fontVariationSettings: "'FILL' 1",
          }}
        >
          favorite
        </span>
      </button>
    </div>

    {/* Title */}
    <h3 style={{ marginLeft: "12px", marginBottom: "4px", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {job.title}
    </h3>

    {/* Categories */}
    <div style={{display:"flex", fontSize: "16px", gap: "8px", color: "var(--color-white)", padding: "0 12px"}}>
      <h4 style={{ 
        width: "60px", 
        backgroundColor: "var(--color-accent)",
        overflow: "hidden", 
        margin: "0", 
        borderRadius: "4px"
      }}>
        {job.categories}
      </h4>
      <h4 style={{
        width: "60px",
        backgroundColor: "var(--color-blue)", 
        overflow: "hidden", 
        marginLeft: "12px", 
        margin: "0", 
        borderRadius: "4px"

      }}>
        {job.equipment}
      </h4>
    </div>

    {/* Job Details */}
    <div style={{fontSize:"16px", fontWeight:"lighter", padding: "0 16px"}}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span className='material-symbols-outlined'>location_on</span>
        <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {job.location.address} address
        </h3>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span className='material-symbols-outlined'>Schedule</span>
        <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
          {job.duration.unit}
        </h3>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span className='material-symbols-outlined'>calendar_month</span>
        <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
          {job.location.address} dato
        </h3>
      </div>
    </div>

    {/* Price */}
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      width: "80%", 
      marginTop: "12px", 
      marginLeft: "auto",
      marginRight: "auto",
      marginBottom: "12px",
      padding: "8px 0",
      backgroundColor: "var(--color-muted-gray)",
      borderRadius: "10px",
    }}>
      <span style={{ 
        fontWeight: 900, 
        color: "var(--color-price)",
        fontSize: "17px"
      }}>
        {job.price}kr/ timen
      </span>
    </div>
  </div>
  );
};

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