// import type { Jobs } from '../../types/Jobs';

// interface UtforskProps {
//   jobs: Jobs[];
// }

// const JobCard = ({ job }: { job: Jobs }) => (
//   <div style={{ 
//     borderRadius: "8px", 
//     backgroundColor: "var(--color-surface)",
//     width: "40vw",
//     maxWidth: "400px",
//     margin: "0 auto",
//     boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
//   }}>
//     {/* Image Section */}
//     <div style={{ 
//       width: "100%", 
//       height: "100px", 
//       borderRadius: "4px",
//       backgroundColor: "#f0f0f0",
//       display: "flex",
//       alignItems: "center",
//       justifyContent: "center",
//     }}>
//       {job.images[0] ? (
//         <img 
//           src={job.images[0]} 
//           alt={job.title}
//           style={{ 
//             width: "100%", 
//             height: "100%", 
//             objectFit: "cover", 
//             borderRadius: "4px" 
//           }}
//         />
//       ) : (
//         <span style={{
//           color: "#666",
//           fontSize: "16px"
//         }}>
//           No image available
//         </span>
//       )}
//     </div>

//     {/* Title */}
//     <h3 style={{ marginLeft: "12px", marginBottom: "4px", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
//       {job.title}
//     </h3>

//     {/* Categories */}
//     <div style={{display:"flex", fontSize: "16px", gap: "8px", color: "var(--color-white)", padding: "0 12px"}}>
//       <h4 style={{ 
//         width: "50px", 
//         backgroundColor: "var(--color-accent)",
//         overflow: "hidden", 
//         margin: "0", 
//         borderRadius: "4px"
//       }}>
//         {job.categories}ca
//       </h4>
//       <h4 style={{
//         width: "50px",
//         backgroundColor: "var(--color-blue)", 
//         overflow: "hidden", 
//         marginLeft: "12px", 
//         margin: "0", 
//         borderRadius: "4px"

//       }}>
//         {job.equipment}
//       </h4>
//     </div>

//     {/* Job Details */}
//     <div style={{fontSize:"16px", fontWeight:"lighter", padding: "0 16px"}}>
//       <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
//         <span className='material-symbols-outlined'>location_on</span>
//         <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
//           {job.location.address} address
//         </h3>
//       </div>

//       <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
//         <span className='material-symbols-outlined'>Schedule</span>
//         <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
//           {job.duration.unit}
//         </h3>
//       </div>

//       <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
//         <span className='material-symbols-outlined'>calendar_month</span>
//         <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
//           {job.location.address} dato
//         </h3>
//       </div>
//     </div>

//     {/* Price */}
//     <div style={{ 
//       display: "flex", 
//       justifyContent: "center", 
//       width: "80%", 
//       marginTop: "12px", 
//       marginLeft: "auto",
//       marginRight: "auto",
//       marginBottom: "12px",
//       padding: "8px 0",
//       backgroundColor: "var(--color-muted-gray)",
//       borderRadius: "10px",
//     }}>
//       <span style={{ 
//         fontWeight: 900, 
//         color: "var(--color-price)",
//         fontSize: "17px"
//       }}>
//         {job.price}kr/ timen
//       </span>
//     </div>
//   </div>
// );

// export const Utforsk = ({ jobs }: UtforskProps) => {
//   return (
//     <div>
//       <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
//         <h3>rawr</h3>
//         <button>filter</button>
//       </div>
      
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
//         {jobs.map(job => (
//           <JobCard key={job._id} job={job} />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default Utforsk;