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
    <div className="">
      {/* <div className="bg-white border-b border-gray-100"> */}
      <div className="">
        <ProfileHeader
          user={userToDisplay}
          handlelogout={handleLogout}
          isOwnProfile={isOwnProfile}
          profileType={profileType}
        />
      </div>

      {isBlockedByMe ? (
        <BlockedUserView />
      ) : (
        <>
          {userToDisplay?.role !== "company" && (
            <CustomSwitcher
              options={[
                { id: "seeker", label: "Jobbsøker" },
                { id: "poster", label: "Oppdragsgiver" },
              ]}
              value={profileType}
              onChange={(val) =>
                handleProfileTypeChange(val as "seeker" | "poster")
              }
            />
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
        </>
      )}
    </div>
  );
}
