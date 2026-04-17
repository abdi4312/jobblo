import { LayoutGrid, Heart, Bookmark } from 'lucide-react';

interface ProfileNavProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  isOwnProfile?: boolean;
}

export function ProfileNav({ activeTab, onTabChange, isOwnProfile = false }: ProfileNavProps) {
  // If it's another user's profile, show 'Oppdrag' and 'Lister'
  const allTabs = [
    { name: 'Oppdrag', icon: LayoutGrid },
    { name: 'Liker', icon: Heart },
    { name: 'Lister', icon: Bookmark },
  ];

  const tabs = isOwnProfile ? allTabs : [allTabs[0], allTabs[2]];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-300 mx-auto px-4 sm:px-6">
        <div className="flex justify-around md:justify-around md:gap-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => onTabChange(tab.name)}
                className={`flex items-center gap-3 py-4.5 px-1 border-b-[3px] w-full justify-center text-lg font-bold mb-[-1.5px] whitespace-nowrap ${isActive
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-900'
                  }`}
              >
                <Icon size={22} className={isActive ? 'text-black' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
                <span className='hidden md:flex'>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
