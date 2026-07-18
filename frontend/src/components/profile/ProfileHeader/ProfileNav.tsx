import { useUserStore } from '../../../stores/userStore';

interface ProfileNavProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  isOwnProfile?: boolean;
  profileType?: 'seeker' | 'poster';
  userRole?: string;
}

export function ProfileNav({
  activeTab,
  onTabChange,
  isOwnProfile = false,
  profileType = 'seeker',
  userRole,
}: ProfileNavProps) {
  const userStoreUser = useUserStore((state) => state.user);
  const seekerTabs = ['Om meg', 'Fullførte', 'Vurderinger', 'Portfolio', 'Sertifiseringer'];
  const posterTabs = ['Aktive', 'Tidligere', 'Vurderinger'];
  const companyTabs = ['Portfolio', 'Sertifiseringer', 'Aktive', 'Tidligere', 'Vurderinger'];

  const tabs =
    profileType === 'seeker'
      ? seekerTabs
      : userRole === 'company' || userStoreUser?.role === 'company'
        ? companyTabs
        : posterTabs;

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-lg border border-black/5 px-1 flex gap-0.5 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-[11px] sm:text-[12px] font-medium transition-all rounded-md whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-[#1a3a1a] text-white shadow-sm'
                : 'text-black/40 hover:text-black/60 hover:bg-white/60'
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
