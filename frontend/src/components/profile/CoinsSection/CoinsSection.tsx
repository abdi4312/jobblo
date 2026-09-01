/**
 * NOTE: nothing renders this component.
 *
 * It belongs to the profile implementation that components/profile/ProfilePage.tsx
 * replaced — `<CoinsSection />` appears in no JSX anywhere in the app, which is why the
 * BankID card it used to hold was invisible on /profile. The card now lives in the real
 * profile tree (ProfilePage for mobile, ItemsGrid's right column for desktop).
 *
 * Left in place rather than deleted because it is still exported from
 * components/profile/index.ts and removing it is unrelated cleanup; its import is
 * repointed so it keeps compiling.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../../stores/userStore';
import { Coins } from 'lucide-react';
import { IdentityVerificationCard } from '../IdentityVerificationCard';

export function CoinsSection() {
  const { fetchProfile } = useUserStore((state) => state);
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const userPoints = user?.pointsBalance || 0;

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUseCoins = () => {
    navigate('/coins');
  };

  return (
    <>
      <div className=" grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-2.5 p-6 rounded-[14px] shadow-md">
          <div className="flex justify-between">
            <h2 className="text-[16px] font-normal text-custom-black">Dine Coins</h2>
            <div className="text-custom-green flex items-center gap-3">
              <span>
                <Coins size={32} />
              </span>
              <span className="text-[48px] font-bold leading-12">{userPoints}</span>
            </div>
          </div>

          <div className="cursor-pointer" onClick={handleUseCoins}>
            <button className="bg-custom-green w-full py-3 text-[16px] text-white font-semibold rounded-xl cursor-pointer">
              Bruk Coins
            </button>
          </div>
        </div>
        <IdentityVerificationCard user={user} isOwnProfile />
      </div>
    </>
  );
}
