import { useUserStore } from '../../../stores/userStore';

/**
 * The tab strip under the identity card.
 *
 * It was a translucent grey bar with 11 px labels in `text-black/40` — below the contrast
 * floor and hard to tell apart from the disabled state. It is the same pill row the rest
 * of the app uses now, and it sits on the page rather than on a panel, so the cards below
 * it are the only surfaces in the column.
 */

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
  profileType = 'seeker',
  userRole,
}: ProfileNavProps) {
  const userStoreUser = useUserStore((state) => state.user);

  const seekerTabs = ['Om meg', 'Fullførte', 'Vurderinger'];
  const posterTabs = ['Aktive', 'Tidligere', 'Vurderinger'];
  // 'Om oss' was written and styled for companies but never reachable: the company tab
  // list started at 'Aktive', so a company's own description, services, areas and contact
  // details rendered to nothing.
  const companyTabs = ['Om oss', 'Aktive', 'Tidligere', 'Vurderinger'];

  const tabs =
    profileType === 'seeker'
      ? seekerTabs
      : userRole === 'company' || userStoreUser?.role === 'company'
        ? companyTabs
        : posterTabs;

  return (
    <div
      role="tablist"
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4.5 text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
              isActive
                ? 'bg-[#0B0B0B] text-white'
                : 'border border-[#E6E7E1] bg-white text-[#63665F] hover:border-[#2E6641]/45 hover:text-[#0B0B0B]'
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
