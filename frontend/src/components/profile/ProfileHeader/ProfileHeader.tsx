import { useUserStore } from "../../../stores/userStore";
import { useState, useEffect } from "react";
import mainLink from "../../../api/mainURLs";
import { Calendar, CircleCheck, LogOut, MapPin, Pencil, ShieldCheck, ShieldX } from "lucide-react";
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
    <>
      <div className="flex flex-col md:flex-row md:justify-between bg-[#FFFFFFB2] px-4 md:px-6 py-4 md:py-14">
        <div className="flex md:justify-center md:items-center gap-6">
          <div className="relative w-fit">
            <img
              src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
              alt="Profile"
              className="max-w-17 max-h-17 sm:max-w-32 md:max-h-32 sm:min-w-25 sm:min-h-25 rounded-full object-cover border-[5px] bg-white border-white shadow-md"
            />
          </div>

          {/* <div className="relative w-fit">
            <img
              src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-[5px] border-white shadow-lg bg-white"
            />

            <div className="absolute bottom-6 mdbottom-0 right-0 transform translate-x-1 translate-y-1">
              <div className={`${user?.verified ? 'bg-[#4C8D71]' : 'bg-red-500'} rounded-full border-[2px] border-white p-1 md:p-1.5 shadow-md flex items-center justify-center`}>
                {user?.verified ? (
                  <ShieldCheck
                    size={20}
                    className="text-white md:w-[22px] md:h-[22px]"
                    strokeWidth={2.5}
                  />
                ) : (
                  <ShieldX
                    size={20}
                    className="text-white md:w-[22px] md:h-[22px]"
                    strokeWidth={2.5}
                  />
                )}
              </div>
            </div>
          </div> */}

          <div>
            <div className="flex flex-wrap gap-2">
              <h2 className="text-[18px] md:text-[30px] leading-9 font-bold">{user?.name || "Guest"}</h2>
              <div className="flex bg-[#2F7E4721] text-[#2F7E47] px-4.5 py-[7.5px] gap-2 rounded-4xl justify-center items-center">
                <span>{user?.verified ? <ShieldCheck size={14} /> : <ShieldX size={14} />}</span>
                <span className="text-[12px] md:text-base leading-[100%]">{user?.verified ? "Verified" : "Not verified"}</span>
              </div>
            </div>
            <p className="text-[16px] font-normal text-[#4A5565]">{user?.email || "Not logged in"}</p>
            <div className="flex flex-col sm:flex-row text-[#6A7282] text-[12px] md:text-[14px] font-normal gap-2 md:gap-4 pt-2">
              <div className="flex md:justify-center items-center gap-1">
                <span><Calendar size={16} /></span>
                <p>medlem siden {memberSince}</p>
              </div>
              <div className="flex md:justify-center items-center gap-1">
                <span><MapPin size={16} /></span>
                <span>{user?.address || "No address provided"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-6 pt-4 md:pt-0">
          <button className="text-[16px] w-full font-medium text-[#364153] flex justify-center items-center gap-2 shadow-md px-3 py-1.5 rounded-4xl cursor-pointer">
            <Pencil size={16} className="text-[#3F8F6B]" />
            Rediger profil</button>
          <button className="text-[16px] w-full font-medium text-[#EA1717] flex gap-2 shadow-md px-3 py-1.5
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
