import { useUserStore } from "../../../stores/userStore";
import { ChevronDown, Gem } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileNav } from "./ProfileNav";

interface User {
  _id: string;
  name: string;
  lastName?: string;
  avatarUrl?: string;
  email: string;
}

export function ProfileHeader({ handlelogout, activeTab, onTabChange }: { handlelogout: () => void, activeTab: string, onTabChange: (tabName: string) => void }) {
  const user = useUserStore((state: { user: User | null }) => state.user);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    handlelogout();
  };

  return (
    <>
      <div className="bg-white px-4 sm:px-8 pt-8 pb-10">
        <div className="max-w-300 mx-auto flex flex-col items-center sm:items-start sm:flex-row gap-8 sm:gap-10 relative">
          {/* Profile Picture Column */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <div className="w-32 h-32 sm:w-42 sm:h-42 rounded-full overflow-hidden bg-gray-100 border border-gray-100 shadow-inner">
                <img
                  src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
                  alt="Profile"
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none sm:pointer-events-auto">
                <button
                  onClick={() => navigate("/settings/picture")}
                  className="bg-white/90 backdrop-blur-sm border border-gray-200 px-4 py-1.5 rounded-full text-sm font-bold text-gray-800 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-white"
                >
                  Edit photo
                </button>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{user?.name || "Bruker Name"}</h1>
            </div>
          </div>

          {/* User Info & Actions Column */}
          <div className="flex flex-col items-center sm:items-start flex-1 sm:pt-1">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-none mb-3">
              @{user?.name.toLowerCase().replace(/\s+/g, '') || "guest"}
            </h2>

            <div className="flex gap-4 mb-5">
              <div className="cursor-pointer hover:underline text-[16px]">
                <span className="font-bold text-black">{0}</span> <span className="text-gray-900 font-medium text-[16px]">followers</span>
              </div>
              <div className="cursor-pointer hover:underline text-[16px]">
                <span className="font-bold text-black">{0}</span> <span className="text-gray-900 font-medium text-[16px]">following</span>
              </div>
            </div>

            <div className="relative flex gap-3">
              <button className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm relative group">
                <Gem size={18} className="text-gray-800" />
                <span>Rewards</span>
                {/* <span className="absolute -top-1.5 -right-1 bg-[#EA1717] ring-2 ring-white text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                  9+
                </span> */}
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm ${isMenuOpen ? 'bg-gray-50' : ''}`}
                >
                  <span>More</span>
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMenuOpen && (
                  <div className="absolute top-[calc(100%+12px)] right-0 bg-white border border-gray-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] py-4 px-5 min-w-[260px] z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => navigate("/settings")}
                        className="flex items-center w-full text-lg font-medium text-black hover:text-gray-600 transition-colors"
                      >
                        Settings
                      </button>
                      <button
                        onClick={handleLogoutClick}
                        className="flex items-center w-full text-lg font-medium text-black hover:text-gray-600 transition-colors"
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProfileNav activeTab={activeTab} onTabChange={onTabChange} />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsLogoutModalOpen(false)} />
          <div className="bg-white rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.1)] w-full max-w-xl relative z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-10 sm:p-14">
              <div className="flex items-center gap-6 mb-4">
                <div className="w-16 h-16 bg-[#FDB927] rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white font-black text-4xl select-none leading-none">!</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Er du sikker?</h3>
              </div>
              <p className="text-2xl text-gray-500 font-medium mb-12 ml-[88px] tracking-tight">
                Vil du virkelig logge ut?
              </p>

              <div className="flex flex-col sm:flex-row justify-end gap-4">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="px-14 py-5 rounded-4xl border-2 border-gray-50 text-xl font-black text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmLogout}
                  className="px-14 py-5 rounded-4xl bg-[#F0811A] text-xl font-black text-white hover:bg-[#D97015] transition-all shadow-lg shadow-orange-100"
                >
                  Ja, logg ut
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
