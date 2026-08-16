import { useState } from 'react';
import { ProfileHeader } from './ProfileHeader/ProfileHeader';
import { ItemsGrid } from './ProfileHeader/ItemsGrid';
import { ProfileNav } from './ProfileHeader/ProfileNav';
import { BlockedUserView } from './ProfilePageComponents/BlockedUserView';
import { EditProfileSheet, type EditSection } from './EditProfileSheet';
import { ProfileCover } from './ProfileCover';
import { useProfileLogic } from '../../features/profile/useProfileLogic';

/**
 * A profile.
 *
 * The page ran on #f5f0e8 / #1a3a1a / #c8d8c8 — a cream-and-forest palette that appears
 * nowhere else on Jobblo — at a 9-to-13 px type scale, and it filled the gaps with
 * invented data: a hardcoded skills list ("Maling, Snekkering, Hagearbeid …") shown for
 * anyone with none, a fixed Mon/Wed/Fri/Sat availability grid nobody could set, a rating
 * histogram that always drew 100 % at five stars, and "Medlem siden desember 2019" for
 * accounts with no `createdAt`. All of it looked like real information about a person a
 * stranger is deciding whether to let into their home.
 *
 * What replaced it is the same brand tokens as the rest of the app, and only figures the
 * API actually returns — which turned out to be plenty: `getUserById` computes response
 * rate, response time, hire rate and completion rate on every fetch and none of it was
 * being shown.
 *
 * Editing is the other half. Every "Rediger" here opens {@link EditProfileSheet} over the
 * profile instead of navigating into the settings tree, so a change is: click, type,
 * Lagre — and you are still looking at your profile.
 */
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

  const [editSection, setEditSection] = useState<EditSection | null>(null);
  const openEditor = (section: EditSection = 'identity') => setEditSection(section);

  if (userId && isLoading) {
    return (
      <div className="min-h-screen bg-[#EFF0EA]">
        <ProfileCover className="h-40 sm:h-56" />
        <div className="mx-auto w-full max-w-300 px-5 pb-16 sm:px-8 lg:px-12">
          <div className="jb-skeleton -mt-14 h-56 rounded-3xl sm:-mt-18" />
          <div className="mt-5 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="jb-skeleton h-10 w-28 rounded-full" />
            ))}
          </div>
          <div className="jb-skeleton mt-5 h-80 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!userToDisplay) {
    return (
      <div className="flex min-h-125 flex-col items-center justify-center gap-4 bg-[#EFF0EA] px-5 text-center">
        <h1 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
          Fant ikke brukeren
        </h1>
        <p className="max-w-90 text-[0.9375rem] leading-relaxed text-[#63665F]">
          Profilen finnes ikke lenger, eller lenken er feil.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-11.5 items-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
        >
          Til forsiden
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      {/* Generated from the user's id — see {@link ProfileCover}. */}
      <ProfileCover seed={userToDisplay?._id} className="h-40 sm:h-56" />

      <div className="mx-auto w-full max-w-300 px-5 pb-16 sm:px-8 lg:px-12">
        <ProfileHeader
          user={userToDisplay}
          handlelogout={handleLogout}
          isOwnProfile={isOwnProfile}
          profileType={profileType}
          onEdit={openEditor}
        />

        {isBlockedByMe ? (
          <BlockedUserView />
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {userToDisplay?.role !== 'company' && (
              <div className="flex w-fit gap-0.5 rounded-full border border-[#E6E7E1] bg-white p-1">
                {[
                  { id: 'seeker', label: 'Jobbsøker' },
                  { id: 'poster', label: 'Oppdragsgiver' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleProfileTypeChange(option.id as 'seeker' | 'poster')}
                    aria-pressed={profileType === option.id}
                    className={`h-9 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                      profileType === option.id
                        ? 'bg-[#EAF1E9] text-[#2E6641]'
                        : 'text-[#63665F] hover:text-[#0B0B0B]'
                    }`}
                  >
                    {option.label}
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
              onEdit={isOwnProfile ? openEditor : undefined}
            />
          </div>
        )}
      </div>

      <EditProfileSheet
        user={userToDisplay}
        open={editSection !== null}
        section={editSection ?? 'identity'}
        onClose={() => setEditSection(null)}
      />
    </div>
  );
}
