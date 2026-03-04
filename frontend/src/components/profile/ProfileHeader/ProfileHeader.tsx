import { useUserStore } from "../../../stores/userStore";
import { useState, useEffect } from "react";
import mainLink from "../../../api/mainURLs";
import { Calendar, LogOut, MapPin, Pencil, ShieldCheck, ShieldX } from "lucide-react";
import ProfileCard from "./ProfileCard";

export function ProfileHeader({ handlelogout }: { handlelogout: () => void }) {
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
    // <div className={styles.container}>
    //   <div className={styles.topSection}>
    //     <div className={styles.profileImageContainer}>
    //       <img 
    //         src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"} 
    //         alt="Profile" 
    //         className={styles.profileImage}
    //       />
    //     </div>
    //     <div className={styles.profileInfo}>
    //       <div className={styles.nameAndEmail}>
    //         <span className={styles.name}>{user?.name || "Guest"}</span>
    //         <span className={styles.email}>{user?.email || "Not logged in"}</span>
    //       </div>
    //       <div className={styles.infoRow}>
    //         <div className={styles.memberSince}>medlem siden {memberSince}</div>
    //       </div>
    //     </div>
    //   </div>

    //   {/* Stats Cards */}
    //   <div className={styles.statsContainer}>
    //     <div className={styles.statCard}>
    //       <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
    //         task_alt
    //       </span>
    //       <div className={styles.statInfo}>
    //         <div className={styles.statValue}>{completedJobs}</div>
    //         <div className={styles.statLabel}>Fullførte</div>
    //       </div>
    //     </div>

    //     <div className={styles.statCard}>
    //       <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
    //         trending_up
    //       </span>
    //       <div className={styles.statInfo}>
    //         <div className={styles.statValue}>{activeJobs}</div>
    //         <div className={styles.statLabel}>Aktive</div>
    //       </div>
    //     </div>

    //     <div className={styles.statCard}>
    //       <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-accent)' }}>
    //         stars
    //       </span>
    //       <div className={styles.statInfo}>
    //         <div className={styles.statValue}>{user?.averageRating ? user.averageRating.toFixed(1) : '0.0'}</div>
    //         <div className={styles.statLabel}>Vurdering</div>
    //       </div>
    //     </div>
    //   </div>
    // </div>
    <>
      <div className="flex justify-between bg-[#FFFFFFB2] px-6 py-14">
        <div className="flex justify-center items-center gap-6">
          <div className="relative w-fit">
            <img
              src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
              alt="Profile"
              className="max-w-32 max-h-32 min-w-25 min-h-25 rounded-full object-cover border-[5px] bg-white border-white shadow-md"
            />
          </div>

          <div>
            <div className="flex gap-2">
              <h2 className="text-[30px] leading-9 font-bold">{user?.name || "Guest"}</h2>
              <div className="flex bg-[#2F7E4721] text-[#2F7E47] px-4.5 py-[7.5px] gap-2 rounded-4xl justify-center items-center">
                <span>{user?.verified ? <ShieldCheck size={14} /> : <ShieldX size={14} />}</span>
                <span className="text-base leading-[100%]">{user?.verified ? "Verified" : "Not verified"}</span>
              </div>
            </div>
            <p className="text-[16px] font-normal text-[#4A5565]">{user?.email || "Not logged in"}</p>
            <div className="flex text-[#6A7282] text-[14px] font-normal gap-4">
              <div className="flex justify-center items-center gap-1">
                <span><Calendar size={16} /></span>
                <p>medlem siden {memberSince}</p>
              </div>
              <div className="flex justify-center items-center gap-1">
                <span><MapPin size={16} /></span>
                <span>{user?.address || "No address provided"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <button className="text-[16px] font-medium text-[#364153] flex items-center gap-2 shadow-md px-3 py-1.5 rounded-4xl cursor-pointer">
            <Pencil size={16} className="text-[#3F8F6B]" />
            Rediger profil</button>
          <button className="text-[16px] font-medium text-[#EA1717] flex gap-2 shadow-md px-3 py-1.5
            rounded-4xl justify-center items-center cursor-pointer hover:bg-[#EA1717] hover:text-[#FFFFFF] transition-all duration-300" onClick={handlelogout}>
            <LogOut size={16} className="" />
            Log Out</button>
        </div>
      </div>

      <div>
        <ProfileCard user={user} activeJobs={activeJobs} completedJobs={completedJobs} />
      </div>
    </>
  );
}
