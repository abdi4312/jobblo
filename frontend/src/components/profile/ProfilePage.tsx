import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { ItemsGrid } from "./ProfileHeader/ItemsGrid";
import { ProfileNav } from "./ProfileHeader/ProfileNav";
import { Spinner } from "../Ui/Spinner";
import { useProfileLogic } from "../../features/profile/useProfileLogic";
import { BlockedUserView } from "./ProfilePageComponents/BlockedUserView";
import { CustomSwitcher } from "../Ui/CustomSwitcher";

export default function ProfilePage() {
  const {
    userId,
    userToDisplay,
    isOwnProfile,
    isLoading,
    activeTab,
    setActiveTab,
    profileType,
    handleProfileTypeChange,
    handleLogout,
    isBlockedByMe,
    navigate,
  } = useProfileLogic();

  if (userId && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!userToDisplay) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-4">
        <h2 className="text-2xl font-bold">Bruker ikke funnet</h2>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-white px-6 py-2 rounded-xl"
        >
          Gå hjem
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f0e8] min-h-screen -mt-6">
      <div className="hero-band h-[130px] bg-[#1a3a1a] relative">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle,#fff_1px,transparent_1px)] bg-[length:24px_24px]"></div>
      </div>
      
      <div className="max-w-[900px] mx-auto px-6 pb-12">
        <ProfileHeader
          user={userToDisplay}
          handlelogout={handleLogout}
          isOwnProfile={isOwnProfile}
          profileType={profileType}
        />

        {isBlockedByMe ? (
          <BlockedUserView />
        ) : (
          <>
            <div className="flex flex-col gap-6">
              {userToDisplay?.role !== "company" && (
                <div className="flex bg-white border border-black/5 rounded-full p-1 w-fit mb-2">
                  {[
                    { id: "seeker", label: "Som jobbsøker" },
                    { id: "poster", label: "Som oppdragsgiver" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleProfileTypeChange(opt.id as "seeker" | "poster")}
                      className={`px-5 py-2 text-[13px] rounded-full transition-all ${
                        profileType === opt.id
                          ? "bg-custom-green text-white font-medium shadow-sm"
                          : "text-black/40 hover:text-black/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <ProfileNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isOwnProfile={isOwnProfile}
                profileType={profileType}
                userRole={userToDisplay?.role}
              />
              
              <ItemsGrid
                activeTab={activeTab}
                user={userToDisplay}
                profileType={profileType}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
