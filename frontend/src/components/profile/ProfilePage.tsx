import { ProfileHeader } from './ProfileHeader/ProfileHeader';
import { ItemsGrid } from './ProfileHeader/ItemsGrid';
import { ProfileNav } from './ProfileHeader/ProfileNav';
import { Spinner } from '../Ui/Spinner';
import { useProfileLogic } from '../../features/profile/useProfileLogic';
import { BlockedUserView } from './ProfilePageComponents/BlockedUserView';
import { CustomSwitcher } from '../Ui/CustomSwitcher';

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
          onClick={() => navigate('/')}
          className="bg-primary text-white px-6 py-2 rounded-xl"
        >
          Gå hjem
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f0e8] min-h-screen">
      <div className="hero-band h-[80px] sm:h-[120px] bg-[#1a3a1a] relative">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle,#fff_1px,transparent_1px)] bg-[length:24px_24px]"></div>
      </div>

      <div className="max-w-[960px] mx-auto px-3 sm:px-4 pb-12 sm:pb-16">
        <ProfileHeader
          user={userToDisplay}
          handlelogout={handleLogout}
          isOwnProfile={isOwnProfile}
          profileType={profileType}
        />

        {isBlockedByMe ? (
          <BlockedUserView />
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5 mt-4 sm:mt-5">
            {userToDisplay?.role !== 'company' && (
              <div className="flex bg-white/60 backdrop-blur-sm border border-black/5 rounded-lg p-0.5 w-fit">
                {[
                  { id: 'seeker', label: 'Jobbsøker' },
                  { id: 'poster', label: 'Oppdragsgiver' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleProfileTypeChange(opt.id as 'seeker' | 'poster')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] rounded-md transition-all font-medium ${
                      profileType === opt.id
                        ? 'bg-[#1a3a1a] text-white shadow-sm'
                        : 'text-black/50 hover:text-black/70 hover:bg-white/80'
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

            <ItemsGrid activeTab={activeTab} user={userToDisplay} profileType={profileType} />
          </div>
        )}
      </div>
    </div>
  );
}
