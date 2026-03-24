import { LayoutGrid, Heart, Bookmark, Shirt, Gauge } from 'lucide-react';

interface ProfileNavProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
}

export function ProfileNav({ activeTab, onTabChange }: ProfileNavProps) {
  const tabs = [
    { name: 'Jobs', icon: LayoutGrid },
    { name: 'Likes', icon: Heart },
    { name: 'Lists', icon: Bookmark },
    { name: 'Your wardrobe', icon: Shirt },
    { name: 'Seller Hub', icon: Gauge },
  ];

  return (
    <div className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between md:justify-center md:gap-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => onTabChange(tab.name)}
                className={`flex items-center gap-3 py-4.5 px-1 border-b-[3px] text-lg font-bold transition-all duration-200 mb-[-1.5px] whitespace-nowrap ${isActive
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
                  }`}
              >
                <Icon size={22} className={isActive ? 'text-black' : 'text-gray-500'} />
                <span className="hidden md:inline">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
